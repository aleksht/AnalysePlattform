import { computeSentiment } from "./scoring";

export type Score = { score: number; label: string; count: number };
/** Nøkler: "overall", "<kategori>" og "<kategori>.<tema>" */
export type ThemeScores = Record<string, Score | { score: number; label: string } | null>;

export type Direction = "bedre" | "verre" | "uendret" | "ny" | "borte";

export type TrendEntry = {
  key: string;
  category: string | null;
  theme: string | null;
  direction: Direction;
  delta: number | null;
  current: number | null;
  previous: number | null;
  /** Få funn bak sammenligningen. Vises som usikker. */
  uncertain: boolean;
};

export type Trend = {
  previous_run_id: string | null;
  previous_finished_at: string | null;
  entries: TrendEntry[];
};

/** Endring i stemningsscore (fra -1 til 1) som regnes som en reell endring. */
const THRESHOLD = 0.25;

type ScoredFinding = {
  category: string;
  theme: string;
  sentiment: "positiv" | "nøytral" | "negativ";
  evidence_strength: "sterk" | "middels" | "svak";
};

/** Stemning totalt, per kategori og per tema. */
export function computeThemeScores(findings: ScoredFinding[]): ThemeScores {
  const groups = new Map<string, ScoredFinding[]>();
  for (const f of findings) {
    for (const key of [f.category, `${f.category}.${f.theme}`]) {
      groups.set(key, [...(groups.get(key) ?? []), f]);
    }
  }
  const out: ThemeScores = {};
  const overall = computeSentiment(findings);
  out.overall = overall ? { ...overall, count: findings.length } : null;
  for (const [key, group] of groups) {
    const s = computeSentiment(group);
    if (s) out[key] = { ...s, count: group.length };
  }
  return out;
}

const countOf = (s: ThemeScores[string]) => (s && "count" in s ? s.count : 0);

/** Sammenligner to kjøringer: bedre, verre eller uendret per kategori og tema. */
export function compareScores(
  current: ThemeScores | null,
  previous: ThemeScores | null,
  previousRun: { id: string; finished_at: string | null } | null,
): Trend {
  const entries: TrendEntry[] = [];
  if (current) {
    const keys = new Set([...Object.keys(current), ...Object.keys(previous ?? {})]);
    for (const key of keys) {
      const cur = current[key] ?? null;
      const prev = previous?.[key] ?? null;
      const [category, theme] = key === "overall" ? [null, null] : key.split(".");
      let direction: Direction;
      let delta: number | null = null;
      if (!prev && !cur) continue;
      if (!prev) direction = "ny";
      else if (!cur) direction = "borte";
      else {
        delta = Math.round((cur.score - prev.score) * 1000) / 1000;
        direction = delta >= THRESHOLD ? "bedre" : delta <= -THRESHOLD ? "verre" : "uendret";
      }
      entries.push({
        key,
        category: category ?? null,
        theme: theme ?? null,
        direction,
        delta,
        current: cur?.score ?? null,
        previous: prev?.score ?? null,
        uncertain: Math.min(countOf(cur) || Infinity, countOf(prev) || Infinity) < 2,
      });
    }
  }
  return {
    previous_run_id: previousRun?.id ?? null,
    previous_finished_at: previousRun?.finished_at ?? null,
    entries: previousRun ? entries : entries.map((e) => ({ ...e, direction: "ny" as const, delta: null })),
  };
}
