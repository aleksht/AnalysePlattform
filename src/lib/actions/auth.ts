"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isEmailAllowed } from "@/lib/auth";

export type LoginState = { email?: string; error?: string };

const credentials = z.object({
  email: z.email({ error: "Skriv inn en gyldig e-postadresse." }),
  password: z.string().min(1, { error: "Skriv inn passordet." }),
});

/**
 * Innlogging med e-post og passord. Brukerne opprettes i Supabase-dashbordet
 * (Authentication → Users), og må i tillegg stå i ALLOWED_EMAILS.
 */
export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = credentials.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });
  const email = String(formData.get("email") ?? "").trim();
  if (!parsed.success) return { email, error: parsed.error.issues[0].message };

  // Samme melding for ukjent bruker og feil passord, så det ikke avslører hvem som har tilgang
  const wrong = { email, error: "Feil e-post eller passord." };
  if (!isEmailAllowed(parsed.data.email)) return wrong;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.status === 429) return { email, error: "For mange forsøk. Vent litt og prøv igjen." };
    if (error.status && error.status >= 500) {
      console.error("signInWithPassword", error.message);
      return { email, error: "Innloggingen er utilgjengelig akkurat nå. Prøv igjen om litt." };
    }
    return wrong;
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
