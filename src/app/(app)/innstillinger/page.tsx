import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getCostRuns, getLibrary, getUserSettings, getWorkerHealth } from "@/lib/data";
import { formatDate, formatInt, formatUsd } from "@/lib/format";
import { setWeeklyAuto } from "@/lib/actions/library";
import { missingResearchConfig } from "@/lib/research/setup";
import { PRICING, RESEARCH_MODEL } from "@/lib/research/config";
import { BudgetForm } from "@/components/budget-form";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Innstillinger" };

const STATUS: Record<string, string> = {
  queued: "I kø",
  running: "Kjører",
  done: "Ferdig",
  failed: "Feilet",
  cancelled: "Avbrutt",
};

const monthFmt = new Intl.DateTimeFormat("nb-NO", { month: "long", year: "numeric", timeZone: "UTC" });
const dateTimeFmt = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Oslo",
});

const runsWord = (n: number) => `${n} ${n === 1 ? "kjøring" : "kjøringer"}`;

export default async function SettingsPage() {
  const { user } = await requireUser();
  const [runs, { stocks }, settings, health] = await Promise.all([
    getCostRuns(),
    getLibrary(),
    getUserSettings(),
    getWorkerHealth(),
  ]);

  // Kostnad i denne kalendermåneden (UTC, samme som budsjettsjekken i databasen)
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const thisMonth = runs.filter((r) => r.created_at >= monthStart);
  const monthCost = thisMonth.reduce((s, r) => s + r.cost_usd, 0);
  const totalCost = runs.reduce((s, r) => s + r.cost_usd, 0);
  const finished = runs.filter((r) => r.status === "done");
  const avgCost = finished.length ? finished.reduce((s, r) => s + r.cost_usd, 0) / finished.length : 0;
  const budget = settings.monthlyBudgetUsd;
  const budgetPct = budget ? Math.min(100, Math.round((monthCost / budget) * 100)) : null;

  // Per måned (siste 6) og per aksje
  const byMonth = new Map<string, { cost: number; runs: number }>();
  for (const r of runs) {
    const key = r.created_at.slice(0, 7);
    const m = byMonth.get(key) ?? { cost: 0, runs: 0 };
    byMonth.set(key, { cost: m.cost + r.cost_usd, runs: m.runs + 1 });
  }
  const months = [...byMonth.entries()].sort(([a], [b]) => b.localeCompare(a)).slice(0, 6);

  const byStock = new Map<string, { name: string; ticker: string; cost: number; runs: number; last: string }>();
  for (const r of runs) {
    const s = byStock.get(r.stock_id) ?? {
      name: r.stocks?.name ?? "Slettet aksje",
      ticker: r.stocks?.ticker ?? "",
      cost: 0,
      runs: 0,
      last: r.created_at,
    };
    byStock.set(r.stock_id, { ...s, cost: s.cost + r.cost_usd, runs: s.runs + 1 });
  }
  const stockRows = [...byStock.entries()].sort(([, a], [, b]) => b.cost - a.cost);

  const weeklyCount = stocks.filter((s) => s.weekly_auto).length;
  const missing = missingResearchConfig();

  return (
    <div className="mx-auto max-w-[1024px] space-y-14 px-[22px] pb-24 pt-14 sm:pt-20">
      <h1 className="text-[40px] font-bold tracking-[-0.03em] sm:text-[56px]">Innstillinger.</h1>

      {/* ------------------------------------------------------------ Kostnad */}
      <section className="space-y-4">
        <SectionTitle>Kostnad</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile label={`Denne måneden`} value={formatUsd(monthCost)} sub={runsWord(thisMonth.length)} />
          <Tile label="Snitt per fullført kjøring" value={formatUsd(avgCost)} sub={`${finished.length} fullført`} />
          <Tile label="Totalt" value={formatUsd(totalCost)} sub={runsWord(runs.length)} />
          <Tile
            label="Søk totalt"
            value={formatInt(runs.reduce((s, r) => s + r.web_searches, 0))}
            sub={`${formatUsd(PRICING.perWebSearch * 1000)} per 1 000 søk`}
          />
        </div>

        <div className="card space-y-4 p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Brukt denne måneden</p>
              {budget != null ? (
                <>
                  <div
                    className="mt-2 h-2 max-w-md overflow-hidden rounded-full bg-surface-2"
                    role="meter"
                    aria-valuemin={0}
                    aria-valuemax={budget}
                    aria-valuenow={monthCost}
                    aria-label="Brukt av månedsbudsjettet"
                  >
                    <div
                      className={`h-full rounded-full ${budgetPct! >= 100 ? "bg-neg" : budgetPct! >= 80 ? "bg-warn" : "bg-accent"}`}
                      style={{ width: `${Math.max(budgetPct!, 2)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {formatUsd(monthCost)} av {formatUsd(budget)} ({budgetPct} %)
                    {budgetPct! >= 100 && " – nye kjøringer er stoppet til neste måned"}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-muted">{formatUsd(monthCost)} · ingen budsjettgrense</p>
              )}
            </div>
            <BudgetForm current={budget} />
          </div>
          <p className="text-xs text-muted">
            Når budsjettet er brukt opp, kan du ikke starte nye kjøringer, og ukentlige kjøringer hoppes over. Kjøringer som
            allerede er i gang, fullføres. Kostnaden er et estimat basert på tokenforbruk ({RESEARCH_MODEL}: $
            {PRICING.inputPerMTok}/$
            {PRICING.outputPerMTok} per million tokens inn/ut) og antall søk. Den faktiske fakturaen finner du i Claude
            Console.
          </p>
        </div>

        {runs.length === 0 ? (
          <EmptyState title="Ingen kjøringer ennå">
            Tokenforbruk og estimert kostnad vises her etter hver researchkjøring.
          </EmptyState>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="px-4 pt-3 text-left text-sm font-medium">Per måned</caption>
                <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium">Måned</th>
                    <th className="px-4 py-2 text-right font-medium">Kjøringer</th>
                    <th className="px-4 py-2 text-right font-medium">Kostnad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {months.map(([key, m]) => (
                    <tr key={key}>
                      <td className="px-4 py-2 capitalize">{monthFmt.format(new Date(`${key}-01T00:00:00Z`))}</td>
                      <td className="px-4 py-2 text-right">{m.runs}</td>
                      <td className="px-4 py-2 text-right font-medium">{formatUsd(m.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="px-4 pt-3 text-left text-sm font-medium">Per aksje</caption>
                <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium">Aksje</th>
                    <th className="px-4 py-2 text-right font-medium">Kjøringer</th>
                    <th className="px-4 py-2 text-right font-medium">Kostnad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stockRows.map(([id, s]) => (
                    <tr key={id}>
                      <td className="px-4 py-2">
                        {s.name} <span className="font-mono text-xs text-muted">{s.ticker}</span>
                      </td>
                      <td className="px-4 py-2 text-right">{s.runs}</td>
                      <td className="px-4 py-2 text-right font-medium">{formatUsd(s.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {runs.length > 0 && (
          <details className="card">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Alle kjøringer ({runs.length})</summary>
            <div className="overflow-x-auto border-t border-border">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium">Dato</th>
                    <th className="px-4 py-2 font-medium">Aksje</th>
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 text-right font-medium">Tokens inn</th>
                    <th className="px-4 py-2 text-right font-medium">Tokens ut</th>
                    <th className="px-4 py-2 text-right font-medium">Søk</th>
                    <th className="px-4 py-2 text-right font-medium">Kostnad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {runs.slice(0, 200).map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2 whitespace-nowrap">{formatDate(r.created_at)}</td>
                      <td className="px-4 py-2">
                        <Link href={`/aksjer/${r.stock_id}`} className="hover:text-accent">
                          {r.stocks?.name ?? "–"}
                        </Link>
                      </td>
                      <td className="px-4 py-2">{r.trigger === "weekly" ? "Ukentlig" : "Manuell"}</td>
                      <td className="px-4 py-2">{STATUS[r.status] ?? r.status}</td>
                      <td className="px-4 py-2 text-right">{formatInt(r.input_tokens)}</td>
                      <td className="px-4 py-2 text-right">{formatInt(r.output_tokens)}</td>
                      <td className="px-4 py-2 text-right">{formatInt(r.web_searches)}</td>
                      <td className="px-4 py-2 text-right font-medium">{formatUsd(r.cost_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </section>

      {/* ------------------------------------------------------------ Ukentlig */}
      <section className="space-y-3">
        <div>
          <SectionTitle>Automatisk ukentlig oppdatering</SectionTitle>
          <p className="mt-1 text-sm text-muted">
            Hver mandag morgen (ca. kl. 06 norsk tid) kjøres ny research for aksjene som er slått på, hvis siste kjøring er
            eldre enn seks dager og budsjettet ikke er brukt opp. {weeklyCount} av {stocks.length} aksjer er med.
          </p>
        </div>
        {stocks.length > 0 && (
          <ul className="card divide-y divide-border">
            {stocks.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span>
                  {s.name} <span className="font-mono text-xs text-muted">{s.ticker}</span>
                </span>
                <form action={setWeeklyAuto}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="enabled" value={String(!s.weekly_auto)} />
                  <button
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      s.weekly_auto ? "bg-pos-bg text-pos" : "bg-surface-2 text-muted"
                    }`}
                    aria-label={`${s.weekly_auto ? "Slå av" : "Slå på"} ukentlig oppdatering for ${s.name}`}
                  >
                    {s.weekly_auto ? "På" : "Av"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------------ Systemstatus */}
      <section className="space-y-3">
        <SectionTitle>Systemstatus</SectionTitle>
        <ul className="card divide-y divide-border text-sm">
          <StatusRow
            ok={missing.length === 0}
            label="Konfigurasjon"
            detail={missing.length === 0 ? "Alle nødvendige nøkler er satt" : `Mangler: ${missing.join(", ")}`}
          />
          <StatusRow
            ok={health.stuckRuns === 0}
            label="Jobbkø"
            detail={
              health.stuckRuns === 0
                ? "Ingen kjøringer venter unormalt lenge"
                : `${health.stuckRuns} kjøring(er) har ventet over 5 minutter uten å starte. Sjekk at pg_cron og Vault-hemmelighetene (app_url, job_secret) er satt opp.`
            }
          />
          <StatusRow
            ok={null}
            label="Siste aktivitet fra arbeideren"
            detail={health.lastActivity ? dateTimeFmt.format(new Date(health.lastActivity)) : "Ingen aktivitet ennå"}
          />
        </ul>
      </section>

      <section className="space-y-2">
        <SectionTitle>Konto</SectionTitle>
        <p className="text-sm">
          Innlogget som <span className="font-medium">{user.email}</span>
        </p>
      </section>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[28px] font-bold tracking-[-0.02em]">{children}</h2>;
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function StatusRow({ ok, label, detail }: { ok: boolean | null; label: string; detail: string }) {
  const icon = ok === null ? "•" : ok ? "✓" : "!";
  const cls = ok === null ? "bg-surface-2 text-muted" : ok ? "bg-pos-bg text-pos" : "bg-warn-bg text-warn";
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${cls}`}
        aria-hidden
      >
        {icon}
      </span>
      <span>
        <span className="font-medium">{label}</span>
        <span className="sr-only">{ok === null ? "" : ok ? " (OK)" : " (krever oppmerksomhet)"}</span>
        <br />
        <span className="text-muted">{detail}</span>
      </span>
    </li>
  );
}
