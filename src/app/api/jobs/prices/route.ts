import { timingSafeEqual } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { refreshStalePrices } from "@/lib/prices/refresh";

export const maxDuration = 300;

function authorized(request: NextRequest): boolean {
  const secret = process.env.JOB_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Daglig oppdatering av kurser, vekket av pg_cron. */
export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
  after(async () => {
    try {
      const n = await refreshStalePrices();
      console.log(`Kurser oppdatert for ${n} aksjer`);
    } catch (err) {
      console.error("Kursoppdatering feilet:", err);
    }
  });
  return NextResponse.json({ accepted: true }, { status: 202 });
}
