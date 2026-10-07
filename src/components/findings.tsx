import type { Category, Finding, RunSection, Source, Trend } from "@/lib/types";
import { TrendBadge } from "./trend-badge";
import { describeToolErrors, significantToolErrors } from "@/lib/research/tool-errors";
import { SOURCE_TYPE_LABELS, THEME_LABELS } from "@/lib/research/schema";
import { hostOf } from "@/lib/research/sources";
import { formatDate } from "@/lib/format";
import { EmptyState } from "./empty-state";

const SENTIMENT_DOT: Record<Finding["sentiment"], string> = {
  positiv: "bg-pos",
  nøytral: "bg-neu",
  negativ: "bg-neg",
};
const SENTIMENT_TEXT: Record<Finding["sentiment"], string> = {
  positiv: "Positiv",
  nøytral: "Nøytral",
  negativ: "Negativ",
};
const STRENGTH_TEXT: Record<Finding["evidence_strength"], string> = {
  sterk: "Sterk evidens",
  middels: "Middels evidens",
  svak: "Svak evidens",
};
const COVERAGE: Record<RunSection["themes"][number]["coverage"], { label: string; cls: string }> = {
  god: { label: "God dekning", cls: "bg-pos-bg text-pos" },
  begrenset: { label: "Begrenset", cls: "bg-warn-bg text-warn" },
  lite: { label: "Lite informasjon", cls: "bg-neu-bg text-muted" },
};

export const sourceTypeLabel = (t: string) => SOURCE_TYPE_LABELS[t as keyof typeof SOURCE_TYPE_LABELS] ?? t;
export const themeLabel = (t: string) => THEME_LABELS[t] ?? t;

export function SourceLink({ url, title }: { url: string; title?: string | null }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent hover:underline"
      title={title ?? url}
    >
      {hostOf(url)}
    </a>
  );
}

