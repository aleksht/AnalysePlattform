import "server-only";
import { Document, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { CATEGORIES, STEP_LABELS, THEME_LABELS } from "@/lib/research/schema";
import { hostOf } from "@/lib/research/sources";
import type { CompletedRun, Finding, Source, Stock, TrendEntry } from "@/lib/types";

// Farger fra appen: logogrønn, nesten svart tekst og dempet grå
const C = {
  brand: "#00a160",
  accent: "#007a48",
  fg: "#1d1d1f",
  muted: "#6e6e73",
  line: "#d2d2d7",
  soft: "#f5f5f7",
  pos: "#248a3d",
  neg: "#d70015",
  warn: "#b25000",
};

const s = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 56, paddingHorizontal: 52, fontFamily: "Helvetica", fontSize: 10.5, color: C.fg, lineHeight: 1.45 },
  top: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18, fontSize: 9, color: C.muted },
  brand: { color: C.brand, fontFamily: "Helvetica-Bold" },
  eyebrow: { fontSize: 10, color: C.muted, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 30, fontFamily: "Helvetica-Bold", marginTop: 4, letterSpacing: -0.6, lineHeight: 1.15 },
  headline: { fontSize: 15, fontFamily: "Helvetica-Bold", marginTop: 8, lineHeight: 1.3 },
  pills: { flexDirection: "row", flexWrap: "wrap", marginTop: 12 },
  pill: { backgroundColor: C.soft, borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8, marginRight: 6, marginBottom: 4, fontSize: 9.5 },
  h2: { fontSize: 15, fontFamily: "Helvetica-Bold", marginTop: 22, marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: C.line },
  h3: { fontSize: 11.5, fontFamily: "Helvetica-Bold", marginTop: 10 },
  row: { flexDirection: "row", marginBottom: 6 },
  num: { width: 18, color: C.muted, fontFamily: "Helvetica-Bold" },
  grow: { flex: 1 },
  cite: { color: C.accent, fontSize: 8.5 },
  small: { fontSize: 9, color: C.muted },
  trendRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: C.line },
  chip: { fontSize: 8.5, color: C.muted, marginRight: 8 },
  footerLeft: { position: "absolute", bottom: 26, left: 52, right: 52, fontSize: 8, color: C.muted },
  source: { flexDirection: "row", marginBottom: 3, fontSize: 9 },
});

/** Standardfontene i PDF dekker ikke alle tegn. Bytter ut de vanligste og fjerner resten. */
function t(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/[−‒]/g, "-")
    .replace(/↗/g, "opp")
    .replace(/↘/g, "ned")
    .replace(/→/g, "->")
    .replace(/ | /g, " ")
    .replace(/[^\u0000-ÿ–—‘’“”•…€]/g, "");
}

const SENT: Record<string, string> = { positiv: "Positiv", negativ: "Negativ", nøytral: "Nøytral", blandet: "Blandet" };
const SENT_COLOR: Record<string, string> = { positiv: C.pos, negativ: C.neg, nøytral: C.muted, blandet: C.warn };
const DIR: Record<string, string> = { bedre: "Bedre", verre: "Verre", uendret: "Uendret", ny: "Ny", borte: "Ingen funn nå" };
const DIR_COLOR: Record<string, string> = { bedre: C.pos, verre: C.neg, uendret: C.muted, ny: C.muted, borte: C.muted };
const PROMISE: Record<string, string> = { levert: "Levert", delvis: "Delvis levert", ikke_levert: "Ikke levert", for_tidlig: "For tidlig å si" };

const dateFmt = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Oslo" });
const fmtDate = (v: string | null | undefined) => (v ? dateFmt.format(new Date(v)) : "–");
const fmtNum = (v: number, d = 2) =>
  t(new Intl.NumberFormat("nb-NO", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v));

export type ReportPdfProps = {
  stock: Stock;
  run: CompletedRun;
  findings: Finding[];
  sources: Source[];
  priceYearChange: number | null;
};

