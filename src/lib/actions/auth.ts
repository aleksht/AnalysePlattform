"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isEmailAllowed } from "@/lib/auth";

export type LoginState = {
  step: "email" | "code";
  email?: string;
  error?: string;
  message?: string;
};

const emailSchema = z.email({ error: "Skriv inn en gyldig e-postadresse." });

async function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? "").trim());
  if (!parsed.success) return { step: "email", error: parsed.error.issues[0].message };
  const email = parsed.data.toLowerCase();

  // Samme svar uansett om adressen er tillatt, så listen ikke kan kartlegges.
  if (isEmailAllowed(email)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      // Bare brukere som er lagt inn i Supabase på forhånd kan logge inn
      options: { emailRedirectTo: `${await siteUrl()}/auth/confirm`, shouldCreateUser: false },
    });
    // Ukjent bruker gir feil fra Supabase. Svarer som om alt gikk bra, så listen ikke kan kartlegges.
    if (error && error.status !== 422 && !/signups not allowed|user not found/i.test(error.message)) {
      console.error("signInWithOtp", error.message);
      return {
        step: "email",
        email,
        error:
          error.status === 429
            ? "For mange forsøk. Vent et minutt og prøv igjen."
            : "Kunne ikke sende e-post akkurat nå. Prøv igjen om litt.",
      };
    }
  }

  return {
    step: "code",
    email,
    message: `Hvis ${email} har tilgang, er en innloggingslenke sendt dit. Klikk på lenken, eller skriv inn koden fra e-posten her.`,
  };
}

export async function verifyCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").toLowerCase();
  const token = String(formData.get("token") ?? "").replace(/\s/g, "");
  if (!/^\d{6,10}$/.test(token)) {
    return { step: "code", email, error: "Koden består av sifre fra e-posten." };
  }
  if (!isEmailAllowed(email)) {
    return { step: "code", email, error: "Koden er ugyldig eller utløpt." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { step: "code", email, error: "Koden er ugyldig eller utløpt." };
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
