import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getLatestResearch, getRunHistory, getStock } from "@/lib/data";
import { formatDate, formatUsd } from "@/lib/format";
import { STEP_LABELS, THEME_LABELS, CATEGORIES } from "@/lib/research/schema";
import { hostOf } from "@/lib/research/sources";
import type { Finding, RunSection, TrendEntry } from "@/lib/types";
import { SentimentBadge } from "@/components/sentiment-badge";
import { TrendBadge } from "@/components/trend-badge";
import { SentimentHistory } from "@/components/sentiment-history";
import { EmptyState } from "@/components/empty-state";

export async function generateMetadata({ params }: PageProps<"/aksjer/[id]/rapport">): Promise<Metadata> {
  const { id } = await params;
  if (!z.guid().safeParse(id).success) return { title: "Rapport" };
  const stock = await getStock(id);
  return { title: stock ? `Rapport: ${stock.name}` : "Rapport" };
}

const DOT: Record<string, string> = { positiv: "bg-pos", nøytral: "bg-neu", negativ: "bg-neg" };
const PROMISE: Record<string, string> = {
  levert: "Levert",
  delvis: "Delvis levert",
  ikke_levert: "Ikke levert",
  for_tidlig: "For tidlig å si",
};

export default async function ReportPage({ params, searchParams }: PageProps<"/aksjer/[id]/rapport">) {
  const { id } = await params;
  const { kjoring } = await searchParams;
  if (!z.guid().safeParse(id).success) notFound();
  const runId = typeof kjoring === "string" && z.guid().safeParse(kjoring).success ? kjoring : undefined;

  const [stock, research, history] = await Promise.all([getStock(id), getLatestResearch(id, runId), getRunHistory(id)]);
  if (!stock) notFound();

  if (!research) {
    return (
      <div className="mx-auto max-w-[760px] space-y-6 px-[22px] py-14">
        <Link href={`/aksjer/${id}`} className="text-sm text-muted hover:text-fg">
          ← {stock.name}
        </Link>
        <EmptyState title="Ingen rapport ennå">Kjør research på aksjen for å lage den første rapporten.</EmptyState>
      </div>
    );
  }

  const { run, findings, sources } = research;
  const report = run.report;
  const trend = run.trend;
  const trendByKey = new Map((trend?.entries ?? []).map((e) => [e.key, e]));
  const overallTrend = trendByKey.get("overall");
  const overall = run.theme_scores?.overall ?? null;
  const isLatest = history.length === 0 || history[history.length - 1].id === run.id;

  // Nummererte kilder for punktene i rapporten
  const sourceIndex = new Map<string, number>();
  const cite = (refs: { url: string }[]) =>
    [...new Map(refs.map((r) => [r.url, r])).values()].map((r) => {
      if (!sourceIndex.has(r.url)) sourceIndex.set(r.url, sourceIndex.size + 1);
      return { url: r.url, n: sourceIndex.get(r.url)! };
    });
  const sourceTitle = new Map(sources.map((s) => [s.url, s.title]));

  // Sammenslåtte røde flagg fra syntesen; eldre rapporter har bare flaggene per funn
  const redFlags = report?.red_flags
    ? report.red_flags.map((r, i) => ({ key: String(i), label: STEP_LABELS[r.category], text: r.text, refs: r.refs }))
    : findings
        .filter((f) => f.is_red_flag)
        .slice(0, 8)
        .map((f) => ({ key: f.id, label: STEP_LABELS[f.category], text: f.claim, refs: [{ url: f.source_url }] }));
  const sections = run.sections ?? {};
  const gaps = CATEGORIES.flatMap((c) =>
    (sections[c]?.themes ?? [])
      .filter((t) => t.coverage === "lite")
      .map((t) => `${STEP_LABELS[c]}: ${THEME_LABELS[t.theme] ?? t.theme}`),
  );

  return (
    <article className="mx-auto max-w-[760px] space-y-12 px-[22px] pb-24 pt-14 sm:pt-20 print:max-w-none">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href={`/aksjer/${id}`} className="text-sm text-muted hover:text-fg">
            ← {stock.name}
          </Link>
          <a
            href={`/aksjer/${id}/rapport/pdf${isLatest ? "" : `?kjoring=${run.id}`}`}
            download
            className="btn-primary"
          >
            Last ned PDF
          </a>
        </div>
        <div>
          <p className="text-sm text-muted">
            Rapport · {formatDate(run.finished_at)}
            {run.trigger === "weekly" ? " · ukentlig oppdatering" : ""}
            {!isLatest && <span className="ml-2 rounded bg-warn-bg px-1.5 py-0.5 text-warn">Eldre kjøring</span>}
          </p>
          <h1 className="mt-2 text-[40px] font-bold leading-[1.07] tracking-[-0.03em] sm:text-[56px]">
            {stock.name} <span className="font-mono text-lg font-normal text-muted">{stock.ticker}</span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SentimentBadge label={(overall?.label as never) ?? null} score={overall?.score ?? null} size="md" />
          <TrendBadge direction={overallTrend?.direction} uncertain={overallTrend?.uncertain} />
          {trend?.previous_finished_at && (
            <span className="text-xs text-muted">mot {formatDate(trend.previous_finished_at)}</span>
          )}
        </div>
        {report?.headline && <p className="text-[22px] font-semibold leading-snug tracking-[-0.01em] sm:text-[28px]">{report.headline}</p>}
      </header>

      {report && report.takeaways.length > 0 && (
        <Section title="Hovedkonklusjoner">
          <ul className="space-y-5 text-[19px]">
            {report.takeaways.map((t, i) => (
              <li key={i} className="flex gap-4 leading-relaxed">
                <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[t.sentiment]}`} aria-label={t.sentiment} />
                <span>
                  {t.text} <Cites refs={cite(t.refs)} />
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Endring siden forrige kjøring">
        {!trend?.previous_run_id ? (
          <p className="text-muted">Dette er første kjøring. Neste kjøring sammenlignes med denne.</p>
        ) : (
          <div className="space-y-4">
            {report && report.changes.length > 0 && (
              <ul className="space-y-3 text-[17px]">
                {report.changes.map((c, i) => (
                  <li key={i} className="leading-relaxed">
                    <TrendBadge direction={c.direction === "ny" ? "uendret" : c.direction} compact /> {c.text}{" "}
                    <Cites refs={cite(c.refs)} />
                  </li>
                ))}
              </ul>
            )}
            <TrendTable entries={trend.entries} />
          </div>
        )}
      </Section>

      <Section title="Kategori for kategori">
        <div className="space-y-6">
          {CATEGORIES.map((c) => (
            <CategoryBlock
              key={c}
              label={STEP_LABELS[c]}
              section={sections[c]}
              category={c}
              findings={findings.filter((f) => f.category === c)}
              trendByKey={trendByKey}
            />
          ))}
        </div>
      </Section>

      {redFlags.length > 0 && (
        <Section title={`Røde flagg (${redFlags.length})`}>
          <ul className="space-y-4 text-[17px]">
            {redFlags.map((f) => (
              <li key={f.key} className="leading-relaxed">
                <span className="text-xs font-medium uppercase tracking-wide text-muted">{f.label}</span>
                <br />
                {f.text} <Cites refs={cite(f.refs)} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {sections.ledelse?.promises && sections.ledelse.promises.length > 0 && (
        <Section title="Lovet mot levert">
          <ul className="space-y-3 text-[17px]">
            {sections.ledelse.promises.map((p, i) => (
              <li key={i} className="leading-relaxed">
                <span className="font-medium">{PROMISE[p.status]}:</span> {p.promise} ({p.said_when}). {p.comment}{" "}
                <Cites refs={cite([p.source])} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {report && report.watch_points.length > 0 && (
        <Section title="Følg med på">
          <ul className="list-disc space-y-3 pl-5 text-[17px]">
            {report.watch_points.map((w, i) => (
              <li key={i} className="leading-relaxed">
                {w.text} <Cites refs={cite(w.refs)} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(gaps.length > 0 || (report?.data_gaps.length ?? 0) > 0) && (
        <Section title="Hva det fantes lite informasjon om">
          {report?.data_gaps.length ? (
            <ul className="list-disc space-y-1 pl-5 text-muted">
              {report.data_gaps.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          ) : null}
          {gaps.length > 0 && (
            <details className="mt-2 text-sm text-muted">
              <summary className="cursor-pointer hover:text-fg">
                {gaps.length} temaer med lite offentlig informasjon
              </summary>
              <ul className="mt-2 columns-1 gap-6 sm:columns-2">
                {gaps.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </details>
          )}
        </Section>
      )}

      <Section title="Stemning over tid">
        <SentimentHistory
          points={history.map((h) => ({
            id: h.id,
            date: h.finished_at,
            score: h.score,
            label: h.label,
            findings: h.findings_count,
          }))}
        />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Tidligere kjøringer</caption>
            <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="py-2 pr-4 font-medium">Dato</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium">Stemning</th>
                <th className="py-2 pr-4 text-right font-medium">Funn</th>
                <th className="py-2 text-right font-medium">Røde flagg</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...history].reverse().map((h) => (
                <tr key={h.id} className={h.id === run.id ? "font-medium" : ""}>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {h.id === run.id ? (
                      formatDate(h.finished_at)
                    ) : (
                      <Link href={`/aksjer/${id}/rapport?kjoring=${h.id}`} className="text-accent hover:underline">
                        {formatDate(h.finished_at)}
                      </Link>
                    )}
                  </td>
                  <td className="py-2 pr-4">{h.trigger === "weekly" ? "Ukentlig" : "Manuell"}</td>
                  <td className="py-2 pr-4">
                    {h.label ?? "–"} {h.score != null && <span className="text-muted">({h.score.toFixed(2)})</span>}
                  </td>
                  <td className="py-2 pr-4 text-right">{h.findings_count}</td>
                  <td className="py-2 text-right">{h.red_flags}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {sourceIndex.size > 0 && (
        <Section title="Kilder i rapporten">
          <ol className="space-y-1 text-sm">
            {[...sourceIndex.entries()].map(([url, n]) => (
              <li key={url} id={`kilde-${n}`} className="flex gap-2">
                <span className="w-6 shrink-0 text-right text-muted">{n}.</span>
                <a href={url} target="_blank" rel="noopener noreferrer" className="min-w-0 break-words hover:text-accent">
                  {sourceTitle.get(url) ?? url} <span className="text-muted">· {hostOf(url)}</span>
                </a>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <footer className="border-t border-border pt-4 text-xs text-muted">
        {run.findings_count} funn fra {sources.length} kilder · {run.web_searches} søk · estimert kostnad{" "}
        {formatUsd(run.cost_usd)} ·{" "}
        <Link href={`/aksjer/${id}?fane=kunder`} className="text-accent hover:underline print:hidden">
          Se alle funn
        </Link>
      </footer>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid-page">
      <h2 className="mb-4 text-[28px] font-bold tracking-[-0.02em] sm:text-[32px]">{title}</h2>
      {children}
    </section>
  );
}

function Cites({ refs }: { refs: { url: string; n: number }[] }) {
  const unique = [...new Map(refs.map((r) => [r.n, r])).values()];
  return (
    <span className="whitespace-nowrap text-xs">
      {unique.map((r) => (
        <a
          key={r.n}
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-0.5 align-super text-accent hover:underline"
          title={hostOf(r.url)}
        >
          [{r.n}]
        </a>
      ))}
    </span>
  );
}

function TrendTable({ entries }: { entries: TrendEntry[] }) {
  const rows = CATEGORIES.map((c) => ({
    c,
    main: entries.find((e) => e.key === c),
    themes: entries.filter((e) => e.category === c && e.theme && e.direction !== "ny" && e.direction !== "uendret"),
  }));
  return (
    <div className="divide-y divide-border overflow-hidden rounded-[22px] bg-surface-2">
      {rows.map(({ c, main, themes }) => (
        <div key={c} className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">{STEP_LABELS[c]}</span>
            {main && main.direction !== "ny" ? (
              <TrendBadge direction={main.direction} uncertain={main.uncertain} />
            ) : (
              <span className="text-xs text-muted">Ingen sammenligning</span>
            )}
          </div>
          {themes.length > 0 && (
            <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              {themes.map((t) => (
                <li key={t.key} className="flex items-center gap-1.5">
                  {THEME_LABELS[t.theme!] ?? t.theme} <TrendBadge direction={t.direction} uncertain={t.uncertain} compact />
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function CategoryBlock({
  label,
  section,
  category,
  findings,
  trendByKey,
}: {
  label: string;
  section: RunSection | undefined;
  category: string;
  findings: Finding[];
  trendByKey: Map<string, TrendEntry>;
}) {
  if (!section) {
    return (
      <div>
        <h3 className="font-semibold">{label}</h3>
        <p className="text-sm text-muted">Ingen data i denne kjøringen.</p>
      </div>
    );
  }
  const main = trendByKey.get(category);
  return (
    <div>
      <div className="flex items-center gap-3">
        <h3 className="font-semibold">{label}</h3>
        <TrendBadge direction={main?.direction} uncertain={main?.uncertain} />
      </div>
      <p className="mt-1 leading-relaxed">{section.summary}</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {section.themes.map((t) => {
          const list = findings.filter((f) => f.theme === t.theme);
          const pos = list.filter((f) => f.sentiment === "positiv").length;
          const neg = list.filter((f) => f.sentiment === "negativ").length;
          const tr = trendByKey.get(`${category}.${t.theme}`);
          return (
            <li
              key={t.theme}
              className={`inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs ${
                t.coverage === "lite" ? "text-muted" : ""
              }`}
              title={t.coverage_note ?? t.summary}
            >
              {THEME_LABELS[t.theme] ?? t.theme}
              {t.coverage === "lite" ? (
                <span className="text-muted">· lite info</span>
              ) : (
                <span>
                  <span className="text-pos">+{pos}</span> <span className="text-neg">−{neg}</span>
                </span>
              )}
              <TrendBadge direction={tr?.direction} uncertain={tr?.uncertain} compact />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
