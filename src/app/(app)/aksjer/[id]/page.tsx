import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getActiveRun, getFolders, getLastFailedRun, getLatestResearch, getStock } from "@/lib/data";
import { parseTab, STOCK_TABS, type TabSlug } from "@/lib/tabs";
import { formatDate, formatUsd } from "@/lib/format";
import type { Finding, Stock } from "@/lib/types";
import { SENTIMENT_TEXT } from "@/components/stock-card";
import { Container, SectionTitle } from "@/components/container";
import { StockTabs } from "@/components/stock-tabs";
import { StockSettings } from "@/components/stock-settings";
import { EmptyState } from "@/components/empty-state";
import { RetryFailedButton, RunControl } from "@/components/run-control";
import { CategoryView, ManagementView, RedFlagsView, SourcesView } from "@/components/findings";

type Research = Awaited<ReturnType<typeof getLatestResearch>>;

async function loadStock(id: string) {
  if (!z.guid().safeParse(id).success) notFound();
  const stock = await getStock(id);
  if (!stock) notFound();
  return stock;
}

export async function generateMetadata({ params }: PageProps<"/aksjer/[id]">): Promise<Metadata> {
  const { id } = await params;
  const stock = await loadStock(id);
  return { title: `${stock.name} (${stock.ticker})` };
}

export default async function StockPage({ params, searchParams }: PageProps<"/aksjer/[id]">) {
  const { id } = await params;
  const tab = parseTab((await searchParams).fane);
  const [stock, folders] = await Promise.all([loadStock(id), getFolders()]);
  const [research, activeRunId, failedRun] = await Promise.all([
    getLatestResearch(stock.id),
    getActiveRun(stock.id),
    getLastFailedRun(stock.id),
  ]);
  const folder = folders.find((f) => f.id === stock.folder_id);

  const run = research?.run;
  const overall = run?.theme_scores?.overall ?? null;
  const tone = stock.sentiment_label ? SENTIMENT_TEXT[stock.sentiment_label] : null;
  const dark = tab === "rode-flagg";

  return (
    <>
      <div className="sticky top-12 z-20 border-b border-black/[0.08] bg-nav backdrop-blur-xl backdrop-saturate-[1.8] print:hidden dark:border-white/[0.08]">
        <Container className="flex min-h-[52px] flex-wrap items-center justify-between gap-x-6 gap-y-1 py-1">
          <Link href={`/aksjer/${stock.id}`} className="text-[21px] font-semibold tracking-tight text-fg">
            {stock.name}
          </Link>
          <StockTabs stockId={stock.id} active={tab} />
        </Container>
      </div>

      <section className="px-[22px] pb-12 pt-14 text-center sm:pt-20">
        <nav className="text-[15px] font-semibold text-muted">
          <Link href="/" className="hover:text-fg">
            {folder ? folder.name : "Aksjer"}
          </Link>
          <span>
            {" · "}
            {stock.ticker}
            {stock.exchange ? ` · ${stock.exchange}` : ""}
          </span>
        </nav>
        <h1 className="mt-2 text-[48px] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[80px]">{stock.name}.</h1>
        {run?.report?.headline ? (
          <p className="mx-auto mt-4 max-w-[720px] text-[22px] font-semibold leading-snug tracking-[-0.01em] sm:text-[28px]">
            {run.report.headline}
          </p>
        ) : (
          <p className="mx-auto mt-4 max-w-[640px] text-xl leading-snug text-muted">
            {stock.last_run_at
              ? `Sist oppdatert ${formatDate(stock.last_run_at)}.`
              : "Ingen research ennå. Kjør den første for å se hva kunder, ansatte og markedet mener."}
          </p>
        )}
        <div className="mt-7 flex flex-col items-center gap-4">
          <RunControl key={activeRunId ?? "idle"} stockId={stock.id} activeRunId={activeRunId} />
          {research && (
            <div className="flex flex-wrap justify-center gap-6 text-[17px]">
              <Link href={`/aksjer/${stock.id}/rapport`} className="link">
                Les hele rapporten ›
              </Link>
              <Link href={`/aksjer/${stock.id}?fane=kilder`} className="link">
                Se kildene ›
              </Link>
            </div>
          )}
        </div>
        {failedRun && !activeRunId && (
          <p className="mx-auto mt-6 max-w-[720px] rounded-2xl bg-neg-bg px-5 py-3 text-sm text-neg">
            Siste research feilet: {failedRun.error ?? "ukjent feil"}. <RetryFailedButton runId={failedRun.id} />
          </p>
        )}
        {run?.error && !activeRunId && !failedRun && (
          <p className="mx-auto mt-6 max-w-[720px] rounded-2xl bg-warn-bg px-5 py-3 text-sm text-warn">
            Noen deler av siste research feilet: {run.error}{" "}
            {research?.isLatest && <RetryFailedButton runId={run.id} />}
          </p>
        )}
      </section>

      {run && (
        <section className="pb-16">
          <Container className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Tile label="Samlet stemning" value={tone?.label ?? "–"} valueCls={tone?.cls}>
              {overall ? `${overall.score.toFixed(2).replace(".", ",")} på en skala fra −1 til 1` : "For få funn"}
            </Tile>
            <Tile label="Siden forrige kjøring" value={TREND_TEXT[stock.sentiment_trend ?? "ny"]}>
              {run.trend?.previous_finished_at ? `mot ${formatDate(run.trend.previous_finished_at)}` : "Første kjøring"}
            </Tile>
            <Tile label="Røde flagg" value={String(run.red_flags)} valueCls={run.red_flags > 0 ? "text-neg" : undefined}>
              <Link href={`/aksjer/${stock.id}?fane=rode-flagg`} className="link">
                Se dem ›
              </Link>
            </Tile>
            <Tile label="Grunnlag" value={`${run.findings_count} funn`}>
              fra {research!.sources.length} kilder
            </Tile>
          </Container>
        </section>
      )}

      <section
        aria-label={STOCK_TABS.find((t) => t.slug === tab)?.label}
        className={dark ? "bg-inverse py-16 text-inverse-fg sm:py-20" : "bg-surface-2 py-16 sm:py-20"}
      >
        <Container>
          <TabContent tab={tab} stock={stock} research={research} />
        </Container>
      </section>

      <section className="py-14">
        <Container className="space-y-4">
          {research && (
            <p className="text-center text-xs text-muted">
              Siste kjøring {formatDate(research.run.finished_at)}: {research.run.findings_count} funn fra{" "}
              {research.sources.length} kilder, {research.run.web_searches} søk, estimert kostnad{" "}
              {formatUsd(research.run.cost_usd)}.
            </p>
          )}
          <StockSettings stock={stock} folders={folders} />
        </Container>
      </section>
    </>
  );
}

