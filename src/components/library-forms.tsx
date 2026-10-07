"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createFolder,
  createStock,
  deleteFolder,
  renameFolder,
  type FormState,
} from "@/lib/actions/library";
import type { Folder } from "@/lib/types";

export const EXCHANGES = [
  "Nasdaq Stockholm",
  "Oslo Børs",
  "Nasdaq Copenhagen",
  "Nasdaq Helsinki",
  "NYSE",
  "Nasdaq (USA)",
  "London Stock Exchange",
  "Xetra",
  "Euronext Paris",
  "Euronext Amsterdam",
];

/** Lukker en omsluttende <details> og nullstiller skjemaet etter vellykket innsending. */
function useResetOnSuccess(state: FormState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && ref.current) {
      ref.current.reset();
      ref.current.closest("details")?.removeAttribute("open");
    }
  }, [state]);
  return ref;
}

export function NewFolderForm() {
  const [state, action, pending] = useActionState(createFolder, {});
  const ref = useResetOnSuccess(state);
  return (
    <details className="relative">
      <summary className="btn-secondary cursor-pointer list-none">+ Ny mappe</summary>
      <div className="card absolute right-0 z-10 mt-2 w-72 p-4 shadow-lg">
        <form ref={ref} action={action} className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="folder-name">
            Navn på mappe
          </label>
          <input id="folder-name" name="name" className="input" placeholder="F.eks. Følger med" required />
          {state.error && <p className="text-sm text-neg">{state.error}</p>}
          <button className="btn-primary w-full" disabled={pending}>
            Lag mappe
          </button>
        </form>
      </div>
    </details>
  );
}

export function AddStockForm({ folders }: { folders: Folder[] }) {
  const [state, action, pending] = useActionState(createStock, {});
  const ref = useResetOnSuccess(state);
  return (
    <details className="relative">
      <summary className="btn-primary cursor-pointer list-none">+ Legg til aksje</summary>
      <div className="card absolute right-0 z-10 mt-2 w-[min(22rem,calc(100vw-2rem))] p-4 shadow-lg">
        <form ref={ref} action={action} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="stock-name">
              Selskap
            </label>
            <input id="stock-name" name="name" className="input" placeholder="Munters" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="stock-ticker">
                Ticker
              </label>
              <input
                id="stock-ticker"
                name="ticker"
                className="input font-mono uppercase"
                placeholder="MTRS"
                autoCapitalize="characters"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="stock-exchange">
                Børs
              </label>
              <input
                id="stock-exchange"
                name="exchange"
                className="input"
                list="exchanges"
                placeholder="Nasdaq Stockholm"
              />
              <datalist id="exchanges">
                {EXCHANGES.map((e) => (
                  <option key={e} value={e} />
                ))}
              </datalist>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="stock-folder">
              Mappe
            </label>
            <select id="stock-folder" name="folder_id" className="input" defaultValue={folders[0]?.id ?? ""}>
              <option value="">Uten mappe</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          {state.error && <p className="text-sm text-neg">{state.error}</p>}
          <button className="btn-primary w-full" disabled={pending}>
            Legg til
          </button>
        </form>
      </div>
    </details>
  );
}

export function FolderMenu({ folder, stockCount }: { folder: Folder; stockCount: number }) {
  const [state, action, pending] = useActionState(renameFolder, {});
  const ref = useResetOnSuccess(state);
  return (
    <details className="relative">
      <summary
        className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
        aria-label={`Valg for ${folder.name}`}
      >
        ⋯
      </summary>
      <div className="card absolute right-0 z-10 mt-1 w-64 space-y-3 p-4 shadow-lg">
        <form ref={ref} action={action} className="space-y-2">
          <input type="hidden" name="id" value={folder.id} />
          <label className="block text-sm font-medium" htmlFor={`rename-${folder.id}`}>
            Endre navn
          </label>
          <input id={`rename-${folder.id}`} name="name" defaultValue={folder.name} className="input" required />
          {state.error && <p className="text-sm text-neg">{state.error}</p>}
          <button className="btn-secondary w-full" disabled={pending}>
            Lagre
          </button>
        </form>
        <form
          action={deleteFolder}
          onSubmit={(e) => {
            const msg =
              stockCount > 0
                ? `Slette mappen «${folder.name}»? De ${stockCount} aksjene flyttes til «Uten mappe».`
                : `Slette mappen «${folder.name}»?`;
            if (!confirm(msg)) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={folder.id} />
          <button className="btn-danger w-full">Slett mappe</button>
        </form>
      </div>
    </details>
  );
}
