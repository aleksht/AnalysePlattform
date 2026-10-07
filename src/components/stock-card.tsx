import Link from "next/link";
import type { SentimentLabel, Stock } from "@/lib/types";
import type { PriceSpark } from "@/lib/data";
import { formatDate, formatPct, formatPrice } from "@/lib/format";
import { TrendBadge } from "./trend-badge";

export const SENTIMENT_TEXT: Record<SentimentLabel, { label: string; cls: string; stroke: string }> = {
  positiv: { label: "Positiv", cls: "text-pos", stroke: "stroke-pos" },
  nøytral: { label: "Nøytral", cls: "text-muted", stroke: "stroke-neu" },
  blandet: { label: "Blandet", cls: "text-warn", stroke: "stroke-warn" },
  negativ: { label: "Negativ", cls: "text-neg", stroke: "stroke-neg" },
};

/** Minikurve over samlet stemning (−1 til 1) for de siste kjøringene. */
function Sparkline({ values, stroke, scale }: { values: number[]; stroke: string; scale: "sentiment" | "auto" }) {
  if (values.length < 2) return <div className="h-11" aria-hidden />;
  const w = 240;
  const h = 44;
  const lo = scale === "sentiment" ? -1 : Math.min(...values);
  const hi = scale === "sentiment" ? 1 : Math.max(...values);
  const span = hi - lo || 1;
  const pts = values
    .map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(4 + ((hi - v) / span) * (h - 8)).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-11 w-full" aria-hidden preserveAspectRatio="none">
      <polyline
        points={pts}
        fill="none"
        className={stroke}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function StockCard({
  stock,
  spark = [],
  priceSpark,
  tone = "white",
}: {
  stock: Stock;
  spark?: number[];
  priceSpark?: PriceSpark;
  tone?: "white" | "gray";
}) {
  const s = stock.sentiment_label ? SENTIMENT_TEXT[stock.sentiment_label] : null;
  const pv = priceSpark?.values ?? [];
  const yearChange = pv.length >= 2 ? ((pv[pv.length - 1] - pv[0]) / pv[0]) * 100 : null;
  // «Siste år» bare når vi faktisk har et helt år med kurser
  const fullYear =
    priceSpark != null &&
    new Date(priceSpark.to).getTime() - new Date(priceSpark.from).getTime() >= 350 * 86400_000;
  const periodLabel = fullYear ? "Kurs siste år" : `Kurs siden ${formatDate(priceSpark?.from)}`;
  const day = stock.price_change_pct != null ? Number(stock.price_change_pct) : null;
  return (
    <Link
      href={`/aksjer/${stock.id}`}
      className={`group flex min-h-[250px] flex-col gap-3.5 rounded-[22px] p-7 text-fg transition-transform duration-300 hover:scale-[1.012] ${
        tone === "white" ? "bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04)]" : "bg-surface-2"
      }`}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">
        {stock.exchange ?? "Børs ikke oppgitt"}
      </div>
      <div>
        <h3 className="text-[28px] font-bold leading-tight tracking-[-0.02em]">{stock.name}</h3>
        <div className="mt-0.5 text-sm text-muted">{stock.ticker}</div>
      </div>
      {stock.last_price == null && stock.price_error && <div className="text-sm text-muted">Fant ikke kurs</div>}
      {stock.last_price != null && (
        <div className="flex flex-wrap items-baseline gap-x-2.5 tnum">
          <span className="text-[17px] font-semibold">{formatPrice(stock.last_price, stock.price_currency)}</span>
          {day != null && (
            <span className={`text-sm font-medium ${day >= 0 ? "text-pos" : "text-neg"}`}>{formatPct(day)} i dag</span>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        {s ? (
          <span className={`text-[21px] font-semibold ${s.cls}`}>{s.label}</span>
        ) : (
          <span className="text-[21px] font-semibold text-muted">Ikke analysert</span>
        )}
        <span className="text-sm text-muted">
          <TrendBadge direction={stock.sentiment_trend} />
        </span>
      </div>
      {pv.length >= 2 ? (
        <div>
          <Sparkline values={pv} stroke={yearChange! >= 0 ? "stroke-pos" : "stroke-neg"} scale="auto" />
          <div className="mt-1 text-xs text-muted tnum">
            {periodLabel}: <span className={yearChange! >= 0 ? "text-pos" : "text-neg"}>{formatPct(yearChange)}</span>
          </div>
        </div>
      ) : (
        <Sparkline values={spark} stroke={s?.stroke ?? "stroke-neu"} scale="sentiment" />
      )}
      <div className="mt-auto flex justify-between gap-3 text-sm">
        <span className="text-muted">
          {stock.last_run_at ? `Oppdatert ${formatDate(stock.last_run_at)}` : "Ingen research ennå"}
        </span>
        <span className="text-accent group-hover:underline">{stock.last_run_at ? "Les mer ›" : "Kom i gang ›"}</span>
      </div>
    </Link>
  );
}