const TREND_TEXT: Record<string, string> = {
  bedre: "↗ Bedre",
  verre: "↘ Verre",
  uendret: "→ Uendret",
  ny: "Ny",
};

function Tile({
  label,
  value,
  valueCls = "",
  children,
}: {
  label: string;
  value: string;
  valueCls?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="card p-5 text-center sm:p-7">
      <div className="text-sm text-muted">{label}</div>
      <div className={`mt-1.5 text-[28px] font-bold tracking-[-0.02em] sm:text-[40px] ${valueCls}`}>{value}</div>
      <div className="mt-1 text-sm text-muted">{children}</div>
    </div>
  );
}

const EMPTY_TEXT: Record<Exclude<TabSlug, "oversikt">, { title: string; body: string }> = {
  kunder: {
    title: "Ingen kundesignaler ennå",
    body: "Her vises hva kunder sier, gruppert i temaer som produktkvalitet, leveringstid, service, pris og relasjon, med sitater og lenke til kilden.",
  },
  ansatte: {
    title: "Ingen ansattsignaler ennå",
    body: "Her vises signaler fra ansattomtaler, stillingsannonser og LinkedIn-aktivitet: vekst, nedbemanning og rekrutteringsfokus.",
  },
  ledelse: {
    title: "Ingen rapportpunkter ennå",
    body: "Her vises hovedpunkter fra siste kvartalsrapporter og presentasjoner, og hva ledelsen har lovet mot hva som er levert.",
  },
  nyheter: {
    title: "Ingen nyheter ennå",
    body: "Her vises relevant bransjepresse, kontrakter og konkurrentbevegelser.",
  },
  "rode-flagg": {
    title: "Ingen røde flagg ennå",
    body: "Negative funn fra alle kategoriene samles her, slik at du ser dem på ett sted.",
  },
  kilder: {
    title: "Ingen kilder ennå",
    body: "Alle kildene agenten brukte, med dato og type.",
  },
};

