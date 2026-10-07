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
  oversikt: { searches: 5, fetches: 3 },
  kunder: { searches: 12, fetches: 6 },
  ansatte: { searches: 10, fetches: 5 },
  ledelse: { searches: 8, fetches: 5 },
  nyheter: { searches: 10, fetches: 5 },
  konkurrenter: { searches: 10, fetches: 5 },
};

/**
 * Hvor mange steg i samme kjøring som kan søke samtidig. Holdes lavt for å unngå
 * at web search svarer med too_many_requests.
 */
export const MAX_PARALLEL_STEPS = 2;

/** Feilkoder fra web search/fetch som tyder på midlertidig trøbbel, og gir grunn til å prøve steget på nytt. */
export const RETRYABLE_TOOL_ERRORS = ["too_many_requests", "unavailable"];

/** Maks antall forsøk per steg (må stemme med p_max_attempts i claim_next_step). */
export const MAX_STEP_ATTEMPTS = 3;

/** Maks antall pause_turn-fortsettelser per steg (sikring mot uendelige løkker). */
export const MAX_CONTINUATIONS = 8;

/** Arbeideren må ha minst så mye tid igjen før den starter et nytt API-kall. */
export const MIN_MS_FOR_REQUEST = Number(process.env.RESEARCH_MIN_MS_FOR_REQUEST ?? 150_000);
