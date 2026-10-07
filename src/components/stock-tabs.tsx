import Link from "next/link";
import { STOCK_TABS, type TabSlug } from "@/lib/tabs";

/** Seksjonsmeny i stil med produktsidene på apple.no. */
export function StockTabs({ stockId, active }: { stockId: string; active: TabSlug }) {
  return (
    <nav aria-label="Seksjoner" className="-mx-[22px] overflow-x-auto px-[22px] [scrollbar-width:none] sm:mx-0 sm:px-0">
      <ul className="flex min-w-max items-center gap-5 text-[13px]">
        {STOCK_TABS.map((t) => {
          const isActive = t.slug === active;
          return (
            <li key={t.slug}>
              <Link
                href={t.slug === "oversikt" ? `/aksjer/${stockId}` : `/aksjer/${stockId}?fane=${t.slug}`}
                scroll={false}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex min-h-11 items-center whitespace-nowrap ${
                  isActive ? "font-semibold text-fg" : "text-fg/70 hover:text-fg"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
