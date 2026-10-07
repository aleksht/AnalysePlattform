"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelResearch, retryFailedSteps, startResearch } from "@/lib/actions/research";

type StepStatus = { step: string; status: string; ord: number; error: string | null };
type RunStatus = {
  id: string;
  status: string;
  current_step: string | null;
  steps_total: number;
  steps_done: number;
  error: string | null;
  cost_usd: number;
  created_at: string;
  started_at: string | null;
  run_steps: StepStatus[];
};

const STEP_LABELS: Record<string, string> = {
  oversikt: "Oversikt",
  kunder: "Kunder",
  ansatte: "Ansatte",
  ledelse: "Ledelse",
  nyheter: "Nyheter",
  konkurrenter: "Konkurrenter",
  syntese: "Oppsummering",
};

export function RunControl({ stockId, activeRunId }: { stockId: string; activeRunId: string | null }) {
  const router = useRouter();
  const [runId, setRunId] = useState(activeRunId);
  const [status, setStatus] = useState<RunStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waitingMin, setWaitingMin] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!runId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch(`/api/runs/${runId}`, { cache: "no-store", redirect: "manual" });
        if (res.status === 401 || res.type === "opaqueredirect") {
          setError("Du er logget ut. Logg inn igjen for å se fremdriften.");
          return;
        }
        if (res.status === 404) {
          setRunId(null);
          router.refresh();
          return;
        }
        if (res.ok) {
          const data = (await res.json()) as RunStatus;
          if (stopped) return;
          setStatus(data);
          setWaitingMin((Date.now() - new Date(data.created_at).getTime()) / 60_000);
          if (!["queued", "running"].includes(data.status)) {
            setRunId(null);
            if (data.status === "failed") setError(data.error ?? "Researchen feilet.");
            router.refresh();
            return;
          }
        }
      } catch {
        // Nettverksfeil: prøv igjen ved neste runde
      }
      if (!stopped) timer = setTimeout(poll, 4000);
    }
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [runId, router]);

  function start() {
    setError(null);
    startTransition(async () => {
      const res = await startResearch(stockId);
      if (res.error) setError(res.error);
      else if (res.runId) setRunId(res.runId);
    });
  }

  function cancel() {
    if (!runId || !confirm("Avbryte researchen? Steg som er ferdige, beholdes ikke i rapporten.")) return;
    startTransition(async () => {
      await cancelResearch(runId);
      setRunId(null);
      setStatus(null);
      router.refresh();
    });
  }

  if (runId) {
    const steps = [...(status?.run_steps ?? [])].sort((a, b) => a.ord - b.ord);
    const done = steps.filter((s) => s.status === "done" || s.status === "failed").length;
    const total = status?.steps_total || steps.length || 7;
    const pct = Math.round((done / total) * 100);
    const stuck = status?.status === "queued" && waitingMin > 3;
    const retrying = steps.filter((s) => s.status === "queued" && s.error);
    return (
      <div className="card w-full p-4 sm:w-96" role="status" aria-live="polite">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">
            {status?.status === "queued" || !status ? "Venter på å starte …" : `Researcher … ${done} av ${total}`}
          </span>
          <button onClick={cancel} disabled={pending} className="text-xs text-muted hover:text-neg">
            Avbryt
          </button>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${Math.max(pct, 4)}%` }} />
        </div>
        <ul className="mt-3 flex flex-wrap gap-1.5 text-xs">
          {steps.map((s) => (
            <li
              key={s.step}
              className={`rounded-full px-2 py-0.5 ${
                s.status === "done"
                  ? "bg-pos-bg text-pos"
                  : s.status === "failed"
                    ? "bg-neg-bg text-neg"
                    : s.status === "running"
                      ? "bg-accent/15 text-accent"
                      : "bg-surface-2 text-muted"
              }`}
            >
              {s.status === "running" && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current align-middle" />}
              {STEP_LABELS[s.step] ?? s.step}
            </li>
          ))}
        </ul>
        {retrying.length > 0 && (
          <p className="mt-2 text-xs text-warn">
            Prøver igjen: {retrying.map((s) => STEP_LABELS[s.step] ?? s.step).join(", ")} ({retrying[0].error})
          </p>
        )}
        {stuck ? (
          <p className="mt-2 text-xs text-warn">
            Kjøringen har ventet i {Math.round(waitingMin)} minutter uten å starte. Sjekk Systemstatus under Innstillinger.
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted">
            Tar vanligvis 5–15 minutter. Du kan lukke siden imens.
            {status && Number(status.cost_usd) > 0 && <> Kostnad så langt: ${Number(status.cost_usd).toFixed(2)}.</>}
          </p>
        )}
        {error && <p className="mt-2 text-xs text-neg">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button onClick={start} disabled={pending} className="btn-primary">
        {pending ? "Starter …" : "Kjør ny research nå"}
      </button>
      {error && <p className="max-w-xs text-right text-xs text-neg">{error}</p>}
    </div>
  );
}

/** Knapp for å prøve feilede steg i siste kjøring på nytt. */
export function RetryFailedButton({ runId }: { runId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        onClick={() =>
          startTransition(async () => {
            const res = await retryFailedSteps(runId);
            if (res.error) setError(res.error);
            else router.refresh();
          })
        }
        disabled={pending}
        className="font-medium underline underline-offset-2 hover:no-underline"
      >
        {pending ? "Starter …" : "Prøv feilede steg på nytt"}
      </button>
      {error && <span className="text-neg">{error}</span>}
    </span>
  );
}
