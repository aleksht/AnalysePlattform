import "server-only";
import { requireUser } from "@/lib/auth";
import type { CompletedRun, Finding, Folder, Source, Stock } from "@/lib/types";

export async function getLibrary() {
  const { supabase } = await requireUser();
  const [folders, stocks] = await Promise.all([
    supabase.from("folders").select("*").order("sort_order").order("created_at"),
    supabase.from("stocks").select("*").order("name"),
  ]);
  if (folders.error) throw folders.error;
  if (stocks.error) throw stocks.error;
  return { folders: folders.data as Folder[], stocks: stocks.data as Stock[] };
}

export async function getStock(id: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("stocks").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Stock | null;
}

export async function getFolders() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("folders").select("*").order("sort_order");
  if (error) throw error;
  return data as Folder[];
}

export async function getActiveRun(stockId: string) {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("research_runs")
    .select("id")
    .eq("stock_id", stockId)
    .in("status", ["queued", "running"])
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Siste vellykkede kjøring med funn og kilder. */
export async function getLatestResearch(stockId: string, runId?: string) {
  const { supabase } = await requireUser();
  let query = supabase.from("research_runs").select("*").eq("stock_id", stockId).eq("status", "done");
  if (runId) query = query.eq("id", runId);
  const { data: run } = await query.order("finished_at", { ascending: false }).limit(1).maybeSingle();
  if (!run) return null;

  const [findings, sources] = await Promise.all([
    supabase.from("findings").select("*").eq("run_id", run.id).order("published_at", { ascending: false, nullsFirst: false }),
    supabase.from("sources").select("*").eq("run_id", run.id).order("published_at", { ascending: false, nullsFirst: false }),
  ]);
  // Er dette den nyeste kjøringen for aksjen (uansett status)?
  const { data: newest } = await supabase
    .from("research_runs")
    .select("id")
    .eq("stock_id", stockId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    isLatest: newest?.id === run.id,
    run: run as CompletedRun,
    findings: (findings.data ?? []) as Finding[],
    sources: (sources.data ?? []) as Source[],
  };
}

export async function getLastFailedRun(stockId: string) {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("research_runs")
    .select("id, status, error, created_at")
    .eq("stock_id", stockId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data && data.status === "failed" ? (data as { id: string; error: string | null; created_at: string }) : null;
}

export type RunHistoryItem = {
  id: string;
  trigger: "manual" | "weekly";
  finished_at: string;
  findings_count: number;
  red_flags: number;
  cost_usd: number;
  score: number | null;
  label: string | null;
};

/** Fullførte kjøringer for en aksje, eldste først (for trend over tid). */
export async function getRunHistory(stockId: string, limit = 26): Promise<RunHistoryItem[]> {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("research_runs")
    .select("id, trigger, finished_at, findings_count, red_flags, cost_usd, theme_scores")
    .eq("stock_id", stockId)
    .eq("status", "done")
    .order("finished_at", { ascending: false })
    .limit(limit);
  return (data ?? [])
    .map((r) => {
      const overall = (r.theme_scores as { overall?: { score: number; label: string } | null } | null)?.overall;
      return {
        id: r.id as string,
        trigger: r.trigger as "manual" | "weekly",
        finished_at: r.finished_at as string,
        findings_count: r.findings_count as number,
        red_flags: r.red_flags as number,
        cost_usd: Number(r.cost_usd),
        score: overall?.score ?? null,
        label: overall?.label ?? null,
      };
    })
    .reverse();
}

export type CostRun = {
  id: string;
  stock_id: string;
  status: string;
  trigger: string;
  created_at: string;
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  web_searches: number;
  model: string | null;
  stocks: { name: string; ticker: string } | null;
};

/** Alle kjøringer med kostnad, nyeste først. */
export async function getCostRuns(limit = 1000) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("research_runs")
    .select("id, stock_id, status, trigger, created_at, cost_usd, input_tokens, output_tokens, web_searches, model, stocks(name, ticker)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...r, cost_usd: Number(r.cost_usd) })) as unknown as CostRun[];
}

export async function getUserSettings() {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("user_settings").select("monthly_budget_usd").maybeSingle();
  // Ingen rad betyr standardbudsjettet på 25 USD
  return { monthlyBudgetUsd: data ? (data.monthly_budget_usd == null ? null : Number(data.monthly_budget_usd)) : 25 };
}

/** Siste aktivitet fra arbeideren og kjøringer som har ventet lenge. Brukes i systemstatus. */
export async function getWorkerHealth() {
  const { supabase } = await requireUser();
  const [{ data: lastStep }, { data: waiting }] = await Promise.all([
    supabase.from("run_steps").select("updated_at").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase
      .from("research_runs")
      .select("id, created_at")
      .eq("status", "queued")
      .lt("created_at", new Date(Date.now() - 5 * 60_000).toISOString()),
  ]);
  return { lastActivity: (lastStep?.updated_at as string | undefined) ?? null, stuckRuns: waiting?.length ?? 0 };
}

/** Samlet stemning for de siste kjøringene per aksje, eldste først (til minikurvene på forsiden). */
export async function getSparklines(points = 8): Promise<Map<string, number[]>> {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("research_runs")
    .select("stock_id, finished_at, theme_scores")
    .eq("status", "done")
    .order("finished_at", { ascending: false })
    .limit(500);
  const map = new Map<string, number[]>();
  for (const r of data ?? []) {
    const score = (r.theme_scores as { overall?: { score: number } | null } | null)?.overall?.score;
    if (score == null) continue;
    const list = map.get(r.stock_id as string) ?? [];
    if (list.length < points) list.unshift(score);
    map.set(r.stock_id as string, list);
  }
  return map;
}
