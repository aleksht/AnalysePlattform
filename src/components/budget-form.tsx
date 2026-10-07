"use client";

import { useActionState } from "react";
import { updateBudget } from "@/lib/actions/library";

export function BudgetForm({ current }: { current: number | null }) {
  const [state, action, pending] = useActionState(updateBudget, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor="budget" className="mb-1 block text-sm font-medium">
          Månedsbudsjett (USD)
        </label>
        <input
          id="budget"
          name="budget"
          inputMode="decimal"
          defaultValue={current ?? ""}
          placeholder="Ingen grense"
          className="input w-36"
        />
      </div>
      <button className="btn-secondary" disabled={pending}>
        Lagre
      </button>
      {state.error && <p className="w-full text-sm text-neg">{state.error}</p>}
      {state.ok && !pending && <p className="w-full text-sm text-pos">Lagret</p>}
    </form>
  );
}
