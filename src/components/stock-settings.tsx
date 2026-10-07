"use client";

import { useActionState } from "react";
import { deleteStock, updateStock } from "@/lib/actions/library";
import type { Folder, Stock } from "@/lib/types";
import { EXCHANGES } from "./library-forms";

export function StockSettings({ stock, folders }: { stock: Stock; folders: Folder[] }) {
  const [state, action, pending] = useActionState(updateStock, {});
  return (
    <details className="card group">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-muted hover:text-fg">
        Rediger, flytt eller slett aksjen
      </summary>
      <div className="space-y-4 border-t border-border p-4">
        <form action={action} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={stock.id} />
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="edit-name">Selskap</label>
            <input id="edit-name" name="name" defaultValue={stock.name} className="input" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="edit-ticker">Ticker</label>
              <input id="edit-ticker" name="ticker" defaultValue={stock.ticker} className="input font-mono uppercase" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="edit-exchange">Børs</label>
              <input id="edit-exchange" name="exchange" defaultValue={stock.exchange ?? ""} list="edit-exchanges" className="input" />
              <datalist id="edit-exchanges">
                {EXCHANGES.map((e) => <option key={e} value={e} />)}
              </datalist>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="edit-folder">Mappe</label>
            <select id="edit-folder" name="folder_id" defaultValue={stock.folder_id ?? ""} className="input">
              <option value="">Uten mappe</option>
              {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" name="weekly_auto" defaultChecked={stock.weekly_auto} className="h-4 w-4 accent-[var(--accent)]" />
            Automatisk ukentlig oppdatering
          </label>
          <div className="flex items-center gap-3 sm:col-span-2">
            <button className="btn-primary" disabled={pending}>Lagre</button>
            {state.error && <span className="text-sm text-neg">{state.error}</span>}
            {state.ok && !pending && <span className="text-sm text-pos">Lagret</span>}
          </div>
        </form>
        <form
          action={deleteStock}
          onSubmit={(e) => {
            if (!confirm(`Slette ${stock.name} og all research som er lagret for den?`)) e.preventDefault();
          }}
          className="border-t border-border pt-4"
        >
          <input type="hidden" name="id" value={stock.id} />
          <button className="btn-danger">Slett aksjen</button>
        </form>
      </div>
    </details>
  );
}
