import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractStructured, runResearch, type ResearchState } from "./agent";
import type { StockContext } from "./prompts";
import {
  CATEGORY_THEMES,
  STEP_LABELS,
  StoredFindingSchema,
  categoryOutputSchema,
  normalizeDate,
  overviewOutputSchema,
  type Category,
  type CategoryOutput,
  type Step,
  type StoredFinding,
} from "./schema";
import type { SeenSource } from "./sources";
import type { Usage } from "./usage";
import { runSynthesis, type SynthesisResult } from "./synthesis";

/** Det som lagres i run_steps.state mellom funksjonskall. */
export type StepState = {
  research?: ResearchState;
  notes?: string;
  sources?: SeenSource[];
};

type LinkedSource = { url: string; title: string | null };

export type CategoryResult = {
  summary: string;
  themes: { theme: string; coverage: "god" | "begrenset" | "lite"; coverage_note: string | null; summary: string }[];
  key_points?: { point: string; period: string; source: LinkedSource }[];
  promises?: {
    promise: string;
    said_when: string;
    status: "levert" | "delvis" | "ikke_levert" | "for_tidlig";
    comment: string;
    source: LinkedSource;
  }[];
  dropped_findings?: number;
};

export type OverviewResult = {
  overview: {
    description: string;
    segments: { name: string; description: string; share_of_revenue: string | null }[];
    key_customers: { name: string; note: string; source_url: string }[];
    competitors: { name: string; note: string; source_url: string }[];
    coverage_note: string | null;
  } | null;
};

export type StepOutcome =
  | { kind: "yield"; state: StepState; usage: Usage }
  | { kind: "checkpoint"; state: StepState; usage: Usage }
  | { kind: "done"; result: CategoryResult | OverviewResult | SynthesisResult; usage: Usage };

type Ctx = {
  db: SupabaseClient;
  runId: string;
  stockId: string;
  userId: string;
  step: Step;
  stock: StockContext;
  deadline: number;
};

/**
 * Kjører ett steg så langt tiden tillater. Returnerer "checkpoint" etter researchfasen,
 * slik at notatene lagres før uttrekket. Da slipper vi å søke på nytt hvis uttrekket feiler.
 */
export async function advanceStep(ctx: Ctx, state: StepState | null, usage: Usage): Promise<StepOutcome> {
  if (ctx.step === "syntese") {
    const { result, usage: u } = await runSynthesis(ctx.db, ctx, usage);
    return { kind: "done", result, usage: u };
  }
  const researchStep = ctx.step;

  if (state?.notes === undefined) {
    const r = await runResearch({
      step: researchStep,
      stock: ctx.stock,
      state: state?.research ?? null,
      usage,
      deadline: ctx.deadline,
    });
    if (r.kind === "yield") return { kind: "yield", state: { research: r.state }, usage: r.usage };
    return { kind: "checkpoint", state: { notes: r.notes, sources: r.sources }, usage: r.usage };
  }

  const notes = state.notes;
  const sources = state.sources ?? [];

  if (ctx.step === "oversikt") {
    if (!notes || sources.length === 0) return { kind: "done", result: { overview: null }, usage };
    const ids = sources.map((s) => s.ref) as [string, ...string[]];
    const { data, usage: u } = await extractStructured({
      schema: overviewOutputSchema(ids),
      stepLabel: STEP_LABELS.oversikt,
      stock: ctx.stock,
      notes,
      sources,
      usage,
    });
    const byRef = new Map(sources.map((s) => [s.ref, s]));
    const link = <T extends { source_ref: string }>(list: T[]) =>
      list.flatMap(({ source_ref, ...rest }) => {
        const s = byRef.get(source_ref);
        return s ? [{ ...rest, source_url: s.url }] : [];
      });
    const overview = {
      description: data.description,
      segments: data.segments,
      key_customers: link(data.key_customers),
      competitors: link(data.competitors),
      coverage_note: data.coverage_note,
    };
    await saveSources(ctx, sources, [...overview.key_customers, ...overview.competitors].map((x) => x.source_url), null);
    return { kind: "done", result: { overview }, usage: u };
  }

  const category = ctx.step as Category;
  if (!notes || sources.length === 0) {
    await replaceFindings(ctx, category, []);
    return { kind: "done", result: emptyCategoryResult(category), usage };
  }

  const ids = sources.map((s) => s.ref) as [string, ...string[]];
  const { data, usage: u } = await extractStructured({
    schema: categoryOutputSchema(category, ids),
    stepLabel: STEP_LABELS[category],
    stock: ctx.stock,
    notes,
    sources,
    usage,
  });
  const output = data as CategoryOutput;
  const byRef = new Map(sources.map((s) => [s.ref, s]));
  const linked = (ref: string): LinkedSource | null => {
    const s = byRef.get(ref);
    return s ? { url: s.url, title: s.title } : null;
  };

  // Valider hvert funn mot lagringsskjemaet. Funn uten gyldig kilde forkastes.
  const findings: StoredFinding[] = [];
  let dropped = 0;
  for (const f of output.findings) {
    const src = byRef.get(f.source_ref);
    const candidate = StoredFindingSchema.safeParse({
      claim: f.claim,
      category,
      theme: f.theme,
      sentiment: f.sentiment,
      quote: f.quote?.trim() ? f.quote.trim().slice(0, 1000) : null,
      is_paraphrase: f.is_paraphrase,
      source_url: src?.url,
      source_type: f.source_type,
      published_at: normalizeDate(f.published_at) ?? normalizeDate(src?.page_age),
      evidence_strength: f.evidence_strength,
      is_red_flag: f.is_red_flag,
    });
    if (candidate.success) findings.push(candidate.data);
    else dropped++;
  }

  const sourceIdByUrl = await saveSources(
    ctx,
    sources,
    [
      ...findings.map((f) => f.source_url),
      ...(output.key_points ?? []).map((k) => byRef.get(k.source_ref)?.url),
      ...(output.promises ?? []).map((p) => byRef.get(p.source_ref)?.url),
    ].filter((u): u is string => Boolean(u)),
    null,
    new Map(findings.map((f) => [f.source_url, { type: f.source_type, date: f.published_at }])),
  );
  await replaceFindings(ctx, category, findings, sourceIdByUrl);

  // Sørg for at alle temaene er med, også de modellen utelot
  const themes = CATEGORY_THEMES[category]
    .filter((t) => t !== "annet")
    .map(
      (t) =>
        output.themes.find((x) => x.theme === t) ?? {
          theme: t,
          coverage: "lite" as const,
          coverage_note: "Fant lite offentlig tilgjengelig informasjon om dette temaet.",
          summary: "",
        },
    );
  const annet = output.themes.find((x) => x.theme === "annet");
  if (annet) themes.push(annet);

  const result: CategoryResult = {
    summary: output.summary,
    themes,
    dropped_findings: dropped,
  };
  if (category === "ledelse") {
    result.key_points = (output.key_points ?? []).flatMap((k) => {
      const s = linked(k.source_ref);
      return s ? [{ point: k.point, period: k.period, source: s }] : [];
    });
    result.promises = (output.promises ?? []).flatMap((p) => {
      const s = linked(p.source_ref);
      return s ? [{ promise: p.promise, said_when: p.said_when, status: p.status, comment: p.comment, source: s }] : [];
    });
  }
  return { kind: "done", result, usage: u };
}

