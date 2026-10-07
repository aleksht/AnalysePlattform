import Anthropic from "@anthropic-ai/sdk";
import { RefusalError } from "./agent";

export type ErrorInfo = {
  /** Melding på norsk som vises til brukeren */
  message: string;
  /** Kan et nytt forsøk hjelpe? */
  retryable: boolean;
  /** Ventetid før neste forsøk, i sekunder */
  backoffSec: number;
};

/**
 * Oversetter feil fra Anthropic, nettverket og databasen til norske meldinger
 * og avgjør om steget skal prøves på nytt.
 */
export function describeError(err: unknown, attempt: number): ErrorInfo {
  const backoff = (base: number) => base * 2 ** Math.max(0, attempt - 1);

  if (err instanceof RefusalError) {
    return { message: err.message, retryable: false, backoffSec: 0 };
  }
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return { message: "Anthropic avviste API-nøkkelen. Sjekk ANTHROPIC_API_KEY.", retryable: false, backoffSec: 0 };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return { message: "Anthropic-grensen for forespørsler er nådd. Prøver igjen senere.", retryable: true, backoffSec: backoff(90) };
  }
  if (err instanceof Anthropic.BadRequestError) {
    const raw = err.message.toLowerCase();
    if (raw.includes("credit") || raw.includes("billing")) {
      return { message: "Anthropic-kontoen mangler kreditt. Fyll på i Claude Console.", retryable: false, backoffSec: 0 };
    }
    if (raw.includes("web search") && raw.includes("not enabled")) {
      return {
        message: "Web search er ikke slått på for organisasjonen i Claude Console.",
        retryable: false,
        backoffSec: 0,
      };
    }
    return { message: `Ugyldig forespørsel til Anthropic: ${err.message.slice(0, 200)}`, retryable: false, backoffSec: 0 };
  }
  if (err instanceof Anthropic.InternalServerError) {
    // Inkluderer 529 (overbelastet)
    return { message: "Anthropic er midlertidig overbelastet. Prøver igjen senere.", retryable: true, backoffSec: backoff(60) };
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return { message: "Fikk ikke kontakt med Anthropic. Prøver igjen.", retryable: true, backoffSec: backoff(30) };
  }
  if (err instanceof Anthropic.APIError) {
    return { message: `Feil fra Anthropic (${err.status ?? "ukjent"}). Prøver igjen.`, retryable: true, backoffSec: backoff(60) };
  }
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("ANTHROPIC_API_KEY mangler") || message.includes("SUPABASE_SECRET_KEY mangler")) {
    return { message, retryable: false, backoffSec: 0 };
  }
  return { message: message.slice(0, 300), retryable: true, backoffSec: backoff(30) };
}
