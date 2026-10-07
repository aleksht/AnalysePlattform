"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { kickWorker } from "@/lib/research/kick";
import { RESEARCH_MODEL } from "@/lib/research/config";
import { STEPS } from "@/lib/research/schema";

export type StartState = { runId?: string; error?: string };

export async function startResearch(stockId: string): Promise<StartState> {
  if (!z.guid().safeParse(stockId).success) return { error: "Ugyldig aksje." };
  const { supabase } = await requireUser();

  // Eierskap sjekkes med brukerens klient (RLS) før service-rollen brukes
  const { data: stock } = await supabase.from("stocks").select("id").eq("id", stockId).maybeSingle();
  if (!stock) return { error: "Fant ikke aksjen." };

  const { data: active } = await supabase
    .from("research_runs")
    .select("id")
    .eq("stock_id", stockId)
    .in("status", ["queued", "running"])
    .maybeSingle();
  if (active) return { runId: active.id as string };

  const admin = createAdminClient();
  const { data: runId, error } = await admin.rpc("create_research_run", {
    p_stock_id: stockId,
    p_trigger: "manual",
    p_steps: [...STEPS],
    p_model: RESEARCH_MODEL,
  });
  if (error) {
    // 23505: en annen kjøring ble startet samtidig
    if (error.code === "23505") return { error: "En kjøring pågår allerede for denne aksjen." };
    console.error("create_research_run", error.message);
    return { error: "Kunne ikke starte researchen." };
  }

  // Tre arbeidere i parallell, så kategoriene kjøres samtidig
  after(() => kickWorker(3));
  revalidatePath(`/aksjer/${stockId}`);
  return { runId: runId as string };
}

export async function cancelResearch(runId: string): Promise<void> {
  if (!z.guid().safeParse(runId).success) return;
  const { supabase } = await requireUser();
  const { data: run } = await supabase.from("research_runs").select("id, stock_id").eq("id", runId).maybeSingle();
  if (!run) return;

  const admin = createAdminClient();
  await admin
    .from("research_runs")
    .update({ status: "cancelled", current_step: null, finished_at: new Date().toISOString() })
    .eq("id", runId)
    .in("status", ["queued", "running"]);
  await admin
    .from("run_steps")
    .update({ status: "failed", error: "Avbrutt av bruker", locked_until: null })
    .eq("run_id", runId)
    .in("status", ["queued", "running"]);
  revalidatePath(`/aksjer/${run.stock_id}`);
}
