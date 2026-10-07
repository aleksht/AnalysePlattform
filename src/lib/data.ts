import "server-only";
import { requireUser } from "@/lib/auth";
import type { CompletedRun, Finding, Folder, ResearchRun, Source, Stock } from "@/lib/types";

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

export async function getRuns(limit = 50) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("research_runs")
    .select("*, stocks(name, ticker)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as (ResearchRun & { stocks: { name: string; ticker: string } | null })[];
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
  return {
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
