import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/** Fremdrift for en kjøring. Leses med brukerens egen klient, så RLS gjelder. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/runs/[id]">) {
  const { id } = await ctx.params;
  if (!z.guid().safeParse(id).success) return NextResponse.json({ error: "Ugyldig id" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("research_runs")
    .select("id, status, current_step, steps_total, steps_done, cost_usd, error, run_steps(step, status, ord)")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Kunne ikke hente status" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Fant ikke kjøringen" }, { status: 404 });
  return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
}
