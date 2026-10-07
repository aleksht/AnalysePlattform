import "server-only";

function appUrl(): string | null {
  const explicit = process.env.APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return null;
}

/**
 * Vekker arbeideren. Ruten svarer 202 med en gang og gjør jobben i after(),
 * så kallet blir raskt ferdig. pg_cron er sikkerhetsnettet hvis dette feiler.
 */
export async function kickWorker(count = 1): Promise<void> {
  const base = appUrl();
  const secret = process.env.JOB_SECRET;
  if (!base || !secret) {
    console.warn("kickWorker: APP_URL/NEXT_PUBLIC_SITE_URL eller JOB_SECRET mangler");
    return;
  }
  await Promise.all(
    Array.from({ length: count }, () =>
      fetch(`${base}/api/jobs/run-step`, {
        method: "POST",
        headers: { authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(10_000),
      }).catch((err) => console.warn("kickWorker feilet:", err?.message ?? err)),
    ),
  );
}
