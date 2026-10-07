import { z } from "zod";

// ---------------------------------------------------------------------------
// Felles verdier
// ---------------------------------------------------------------------------

export const CATEGORIES = ["kunder", "ansatte", "ledelse", "nyheter", "konkurrenter"] as const;
export type Category = (typeof CATEGORIES)[number];

// Må stemme med research_steps() i supabase/migrations/0004_insight.sql
export const STEPS = ["oversikt", ...CATEGORIES, "syntese"] as const;
export type Step = (typeof STEPS)[number];

export type ResearchStep = Exclude<Step, "syntese">;

export const STEP_LABELS: Record<Step, string> = {
  oversikt: "Selskapsoversikt",
  kunder: "Kunder",
  ansatte: "Ansatte",
  ledelse: "Ledelse og resultater",
  nyheter: "Nyheter og bransje",
  konkurrenter: "Konkurrenter",
  syntese: "Oppsummering",
};

export const SENTIMENTS = ["positiv", "nøytral", "negativ"] as const;
export const STRENGTHS = ["sterk", "middels", "svak"] as const;
export const COVERAGE = ["god", "begrenset", "lite"] as const;

export const SOURCE_TYPES = [
  "kundecase",
  "bransjepresse",
  "forum",
  "reddit",
  "linkedin",
  "stillingsannonse",
  "ansattomtale",
  "kvartalsrapport",
  "presentasjon",
  "pressemelding",
  "kontrakt_anbud",
  "partner_distributør",
  "konkurrent",
  "nyhet",
  "selskapets_nettside",
  "annet",
] as const;

export const SOURCE_TYPE_LABELS: Record<(typeof SOURCE_TYPES)[number], string> = {
  kundecase: "Kundecase",
  bransjepresse: "Bransjepresse",
  forum: "Forum",
  reddit: "Reddit",
  linkedin: "LinkedIn",
  stillingsannonse: "Stillingsannonse",
  ansattomtale: "Ansattomtale",
  kvartalsrapport: "Kvartalsrapport",
  presentasjon: "Presentasjon",
  pressemelding: "Pressemelding",
  kontrakt_anbud: "Kontrakt/anbud",
  partner_distributør: "Partner/distributør",
  konkurrent: "Konkurrent",
  nyhet: "Nyhet",
  selskapets_nettside: "Selskapets nettside",
  annet: "Annet",
};

/** Faste temaer per kategori. Kundetemaene følger ønsket inndeling. */
export const CATEGORY_THEMES = {
  kunder: ["produktkvalitet", "leveringstid", "service", "pris", "relasjon", "annet"],
  ansatte: ["vekst", "nedbemanning", "rekrutteringsfokus", "arbeidsmiljø", "ledelse_og_kultur", "annet"],
  ledelse: ["resultater", "guiding", "strategi", "kapitalallokering", "lovnader", "annet"],
  nyheter: ["kontrakter", "bransje", "produkter", "regulering", "oppkjøp", "annet"],
  konkurrenter: ["konkurrentbevegelser", "markedsposisjon", "prising", "teknologi", "annet"],
} as const satisfies Record<Category, readonly string[]>;

export const THEME_LABELS: Record<string, string> = {
  produktkvalitet: "Produktkvalitet",
  leveringstid: "Leveringstid",
  service: "Service",
  pris: "Pris",
  relasjon: "Relasjon",
  vekst: "Vekst",
  nedbemanning: "Nedbemanning",
  rekrutteringsfokus: "Rekrutteringsfokus",
  arbeidsmiljø: "Arbeidsmiljø",
  ledelse_og_kultur: "Ledelse og kultur",
  resultater: "Resultater",
  guiding: "Guiding og mål",
  strategi: "Strategi",
  kapitalallokering: "Kapitalallokering",
  lovnader: "Lovnader",
  kontrakter: "Kontrakter",
  bransje: "Bransje",
  produkter: "Produkter",
  regulering: "Regulering",
  oppkjøp: "Oppkjøp",
  konkurrentbevegelser: "Konkurrentbevegelser",
  markedsposisjon: "Markedsposisjon",
  prising: "Prising",
  teknologi: "Teknologi",
  annet: "Annet",
};

type NonEmpty = [string, ...string[]];

// ---------------------------------------------------------------------------
// Skjema som modellen fyller ut (structured outputs).
// Kildene refereres med id-er (S1, S2 …) fra listen over kilder agenten faktisk
// så i søk og hentinger. Enum-et gjør det umulig å oppgi en kilde som ikke finnes.
// ---------------------------------------------------------------------------

function themeEntry(category: Category) {
  return z.object({
    theme: z.enum(CATEGORY_THEMES[category]),
    coverage: z.enum(COVERAGE).describe("Hvor mye offentlig informasjon som finnes om temaet"),
    coverage_note: z
      .string()
      .nullable()
      .describe('Påkrevd ved "begrenset" eller "lite", f.eks. "Lite offentlig tilgjengelig kundeinformasjon om leveringstid."'),
    summary: z.string().describe("1–3 setninger på norsk. Bare det kildene støtter."),
  });
}

function findingEntry(category: Category, sourceIds: NonEmpty) {
  return z.object({
    claim: z.string().describe("Påstanden på norsk, maks to setninger"),
    theme: z.enum(CATEGORY_THEMES[category]),
    sentiment: z.enum(SENTIMENTS),
    quote: z
      .string()
      .nullable()
      .describe("Kort sitat (originalspråk) eller parafrase fra kilden. Maks 300 tegn."),
    is_paraphrase: z.boolean().describe("true hvis quote er en parafrase, false hvis ordrett sitat"),
    source_ref: z.enum(sourceIds).describe("Id-en til kilden som støtter påstanden"),
    source_type: z.enum(SOURCE_TYPES),
    published_at: z.string().nullable().describe("Publiseringsdato YYYY-MM-DD, eller null hvis ukjent"),
    evidence_strength: z
      .enum(STRENGTHS)
      .describe("sterk: primærkilde/navngitt kunde/tall. middels: troverdig sekundærkilde. svak: enkeltinnlegg, anonym, gammel"),
    is_red_flag: z
      .boolean()
      .describe("true bare for vesentlige negative funn som hører til denne kategorien. Krever sentiment negativ."),
  });
}

