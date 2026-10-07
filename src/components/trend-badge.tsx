import type { Direction } from "@/lib/types";

const STYLE: Record<Direction, { label: string; icon: string; cls: string }> = {
  bedre: { label: "Bedre", icon: "↗", cls: "text-pos" },
  verre: { label: "Verre", icon: "↘", cls: "text-neg" },
  uendret: { label: "Uendret", icon: "→", cls: "text-muted" },
  ny: { label: "Ny", icon: "•", cls: "text-muted" },
  borte: { label: "Ingen funn nå", icon: "○", cls: "text-muted" },
};

/** Endring mot forrige kjøring. Har alltid tekst, så det ikke bare er farge som bærer betydningen. */
export function TrendBadge({
  direction,
  uncertain = false,
  compact = false,
}: {
  direction: Direction | null | undefined;
  uncertain?: boolean;
  compact?: boolean;
}) {
  if (!direction || direction === "ny") return null;
  const s = STYLE[direction];
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${s.cls}`}
      title={uncertain ? `${s.label} mot forrige kjøring (få funn, usikkert)` : `${s.label} mot forrige kjøring`}
    >
      <span aria-hidden>{s.icon}</span>
      {!compact && (
        <span>
          {s.label}
          {uncertain && <span className="font-normal text-muted"> (usikkert)</span>}
        </span>
      )}
      {compact && <span className="sr-only">{s.label}</span>}
    </span>
  );
}
