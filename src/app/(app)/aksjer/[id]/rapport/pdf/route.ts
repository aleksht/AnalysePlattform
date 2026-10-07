import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getLatestResearch, getPriceHistory, getStock } from "@/lib/data";
import { ReportPdf } from "@/lib/pdf/report-pdf";

export const maxDuration = 60;

/** Rapporten som PDF. Leses med brukerens egen innlogging, så RLS gjelder. */
export async function GET(request: NextRequest, ctx: RouteContext<"/aksjer/[id]/rapport/pdf">) {
  const { id } = await ctx.params;
  const runId = request.nextUrl.searchParams.get("kjoring") ?? undefined;
  if (!z.guid().safeParse(id).success || (runId && !z.guid().safeParse(runId).success)) {
    return NextResponse.json({ error: "Ugyldig adresse" }, { status: 400 });
  }

  const [stock, research, prices] = await Promise.all([getStock(id), getLatestResearch(id, runId), getPriceHistory(id)]);
  if (!stock || !research) return NextResponse.json({ error: "Fant ingen rapport" }, { status: 404 });

  // Kursendring siste år. Mangler vi et helt år med kurser, oppgis perioden vi faktisk har.
  const yearAgo = new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10);
  const start = prices.find((p) => p.date >= yearAgo);
  const last = prices.at(-1);
  const fullYear = prices.length > 0 && prices[0].date <= new Date(Date.now() - 350 * 86400_000).toISOString().slice(0, 10);
  const priceChange =
    start && last && start !== last
      ? { pct: ((last.close - start.close) / start.close) * 100, since: fullYear ? null : start.date }
      : null;

  const buffer = await renderToBuffer(
    createElement(ReportPdf, { stock, run: research.run, findings: research.findings, sources: research.sources, priceChange }) as Parameters<typeof renderToBuffer>[0],
  );

  const date = (research.run.finished_at ?? new Date().toISOString()).slice(0, 10);
  const safeName = stock.name.normalize("NFKD").replace(/[^\w-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const filename = `Aksjeinnsikt-${safeName || "rapport"}-${date}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "cache-control": "private, no-store",
    },
  });
}
