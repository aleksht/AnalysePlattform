import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase-klient med service-rollen. Omgår RLS, så den brukes bare av bakgrunnsjobben
 * og etter at eierskap er sjekket med brukerens egen klient.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY mangler");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
