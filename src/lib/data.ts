import "server-only";
import { requireUser } from "@/lib/auth";
import type { Folder, ResearchRun, Stock } from "@/lib/types";

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