export function FindingItem({ finding, showCategory = false }: { finding: Finding; showCategory?: boolean }) {
  return (
    <li className="flex gap-3 py-3">
      <span
        className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${SENTIMENT_DOT[finding.sentiment]}`}
        title={SENTIMENT_TEXT[finding.sentiment]}
        aria-label={SENTIMENT_TEXT[finding.sentiment]}
      />
      <div className="min-w-0 flex-1">
        <p className="leading-snug">
          {finding.is_red_flag && (
            <span className="mr-1.5 rounded bg-neg-bg px-1.5 py-0.5 text-xs font-medium text-neg">Rødt flagg</span>
          )}
          {finding.claim}
        </p>
        {finding.quote && (
          <blockquote className="mt-1.5 border-l-2 border-border pl-3 text-sm text-muted">
            {finding.is_paraphrase ? finding.quote : <>«{finding.quote}»</>}
            {finding.is_paraphrase && <span className="ml-1 text-xs">(parafrase)</span>}
          </blockquote>
        )}
        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          <SourceLink url={finding.source_url} />
          <span>{finding.published_at ? formatDate(finding.published_at) : "Dato ukjent"}</span>
          <span>{sourceTypeLabel(finding.source_type)}</span>
          <span>{STRENGTH_TEXT[finding.evidence_strength]}</span>
          {showCategory && <span>{themeLabel(finding.theme)}</span>}
        </p>
      </div>
    </li>
  );
}

function SentimentCounts({ findings }: { findings: Finding[] }) {
  const c = { positiv: 0, nøytral: 0, negativ: 0 };
  for (const f of findings) c[f.sentiment]++;
  return (
    <span className="flex gap-2 text-xs text-muted">
      <span className="text-pos">+{c.positiv}</span>
      <span>{c.nøytral}</span>
      <span className="text-neg">−{c.negativ}</span>
    </span>
  );
}

export function CategoryView({
  section,
  findings,
  category,
  trend,
}: {
  section: RunSection | undefined;
  findings: Finding[];
  category?: Category;
  trend?: Trend | null;
}) {
  const trendFor = (theme: string) => trend?.entries.find((e) => e.key === `${category}.${theme}`);
  if (!section) {
    return (
      <EmptyState title="Ingen data for denne kategorien">
        Steget feilet eller ble ikke kjørt i siste research. Prøv å kjøre researchen på nytt.
      </EmptyState>
    );
  }

  const themes = section.themes;
  const searchErrors = significantToolErrors(section.tool_errors);
  const extraThemes = [...new Set(findings.map((f) => f.theme))].filter((t) => !themes.some((x) => x.theme === t));

  return (
    <div className="space-y-4">
      <p className="mx-auto max-w-[760px] pb-4 text-center text-xl leading-snug text-muted sm:text-[21px]">{section.summary}</p>
      {Object.keys(searchErrors).length > 0 && (
        <p className="mx-auto max-w-[760px] rounded-2xl bg-warn-bg px-5 py-3 text-center text-sm text-warn">
          Søkeverktøyet hadde problemer i denne kategorien ({describeToolErrors(searchErrors)}). Grunnlaget kan være
          tynnere enn vanlig. Kjør ny research for å prøve igjen.
        </p>
      )}
      {themes.map((t) => {
        const list = findings.filter((f) => f.theme === t.theme);
        const cov = COVERAGE[t.coverage];
        return (
          <section key={t.theme} className="rounded-[22px] bg-surface p-6 sm:p-7">
            <header className="flex flex-wrap items-center gap-2">
              <h3 className="text-2xl font-bold tracking-[-0.01em]">{themeLabel(t.theme)}</h3>
              <span className={`rounded-full px-2 py-0.5 text-xs ${cov.cls}`}>{cov.label}</span>
              <TrendBadge direction={trendFor(t.theme)?.direction} uncertain={trendFor(t.theme)?.uncertain} />
              {list.length > 0 && (
                <span className="ml-auto">
                  <SentimentCounts findings={list} />
                </span>
              )}
            </header>
            {t.summary && <p className="mt-2 text-sm">{t.summary}</p>}
            {t.coverage !== "god" && t.coverage_note && (
              <p className="mt-2 text-sm italic text-muted">{t.coverage_note}</p>
            )}
            {list.length > 0 && (
              <ul className="mt-2 divide-y divide-border">
                {list.map((f) => (
                  <FindingItem key={f.id} finding={f} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
      {extraThemes.map((theme) => (
        <section key={theme} className="rounded-[22px] bg-surface p-6 sm:p-7">
          <h3 className="text-2xl font-bold tracking-[-0.01em]">{themeLabel(theme)}</h3>
          <ul className="mt-2 divide-y divide-border">
            {findings
              .filter((f) => f.theme === theme)
              .map((f) => (
                <FindingItem key={f.id} finding={f} />
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

const PROMISE_STATUS: Record<NonNullable<RunSection["promises"]>[number]["status"], { label: string; cls: string }> = {
  levert: { label: "Levert", cls: "bg-pos-bg text-pos" },
  delvis: { label: "Delvis", cls: "bg-warn-bg text-warn" },
  ikke_levert: { label: "Ikke levert", cls: "bg-neg-bg text-neg" },
  for_tidlig: { label: "For tidlig", cls: "bg-neu-bg text-muted" },
};

export function ManagementView({
  section,
  findings,
  trend,
}: {
  section: RunSection | undefined;
  findings: Finding[];
  trend?: Trend | null;
}) {
  return (
    <div className="space-y-6">
      {section?.key_points && section.key_points.length > 0 && (
        <section className="rounded-[22px] bg-surface p-6 sm:p-7">
          <h3 className="mb-4 text-2xl font-bold tracking-[-0.01em]">Hovedpunkter fra siste rapporter</h3>
          <ul className="space-y-2 text-sm">
            {section.key_points.map((k, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-16 shrink-0 font-mono text-xs text-muted">{k.period}</span>
                <span className="flex-1">
                  {k.point} <SourceLink url={k.source.url} title={k.source.title} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {section?.promises && section.promises.length > 0 && (
        <section className="overflow-hidden rounded-[22px] bg-surface">
          <h3 className="px-6 pt-6 text-2xl font-bold tracking-[-0.01em] sm:px-7">Lovet mot levert</h3>
          <ul className="divide-y divide-border">
            {section.promises.map((p, i) => {
              const st = PROMISE_STATUS[p.status];
              return (
                <li key={i} className="px-4 py-3 text-sm sm:px-5">
                  <div className="flex flex-wrap items-start gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                    <span className="flex-1 font-medium">{p.promise}</span>
                    <span className="text-xs text-muted">{p.said_when}</span>
                  </div>
                  <p className="mt-1 text-muted">
                    {p.comment} <SourceLink url={p.source.url} title={p.source.title} />
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <CategoryView section={section} findings={findings} category="ledelse" trend={trend} />
    </div>
  );
}

export function RedFlagsView({ findings }: { findings: Finding[] }) {
  const list = findings
    .filter((f) => f.is_red_flag || f.sentiment === "negativ")
    .sort((a, b) => Number(b.is_red_flag) - Number(a.is_red_flag));
  if (list.length === 0) {
    return <EmptyState title="Ingen negative funn">Siste research fant ingen negative signaler med kilde.</EmptyState>;
  }
  const label: Record<Category, string> = {
    kunder: "Kunder",
    ansatte: "Ansatte",
    ledelse: "Ledelse",
    nyheter: "Nyheter",
    konkurrenter: "Konkurrenter",
  };
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-[32px] font-bold tracking-[-0.02em] sm:text-[48px]">Røde flagg.</h2>
      </div>
      <p className="text-center text-xl text-inverse-muted">
        {list.filter((f) => f.is_red_flag).length} røde flagg og {list.filter((f) => !f.is_red_flag).length} andre
        negative funn.
      </p>
      <ul className="grid gap-5 md:grid-cols-2">
        {list.map((f) => (
          <li key={f.id} className="flex flex-col rounded-[22px] bg-inverse-surface p-6 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[#ff6961]">
              {f.is_red_flag ? "Rødt flagg · " : ""}
              {label[f.category]} · {themeLabel(f.theme)}
            </p>
            <p className="mt-2.5 text-[21px] font-semibold leading-snug">{f.claim}</p>
            {f.quote && (
              <p className="mt-2 text-[15px] italic leading-relaxed text-inverse-muted">
                «{f.quote}»{f.is_paraphrase && <span className="not-italic"> (parafrase)</span>}
              </p>
            )}
            <p className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-4 text-[13px] text-inverse-muted">
              <span>{sourceTypeLabel(f.source_type)}</span>
              <span>{f.published_at ? formatDate(f.published_at) : "Dato ukjent"}</span>
              <span>{STRENGTH_TEXT[f.evidence_strength]}</span>
              <a href={f.source_url} target="_blank" rel="noopener noreferrer" className="text-[#2997ff] hover:underline">
                {hostOf(f.source_url)} ›
              </a>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SourcesView({ sources, findings }: { sources: Source[]; findings: Finding[] }) {
  if (sources.length === 0) return <EmptyState title="Ingen kilder" />;
  const uses = new Map<string, number>();
  for (const f of findings) uses.set(f.source_url, (uses.get(f.source_url) ?? 0) + 1);
  return (
    <div className="overflow-x-auto rounded-[22px] bg-surface">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-2 font-medium">Kilde</th>
            <th className="px-4 py-2 font-medium">Type</th>
            <th className="px-4 py-2 font-medium whitespace-nowrap">Publisert</th>
            <th className="px-4 py-2 text-right font-medium">Funn</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sources.map((s) => (
            <tr key={s.id}>
              <td className="max-w-md px-4 py-2">
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
                  <span className="line-clamp-2">{s.title ?? s.url}</span>
                </a>
                <span className="text-xs text-muted">{hostOf(s.url)}</span>
              </td>
              <td className="px-4 py-2 whitespace-nowrap">{sourceTypeLabel(s.source_type)}</td>
              <td className="px-4 py-2 whitespace-nowrap">{s.published_at ? formatDate(s.published_at) : "–"}</td>
              <td className="px-4 py-2 text-right">{uses.get(s.url) ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border px-4 py-2 text-xs text-muted">
        Hentet {formatDate(sources[0]?.accessed_at)}. Kilder uten funn ble brukt i oversikt eller rapportpunkter.
      </p>
    </div>
  );
}
