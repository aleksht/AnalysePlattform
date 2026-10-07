import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractStructured } from "./agent";
import { SYNTHESIS_SYSTEM, synthesisUserPrompt, type StockContext } from "./prompts";
import { STEP_LABELS, THEME_LABELS, synthesisOutputSchema, type Category } from "./schema";
import { compareScores, computeThemeScores, type ThemeScores, type Trend } from "./trend";
import type { Usage } from "./usage";

type LinkedRef = { finding_id: string; url: string };

export type Report = {
  headline: string;
  takeaways: { text: string; sentiment: "positiv" | "nøytral" | "negativ"; refs: LinkedRef[] }[];
  changes: { text: string; direction: "bedre" | "verre" | "uendret" | "ny"; refs: LinkedRef[] }[];
  watch_points: { text: string; refs: LinkedRef[] }[];
  /** Røde flagg slått sammen på tvers av kategorier. Mangler i rapporter laget før dette fantes. */
  red_flags?: { text: string; category: Category; refs: LinkedRef[] }[];
  data_gaps: string[];
};

export type SynthesisResult = { report: Report | null; trend: Trend; theme_scores: ThemeScores };

type FindingRow = {
  id: string;
  category: Category;
  theme: string;
  claim: string;
  sentiment: "positiv" | "nøytral" | "negativ";
  evidence_strength: "sterk" | "middels" | "svak";
  is_red_flag: boolean;
  published_at: string | null;
  source_url: string;
};

const ARROW: Record<string, string> = { bedre: "bedre", verre: "verre", uendret: "uendret", ny: "ny", borte: "ingen funn nå" };

/**
 * Syntesesteget: beregner stemning per tema, sammenligner med forrige kjøring
 * og lar modellen skrive hovedkonklusjoner som viser til konkrete funn.
 */
export async function runSynthesis(
  db: SupabaseClient,
  ctx: { runId: string; stockId: string; stock: StockContext },
  usage: Usage,
): Promise<{ result: SynthesisResult; usage: Usage }> {
  const [{ data: findingRows }, { data: stepRows }, { data: prevRun }] = await Promise.all([
    db
      .from("findings")
      .select("id, category, theme, claim, sentiment, evidence_strength, is_red_flag, published_at, source_url")
      .eq("run_id", ctx.runId),
    db.from("run_steps").select("step, status, result").eq("run_id", ctx.runId),
    db
      .from("research_runs")
      .select("id, finished_at, theme_scores, report")
      .eq("stock_id", ctx.stockId)
      .eq("status", "done")
      .neq("id", ctx.runId)
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const findings = (findingRows ?? []) as FindingRow[];
  const themeScores = computeThemeScores(findings);
  const trend = compareScores(
    themeScores,
    (prevRun?.theme_scores as ThemeScores | null) ?? null,
    prevRun ? { id: prevRun.id as string, finished_at: prevRun.finished_at as string | null } : null,
  );

  if (findings.length === 0) {
    return { result: { report: null, trend, theme_scores: themeScores }, usage };
  }

  // Funnene nummereres F1, F2 … slik at modellen bare kan vise til funn som finnes
  const refs = findings.map((f, i) => ({ ref: `F${i + 1}`, f }));
  const byRef = new Map(refs.map((r) => [r.ref, r.f]));
  const findingsText = refs
    .map(
      ({ ref, f }) =>
        `[${ref}] ${STEP_LABELS[f.category]} / ${THEME_LABELS[f.theme] ?? f.theme} – ${f.sentiment}, ${f.evidence_strength} evidens${
          f.is_red_flag ? ", RØDT FLAGG" : ""
        }${f.published_at ? `, ${f.published_at}` : ""}: ${f.claim}`,
    )
    .join("\n");

  const sectionsText = (stepRows ?? [])
    .filter((s) => s.status === "done" && s.step !== "oversikt" && s.step !== "syntese")
    .map((s) => `${STEP_LABELS[s.step as Category]}: ${(s.result as { summary?: string } | null)?.summary ?? ""}`)
    .join("\n");

  const trendText = trend.previous_run_id
    ? trend.entries
        .filter((e) => e.direction !== "ny")
        .map(
          (e) =>
            `${e.key === "overall" ? "Totalt" : e.key}: ${ARROW[e.direction]} (${e.previous?.toFixed(2) ?? "–"} → ${
              e.current?.toFixed(2) ?? "–"
            })${e.uncertain ? " – få funn, usikkert" : ""}`,
        )
        .join("\n")
    : "Ingen tidligere kjøring.";

  const prevReport = prevRun?.report as Report | null;
  const previousText = prevReport
    ? `${prevReport.headline}\n${prevReport.takeaways.map((t) => `- ${t.text}`).join("\n")}`
    : "Ingen tidligere rapport.";

  const ids = refs.map((r) => r.ref) as [string, ...string[]];
  const { data, usage: u } = await extractStructured({
    schema: synthesisOutputSchema(ids),
    system: SYNTHESIS_SYSTEM,
    effort: "medium",
    prompt: synthesisUserPrompt({
      stock: ctx.stock,
      findings: findingsText,
      sections: sectionsText,
      trend: trendText,
      previous: previousText,
    }),
    usage,
  });

  const link = (list: string[]): LinkedRef[] =>
    [...new Set(list)].flatMap((ref) => {
      const f = byRef.get(ref);
      return f ? [{ finding_id: f.id, url: f.source_url }] : [];
    });
  // Punkter uten gyldig kilde tas ikke med
  const report: Report = {
    headline: data.headline,
    takeaways: data.takeaways
      .map((t) => ({ text: t.text, sentiment: t.sentiment, refs: link(t.finding_refs) }))
      .filter((t) => t.refs.length > 0),
    changes: trend.previous_run_id
      ? data.changes
          .map((c) => ({ text: c.text, direction: c.direction, refs: link(c.finding_refs) }))
          .filter((c) => c.refs.length > 0)
      : [],
    watch_points: data.watch_points
      .map((w) => ({ text: w.text, refs: link(w.finding_refs) }))
      .filter((w) => w.refs.length > 0),
    red_flags: data.red_flags
      .map((r) => ({ text: r.text, category: r.category, refs: link(r.finding_refs) }))
      .filter((r) => r.refs.length > 0)
      .slice(0, 6),
    data_gaps: data.data_gaps,
  };

  return { result: { report, trend, theme_scores: themeScores }, usage: u };
}
