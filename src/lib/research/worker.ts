import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeError } from "./errors";
import { MAX_PARALLEL_STEPS, MAX_STEP_ATTEMPTS, MIN_MS_FOR_REQUEST } from "./config";
import { CATEGORIES, STEP_LABELS, type Step } from "./schema";
import { computeSentiment } from "./scoring";
import { advanceStep, SearchUnavailableError, type CategoryResult, type OverviewResult, type StepState } from "./steps";
import type { SynthesisResult } from "./synthesis";
import { computeThemeScores } from "./trend";
import { emptyUsage, estimateCost, sumUsage, type Usage } from "./usage";

/** Arbeideren tar ikke nye steg etter så lang tid, slik at det rekker å bli ferdig. */
const CLAIM_WINDOW_MS = 90_000;

type StepRow = {
  id: string;
  run_id: string;
  user_id: string;
  step: Step;
  status: string;
  attempts: number;
  state: StepState | null;
  usage: Partial<Usage> | null;
};

/**
 * Plukker og kjører steg til tiden er brukt opp.
 * Returnerer om det fortsatt finnes ventende arbeid, slik at kalleren kan starte en ny runde.
 */
export async function runWorker(maxMs = 270_000): Promise<{ processed: number; pending: boolean }> {
  const start = Date.now();
  const deadline = start + maxMs;
  const db = createAdminClient();
  let processed = 0;

  // Ta bare nye steg så lenge det er tid til minst ett API-kall
  while (Date.now() - start < CLAIM_WINDOW_MS && deadline - Date.now() >= MIN_MS_FOR_REQUEST) {
    const { data, error } = await db.rpc("claim_next_step", {
      p_max_attempts: MAX_STEP_ATTEMPTS,
      p_max_parallel_per_run: MAX_PARALLEL_STEPS,
    });
    if (error) throw new Error(`claim_next_step: ${error.message}`);
    const step = (data as StepRow[] | null)?.[0];
    if (!step) break;
    const outcome = await processStep(db, step, deadline);
    await refreshRunUsage(db, step.run_id);
    await finalizeRunIfComplete(db, step.run_id);
    processed++;
    // Et steg som ga fra seg kontrollen, betyr at tiden er brukt opp i denne runden
    if (outcome === "yielded") break;
  }

  await finalizeStaleRuns(db);
  const { data: pending } = await db.rpc("has_pending_steps");
  return { processed, pending: Boolean(pending) };
}

async function processStep(
  db: SupabaseClient,
  step: StepRow,
  deadline: number,
): Promise<"done" | "yielded" | "failed" | "retry"> {
  let usage: Usage = { ...emptyUsage(), ...(step.usage ?? {}) };
  const save = (fields: Record<string, unknown>) =>
    db
      .from("run_steps")
      .update({ ...fields, usage, cost_usd: estimateCost(usage), updated_at: new Date().toISOString() })
      .eq("id", step.id);

  const { data: run } = await db
    .from("research_runs")
    .select("id, status, stock_id, stocks(name, ticker, exchange)")
    .eq("id", step.run_id)
    .maybeSingle();
  const stock = run?.stocks as unknown as { name: string; ticker: string; exchange: string | null } | null;
  if (!run || !stock || !["queued", "running"].includes(run.status)) {
    await save({ status: "failed", error: "Kjøringen er avsluttet", locked_until: null });
    return "failed";
  }

  await db.from("research_runs").update({ current_step: step.step }).eq("id", run.id);
  let state = step.state;

  try {
    // Ett steg kan gå gjennom flere faser i samme funksjonskall: research → lagre notater → uttrekk
    for (;;) {
      const outcome = await advanceStep(
        {
          db,
          runId: run.id,
          stockId: run.stock_id,
          userId: step.user_id,
          step: step.step,
          stock,
          deadline,
          attempt: step.attempts,
        },
        state,
        usage,
      );
      usage = outcome.usage;

      if (outcome.kind === "yield") {
        // Ikke nok tid igjen: legg steget tilbake i køen uten å bruke opp et forsøk
        await save({ status: "queued", state: outcome.state, attempts: Math.max(0, step.attempts - 1), locked_until: null });
        return "yielded";
      }
      if (outcome.kind === "checkpoint") {
        state = outcome.state;
        await save({ state });
        continue;
      }
      await save({ status: "done", result: outcome.result, state: null, error: null, locked_until: null });
      return "done";
    }
  } catch (err) {
    const info = describeError(err, step.attempts);
    console.error(`Steg ${step.step} i kjøring ${step.run_id} feilet:`, err instanceof Error ? err.message : err);
    const final = !info.retryable || step.attempts >= MAX_STEP_ATTEMPTS;
    await save({
      status: final ? "failed" : "queued",
      // Midlertidig søkefeil: start researchen på nytt i stedet for å bygge videre på et tynt grunnlag
      ...(err instanceof SearchUnavailableError ? { state: null } : {}),
      error: info.message.slice(0, 500),
      locked_until: final ? null : new Date(Date.now() + info.backoffSec * 1000).toISOString(),
    });
    return final ? "failed" : "retry";
  }
}

