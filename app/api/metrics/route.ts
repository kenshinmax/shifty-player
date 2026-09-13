import { METRICS_CONTENT_TYPE, renderMetrics } from "@/lib/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Prometheus scrape endpoint for local or cluster collectors. */
export async function GET() {
  const body = await renderMetrics();
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": METRICS_CONTENT_TYPE,
      "Cache-Control": "no-store",
    },
  });
}
