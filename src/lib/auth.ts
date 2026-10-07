import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email: string | undefined | null): boolean {
  if (!email) return false;
  const list = allowedEmails();
  // Tom liste betyr at alle kan logge inn (nyttig lokalt). Sett ALLOWED_EMAILS i produksjon.
  return list.length === 0 || list.includes(email.toLowerCase());
}

/** Henter innlogget bruker og en Supabase-klient. Sender til /login hvis brukeren mangler eller ikke er på tillatt-listen. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isEmailAllowed(user.email)) {
    redirect("/login");
  }
  return { supabase, user };
}
