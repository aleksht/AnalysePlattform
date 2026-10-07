import Link from "next/link";
import { STOCK_TABS, type TabSlug } from "@/lib/tabs";

export function StockTabs({ stockId, active }: { stockId: string; active: TabSlug }) {
  return (
    <nav
      aria-label="Faner"
      className="-mx-4 overflow-x-auto border-b border-border px-4 [scrollbar-width:none]"
    >
      <ul className="flex min-w-max gap-1">
        {STOCK_TABS.map((t) => {
          const isActive = t.slug === active;
          return (
            <li key={t.slug}>
              <Link
                href={t.slug === "oversikt" ? `/aksjer/${stockId}` : `/aksjer/${stockId}?fane=${t.slug}`}
                scroll={false}
                aria-current={isActive ? "page" : undefined}
                className={`inline-block border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-accent font-medium text-fg"
                    : "border-transparent text-muted hover:text-fg"
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
