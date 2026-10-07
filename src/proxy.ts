import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Alt unntatt statiske filer og jobb-API-et (som har egen nøkkelsjekk)
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon|manifest.webmanifest|api/jobs|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