export function ReportPdf({ stock, run, findings, sources, priceYearChange }: ReportPdfProps) {
  const report = run.report;
  const trend = run.trend;
  const overall = run.theme_scores?.overall ?? null;
  const overallTrend = trend?.entries.find((e) => e.key === "overall");
  const sections = run.sections ?? {};
  const titleOf = new Map(sources.map((x) => [x.url, x.title]));

  // Nummererte kilder, i den rekkefølgen de brukes
  const index = new Map<string, number>();
  const cite = (refs: { url: string }[]) =>
    [...new Set(refs.map((r) => r.url))]
      .map((u) => {
        if (!index.has(u)) index.set(u, index.size + 1);
        return `[${index.get(u)}]`;
      })
      .join(" ");

  const redFlags = findings.filter((f) => f.is_red_flag).slice(0, 12);
  const byKey = new Map<string, TrendEntry>((trend?.entries ?? []).map((e) => [e.key, e]));

  // Bygg innholdet først, så kildelisten til slutt får alle numrene
  const takeaways = (report?.takeaways ?? []).map((x) => ({ ...x, c: cite(x.refs) }));
  const changes = trend?.previous_run_id ? (report?.changes ?? []).map((x) => ({ ...x, c: cite(x.refs) })) : [];
  const flags = redFlags.map((f) => ({ f, c: cite([{ url: f.source_url }]) }));
  const promises = (sections.ledelse?.promises ?? []).map((p) => ({ p, c: cite([p.source]) }));
  const watch = (report?.watch_points ?? []).map((w) => ({ ...w, c: cite(w.refs) }));

  return (
    <Document title={`Aksjeinnsikt – ${stock.name}`} author="Aksjeinnsikt" language="nb">
      <Page size="A4" style={s.page}>
        <Text style={s.footerLeft} fixed>
          {t(stock.name)} · {fmtDate(run.finished_at)} · funn fra offentlige kilder · ikke investeringsråd
        </Text>
        <View style={s.top} fixed>
          <Text>
            <Text style={s.brand}>Aksjeinnsikt</Text> · Rapport
          </Text>
          <Text>{fmtDate(run.finished_at)}</Text>
        </View>

        <Text style={s.eyebrow}>{t([stock.ticker, stock.exchange].filter(Boolean).join(" · "))}</Text>
        <Text style={s.title}>{t(stock.name)}</Text>
        {report?.headline && <Text style={s.headline}>{t(report.headline)}</Text>}

        <View style={s.pills}>
          {overall && (
            <Text style={[s.pill, { color: SENT_COLOR[overall.label] ?? C.fg }]}>
              {SENT[overall.label] ?? overall.label} · {fmtNum(overall.score)}
            </Text>
          )}
          {overallTrend && overallTrend.direction !== "ny" && (
            <Text style={[s.pill, { color: DIR_COLOR[overallTrend.direction] }]}>
              {DIR[overallTrend.direction]} enn {fmtDate(trend?.previous_finished_at)}
            </Text>
          )}
          <Text style={[s.pill, { color: run.red_flags > 0 ? C.neg : C.fg }]}>{run.red_flags} røde flagg</Text>
          <Text style={s.pill}>
            {run.findings_count} funn fra {sources.length} kilder
          </Text>
          {stock.last_price != null && (
            <Text style={s.pill}>
              Kurs {fmtNum(Number(stock.last_price))} {stock.price_currency ?? ""}
              {priceYearChange != null && `, ${priceYearChange >= 0 ? "+" : "-"}${fmtNum(Math.abs(priceYearChange), 1)} % siste år`}
            </Text>
          )}
        </View>

        {takeaways.length > 0 && (
          <View>
            <Text style={s.h2}>Hovedkonklusjoner</Text>
            {takeaways.map((x, i) => (
              <View key={i} style={s.row} wrap={false}>
                <Text style={s.num}>{i + 1}.</Text>
                <Text style={s.grow}>
                  {t(x.text)} <Text style={s.cite}>{x.c}</Text>
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={s.h2}>Endring siden forrige kjøring</Text>
        {!trend?.previous_run_id ? (
          <Text style={s.small}>Dette er første kjøring. Neste kjøring sammenlignes med denne.</Text>
        ) : (
          <View>
            {changes.map((x, i) => (
              <View key={i} style={s.row} wrap={false}>
                <Text style={[s.num, { color: DIR_COLOR[x.direction] ?? C.muted }]}>•</Text>
                <Text style={s.grow}>
                  {t(x.text)} <Text style={s.cite}>{x.c}</Text>
                </Text>
              </View>
            ))}
            {CATEGORIES.map((c) => {
              const e = byKey.get(c);
              return (
                <View key={c} style={s.trendRow} wrap={false}>
                  <Text>{STEP_LABELS[c]}</Text>
                  <Text style={{ color: e ? DIR_COLOR[e.direction] : C.muted }}>
                    {e && e.direction !== "ny" ? `${DIR[e.direction]}${e.uncertain ? " (usikkert)" : ""}` : "Ingen sammenligning"}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <Text style={s.h2}>Kategori for kategori</Text>
        {CATEGORIES.map((c) => {
          const sec = sections[c];
          const list = findings.filter((f) => f.category === c);
          return (
            <View key={c} wrap={false} style={{ marginBottom: 6 }}>
              <Text style={s.h3}>{STEP_LABELS[c]}</Text>
              <Text>{sec ? t(sec.summary) : "Ingen data i denne kjøringen."}</Text>
              {sec && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 3 }}>
                  {sec.themes.map((th) => {
                    const items = list.filter((f) => f.theme === th.theme);
                    const pos = items.filter((f) => f.sentiment === "positiv").length;
                    const neg = items.filter((f) => f.sentiment === "negativ").length;
                    return (
                      <Text key={th.theme} style={s.chip}>
                        {THEME_LABELS[th.theme] ?? th.theme}: {th.coverage === "lite" ? "lite info" : `+${pos} / -${neg}`}
                      </Text>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        {flags.length > 0 && (
          <View>
            <Text style={s.h2}>Røde flagg</Text>
            {flags.map(({ f, c }) => (
              <View key={f.id} style={{ marginBottom: 6 }} wrap={false}>
                <Text style={[s.small, { color: C.neg, fontFamily: "Helvetica-Bold" }]}>
                  {STEP_LABELS[f.category]} · {THEME_LABELS[f.theme] ?? f.theme}
                </Text>
                <Text>
                  {t(f.claim)} <Text style={s.cite}>{c}</Text>
                </Text>
              </View>
            ))}
          </View>
        )}

        {promises.length > 0 && (
          <View>
            <Text style={s.h2}>Lovet mot levert</Text>
            {promises.map(({ p, c }, i) => (
              <View key={i} style={{ marginBottom: 6 }} wrap={false}>
                <Text>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>{PROMISE[p.status]}: </Text>
                  {t(p.promise)} ({t(p.said_when)}). {t(p.comment)} <Text style={s.cite}>{c}</Text>
                </Text>
              </View>
            ))}
          </View>
        )}

        {watch.length > 0 && (
          <View>
            <Text style={s.h2}>Følg med på</Text>
            {watch.map((w, i) => (
              <View key={i} style={s.row} wrap={false}>
                <Text style={s.num}>•</Text>
                <Text style={s.grow}>
                  {t(w.text)} <Text style={s.cite}>{w.c}</Text>
                </Text>
              </View>
            ))}
          </View>
        )}

        {(report?.data_gaps.length ?? 0) > 0 && (
          <View wrap={false}>
            <Text style={s.h2}>Hva det fantes lite informasjon om</Text>
            {report!.data_gaps.map((g, i) => (
              <View key={i} style={s.row}>
                <Text style={s.num}>•</Text>
                <Text style={[s.grow, { color: C.muted }]}>{t(g)}</Text>
              </View>
            ))}
          </View>
        )}

        {index.size > 0 && (
          <View>
            <Text style={s.h2}>Kilder</Text>
            {[...index.entries()].map(([url, n]) => (
              <View key={url} style={s.source} wrap={false}>
                <Text style={{ width: 22, color: C.muted }}>{n}.</Text>
                <View style={s.grow}>
                  <Text>{t(titleOf.get(url) ?? hostOf(url))}</Text>
                  <Link src={url} style={{ color: C.accent, fontSize: 8, textDecoration: "none" }}>
                    {t(url.length > 110 ? url.slice(0, 107) + "..." : url)}
                  </Link>
                </View>
              </View>
            ))}
          </View>
        )}

      </Page>
    </Document>
  );
}
