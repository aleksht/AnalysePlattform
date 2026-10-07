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
