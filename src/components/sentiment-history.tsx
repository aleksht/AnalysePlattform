"use client";

import { useEffect, useRef, useState } from "react";

export type HistoryPoint = { id: string; date: string; score: number | null; label: string | null; findings: number };

const H = 180;
const PAD = { top: 14, right: 16, bottom: 28, left: 64 };
const LABEL: Record<string, string> = { positiv: "Positiv", nøytral: "Nøytral", negativ: "Negativ", blandet: "Blandet" };

const dateFmt = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", timeZone: "Europe/Oslo" });

/** Samlet stemning per kjøring over tid. Én serie, skala fra -1 (negativ) til 1 (positiv). */
export function SentimentHistory({ points }: { points: HistoryPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  // Tegner i faktisk bredde, så teksten beholder lesbar størrelse også på mobil
  const ref = useRef<HTMLElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const data = points.filter((p): p is HistoryPoint & { score: number } => p.score != null);
  if (data.length === 0) return null;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => PAD.top + ((1 - v) / 2) * innerH;
  const path = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.score).toFixed(1)}`).join(" ");
  const active = hover != null ? data[hover] : null;
  const hitW = data.length === 1 ? innerW : innerW / (data.length - 1);

  return (
    <figure ref={ref} className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="block max-w-full overflow-visible"
        role="img"
        aria-label={`Samlet stemning over ${data.length} kjøringer, siste ${data[data.length - 1].score.toFixed(2)}`}
        onMouseLeave={() => setHover(null)}
      >
        {/* Rutenett: positiv, nøytral, negativ */}
        {[1, 0, -1].map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              className={v === 0 ? "stroke-border" : "stroke-border/60"}
              strokeWidth={1}
              strokeDasharray={v === 0 ? undefined : "3 4"}
            />
            <text x={PAD.left - 10} y={y(v)} dy="0.35em" textAnchor="end" className="fill-muted text-[11px]">
              {v === 1 ? "Positiv" : v === 0 ? "Nøytral" : "Negativ"}
            </text>
          </g>
        ))}
        {data.length > 1 && <path d={path} fill="none" className="stroke-series-1" strokeWidth={2} strokeLinejoin="round" />}
        {hover != null && (
          <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} className="stroke-muted/50" strokeWidth={1} />
        )}
        {data.map((d, i) => (
          <circle
            key={d.id}
            cx={x(i)}
            cy={y(d.score)}
            r={hover === i ? 5 : 4}
            className="fill-series-1 stroke-surface"
            strokeWidth={2}
          />
        ))}
        {/* Datoer for første og siste kjøring */}
        <text x={x(0)} y={H - 8} textAnchor={data.length === 1 ? "middle" : "start"} className="fill-muted text-[11px]">
          {dateFmt.format(new Date(data[0].date))}
        </text>
        {data.length > 1 && (
          <text x={x(data.length - 1)} y={H - 8} textAnchor="end" className="fill-muted text-[11px]">
            {dateFmt.format(new Date(data[data.length - 1].date))}
          </text>
        )}
        {/* Treffflater større enn punktene */}
        {data.map((d, i) => (
          <rect
            key={`hit-${d.id}`}
            x={x(i) - hitW / 2}
            y={PAD.top}
            width={hitW}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onTouchStart={() => setHover(i)}
          />
        ))}
      </svg>
      {active && hover != null && (
        <div
          className={`pointer-events-none absolute top-0 z-10 whitespace-nowrap rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs shadow-md ${
            x(hover) / W > 0.7 ? "-translate-x-full" : x(hover) / W < 0.3 ? "" : "-translate-x-1/2"
          }`}
          style={{ left: `${(x(hover) / W) * 100}%` }}
        >
          <div className="font-medium">{dateFmt.format(new Date(active.date))}</div>
          <div className="text-muted">
            {LABEL[active.label ?? ""] ?? "–"} · {active.score.toFixed(2)} · {active.findings} funn
          </div>
        </div>
      )}
      {data.length === 1 && (
        <figcaption className="mt-1 text-xs text-muted">Trenden vises når det finnes mer enn én kjøring.</figcaption>
      )}
    </figure>
  );
}
