/** Modell, grenser og priser for researchagenten. Endre her ved prisendringer. */
export const RESEARCH_MODEL = "claude-sonnet-5-5";

/** Priser i USD per million tokens (Claude Sonnet 5.5) og per web search. */
export const PRICING = {
  inputPerMTok: 2.0,
  outputPerMTok: 10.0,
  cacheReadPerMTok: 0.2,
  cacheWritePerMTok: 2.5,
  perWebSearch: 0.01,
} as const;

/** Tak på søk og hentinger per steg. */
export const TOOL_LIMITS: Record<string, { searches: number; fetches: number }> = {
  oversikt: { searches: 4, fetches: 3 },
  kunder: { searches: 10, fetches: 6 },
  ansatte: { searches: 8, fetches: 5 },
  ledelse: { searches: 6, fetches: 5 },
  nyheter: { searches: 8, fetches: 5 },
  konkurrenter: { searches: 6, fetches: 4 },
};

/** Maks antall pause_turn-fortsettelser per steg (sikring mot uendelige løkker). */
export const MAX_CONTINUATIONS = 8;

/** Arbeideren må ha minst så mye tid igjen før den starter et nytt API-kall. */
export const MIN_MS_FOR_REQUEST = Number(process.env.RESEARCH_MIN_MS_FOR_REQUEST ?? 150_000);
