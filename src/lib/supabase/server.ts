import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Supabase-klient for serverkomponenter, server actions og route handlers. Kjører som innlogget bruker (RLS gjelder). */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Kalt fra en serverkomponent. Proxy oppdaterer sesjonen, så dette kan ignoreres.
          }
        },
      },
    },
  );
}
