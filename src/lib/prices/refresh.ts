import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { yahooSymbol } from "./symbol";
import { fetchPrices, PriceError } from "./yahoo";

type StockRow = {
  id: string;
  user_id: string;
  ticker: string;
  exchange: string | null;
  price_symbol: string | null;
  price_updated_at: string | null;
};

/** Kurser regnes som ferske i så mange timer. */
const FRESH_HOURS = 6;

/** Henter og lagrer kurser for én aksje. Første gang 5 år, deretter siste måned. */
async function refreshOne(db: SupabaseClient, stock: StockRow) {
  const symbol = yahooSymbol(stock);
  try {
    const series = await fetchPrices(symbol, stock.price_updated_at ? "1mo" : "5y");
    if (series.points.length > 0) {
      const rows = series.points.map((p) => ({ stock_id: stock.id, user_id: stock.user_id, date: p.date, close: p.close }));
      const { error } = await db.from("stock_prices").upsert(rows, { onConflict: "stock_id,date" });
      if (error) throw new Error(error.message);
    }
    const change =
      series.lastPrice != null && series.previousClose
        ? Math.round(((series.lastPrice - series.previousClose) / series.previousClose) * 100000) / 1000
        : null;
    await db
      .from("stocks")
      .update({
        last_price: series.lastPrice,
        price_change_pct: change,
        price_currency: series.currency,
        price_updated_at: new Date().toISOString(),
        price_error: null,
      })
      .eq("id", stock.id);
  } catch (err) {
    const message = err instanceof PriceError ? err.message : "Kunne ikke hente kurs";
    console.warn(`Kurs for ${symbol}:`, err instanceof Error ? err.message : err);
    // Marker forsøket, så vi ikke prøver igjen ved hver sidevisning
    await db
      .from("stocks")
      .update({ price_error: message, price_updated_at: new Date().toISOString() })
      .eq("id", stock.id);
  }
}

/**
 * Oppdaterer kurser som er eldre enn FRESH_HOURS. Med userId bare for den brukeren
 * (kalles etter sidevisning), uten for alle (daglig jobb).
 */
export async function refreshStalePrices(opts: { userId?: string; stockIds?: string[]; force?: boolean } = {}) {
  const db = createAdminClient();
  let query = db.from("stocks").select("id, user_id, ticker, exchange, price_symbol, price_updated_at");
  if (opts.userId) query = query.eq("user_id", opts.userId);
  if (opts.stockIds) query = query.in("id", opts.stockIds);
  if (!opts.force) {
    const cutoff = new Date(Date.now() - FRESH_HOURS * 3600_000).toISOString();
    query = query.or(`price_updated_at.is.null,price_updated_at.lt.${cutoff}`);
  }
  const { data } = await query.limit(100);
  // Én og én, for å være skånsom mot Yahoo
  for (const stock of (data ?? []) as StockRow[]) await refreshOne(db, stock);
  return (data ?? []).length;
}
