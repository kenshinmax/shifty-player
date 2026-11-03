/**
 * Runs once per Next.js server instance. Boots the async payment-verification
 * worker (requirement 2): confirm-enrollment and the Stripe webhook only
 * enqueue; this loop verifies payments and enrolls players in the background.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Start OpenTelemetry (Splunk export) first so the worker and every API
  // route share the global tracer/meter providers. No-ops unless enabled
  // via environment variables (see documentation/planned/otel-splunk-implementation-plan.md).
  const { startOtel } = await import("@/lib/otel");
  await startOtel();
  const { startPaymentVerificationWorker } = await import(
    "@/lib/payment-verification"
  );
  startPaymentVerificationWorker();
}
