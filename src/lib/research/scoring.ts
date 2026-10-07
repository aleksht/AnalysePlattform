import type { SentimentLabel } from "@/lib/types";

type ScoredFinding = {
  sentiment: "positiv" | "nøytral" | "negativ";
  evidence_strength: "sterk" | "middels" | "svak";
};

const WEIGHT = { sterk: 1, middels: 0.6, svak: 0.3 } as const;
const VALUE = { positiv: 1, nøytral: 0, negativ: -1 } as const;

/**
 * Samlet stemning fra -1 til 1, vektet etter evidensstyrke.
 * "Blandet" brukes når både positive og negative funn har betydelig vekt.
 */
export function computeSentiment(
  findings: ScoredFinding[],
): { score: number; label: SentimentLabel } | null {
  if (findings.length === 0) return null;
  let total = 0;
  let sum = 0;
  let pos = 0;
  let neg = 0;
  for (const f of findings) {
    const w = WEIGHT[f.evidence_strength];
    total += w;
    sum += w * VALUE[f.sentiment];
    if (f.sentiment === "positiv") pos += w;
    if (f.sentiment === "negativ") neg += w;
  }
  const score = Math.round((sum / total) * 1000) / 1000;
  let label: SentimentLabel;
  if (score >= 0.25) label = "positiv";
  else if (score <= -0.25) label = "negativ";
  else if (pos / total >= 0.3 && neg / total >= 0.3) label = "blandet";
  else label = "nøytral";
  return { score, label };
}
