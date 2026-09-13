import { recordMetricsEvent } from "@/lib/metrics";
import type { MetricsEventType } from "@/lib/metrics-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENT_TYPES: MetricsEventType[] = [
  "registration_started",
  "payment_succeeded",
  "payment_failed",
];

function isMetricsEventType(value: unknown): value is MetricsEventType {
  return (
    typeof value === "string" &&
    EVENT_TYPES.includes(value as MetricsEventType)
  );
}

/**
 * Ingest app events into in-process Prometheus counters.
 * Intended for local/demo use; protect or remove in production.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const type =
    body && typeof body === "object" && "type" in body
      ? (body as { type: unknown }).type
      : undefined;

  if (!isMetricsEventType(type)) {
    return Response.json(
      {
        error: `Unknown event type. Expected one of: ${EVENT_TYPES.join(", ")}`,
      },
      { status: 400 },
    );
  }

  recordMetricsEvent(type);
  return Response.json({ ok: true });
}
