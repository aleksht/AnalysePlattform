import { timingSafeEqual } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { runWorker } from "@/lib/research/worker";
import { kickWorker } from "@/lib/research/kick";

// Hver runde holder seg under 300 sekunder, som virker på både Hobby og Pro.
export const maxDuration = 300;

function authorized(request: NextRequest): boolean {
  const secret = process.env.JOB_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Vekkes av appen og av pg_cron. Svarer med en gang og gjør jobben etterpå. */
export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
  }

  after(async () => {
    try {
      const { pending } = await runWorker(270_000);
      if (pending) await kickWorker(1);
    } catch (err) {
      console.error("Arbeideren feilet:", err);
    }
  });

  return NextResponse.json({ accepted: true }, { status: 202 });
}
