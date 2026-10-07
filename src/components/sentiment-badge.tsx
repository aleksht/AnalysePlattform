import type { SentimentLabel } from "@/lib/types";

const styles: Record<SentimentLabel, string> = {
  positiv: "bg-pos-bg text-pos",
  nøytral: "bg-neu-bg text-neu",
  blandet: "bg-warn-bg text-warn",
  negativ: "bg-neg-bg text-neg",
};

const labels: Record<SentimentLabel, string> = {
  positiv: "Positiv",
  nøytral: "Nøytral",
  blandet: "Blandet",
  negativ: "Negativ",
};

/** Samlet stemningsindikator: etikett + en liten skala fra -1 til 1. */
export function SentimentBadge({
  label,
  score,
  size = "sm",
}: {
  label: SentimentLabel | null;
  score?: number | null;
  size?: "sm" | "md";
}) {
  if (!label) {
    return (
      <span className="inline-flex items-center rounded-full bg-neu-bg px-2 py-0.5 text-xs text-muted">
        Ikke analysert
      </span>
    );
  }
  const pct = score == null ? null : Math.round(((Number(score) + 1) / 2) * 100);
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${styles[label]} ${
          size === "md" ? "text-sm" : "text-xs"
        }`}
      >
        {labels[label]}
      </span>
      {pct != null && (
        <span
          className="relative h-1.5 w-14 rounded-full bg-gradient-to-r from-neg via-neu to-pos opacity-80"
          title={`Stemningsscore ${Number(score).toFixed(2)} (fra -1 til 1)`}
        >
          <span
            className="absolute top-1/2 h-3 w-1 -translate-x-1/2 -translate-y-1/2 rounded bg-fg"
            style={{ left: `${pct}%` }}
          />
        </span>
      )}
    </span>
  );
}
