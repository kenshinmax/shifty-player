import Stripe from "stripe";
import { getOrganizationById } from "@/lib/db/platform-repository";
import {
  claimDueVerification,
  updatePaymentVerification,
  type PaymentVerification,
} from "@/lib/db/payment-verification-repository";
import {
  claimProcessedPayment,
  enrollPaidInDb,
  getRegistrationState,
} from "@/lib/db/registration-repository";
import { syncEnrollmentToHubSpot } from "@/lib/hubspot-sync";
import { buildMerchandiseOrder } from "@/lib/merchandise";
import { getClinicTuitionCents } from "@/lib/programs";
import { recordMetricsEvent } from "@/lib/metrics";
import {
  evaluatePaymentIntentForEnrollment,
  getStripe,
} from "@/lib/stripe";

/** How the worker retrieves a PaymentIntent; injected in tests. */
export type RetrievePaymentIntent = (
  paymentIntentId: string,
) => Promise<{
  id: string;
  status: string;
  amount: number;
  currency: string;
  metadata: Stripe.Metadata;
}>;

const defaultRetrievePaymentIntent: RetrievePaymentIntent = (paymentIntentId) =>
  getStripe().paymentIntents.retrieve(paymentIntentId) as never;

function maxAttempts(): number {
  const parsed = Number(process.env.PAYMENT_VERIFICATION_MAX_ATTEMPTS);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 5;
}

function backoffMs(attempts: number): number {
  const base = Number(process.env.PAYMENT_VERIFICATION_BACKOFF_MS);
  const baseMs = Number.isFinite(base) && base >= 0 ? base : 2_000;
  return baseMs * 2 ** Math.max(0, attempts - 1);
}

/** Marks a job failed permanently (deterministic problem, no more retries). */
async function markFailed(
  job: PaymentVerification,
  error: string,
): Promise<void> {
  await updatePaymentVerification(job.paymentIntentId, {
    status: "failed",
    lastError: error,
  });
}

/** Schedules another try, or fails the job once attempts are exhausted. */
async function scheduleRetry(
  job: PaymentVerification,
  error: string,
): Promise<void> {
  const attempts = job.attempts + 1;
  if (attempts >= maxAttempts()) {
    await markFailed(job, `${error} (after ${attempts} attempts)`);
    return;
  }
  await updatePaymentVerification(job.paymentIntentId, {
    status: "pending",
    attempts,
    lastError: error,
    nextAttemptAt: new Date(Date.now() + backoffMs(attempts)).toISOString(),
  });
}

/**
 * Processes one claimed job: retrieves the PaymentIntent from Stripe, validates
 * it against the requested enrollment, and enrolls. Deterministic mismatches
 * fail the job; transient errors (Stripe/network/Mongo) are retried.
 */
async function processJob(
  job: PaymentVerification,
  retrievePaymentIntent: RetrievePaymentIntent,
): Promise<void> {
  const org = await getOrganizationById(job.orgId);
  if (!org) {
    console.warn(
      `Payment verification: organization ${job.orgId} not found; ${job.paymentIntentId} not enrolled.`,
    );
    await markFailed(job, `Organization ${job.orgId} not found.`);
    return;
  }

  let paymentIntent;
  try {
    paymentIntent = await retrievePaymentIntent(job.paymentIntentId);
  } catch (error) {
    await scheduleRetry(
      job,
      error instanceof Error ? error.message : "Failed to retrieve payment.",
    );
    return;
  }

  // A payment that has not settled yet may still succeed: retry, don't fail.
  if (paymentIntent.status !== "succeeded") {
    await scheduleRetry(
      job,
      `Payment is not complete (status: ${paymentIntent.status}).`,
    );
    return;
  }

  const state = await getRegistrationState(job.orgId);
  const clinic = state.sessions.find(
    (session) => session.id === job.clinicId,
  );
  const evaluation = evaluatePaymentIntentForEnrollment(paymentIntent, {
    playerId: job.playerId,
    programId: job.programId,
    clinicId: job.clinicId,
    tuitionCents: clinic ? getClinicTuitionCents(clinic) : undefined,
  });
  if (!evaluation.approved) {
    await markFailed(job, evaluation.error);
    return;
  }

  const merchandiseOrder = buildMerchandiseOrder(
    job.clinicId,
    evaluation.cart,
    new Date().toISOString(),
    evaluation.tuitionCents,
  );
  const enrolled = await enrollPaidInDb(
    job.orgId,
    job.playerId,
    job.programId,
    job.clinicId,
    merchandiseOrder.paidAt,
    merchandiseOrder,
  );
  if ("error" in enrolled) {
    await markFailed(job, enrolled.error);
    return;
  }

  await updatePaymentVerification(job.paymentIntentId, {
    status: "verified",
  });

  // The verified payment enrolls exactly once (requirement 1): the unique
  // processed_payments claim is the single gate for the once-only side effects.
  const claimed = await claimProcessedPayment(job.paymentIntentId);
  if (claimed) {
    recordMetricsEvent("payment_succeeded");
    const enrolledState = enrolled.state;
    void syncEnrollmentToHubSpot(
      enrolledState,
      job.playerId,
      job.programId,
      job.paymentIntentId,
    ).catch((error) => {
      console.warn(
        `Payment verification: HubSpot sync failed for ${job.paymentIntentId}:`,
        error,
      );
    });
  }

  await updatePaymentVerification(job.paymentIntentId, {
    status: "enrolled",
  });
}

/**
 * Claims and processes every due verification once. Returns how many jobs
 * were processed. Failures inside processJob never throw: they are recorded
 * as retries or permanent failures on the job itself.
 */
export async function processPaymentVerifications(
  retrievePaymentIntent: RetrievePaymentIntent = defaultRetrievePaymentIntent,
): Promise<number> {
  let processed = 0;
  for (;;) {
    const job = await claimDueVerification();
    if (!job) break;
    processed += 1;
    try {
      await processJob(job, retrievePaymentIntent);
    } catch (error) {
      // Unexpected crash (e.g. Mongo blip): put the job back for retry.
      await scheduleRetry(
        job,
        error instanceof Error ? error.message : "Verification crashed.",
      );
    }
  }
  return processed;
}

type WorkerGlobal = typeof globalThis & {
  __shiftyPaymentWorkerStarted?: boolean;
};

const globalForWorker = globalThis as WorkerGlobal;

/**
 * Starts the background polling loop (once per server instance). Fire-and-forget:
 * verification failures are persisted on the jobs, never thrown.
 */
export function startPaymentVerificationWorker(): void {
  if (globalForWorker.__shiftyPaymentWorkerStarted) return;
  globalForWorker.__shiftyPaymentWorkerStarted = true;

  const parsed = Number(process.env.PAYMENT_VERIFICATION_POLL_MS);
  const pollMs = Number.isFinite(parsed) && parsed >= 250 ? parsed : 2_000;

  const tick = () => {
    void processPaymentVerifications().catch((error) => {
      console.warn("Payment verification worker tick failed:", error);
    });
  };

  const timer = setInterval(tick, pollMs);
  // Never keep the process alive just for the worker.
  timer.unref?.();
  tick();
}
