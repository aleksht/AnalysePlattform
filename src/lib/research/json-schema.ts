import { z } from "zod";

type JsonSchema = Record<string, unknown>;

/**
 * Lager et JSON-skjema for structured outputs direkte fra zod.
 *
 * Vi bruker ikke SDK-hjelperen (betaZodOutputFormat) fordi den i @anthropic-ai/sdk 0.131
 * flytter `enum` inn i beskrivelsen i stedet for å beholde det som en begrensning.
 * Da ville ikke API-et lenger garantere at kilde-id-er og temaer er gyldige.
 */
export function toStrictJsonSchema(schema: z.ZodType): JsonSchema {
  const json = z.toJSONSchema(schema, { target: "draft-2020-12", io: "output" }) as JsonSchema;
  delete json.$schema;
  return strict(json);
}

function strict(node: unknown): JsonSchema {
  if (!node || typeof node !== "object") return node as JsonSchema;
  if (Array.isArray(node)) return node.map(strict) as unknown as JsonSchema;

  const out: JsonSchema = {};
  for (const [key, value] of Object.entries(node as JsonSchema)) {
    if (key === "properties" && value && typeof value === "object") {
      out.properties = Object.fromEntries(Object.entries(value as JsonSchema).map(([k, v]) => [k, strict(v)]));
    } else if (key === "$defs" && value && typeof value === "object") {
      out.$defs = Object.fromEntries(Object.entries(value as JsonSchema).map(([k, v]) => [k, strict(v)]));
    } else if (["items", "anyOf", "allOf"].includes(key)) {
      out[key] = strict(value);
    } else {
      out[key] = value;
    }
  }
  if (out.type === "object") {
    out.additionalProperties = false;
    out.required = Object.keys((out.properties as JsonSchema) ?? {});
  }
  return out;
}
