import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getLibrary, getRuns } from "@/lib/data";
import { setWeeklyAuto } from "@/lib/actions/library";
import { formatDate, formatInt, formatUsd } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Innstillinger" };

const STATUS: Record<string, string> = {
  queued: "I kø",
  running: "Kjører",
  done: "Ferdig",
  failed: "Feilet",
  cancelled: "Avbrutt",
};

export default async function SettingsPage() {
  const { user } = await requireUser();
  const [runs, { stocks }] = await Promise.all([getRuns(100), getLibrary()]);
  const weeklyCount = stocks.filter((s) => s.weekly_auto).length;
  const total = runs.reduce((sum, r) => sum + Number(r.cost_usd), 0);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Innstillinger</h1>

      <section className="card p-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Konto</h2>
        <p className="text-sm">
          Innlogget som <span className="font-medium">{user.email}</span>
        </p>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Automatisk ukentlig oppdatering</h2>
          <p className="mt-1 text-sm text-muted">
            Hver mandag morgen (ca. kl. 06 norsk tid) kjøres ny research for aksjene som er slått på, hvis siste
            kjøring er eldre enn seks dager. {weeklyCount} av {stocks.length} aksjer er med.
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

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Kostnad per kjøring</h2>
          <p className="text-sm text-muted">
            Totalt siste {runs.length} kjøringer: <span className="font-medium text-fg">{formatUsd(total)}</span>
          </p>
        </div>
        {runs.length === 0 ? (
          <EmptyState title="Ingen kjøringer ennå">
            Tokenforbruk og estimert kostnad vises her etter hver researchkjøring.
          </EmptyState>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Dato</th>
                  <th className="px-4 py-2 font-medium">Aksje</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Tokens inn</th>
                  <th className="px-4 py-2 text-right font-medium">Tokens ut</th>
                  <th className="px-4 py-2 text-right font-medium">Søk</th>
                  <th className="px-4 py-2 text-right font-medium">Kostnad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 whitespace-nowrap">{formatDate(r.created_at)}</td>
                    <td className="px-4 py-2">{r.stocks?.name ?? "–"}</td>
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
        )}
      </section>
    </div>
  );
}
