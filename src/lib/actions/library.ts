"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshStalePrices } from "@/lib/prices/refresh";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";

export type FormState = { ok?: boolean; error?: string };

const folderName = z
  .string()
  .trim()
  .min(1, { error: "Mappen må ha et navn." })
  .max(80, { error: "Navnet kan være maks 80 tegn." });

const optionalId = z
  .string()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.guid().nullable());

const stockInput = z.object({
  name: z.string().trim().min(1, { error: "Skriv inn selskapsnavn." }).max(120),
  ticker: z
    .string()
    .trim()
    .min(1, { error: "Skriv inn ticker." })
    .max(20)
    .transform((t) => t.toUpperCase()),
  exchange: z
    .string()
    .trim()
    .max(60)
    .transform((v) => v || null),
  folder_id: optionalId,
  price_symbol: z
    .string()
    .trim()
    .max(30)
    .transform((v) => (v ? v.toUpperCase() : null)),
});

// ---------------------------------------------------------------- Mapper

export async function createFolder(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = folderName.safeParse(formData.get("name") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase, user } = await requireUser();
  const { count } = await supabase
    .from("folders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { error } = await supabase
    .from("folders")
    .insert({ name: parsed.data, user_id: user.id, sort_order: count ?? 0 });
  if (error) return { error: "Kunne ikke lage mappen." };

  revalidatePath("/");
  return { ok: true };
}

export async function renameFolder(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = folderName.safeParse(formData.get("name") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const id = z.guid().parse(formData.get("id"));

  const { supabase } = await requireUser();
  const { error } = await supabase.from("folders").update({ name: parsed.data }).eq("id", id);
  if (error) return { error: "Kunne ikke endre navn." };

  revalidatePath("/");
  return { ok: true };
}

export async function deleteFolder(formData: FormData) {
  const id = z.guid().parse(formData.get("id"));
  const { supabase } = await requireUser();
  // Aksjene i mappen beholdes og havner under «Uten mappe» (on delete set null).
  await supabase.from("folders").delete().eq("id", id);
  revalidatePath("/");
}

// ---------------------------------------------------------------- Aksjer

export async function createStock(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = stockInput.safeParse({
    name: formData.get("name") ?? "",
    ticker: formData.get("ticker") ?? "",
    exchange: formData.get("exchange") ?? "",
    folder_id: formData.get("folder_id") ?? "",
    price_symbol: formData.get("price_symbol") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase, user } = await requireUser();
  const { data: created, error } = await supabase
    .from("stocks")
    .insert({ ...parsed.data, user_id: user.id })
    .select("id")
    .single();
  if (error) return { error: "Kunne ikke legge til aksjen." };

  // Hent kurser i bakgrunnen
  after(() => refreshStalePrices({ stockIds: [created.id as string], force: true }));

  revalidatePath("/");
  return { ok: true };
}

export async function updateStock(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = z.guid().parse(formData.get("id"));
  const parsed = stockInput.safeParse({
    name: formData.get("name") ?? "",
    ticker: formData.get("ticker") ?? "",
    exchange: formData.get("exchange") ?? "",
    folder_id: formData.get("folder_id") ?? "",
    price_symbol: formData.get("price_symbol") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase } = await requireUser();
  const { data: before } = await supabase
    .from("stocks")
    .select("ticker, exchange, price_symbol")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase
    .from("stocks")
    .update({ ...parsed.data, weekly_auto: formData.get("weekly_auto") === "on" })
    .eq("id", id);
  if (error) return { error: "Kunne ikke lagre endringene." };

  // Nytt symbol: slett gamle kurser og hent på nytt
  const symbolChanged =
    before &&
    (before.ticker !== parsed.data.ticker ||
      (before.exchange ?? null) !== parsed.data.exchange ||
      (before.price_symbol ?? null) !== parsed.data.price_symbol);
  if (symbolChanged) {
    const admin = createAdminClient();
    await admin.from("stock_prices").delete().eq("stock_id", id);
    await admin
      .from("stocks")
      .update({ last_price: null, price_change_pct: null, price_updated_at: null, price_error: null })
      .eq("id", id);
    after(() => refreshStalePrices({ stockIds: [id], force: true }));
  }

  revalidatePath("/");
  revalidatePath(`/aksjer/${id}`);
  return { ok: true };
}

export async function deleteStock(formData: FormData) {
  const id = z.guid().parse(formData.get("id"));
  const { supabase } = await requireUser();
  await supabase.from("stocks").delete().eq("id", id);
  revalidatePath("/");
  redirect("/");
}

export async function setWeeklyAuto(formData: FormData) {
  const id = z.guid().parse(formData.get("id"));
  const enabled = formData.get("enabled") === "true";
  const { supabase } = await requireUser();
  await supabase.from("stocks").update({ weekly_auto: enabled }).eq("id", id);
  revalidatePath("/innstillinger");
  revalidatePath(`/aksjer/${id}`);
}

export async function updateBudget(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = String(formData.get("budget") ?? "").trim().replace(",", ".");
  const value = raw === "" ? null : Number(raw);
  if (value !== null && (!Number.isFinite(value) || value < 0 || value > 10000)) {
    return { error: "Skriv inn et beløp mellom 0 og 10 000, eller la feltet stå tomt for ingen grense." };
  }
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, monthly_budget_usd: value, updated_at: new Date().toISOString() });
  if (error) return { error: "Kunne ikke lagre budsjettet." };
  revalidatePath("/innstillinger");
  return { ok: true };
}