export function categoryOutputSchema(category: Category, sourceIds: NonEmpty) {
  const base = z.object({
    summary: z.string().describe("Oppsummering av kategorien på norsk, 2–4 setninger"),
    themes: z.array(themeEntry(category)).describe("Ett element per tema i kategorien"),
    findings: z.array(findingEntry(category, sourceIds)),
  });

  if (category !== "ledelse") return base;

  return base.extend({
    key_points: z
      .array(
        z.object({
          point: z.string().describe("Hovedpunkt fra kvartalsrapport/presentasjon, på norsk"),
          period: z.string().describe('F.eks. "Q2 2026"'),
          source_ref: z.enum(sourceIds),
        }),
      )
      .describe("Hovedpunkter fra de siste kvartalsrapportene og presentasjonene"),
    promises: z
      .array(
        z.object({
          promise: z.string().describe("Hva ledelsen har lovet eller satt som mål"),
          said_when: z.string().describe('Når det ble sagt, f.eks. "CMD 2024" eller "Q4 2025"'),
          status: z.enum(["levert", "delvis", "ikke_levert", "for_tidlig"]),
          comment: z.string().describe("Hva som faktisk er levert, med tall der det finnes"),
          source_ref: z.enum(sourceIds),
        }),
      )
      .describe("Hva ledelsen har lovet mot hva som er levert"),
  });
}

export function overviewOutputSchema(sourceIds: NonEmpty) {
  const named = z.object({
    name: z.string(),
    note: z.string().describe("Kort forklaring på norsk"),
    source_ref: z.enum(sourceIds),
  });
  return z.object({
    description: z.string().describe("Kort selskapsbeskrivelse på norsk, 3–5 setninger"),
    segments: z.array(
      z.object({
        name: z.string(),
        description: z.string(),
        share_of_revenue: z.string().nullable().describe('F.eks. "ca. 45 %", eller null hvis ukjent'),
      }),
    ),
    key_customers: z.array(named).describe("Navngitte kunder som kildene bekrefter"),
    competitors: z.array(named),
    coverage_note: z.string().nullable().describe("Hva det fantes lite informasjon om"),
  });
}

export function synthesisOutputSchema(findingIds: NonEmpty) {
  const refs = z.array(z.enum(findingIds)).min(1).describe("Id-ene til funnene som støtter punktet");
  return z.object({
    headline: z.string().describe("Én setning som oppsummerer bildet, på norsk"),
    takeaways: z
      .array(z.object({ text: z.string(), sentiment: z.enum(SENTIMENTS), finding_refs: refs }))
      .describe("3–6 hovedkonklusjoner, de viktigste først"),
    changes: z
      .array(
        z.object({
          text: z.string(),
          direction: z.enum(["bedre", "verre", "uendret", "ny"]),
          finding_refs: refs,
        }),
      )
      .describe("Hva som har endret seg siden forrige kjøring"),
    watch_points: z
      .array(z.object({ text: z.string(), finding_refs: refs }))
      .describe("2–4 ting investoren bør følge med på fremover"),
    red_flags: z
      .array(
        z.object({
          text: z.string().describe("Det negative forholdet, 1–2 setninger"),
          category: z.enum(CATEGORIES).describe("Kategorien forholdet hører mest naturlig hjemme i"),
          finding_refs: refs,
        }),
      )
      .describe("Røde flagg slått sammen: ett punkt per forhold, de alvorligste først, maks 6"),
    data_gaps: z.array(z.string()).describe("Temaer med lite offentlig informasjon"),
  });
}
export type SynthesisOutput = z.infer<ReturnType<typeof synthesisOutputSchema>>;

export type CategoryOutput = z.infer<ReturnType<typeof categoryOutputSchema>> & {
  key_points?: { point: string; period: string; source_ref: string }[];
  promises?: {
    promise: string;
    said_when: string;
    status: "levert" | "delvis" | "ikke_levert" | "for_tidlig";
    comment: string;
    source_ref: string;
  }[];
};
export type OverviewOutput = z.infer<ReturnType<typeof overviewOutputSchema>>;

// ---------------------------------------------------------------------------
// Skjema for det som lagres. Hvert funn valideres mot dette før det skrives.
// ---------------------------------------------------------------------------

const isoDate = z.iso.date();

export const StoredFindingSchema = z.object({
  claim: z.string().trim().min(1).max(1000),
  category: z.enum(CATEGORIES),
  theme: z.string().min(1),
  sentiment: z.enum(SENTIMENTS),
  quote: z.string().max(1000).nullable(),
  is_paraphrase: z.boolean(),
  source_url: z.url({ protocol: /^https?$/ }),
  source_type: z.enum(SOURCE_TYPES),
  published_at: isoDate.nullable(),
  evidence_strength: z.enum(STRENGTHS),
  is_red_flag: z.boolean(),
});
export type StoredFinding = z.infer<typeof StoredFindingSchema>;

/** Gjør en dato fra modellen om til YYYY-MM-DD, eller null hvis den ikke er gyldig. */
export function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v) && isoDate.safeParse(v).success) return v;
  if (/^\d{4}-\d{2}$/.test(v)) return `${v}-01`;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