function emptyCategoryResult(category: Category): CategoryResult {
  return {
    summary: "Agenten fant ingen brukbare kilder for denne kategorien.",
    themes: CATEGORY_THEMES[category]
      .filter((t) => t !== "annet")
      .map((t) => ({
        theme: t,
        coverage: "lite" as const,
        coverage_note: "Fant lite offentlig tilgjengelig informasjon om dette temaet.",
        summary: "",
      })),
  };
}

/** Lagrer de kildene som faktisk brukes, og returnerer id per URL. */
async function saveSources(
  ctx: Ctx,
  seen: SeenSource[],
  urls: string[],
  defaultType: string | null,
  meta?: Map<string, { type: string; date: string | null }>,
): Promise<Map<string, string>> {
  const wanted = [...new Set(urls)];
  if (wanted.length === 0) return new Map();
  const byUrl = new Map(seen.map((s) => [s.url, s]));
  const rows = wanted.map((url) => {
    const s = byUrl.get(url);
    const m = meta?.get(url);
    return {
      user_id: ctx.userId,
      run_id: ctx.runId,
      stock_id: ctx.stockId,
      url,
      title: s?.title ?? null,
      source_type: m?.type ?? defaultType ?? "annet",
      published_at: m?.date ?? normalizeDate(s?.page_age),
    };
  });
  // Kildetype fra funnene er mer presis enn standardverdien, så den får overskrive
  const { error } = await ctx.db.from("sources").upsert(rows, { onConflict: "run_id,url", ignoreDuplicates: !meta });
  if (error) throw new Error(`Kunne ikke lagre kilder: ${error.message}`);

  const { data, error: selErr } = await ctx.db
    .from("sources")
    .select("id, url")
    .eq("run_id", ctx.runId)
    .in("url", wanted);
  if (selErr) throw new Error(`Kunne ikke lese kilder: ${selErr.message}`);
  return new Map((data ?? []).map((r) => [r.url as string, r.id as string]));
}

/** Erstatter funnene for kategorien, så et nytt forsøk ikke gir duplikater. */
async function replaceFindings(
  ctx: Ctx,
  category: Category,
  findings: StoredFinding[],
  sourceIdByUrl: Map<string, string> = new Map(),
) {
  const del = await ctx.db.from("findings").delete().eq("run_id", ctx.runId).eq("category", category);
  if (del.error) throw new Error(`Kunne ikke rydde funn: ${del.error.message}`);
  if (findings.length === 0) return;
  const { error } = await ctx.db.from("findings").insert(
    findings.map((f) => ({
      ...f,
      user_id: ctx.userId,
      run_id: ctx.runId,
      stock_id: ctx.stockId,
      source_id: sourceIdByUrl.get(f.source_url) ?? null,
    })),
  );
  if (error) throw new Error(`Kunne ikke lagre funn: ${error.message}`);
}
