import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getFolders, getStock } from "@/lib/data";
import { parseTab, STOCK_TABS, type TabSlug } from "@/lib/tabs";
import { formatDate } from "@/lib/format";
import type { Stock } from "@/lib/types";
import { SentimentBadge } from "@/components/sentiment-badge";
import { StockTabs } from "@/components/stock-tabs";
import { StockSettings } from "@/components/stock-settings";
import { EmptyState } from "@/components/empty-state";

async function loadStock(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
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
  const folder = folders.find((f) => f.id === stock.folder_id);

  return (
    <div className="space-y-6">
      <div>
        <nav className="mb-3 text-sm text-muted">
          <Link href="/" className="hover:text-fg">Aksjer</Link>
          {folder && <span> / {folder.name}</span>}
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{stock.name}</h1>
            <p className="mt-1 font-mono text-sm text-muted">
              {stock.ticker}
              {stock.exchange ? ` · ${stock.exchange}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
              <SentimentBadge label={stock.sentiment_label} score={stock.sentiment_score} size="md" />
              <span>
                {stock.last_run_at ? `Sist oppdatert ${formatDate(stock.last_run_at)}` : "Ingen research ennå"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" disabled title="Kommer i fase 3">
              Rapportvisning
            </button>
            <button className="btn-primary" disabled title="Kommer i fase 2">
              Kjør ny research nå
            </button>
          </div>
        </div>
      </div>

      <StockTabs stockId={stock.id} active={tab} />

      <section aria-label={STOCK_TABS.find((t) => t.slug === tab)?.label}>
        <TabContent tab={tab} stock={stock} />
      </section>

      <StockSettings stock={stock} folders={folders} />
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

function TabContent({ tab, stock }: { tab: TabSlug; stock: Stock }) {
  if (tab === "oversikt") return <Overview stock={stock} />;
  const t = EMPTY_TEXT[tab];
  return (
    <EmptyState title={t.title}>
      <p>{t.body}</p>
      <p className="mt-2">Kjør research for å fylle denne fanen.</p>
    </EmptyState>
  );
}

function Overview({ stock }: { stock: Stock }) {
  const o = stock.overview;
  if (!o) {
    return (
      <EmptyState title="Ingen oversikt ennå">
        Etter første researchkjøring vises en kort selskapsbeskrivelse, segmenter, de viktigste kundene og
        konkurrentene her.
      </EmptyState>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="card p-5 lg:col-span-2">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Om selskapet</h2>
        <p className="leading-relaxed">{o.description ?? "Ingen beskrivelse."}</p>
        {o.segments && o.segments.length > 0 && (
          <>
            <h3 className="mt-5 mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Segmenter</h3>
            <ul className="divide-y divide-border">
              {o.segments.map((s) => (
                <li key={s.name} className="flex justify-between gap-4 py-2 text-sm">
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
      <div className="space-y-4">
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
    <div className="card p-5">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {!items || items.length === 0 ? (
        <p className="text-sm text-muted">Lite offentlig tilgjengelig informasjon.</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
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
