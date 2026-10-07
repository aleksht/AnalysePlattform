"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="py-16 text-center">
      <h1 className="text-xl font-semibold">Noe gikk galt</h1>
      <p className="mt-1 text-sm text-muted">Kunne ikke hente data akkurat nå.</p>
      <button onClick={reset} className="btn-secondary mt-6">Prøv igjen</button>
    </div>
  );
}
