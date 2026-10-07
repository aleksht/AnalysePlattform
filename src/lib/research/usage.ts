import { PRICING } from "./config";

export type Usage = {
  requests: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  web_searches: number;
  web_fetches: number;
  models: string[];
};

export const emptyUsage = (): Usage => ({
  requests: 0,
  input_tokens: 0,
  output_tokens: 0,
  cache_read_tokens: 0,
  cache_write_tokens: 0,
  web_searches: 0,
  web_fetches: 0,
  models: [],
});

type ApiUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number; web_fetch_requests?: number } | null;
};

export function addApiUsage(acc: Usage, u: ApiUsage, model: string): Usage {
  return {
    requests: acc.requests + 1,
    input_tokens: acc.input_tokens + (u.input_tokens ?? 0),
    output_tokens: acc.output_tokens + (u.output_tokens ?? 0),
    cache_read_tokens: acc.cache_read_tokens + (u.cache_read_input_tokens ?? 0),
    cache_write_tokens: acc.cache_write_tokens + (u.cache_creation_input_tokens ?? 0),
    web_searches: acc.web_searches + (u.server_tool_use?.web_search_requests ?? 0),
    web_fetches: acc.web_fetches + (u.server_tool_use?.web_fetch_requests ?? 0),
    models: acc.models.includes(model) ? acc.models : [...acc.models, model],
  };
}

export function sumUsage(list: Partial<Usage>[]): Usage {
  return list.reduce<Usage>(
    (a, u) => ({
      requests: a.requests + (u.requests ?? 0),
      input_tokens: a.input_tokens + (u.input_tokens ?? 0),
      output_tokens: a.output_tokens + (u.output_tokens ?? 0),
      cache_read_tokens: a.cache_read_tokens + (u.cache_read_tokens ?? 0),
      cache_write_tokens: a.cache_write_tokens + (u.cache_write_tokens ?? 0),
      web_searches: a.web_searches + (u.web_searches ?? 0),
      web_fetches: a.web_fetches + (u.web_fetches ?? 0),
      models: [...new Set([...a.models, ...(u.models ?? [])])],
    }),
    emptyUsage(),
  );
}

/** Estimert kostnad i USD. */
export function estimateCost(u: Usage): number {
  const cost =
    (u.input_tokens * PRICING.inputPerMTok +
      u.output_tokens * PRICING.outputPerMTok +
      u.cache_read_tokens * PRICING.cacheReadPerMTok +
      u.cache_write_tokens * PRICING.cacheWritePerMTok) /
      1_000_000 +
    u.web_searches * PRICING.perWebSearch;
  return Math.round(cost * 10_000) / 10_000;
}
