export type Sentiment = "positiv" | "nøytral" | "negativ";
export type SentimentLabel = Sentiment | "blandet";
export type Category = "kunder" | "ansatte" | "ledelse" | "nyheter" | "konkurrenter";
export type EvidenceStrength = "sterk" | "middels" | "svak";
export type RunStatus = "queued" | "running" | "done" | "failed" | "cancelled";

export type Folder = {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

export type StockOverview = {
  description?: string;
  segments?: { name: string; description?: string; share_of_revenue?: string | null }[];
  key_customers?: { name: string; note?: string; source_url?: string }[];
  competitors?: { name: string; note?: string; source_url?: string }[];
  coverage_note?: string | null;
};

export type Stock = {
  id: string;
  folder_id: string | null;
  name: string;
  ticker: string;
  exchange: string | null;
  notes: string | null;
  overview: StockOverview | null;
  sentiment_score: number | null;
  sentiment_label: SentimentLabel | null;
  last_run_at: string | null;
  sentiment_trend: "bedre" | "verre" | "uendret" | "ny" | null;
  price_symbol: string | null;
  last_price: number | null;
  price_change_pct: number | null;
  price_currency: string | null;
  price_updated_at: string | null;
  price_error: string | null;
  weekly_auto: boolean;
  created_at: string;
};

export type ResearchRun = {
  id: string;
  stock_id: string;
  status: RunStatus;
  trigger: "manual" | "weekly";
  current_step: string | null;
  steps_total: number;
  steps_done: number;
  input_tokens: number;
  output_tokens: number;
  web_searches: number;
  cost_usd: number;
  error: string | null;
  created_at: string;
  finished_at: string | null;
};

export type Finding = {
  id: string;
  run_id: string;
  category: Category;
  theme: string;
  claim: string;
  sentiment: Sentiment;
  quote: string | null;
  is_paraphrase: boolean;
  source_url: string;
  source_type: string;
  published_at: string | null;
  evidence_strength: EvidenceStrength;
  is_red_flag: boolean;
};

export type Source = {
  id: string;
  url: string;
  title: string | null;
  source_type: string;
  published_at: string | null;
  accessed_at: string;
};

export type RunSection = {
  summary: string;
  tool_errors?: Record<string, number>;
  themes: { theme: string; coverage: "god" | "begrenset" | "lite"; coverage_note: string | null; summary: string }[];
  key_points?: { point: string; period: string; source: { url: string; title: string | null } }[];
  promises?: {
    promise: string;
    said_when: string;
    status: "levert" | "delvis" | "ikke_levert" | "for_tidlig";
    comment: string;
    source: { url: string; title: string | null };
  }[];
};

export type { Trend, TrendEntry, Direction } from "@/lib/research/trend";
export type { Report } from "@/lib/research/synthesis";

export type CompletedRun = ResearchRun & {
  trend: import("@/lib/research/trend").Trend | null;
  report: import("@/lib/research/synthesis").Report | null;
  theme_scores: import("@/lib/research/trend").ThemeScores | null;
  sections: Partial<Record<Category, RunSection>> | null;
  findings_count: number;
  red_flags: number;
  web_fetches: number;
};