function TabContent({ tab, stock, research }: { tab: TabSlug; stock: Stock; research: Research }) {
  if (tab === "oversikt") return <Overview stock={stock} research={research} />;
  if (!research) {
    const t = EMPTY_TEXT[tab];
    return (
      <EmptyState title={t.title}>
        <p>{t.body}</p>
        <p className="mt-2">Kjør research for å fylle denne fanen.</p>
      </EmptyState>
    );
  }
  const { run, findings, sources } = research;
  const by = (c: Finding["category"]) => findings.filter((f) => f.category === c);
  switch (tab) {
    case "kunder":
      return <CategoryView section={run.sections?.kunder} findings={by("kunder")} category="kunder" trend={run.trend} />;
    case "ansatte":
      return <CategoryView section={run.sections?.ansatte} findings={by("ansatte")} category="ansatte" trend={run.trend} />;
    case "ledelse":
      return <ManagementView section={run.sections?.ledelse} findings={by("ledelse")} trend={run.trend} />;
    case "nyheter":
      return (
        <div className="space-y-10">
          <CategoryView section={run.sections?.nyheter} findings={by("nyheter")} category="nyheter" trend={run.trend} />
          <div>
            <SectionTitle className="mb-6">Konkurrenter.</SectionTitle>
            <CategoryView
              section={run.sections?.konkurrenter}
              findings={by("konkurrenter")}
              category="konkurrenter"
              trend={run.trend}
            />
          </div>
        </div>
      );
    case "rode-flagg":
      return <RedFlagsView findings={findings} />;
    case "kilder":
      return <SourcesView sources={sources} findings={findings} />;
  }
}

function Overview({ stock, research }: { stock: Stock; research: Research }) {
  const o = stock.overview;
  const summaries = research?.run.sections;
  if (!o) {
    return (
      <EmptyState title="Ingen oversikt ennå">
        Etter første researchkjøring vises en kort selskapsbeskrivelse, segmenter, de viktigste kundene og
        konkurrentene her.
      </EmptyState>
    );
  }
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="rounded-[22px] bg-surface p-7 lg:col-span-2">
        <SectionTitle className="!text-[28px]">Om selskapet.</SectionTitle>
        <p className="mt-3 text-[17px] leading-relaxed">{o.description ?? "Ingen beskrivelse."}</p>
        {o.segments && o.segments.length > 0 && (
          <>
            <h3 className="mt-7 mb-2 text-[21px] font-semibold">Segmenter</h3>
            <ul className="divide-y divide-border">
              {o.segments.map((s) => (
                <li key={s.name} className="flex justify-between gap-4 py-3 text-[15px]">
                  <span>
                    <span className="font-medium">{s.name}</span>
                    {s.description && <span className="text-muted">: {s.description}</span>}
                  </span>
                  {s.share_of_revenue && <span className="shrink-0 text-muted">{s.share_of_revenue}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {summaries && (
        <div className="rounded-[22px] bg-surface p-7 lg:col-span-2">
          <SectionTitle className="!text-[28px]">Kort fortalt.</SectionTitle>
          <dl className="mt-4 space-y-4 text-[15px] leading-relaxed">
            {(
              [
                ["kunder", "Kunder"],
                ["ansatte", "Ansatte"],
                ["ledelse", "Ledelse og resultater"],
                ["nyheter", "Nyheter og bransje"],
                ["konkurrenter", "Konkurrenter"],
              ] as const
            ).map(([key, label]) =>
              summaries[key] ? (
                <div key={key}>
                  <dt className="font-semibold">{label}</dt>
                  <dd className="text-muted">{summaries[key]!.summary}</dd>
                </div>
              ) : null,
            )}
          </dl>
        </div>
      )}
      <div className="space-y-5 lg:col-start-3 lg:row-span-2 lg:row-start-1">
        <NamedList title="Viktigste kunder" items={o.key_customers} />
        <NamedList title="Konkurrenter" items={o.competitors} />
      </div>
    </div>
  );
}

function NamedList({
  title,
  items,
}: {
  title: string;
  items?: { name: string; note?: string; source_url?: string }[];
}) {
  return (
    <div className="rounded-[22px] bg-surface p-7">
      <h2 className="mb-3 text-[21px] font-semibold">{title}</h2>
      {!items || items.length === 0 ? (
        <p className="text-[15px] text-muted">Lite offentlig tilgjengelig informasjon.</p>
      ) : (
        <ul className="space-y-2 text-[15px]">
          {items.map((i) => (
            <li key={i.name}>
              {i.source_url ? (
                <a href={i.source_url} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-accent">
                  {i.name}
                </a>
              ) : (
                <span className="font-medium">{i.name}</span>
              )}
              {i.note && <span className="text-muted"> · {i.note}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
