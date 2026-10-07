const dateFmt = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Oslo",
});

export function formatDate(value: string | null | undefined): string {
  if (!value) return "–";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "–" : dateFmt.format(d);
}

const usdFmt = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatUsd(value: number | string | null | undefined): string {
  return usdFmt.format(Number(value ?? 0));
}

export function formatInt(value: number | string | null | undefined): string {
  return new Intl.NumberFormat("nb-NO").format(Number(value ?? 0));
}

export function formatPrice(value: number | string | null | undefined, currency?: string | null): string {
  if (value == null) return "–";
  const n = new Intl.NumberFormat("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
  return currency ? `${n} ${currency}` : n;
}

export function formatPct(value: number | string | null | undefined): string {
  if (value == null) return "–";
  const v = Number(value);
  return `${v >= 0 ? "+" : "−"}${new Intl.NumberFormat("nb-NO", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(v))} %`;
}
