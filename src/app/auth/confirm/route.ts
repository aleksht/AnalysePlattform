import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isEmailAllowed } from "@/lib/auth";

/**
 * Mottar den magiske lenken. Støtter både PKCE (?code=) og token_hash-malen
 * (?token_hash=&type=), som også virker når lenken åpnes på en annen enhet.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  const supabase = await createClient();
  let ok = false;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  if (ok) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (isEmailAllowed(user?.email)) {
      return NextResponse.redirect(new URL(next, origin));
    }
    await supabase.auth.signOut();
  }

  return NextResponse.redirect(new URL("/login?feil=lenke", origin));
}
