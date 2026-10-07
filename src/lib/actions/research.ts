"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { kickWorker } from "@/lib/research/kick";
import { RESEARCH_MODEL } from "@/lib/research/config";
import { STEPS } from "@/lib/research/schema";
import { missingResearchConfig } from "@/lib/research/setup";
import { formatUsd } from "@/lib/format";

export type StartState = { runId?: string; error?: string };

export async function startResearch(stockId: string): Promise<StartState> {
  if (!z.guid().safeParse(stockId).success) return { error: "Ugyldig aksje." };
  const { supabase, user } = await requireUser();

  const missing = missingResearchConfig();
  if (missing.length > 0) {
    return { error: `Researchagenten er ikke satt opp. Mangler: ${missing.join(", ")}.` };
  }

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
  const { data: overBudget } = await admin.rpc("over_monthly_budget", { p_user: user.id });
  if (overBudget) {
    const { data: settings } = await supabase.from("user_settings").select("monthly_budget_usd").maybeSingle();
    return {
      error: `Månedsbudsjettet på ${formatUsd(settings?.monthly_budget_usd ?? 25)} er brukt opp. Du kan endre det under Innstillinger.`,
    };
  }

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

/**
 * Prøver feilede steg i siste kjøring på nytt, uten å kjøre de vellykkede stegene igjen.
 * Syntesen kjøres alltid på nytt, så rapporten tar med de nye funnene.
 */
export async function retryFailedSteps(runId: string): Promise<StartState> {
  if (!z.guid().safeParse(runId).success) return { error: "Ugyldig kjøring." };
  const { supabase, user } = await requireUser();

  const { data: run } = await supabase
    .from("research_runs")
    .select("id, stock_id, status, run_steps(step, status)")
    .eq("id", runId)
    .maybeSingle();
  if (!run) return { error: "Fant ikke kjøringen." };
  if (!["done", "failed"].includes(run.status as string)) return { error: "Kjøringen er ikke ferdig." };

  const steps = (run.run_steps ?? []) as { step: string; status: string }[];
  const failed = steps.filter((s) => s.status === "failed" && s.step !== "syntese").map((s) => s.step);
  if (failed.length === 0) return { error: "Ingen feilede steg å prøve på nytt." };

  const missing = missingResearchConfig();
  if (missing.length > 0) return { error: `Researchagenten er ikke satt opp. Mangler: ${missing.join(", ")}.` };

  const admin = createAdminClient();
  const { data: overBudget } = await admin.rpc("over_monthly_budget", { p_user: user.id });
  if (overBudget) return { error: "Månedsbudsjettet er brukt opp. Du kan endre det under Innstillinger." };

  // Bare siste kjøring for aksjen kan tas opp igjen, og ingen annen kjøring kan være aktiv
  const { data: latest } = await supabase
    .from("research_runs")
    .select("id")
    .eq("stock_id", run.stock_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (latest?.id !== runId) return { error: "Bare den nyeste kjøringen kan prøves på nytt." };

  const { error } = await admin
    .from("research_runs")
    .update({ status: "running", finished_at: null, error: null })
    .eq("id", runId)
    .in("status", ["done", "failed"]);
  if (error) {
    if (error.code === "23505") return { error: "En kjøring pågår allerede for denne aksjen." };
    return { error: "Kunne ikke starte på nytt." };
  }
  await admin
    .from("run_steps")
    .update({ status: "queued", attempts: 0, error: null, locked_until: null, state: null })
    .eq("run_id", runId)
    .in("step", [...failed, "syntese"]);

  after(() => kickWorker(3));
  revalidatePath(`/aksjer/${run.stock_id}`);
  return { runId };
}