/**
 * Summerer forbruk og kostnad fra stegene inn i kjøringen. Kjøres etter hvert steg,
 * så kostnaden er oppdatert også mens kjøringen pågår og for avbrutte kjøringer.
 */
export async function refreshRunUsage(db: SupabaseClient, runId: string) {
  const { data } = await db.from("run_steps").select("usage").eq("run_id", runId);
  const usage = sumUsage((data ?? []).map((s) => (s.usage as Partial<Usage>) ?? {}));
  await db
    .from("research_runs")
    .update({
      model: usage.models.join(", ") || undefined,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cache_read_tokens: usage.cache_read_tokens,
      cache_write_tokens: usage.cache_write_tokens,
      web_searches: usage.web_searches,
      web_fetches: usage.web_fetches,
      cost_usd: estimateCost(usage),
    })
    .eq("id", runId);
}

/** Avslutter kjøringen når alle steg er ferdige: summerer kostnad, regner ut stemning og oppdaterer aksjen. */
export async function finalizeRunIfComplete(db: SupabaseClient, runId: string) {
  const { data: steps } = await db
    .from("run_steps")
    .select("step, status, result, usage, error")
    .eq("run_id", runId);
  const list = (steps ?? []) as { step: Step; status: string; result: unknown; usage: Partial<Usage>; error: string | null }[];

  await db
    .from("research_runs")
    .update({ steps_done: list.filter((s) => s.status === "done" || s.status === "failed").length })
    .eq("id", runId);

  if (list.some((s) => s.status === "queued" || s.status === "running")) return;

  const { data: findings } = await db
    .from("findings")
    .select("category, theme, sentiment, evidence_strength, is_red_flag")
    .eq("run_id", runId);
  const all = (findings ?? []) as {
    category: string;
    theme: string;
    sentiment: "positiv" | "nøytral" | "negativ";
    evidence_strength: "sterk" | "middels" | "svak";
    is_red_flag: boolean;
  }[];

  const usage = sumUsage(list.map((s) => s.usage ?? {}));
  const okCategories = list.filter((s) => s.status === "done" && (CATEGORIES as readonly string[]).includes(s.step));
  const failed = list.filter((s) => s.status === "failed");
  const sentiment = computeSentiment(all);

  // Syntesen har allerede beregnet stemning per tema og trend. Feilet den, beregnes stemningen her.
  const synthesis = list.find((s) => s.step === "syntese" && s.status === "done")?.result as
    | SynthesisResult
    | undefined;
  const themeScores = synthesis?.theme_scores ?? computeThemeScores(all);

  const sections: Record<string, CategoryResult> = {};
  for (const s of okCategories) sections[s.step] = s.result as CategoryResult;

  const status = okCategories.length === 0 ? "failed" : "done";
  const { data: updated } = await db
    .from("research_runs")
    .update({
      status,
      current_step: null,
      sections,
      findings_count: all.length,
      red_flags: all.filter((f) => f.is_red_flag).length,
      theme_scores: themeScores,
      trend: synthesis?.trend ?? null,
      report: synthesis?.report ?? null,
      summary_md: synthesis?.report?.headline ?? null,
      model: usage.models.join(", ") || null,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cache_read_tokens: usage.cache_read_tokens,
      cache_write_tokens: usage.cache_write_tokens,
      web_searches: usage.web_searches,
      web_fetches: usage.web_fetches,
      cost_usd: estimateCost(usage),
      error: failed.length
        ? failed.map((s) => `${STEP_LABELS[s.step]}: ${s.error ?? "ukjent feil"}`).join(" · ").slice(0, 1000)
        : list.length === 0
          ? "Kjøringen hadde ingen steg"
          : null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .in("status", ["queued", "running"])
    .select("stock_id")
    .maybeSingle();

  // Bare den arbeideren som faktisk avsluttet kjøringen, oppdaterer aksjen
  if (!updated || status !== "done") return;
  const overviewStep = list.find((s) => s.step === "oversikt" && s.status === "done");
  const overview = (overviewStep?.result as OverviewResult | undefined)?.overview;
  await db
    .from("stocks")
    .update({
      last_run_at: new Date().toISOString(),
      sentiment_score: sentiment?.score ?? null,
      sentiment_label: sentiment?.label ?? null,
      sentiment_trend: synthesis?.trend.entries.find((e) => e.key === "overall")?.direction ?? null,
      ...(overview ? { overview } : {}),
    })
    .eq("id", updated.stock_id);
}

/** Avslutter kjøringer der alle steg er ferdige, men der ingen arbeider rakk å avslutte selve kjøringen. */
async function finalizeStaleRuns(db: SupabaseClient) {
  const { data } = await db
    .from("research_runs")
    .select("id")
    .in("status", ["queued", "running"])
    .order("created_at")
    .limit(20);
  for (const r of data ?? []) await finalizeRunIfComplete(db, r.id as string);
}
