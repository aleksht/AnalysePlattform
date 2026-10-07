import "server-only";

/** Miljøvariabler researchagenten trenger. Brukes til å gi tydelige feilmeldinger og systemstatus. */
export function missingResearchConfig(): string[] {
  const required: [string, string | undefined][] = [
    ["ANTHROPIC_API_KEY", process.env.ANTHROPIC_API_KEY],
    ["SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY],
    ["JOB_SECRET", process.env.JOB_SECRET],
    ["NEXT_PUBLIC_SITE_URL eller APP_URL", process.env.APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL],
  ];
  return required.filter(([, v]) => !v).map(([k]) => k);
}
