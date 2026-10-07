const LABELS: Record<string, string> = {
  max_uses_exceeded: "søketaket ble nådd",
  too_many_requests: "for mange forespørsler",
  unavailable: "tjenesten var utilgjengelig",
  url_not_accessible: "siden kunne ikke hentes",
  url_not_allowed: "siden tillater ikke henting",
  unsupported_content_type: "filtypen støttes ikke",
  query_too_long: "søket var for langt",
  invalid_tool_input: "ugyldig søk",
};

/** Kort norsk beskrivelse av feilkoder fra web search og web fetch, f.eks. "søk: for mange forespørsler (2)". */
export function describeToolErrors(errors: Record<string, number> | null | undefined): string {
  if (!errors) return "";
  return Object.entries(errors)
    .map(([key, n]) => {
      const [tool, code] = key.split(":");
      return `${tool === "fetch" ? "henting" : "søk"}: ${LABELS[code] ?? code} (${n})`;
    })
    .join(", ");
}

/** Feil som faktisk påvirker grunnlaget. Mislykkede hentinger av enkeltsider er vanlige og regnes ikke med. */
export function significantToolErrors(errors: Record<string, number> | null | undefined): Record<string, number> {
  return Object.fromEntries(Object.entries(errors ?? {}).filter(([k]) => k.startsWith("search:")));
}
