/** Yahoo Finance-suffiks per børs. Børser uten treff antas å være amerikanske (ingen suffiks). */
const SUFFIX: [RegExp, string][] = [
  [/stockholm/i, ".ST"],
  [/oslo/i, ".OL"],
  [/copenhagen|københavn|kobenhavn/i, ".CO"],
  [/helsinki/i, ".HE"],
  [/iceland|reykjavik/i, ".IC"],
  [/xetra|frankfurt/i, ".DE"],
  [/euronext paris|paris/i, ".PA"],
  [/amsterdam/i, ".AS"],
  [/brussel|brussels/i, ".BR"],
  [/london|lse/i, ".L"],
  [/swiss|six|zürich|zurich/i, ".SW"],
  [/milano|milan|borsa italiana/i, ".MI"],
  [/madrid/i, ".MC"],
  [/toronto|tsx/i, ".TO"],
];

/**
 * Lager Yahoo-symbolet fra ticker og børs, f.eks. MTRS + Nasdaq Stockholm → MTRS.ST
 * og «NIBE B» → NIBE-B.ST. Et eget symbol på aksjen overstyrer.
 */
export function yahooSymbol(stock: { ticker: string; exchange: string | null; price_symbol?: string | null }): string {
  if (stock.price_symbol?.trim()) return stock.price_symbol.trim().toUpperCase();
  const base = stock.ticker.trim().toUpperCase().replace(/\s+/g, "-");
  if (base.includes(".")) return base;
  const match = SUFFIX.find(([re]) => re.test(stock.exchange ?? ""));
  return base + (match?.[1] ?? "");
}
