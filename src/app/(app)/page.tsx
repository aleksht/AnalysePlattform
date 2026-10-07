import { getLibrary } from "@/lib/data";
import { StockCard } from "@/components/stock-card";
import { EmptyState } from "@/components/empty-state";
import { AddStockForm, FolderMenu, NewFolderForm } from "@/components/library-forms";
import type { Stock } from "@/lib/types";

export default async function HomePage() {
  const { folders, stocks } = await getLibrary();

  const byFolder = new Map<string | null, Stock[]>();
  for (const s of stocks) {
    const key = folders.some((f) => f.id === s.folder_id) ? s.folder_id : null;
    byFolder.set(key, [...(byFolder.get(key) ?? []), s]);
  }
  const unfiled = byFolder.get(null) ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Aksjer</h1>
          <p className="text-sm text-muted">
            {stocks.length === 0
              ? "Legg til selskapene du vil følge med på."
              : `${stocks.length} ${stocks.length === 1 ? "aksje" : "aksjer"} i ${folders.length} ${
                  folders.length === 1 ? "mappe" : "mapper"
                }`}
          </p>
        </div>
        <div className="flex gap-2">
          <NewFolderForm />
          <AddStockForm folders={folders} />
        </div>
      </div>

      {stocks.length === 0 && folders.length === 0 && (
        <EmptyState title="Ingen aksjer ennå">
          Start med å lage en mappe, for eksempel «Følger med» eller «Eier», og legg så til en aksje som
          Munters (MTRS).
        </EmptyState>
      )}

      {folders.map((folder) => {
        const list = byFolder.get(folder.id) ?? [];
        return (
          <section key={folder.id} aria-labelledby={`folder-${folder.id}`}>
            <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
              <h2 id={`folder-${folder.id}`} className="text-sm font-semibold uppercase tracking-wide text-muted">
                {folder.name}
              </h2>
              <span className="text-xs text-muted">{list.length}</span>
              <div className="ml-auto">
                <FolderMenu folder={folder} stockCount={list.length} />
              </div>
            </div>
            {list.length === 0 ? (
              <p className="text-sm text-muted">Ingen aksjer i denne mappen.</p>
            ) : (
              <StockGrid stocks={list} />
            )}
          </section>
        );
      })}

      {unfiled.length > 0 && (
        <section aria-labelledby="folder-none">
          <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
            <h2 id="folder-none" className="text-sm font-semibold uppercase tracking-wide text-muted">
              Uten mappe
            </h2>
            <span className="text-xs text-muted">{unfiled.length}</span>
          </div>
          <StockGrid stocks={unfiled} />
        </section>
      )}
    </div>
  );
}

function StockGrid({ stocks }: { stocks: Stock[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {stocks.map((s) => (
        <StockCard key={s.id} stock={s} />
      ))}
    </div>
  );
}
