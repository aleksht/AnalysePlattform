import "server-only";

/**
 * Henting av daglige sluttkurser fra Yahoo Finance (chart-grensesnittet).
 * All kontakt med Yahoo ligger i denne filen, så kilden er enkel å bytte ut.
 */

export type PriceSeries = {
  symbol: string;
  currency: string | null;
  lastPrice: number | null;
  previousClose: number | null;
  points: { date: string; close: number }[];
};

type ChartResponse = {
  chart?: {
    result?: {
      meta?: {
        symbol?: string;
        currency?: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        exchangeTimezoneName?: string;
      };
      timestamp?: number[];
      indicators?: { quote?: { close?: (number | null)[] }[] };
    }[];
    error?: { code?: string; description?: string } | null;
  };
};

export class PriceError extends Error {}

function toDate(ts: number, timeZone: string): string {
  // Dato i børsens tidssone (YYYY-MM-DD)
  return new Intl.DateTimeFormat("sv-SE", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(ts * 1000),
  );
}

export function parseChart(json: ChartResponse, symbol: string): PriceSeries {
  const err = json.chart?.error;
  if (err) throw new PriceError(err.description || err.code || "Ukjent feil fra Yahoo");
  const result = json.chart?.result?.[0];
  if (!result) throw new PriceError(`Fant ingen kurser for ${symbol}`);

  const tz = result.meta?.exchangeTimezoneName ?? "Europe/Stockholm";
  const ts = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const byDate = new Map<string, number>();
  ts.forEach((t, i) => {
    const c = closes[i];
    if (typeof c === "number" && Number.isFinite(c)) byDate.set(toDate(t, tz), Math.round(c * 10000) / 10000);
  });
  const points = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, close]) => ({ date, close }));

  const last = result.meta?.regularMarketPrice ?? points.at(-1)?.close ?? null;
  // Forrige sluttkurs: nest siste punkt i serien er mest pålitelig for dagsendring
  const prev = points.length >= 2 ? points[points.length - 2].close : (result.meta?.previousClose ?? null);
  return { symbol: result.meta?.symbol ?? symbol, currency: result.meta?.currency ?? null, lastPrice: last, previousClose: prev, points };
}

export async function fetchPrices(symbol: string, range: "1mo" | "1y" | "5y" = "5y"): Promise<PriceSeries> {
  const base = process.env.YAHOO_CHART_URL ?? "https://query1.finance.yahoo.com/v8/finance/chart";
  const url = `${base}/${encodeURIComponent(symbol)}?range=${range}&interval=1d&includePrePost=false`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Aksjeinnsikt/1.0)", Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch {
    throw new PriceError("Fikk ikke kontakt med Yahoo Finance");
  }
  if (res.status === 404) throw new PriceError(`Yahoo kjenner ikke symbolet ${symbol}`);
  if (!res.ok) throw new PriceError(`Yahoo Finance svarte ${res.status}`);
  return parseChart((await res.json()) as ChartResponse, symbol);
}
