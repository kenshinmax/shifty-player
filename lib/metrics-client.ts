export type MetricsEventType =
  | "registration_started"
  | "payment_succeeded"
  | "payment_failed";

/** Fire-and-forget metrics ingest; never blocks UX on failure. */
export function emitMetricsEvent(type: MetricsEventType): void {
  if (typeof window === "undefined") return;

  void fetch("/api/metrics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type }),
    keepalive: true,
  }).catch(() => {
    // Metrics must not affect registration/payment UX.
  });
}
