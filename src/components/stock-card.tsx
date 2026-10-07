import Link from "next/link";
import type { Stock } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { SentimentBadge } from "./sentiment-badge";

export function StockCard({ stock }: { stock: Stock }) {
  return (
    <Link
      href={`/aksjer/${stock.id}`}
      className="card group flex flex-col gap-3 p-4 transition-colors hover:border-accent/60"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold group-hover:text-accent">{stock.name}</h3>
          <p className="font-mono text-xs text-muted">
            {stock.ticker}
            {stock.exchange ? ` · ${stock.exchange}` : ""}
          </p>
        </div>
        <SentimentBadge label={stock.sentiment_label} score={stock.sentiment_score} />
      </div>
      <p className="text-xs text-muted">
        {stock.last_run_at ? `Oppdatert ${formatDate(stock.last_run_at)}` : "Ingen research ennå"}
      </p>
    </Link>
  );
}
