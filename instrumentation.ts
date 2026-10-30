/**
 * Runs once per Next.js server instance. Boots the async payment-verification
 * worker (requirement 2): confirm-enrollment and the Stripe webhook only
 * enqueue; this loop verifies payments and enrolls players in the background.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startPaymentVerificationWorker } = await import(
    "@/lib/payment-verification"
  );
  startPaymentVerificationWorker();
}
