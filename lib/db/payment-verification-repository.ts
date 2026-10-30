import { getDocStore } from "@/lib/db/doc-store";

/**
 * Persisted verification status for a Stripe PaymentIntent (requirements 3+4):
 * the async worker claims due `pending` jobs, and `failed` jobs can be
 * re-enqueued. `paymentIntentId` is the unique key, so enqueuing the same
 * payment from both the webhook and confirm-enrollment never duplicates work.
 */
export type PaymentVerificationStatus =
  | "pending"
  | "processing"
  | "verified"
  | "enrolled"
  | "failed";

export type PaymentVerification = {
  paymentIntentId: string;
  orgId: string;
  playerId: string;
  programId: string;
  clinicId: string;
  status: PaymentVerificationStatus;
  attempts: number;
  /** ISO timestamp before which the worker must not claim the job. */
  nextAttemptAt: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
};

export type EnqueueVerificationInput = {
  paymentIntentId: string;
  orgId: string;
  playerId: string;
  programId: string;
  clinicId: string;
};

const COLLECTION = "payment_verifications";

/** Inserts the verification job; false when one already exists for this payment. */
export async function enqueuePaymentVerification(
  input: EnqueueVerificationInput,
): Promise<boolean> {
  const now = new Date().toISOString();
  return getDocStore().insertOne(COLLECTION, {
    ...input,
    status: "pending",
    attempts: 0,
    nextAttemptAt: now,
    createdAt: now,
    updatedAt: now,
  } satisfies PaymentVerification);
}

export async function getPaymentVerification(
  paymentIntentId: string,
): Promise<PaymentVerification | null> {
  const doc = await getDocStore().findOne<PaymentVerification>(COLLECTION, {
    paymentIntentId,
  });
  return doc;
}

/**
 * Claims one due job by flipping it to `processing`. The status guard in the
 * filter keeps concurrent workers from claiming the same job twice.
 */
export async function claimDueVerification(): Promise<PaymentVerification | null> {
  const store = getDocStore();
  const now = new Date().toISOString();
  const due = await store.find<PaymentVerification>(COLLECTION, {
    status: "pending",
  });
  const job = due
    .filter((entry) => entry.nextAttemptAt <= now)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  if (!job) return null;

  const claimed = await store.updateMany(
    COLLECTION,
    { paymentIntentId: job.paymentIntentId, status: "pending" },
    { status: "processing", updatedAt: now },
  );
  return claimed === 1 ? { ...job, status: "processing" } : null;
}

export async function updatePaymentVerification(
  paymentIntentId: string,
  set: Partial<Pick<PaymentVerification, "status" | "attempts" | "nextAttemptAt" | "lastError">>,
): Promise<void> {
  await getDocStore().updateMany(COLLECTION, { paymentIntentId }, {
    ...set,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Re-enqueues a failed job for another round of attempts (requirement 4).
 * Returns false unless the job exists and is in `failed`.
 */
export async function retryPaymentVerification(
  paymentIntentId: string,
): Promise<boolean> {
  const job = await getPaymentVerification(paymentIntentId);
  if (!job || job.status !== "failed") return false;
  await updatePaymentVerification(paymentIntentId, {
    status: "pending",
    attempts: 0,
    nextAttemptAt: new Date().toISOString(),
  });
  return true;
}
