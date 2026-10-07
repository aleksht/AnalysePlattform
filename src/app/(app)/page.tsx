import { after } from "next/server";
import { getLibrary, getPriceSparklines, getSparklines } from "@/lib/data";
import { requireUser } from "@/lib/auth";
import { refreshStalePrices } from "@/lib/prices/refresh";
import { StockCard } from "@/components/stock-card";
import { AddStockForm, FolderMenu, NewFolderForm } from "@/components/library-forms";
import { Container, SectionTitle } from "@/components/container";
import type { Folder, Stock } from "@/lib/types";

export default async function HomePage() {
  const { user } = await requireUser();
  const [{ folders, stocks }, sparks, priceSparks] = await Promise.all([
    getLibrary(),
    getSparklines(),
    getPriceSparklines(),
  ]);
  // Oppdater gamle kurser i bakgrunnen; nye tall vises ved neste visning
  after(() => refreshStalePrices({ userId: user.id }).catch((e) => console.warn("Kursoppdatering:", e)));

  const byFolder = new Map<string | null, Stock[]>();
  for (const s of stocks) {
    const key = folders.some((f) => f.id === s.folder_id) ? s.folder_id : null;
    byFolder.set(key, [...(byFolder.get(key) ?? []), s]);
  }
  const unfiled = byFolder.get(null) ?? [];
  const sections: { folder: Folder | null; list: Stock[] }[] = [
    ...folders.map((f) => ({ folder: f, list: byFolder.get(f.id) ?? [] })),
    ...(unfiled.length > 0 ? [{ folder: null, list: unfiled }] : []),
  ];

  return (
    <>
      <section className="px-[22px] pb-16 pt-16 text-center sm:pb-20 sm:pt-24">
        <h1 className="text-[44px] font-bold leading-[1.06] tracking-[-0.025em] sm:text-[64px]">Aksjene dine.</h1>
        <p className="mx-auto mt-3.5 max-w-[640px] text-xl leading-snug text-muted sm:text-2xl">
          Hva kunder, ansatte og markedet faktisk mener – samlet på ett sted.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
          <AddStockForm folders={folders} />
          <NewFolderForm />
        </div>
        {stocks.length > 0 && (
          <p className="mt-6 text-sm text-muted">
            {stocks.length} {stocks.length === 1 ? "aksje" : "aksjer"} i {folders.length}{" "}
            {folders.length === 1 ? "mappe" : "mapper"}
          </p>
        )}
      </section>

      {sections.length === 0 && (
        <section className="bg-surface-2 px-[22px] py-20 text-center">
          <SectionTitle>Kom i gang.</SectionTitle>
          <p className="mx-auto mt-3 max-w-[560px] text-lg leading-relaxed text-muted">
            Lag en mappe, for eksempel «Følger med» eller «Eier», og legg til en aksje som Munters (MTRS).
          </p>
        </section>
      )}

      {sections.map(({ folder, list }, i) => {
        const gray = i % 2 === 0;
        return (
          <section
            key={folder?.id ?? "uten-mappe"}
            aria-label={folder?.name ?? "Uten mappe"}
            className={`py-16 sm:py-20 ${gray ? "bg-surface-2" : "bg-bg"}`}
          >
            <Container>
              <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
                <div className="flex items-baseline gap-3">
                  <SectionTitle>{folder ? `${folder.name}.` : "Uten mappe."}</SectionTitle>
                  <span className="text-lg text-muted">{list.length}</span>
                </div>
                {folder && <FolderMenu folder={folder} stockCount={list.length} />}
              </div>
              {list.length === 0 ? (
                <p className="text-lg text-muted">Ingen aksjer i denne mappen ennå.</p>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((s) => (
                    <StockCard
                      key={s.id}
                      stock={s}
                      spark={sparks.get(s.id)}
                      priceSpark={priceSparks.get(s.id)}
                      tone={gray ? "white" : "gray"}
                    />
                  ))}
                </div>
              )}
            </Container>
          </section>
        );
      })}

      <footer className="bg-surface-2 py-7 text-xs text-muted">
        <Container className="flex flex-wrap justify-between gap-4">
          <span>Funn hentes fra offentlige kilder. Ikke investeringsråd.</span>
          <span>Automatisk oppdatering hver mandag ca. kl. 06.00</span>
        </Container>
      </footer>
    </>
  );
}
