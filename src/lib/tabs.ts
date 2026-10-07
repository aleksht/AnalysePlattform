export const STOCK_TABS = [
  { slug: "oversikt", label: "Oversikt" },
  { slug: "kunder", label: "Kundestemning" },
  { slug: "ansatte", label: "Ansatte" },
  { slug: "ledelse", label: "Ledelse og resultater" },
  { slug: "nyheter", label: "Nyheter og bransje" },
  { slug: "rode-flagg", label: "Røde flagg" },
  { slug: "kilder", label: "Kilder" },
] as const;

export type TabSlug = (typeof STOCK_TABS)[number]["slug"];

export function parseTab(value: string | string[] | undefined): TabSlug {
  const v = Array.isArray(value) ? value[0] : value;
  return STOCK_TABS.some((t) => t.slug === v) ? (v as TabSlug) : "oversikt";
}
