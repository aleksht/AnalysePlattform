"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="py-16 text-center">
      <h1 className="text-xl font-semibold">Noe gikk galt</h1>
      <p className="mt-1 text-sm text-muted">
        Kunne ikke hente data akkurat nå. Sjekk nettforbindelsen og prøv igjen.
        {error.digest && <span className="block text-xs">Feilkode: {error.digest}</span>}
      </p>
      <button onClick={reset} className="btn-secondary mt-6">
        Prøv igjen
      </button>
    </div>
  );
}
