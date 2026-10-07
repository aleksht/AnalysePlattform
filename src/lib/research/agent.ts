import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { MAX_CONTINUATIONS, MIN_MS_FOR_REQUEST, RESEARCH_MODEL, TOOL_LIMITS } from "./config";
import { EXTRACT_SYSTEM, RESEARCH_SYSTEM, extractUserPrompt, researchUserPrompt, type StockContext } from "./prompts";
import type { ResearchStep } from "./schema";
import { collectSources, formatSourceList, type SeenSource } from "./sources";
import { addApiUsage, type Usage } from "./usage";
import { toStrictJsonSchema } from "./json-schema";

// Server-side fallback: avviste svar prøves automatisk på nytt med en annen modell.
const BETAS: Anthropic.Beta.AnthropicBeta[] = ["server-side-fallback-2026-07-01"];

let client: Anthropic | null = null;
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY mangler");
  client ??= new Anthropic({ maxRetries: 3, timeout: 280_000 });
  return client;
}

export class RefusalError extends Error {}

/** Tilstand som lagres mellom funksjonskall når et steg må fortsette senere. */
export type ResearchState = {
  messages: Anthropic.Beta.BetaMessageParam[];
  done: boolean;
};

export type ResearchProgress =
  | { kind: "yield"; state: ResearchState; usage: Usage }
  | { kind: "done"; notes: string; sources: SeenSource[]; usage: Usage };

/**
 * Researchfasen: modellen søker og leser med web search og web fetch.
 * Fortsetter ved pause_turn, og gir fra seg kontrollen hvis tiden er i ferd med å renne ut.
 */
export async function runResearch(opts: {
  step: ResearchStep;
  stock: StockContext;
  state: ResearchState | null;
  usage: Usage;
  deadline: number;
}): Promise<ResearchProgress> {
  const { step, stock, deadline } = opts;
  let usage = opts.usage;
  const limits = TOOL_LIMITS[step];
  const today = new Date().toISOString().slice(0, 10);

  const messages: Anthropic.Beta.BetaMessageParam[] = opts.state?.messages ?? [
    { role: "user", content: researchUserPrompt(step, stock, today) },
  ];
  let done = opts.state?.done ?? false;

  for (let i = 0; !done && i <= MAX_CONTINUATIONS; i++) {
    if (deadline - Date.now() < MIN_MS_FOR_REQUEST) {
      return { kind: "yield", state: { messages, done }, usage };
    }

    const response = await anthropic()
      .beta.messages.stream({
        model: RESEARCH_MODEL,
        max_tokens: 16000,
        betas: BETAS,
        fallbacks: "default",
        system: RESEARCH_SYSTEM,
        cache_control: { type: "ephemeral" },
        output_config: { effort: "medium" },
        tools: [
          { type: "web_search_20260318", name: "web_search", max_uses: limits.searches },
          { type: "web_fetch_20260318", name: "web_fetch", max_uses: limits.fetches, max_content_tokens: 20000 },
        ],
        messages,
      })
      .finalMessage();

    usage = addApiUsage(usage, response.usage, response.model);

    if (response.stop_reason === "refusal") {
      throw new RefusalError(
        `Modellen avslo forespørselen (${response.stop_details?.category ?? "ukjent kategori"}).`,
      );
    }

    messages.push({ role: "assistant", content: response.content });
    // pause_turn: send svaret tilbake uendret, så fortsetter serveren der den slapp
    done = response.stop_reason !== "pause_turn";
  }

  const assistantContent = messages.filter((m) => m.role === "assistant").map((m) => m.content);
  const notes = assistantContent
    .flatMap((c) => (Array.isArray(c) ? c : []))
    .filter((b): b is Anthropic.Beta.BetaTextBlockParam => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  return { kind: "done", notes, sources: collectSources(assistantContent), usage };
}

/**
 * Uttrekksfasen: gjør notatene om til JSON etter et zod-skjema (structured outputs),
 * og validerer svaret med zod. Prøver én gang til hvis svaret ikke validerer.
 */
export async function extractStructured<S extends z.ZodType>(opts: {
  schema: S;
  usage: Usage;
  /** Standard: uttrekk fra researchnotater */
  system?: string;
  prompt?: string;
  effort?: "low" | "medium";
  stepLabel?: string;
  stock?: StockContext;
  notes?: string;
  sources?: SeenSource[];
}): Promise<{ data: z.infer<S>; usage: Usage }> {
  const prompt =
    opts.prompt ??
    extractUserPrompt(opts.stepLabel ?? "", opts.stock!, opts.notes ?? "", formatSourceList(opts.sources ?? []));
  let usage = opts.usage;
  let lastError = "";
  const jsonSchema = toStrictJsonSchema(opts.schema);

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await anthropic().beta.messages.create({
      model: RESEARCH_MODEL,
      max_tokens: 16000,
      betas: BETAS,
      fallbacks: "default",
      system: opts.system ?? EXTRACT_SYSTEM,
      output_config: { effort: opts.effort ?? "low", format: { type: "json_schema", schema: jsonSchema } },
      messages: [{ role: "user", content: prompt }],
    });
    usage = addApiUsage(usage, response.usage, response.model);

    if (response.stop_reason === "refusal") {
      throw new RefusalError("Modellen avslo uttrekket.");
    }
    if (response.stop_reason === "max_tokens") {
      lastError = "Svaret ble for langt (max_tokens).";
      continue;
    }

    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      lastError = "Svaret var ikke gyldig JSON.";
      continue;
    }
    const parsed = opts.schema.safeParse(json);
    if (parsed.success) return { data: parsed.data, usage };
    lastError = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
  }
  throw new Error(`Ugyldig strukturert svar: ${lastError}`);
}
