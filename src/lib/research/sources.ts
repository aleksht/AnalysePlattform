/** En kilde agenten faktisk har sett i et søkeresultat eller en henting. */
export type SeenSource = {
  ref: string; // S1, S2 …
  url: string;
  title: string | null;
  page_age: string | null;
  fetched: boolean;
};

const TRACKING_PARAMS = /^(utm_|fbclid|gclid|mc_cid|mc_eid|ref$|ref_src$)/i;

/** Fjerner fragment og sporingsparametre, men beholder adressen ellers som den er. */
export function cleanUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
    }
    return u.toString();
  } catch {
    return null;
  }
}

/** Normaliserer en URL for sammenligning: uten fragment, sporingsparametre og avsluttende skråstrek. */
export function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
    }
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    let s = u.toString();
    if (s.endsWith("/") && u.pathname !== "/") s = s.slice(0, -1);
    return s;
  } catch {
    return null;
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

type Found = { url: string; title: string | null; page_age: string | null; fetched: boolean };

/**
 * Går gjennom svarblokkene (også de som er nøstet inne i dynamisk filtrering)
 * og samler alle URL-er fra søkeresultater, hentinger og sitater.
 */
function walk(node: unknown, out: Found[]) {
  if (Array.isArray(node)) {
    for (const n of node) walk(n, out);
    return;
  }
  if (!node || typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : null);

  switch (o.type) {
    case "web_search_result":
      if (str(o.url)) out.push({ url: o.url as string, title: str(o.title), page_age: str(o.page_age), fetched: false });
      break;
    case "web_search_result_location":
      if (str(o.url)) out.push({ url: o.url as string, title: str(o.title), page_age: null, fetched: false });
      break;
    case "web_fetch_result": {
      const doc = o.content as Record<string, unknown> | undefined;
      if (str(o.url)) out.push({ url: o.url as string, title: str(doc?.title), page_age: null, fetched: true });
      break;
    }
  }
  for (const [key, value] of Object.entries(o)) {
    // Selve dokumentinnholdet og krypterte felt trenger vi ikke å gå gjennom
    if (key === "encrypted_content" || key === "encrypted_index" || key === "data" || key === "source") continue;
    if (value && typeof value === "object") walk(value, out);
  }
}

export function collectSources(contents: unknown[], limit = 150): SeenSource[] {
  const found: Found[] = [];
  walk(contents, found);

  const byUrl = new Map<string, Found>();
  for (const f of found) {
    const key = normalizeUrl(f.url);
    if (!key) continue;
    const prev = byUrl.get(key);
    byUrl.set(key, {
      url: prev?.url ?? cleanUrl(f.url) ?? f.url,
      title: prev?.title ?? f.title,
      page_age: prev?.page_age ?? f.page_age,
      fetched: Boolean(prev?.fetched || f.fetched),
    });
  }

  // Hentede sider først: de har agenten faktisk lest i sin helhet
  const list = [...byUrl.values()].sort((a, b) => Number(b.fetched) - Number(a.fetched)).slice(0, limit);
  return list.map((s, i) => ({ ref: `S${i + 1}`, ...s }));
}

export function formatSourceList(sources: SeenSource[]): string {
  return sources
    .map(
      (s) =>
        `[${s.ref}] ${s.title ?? "(uten tittel)"}\n    ${s.url}${s.page_age ? `\n    Dato/alder: ${s.page_age}` : ""}${
          s.fetched ? "\n    (lest i sin helhet)" : ""
        }`,
    )
    .join("\n");
}
