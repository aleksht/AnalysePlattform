"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Point = { date: string; close: number };
type RunMark = { date: string; label: string | null };

const RANGES = [
  { key: "1M", label: "1 md.", days: 31 },
  { key: "6M", label: "6 md.", days: 183 },
  { key: "1Y", label: "1 år", days: 366 },
  { key: "5Y", label: "5 år", days: 1830 },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

const H = 260;
const PAD = { top: 16, right: 12, bottom: 30, left: 56 };

const SENT_CLS: Record<string, string> = {
  positiv: "fill-pos",
  negativ: "fill-neg",
  blandet: "fill-warn",
  nøytral: "fill-neu",
};
const SENT_TEXT: Record<string, string> = { positiv: "Positiv", negativ: "Negativ", blandet: "Blandet", nøytral: "Nøytral" };

const dateFmt = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const shortFmt = new Intl.DateTimeFormat("nb-NO", { month: "short", year: "2-digit", timeZone: "UTC" });

function fmtPrice(v: number, currency: string | null) {
  return `${new Intl.NumberFormat("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)}${
    currency ? ` ${currency}` : ""
  }`;
}
function fmtPct(v: number) {
  return `${v >= 0 ? "+" : "−"}${new Intl.NumberFormat("nb-NO", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(v))} %`;
}

/** Kursgraf med valg av periode, verktøytips og markører for researchkjøringer. */
export function PriceChart({
  points,
  runs,
  currency,
}: {
  points: Point[];
  runs: RunMark[];
  currency: string | null;
}) {
  const [range, setRange] = useState<RangeKey>("1Y");
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    if (points.length === 0) return [];
    const days = RANGES.find((r) => r.key === range)!.days;
    const last = new Date(points[points.length - 1].date + "T00:00:00Z").getTime();
    const from = new Date(last - days * 86400_000).toISOString().slice(0, 10);
    return points.filter((p) => p.date >= from);
  }, [points, range]);

  if (points.length < 2) return null;

  const first = data[0];
  const last = data[data.length - 1];
  const changePct = first && last ? ((last.close - first.close) / first.close) * 100 : 0;
  const min = Math.min(...data.map((d) => d.close));
  const max = Math.max(...data.map((d) => d.close));
  const pad = (max - min) * 0.08 || max * 0.02;
  const lo = min - pad;
  const hi = max + pad;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => PAD.top + ((hi - v) / (hi - lo)) * innerH;
  const path = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.close).toFixed(1)}`).join(" ");
  const ticks = [hi - pad, (hi + lo) / 2, lo + pad];

  // Researchkjøringer som faller innenfor perioden, plassert på nærmeste handelsdag
  const marks = runs
    .filter((r) => first && r.date >= first.date && r.date <= last.date)
    .map((r) => {
      let idx = data.findIndex((d) => d.date >= r.date);
      if (idx < 0) idx = data.length - 1;
      return { ...r, idx };
    });

  const active = hover != null ? data[hover] : null;
  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(data.length - 1, Math.round(rel * (data.length - 1)))));
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[13px] text-muted">Kurs · {RANGES.find((r) => r.key === range)!.label}</div>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3">
            <span className="text-[28px] font-bold tracking-[-0.02em] tnum">{fmtPrice(last.close, currency)}</span>
            <span className={`text-[17px] font-semibold tnum ${changePct >= 0 ? "text-pos" : "text-neg"}`}>
              {fmtPct(changePct)}
            </span>
          </div>
        </div>
        <div role="group" aria-label="Periode" className="flex rounded-full bg-neu-bg p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              aria-pressed={range === r.key}
              className={`min-h-9 rounded-full px-3.5 text-[13px] ${
                range === r.key ? "bg-surface font-semibold text-fg shadow-sm" : "text-muted hover:text-fg"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={ref} className="relative mt-4">
        <svg
          width={W}
          height={H}
          className="block max-w-full"
          role="img"
          aria-label={`Kursutvikling ${RANGES.find((r) => r.key === range)!.label}: fra ${fmtPrice(first.close, currency)} til ${fmtPrice(last.close, currency)} (${fmtPct(changePct)})`}
        >
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-border" strokeOpacity={0.6} strokeDasharray={i === 2 ? undefined : "3 4"} />
              <text x={PAD.left - 8} y={y(t)} dy="0.35em" textAnchor="end" className="fill-muted text-[11px] tnum">
                {new Intl.NumberFormat("nb-NO", { maximumFractionDigits: t >= 100 ? 0 : 1 }).format(t)}
              </text>
            </g>
          ))}
          <path d={path} fill="none" className="stroke-series-1" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {marks.map((m, i) => (
            <circle
              key={i}
              cx={x(m.idx)}
              cy={H - PAD.bottom + 1}
              r={4.5}
              className={`${SENT_CLS[m.label ?? "nøytral"] ?? "fill-neu"} stroke-surface-2`}
              strokeWidth={2}
            >
              <title>
                Research {dateFmt.format(new Date(m.date + "T00:00:00Z"))}: {SENT_TEXT[m.label ?? ""] ?? "Ukjent"} stemning
              </title>
            </circle>
          ))}
          <text x={PAD.left} y={H - 6} className="fill-muted text-[11px]">
            {shortFmt.format(new Date(first.date + "T00:00:00Z"))}
          </text>
          <text x={W - PAD.right} y={H - 6} textAnchor="end" className="fill-muted text-[11px]">
            {shortFmt.format(new Date(last.date + "T00:00:00Z"))}
          </text>
          {hover != null && active && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} className="stroke-muted" strokeOpacity={0.5} />
              <circle cx={x(hover)} cy={y(active.close)} r={4.5} className="fill-series-1 stroke-surface-2" strokeWidth={2} />
            </g>
          )}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={innerW}
            height={innerH}
            fill="transparent"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
        {hover != null && active && (
          <div
            className={`pointer-events-none absolute top-0 z-10 whitespace-nowrap rounded-xl bg-surface px-3 py-2 text-xs shadow-lg ring-1 ring-black/5 dark:ring-white/10 ${
              x(hover) / W > 0.7 ? "-translate-x-full" : x(hover) / W < 0.3 ? "" : "-translate-x-1/2"
            }`}
            style={{ left: `${(x(hover) / W) * 100}%` }}
          >
            <div className="font-semibold">{dateFmt.format(new Date(active.date + "T00:00:00Z"))}</div>
            <div className="tnum">{fmtPrice(active.close, currency)}</div>
            <div className={`tnum ${active.close >= first.close ? "text-pos" : "text-neg"}`}>
              {fmtPct(((active.close - first.close) / first.close) * 100)} i perioden
            </div>
          </div>
        )}
      </div>
      {marks.length > 0 && (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted">
          <svg width="10" height="10" aria-hidden>
            <circle cx="5" cy="5" r="4" className="fill-neu" />
          </svg>
          Punktene under grafen er researchkjøringer, farget etter samlet stemning.
        </p>
      )}
    </div>
  );
}
