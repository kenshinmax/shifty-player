import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDocStore } from "@/lib/db/doc-store";
import {
  enqueuePaymentVerification,
  getPaymentVerification,
  retryPaymentVerification,
  updatePaymentVerification,
} from "@/lib/db/payment-verification-repository";
import {
  getRegistrationState,
  resetMemoryRegistrationDb,
} from "@/lib/db/registration-repository";
import { DEFAULT_ORG_ID } from "@/lib/organizations";
import { getClinicTuitionCents } from "@/lib/programs";
import { sampleData } from "@/lib/sample-data";
import {
  STRIPE_CURRENCY,
  buildPaymentIntentMetadata,
} from "@/lib/stripe";
import { computeRegistrationTotalCents } from "@/lib/merchandise";
import {
  processPaymentVerifications,
  type RetrievePaymentIntent,
} from "@/lib/payment-verification";

const PLAYER = "player-child-1";
const PROGRAM = "program-summer-2026";
const CLINIC = "clinic-summer-2026-w1";

type IntentOverrides = {
  id?: string;
  status?: string;
  metadata?: Record<string, string>;
  amount?: number;
  cart?: { skuId: "tshirt" | "shorts"; size: "AM"; quantity: number }[];
};

async function makeIntent(overrides: IntentOverrides = {}) {
  const state = await getRegistrationState(DEFAULT_ORG_ID);
  const clinic = state.sessions.find((session) => session.id === CLINIC)!;
  const tuitionCents = getClinicTuitionCents(clinic);
  const metadata = buildPaymentIntentMetadata({
    orgId: DEFAULT_ORG_ID,
    playerId: PLAYER,
    programId: PROGRAM,
    clinicId: CLINIC,
    parentUserId: "user-1",
    cart: overrides.cart ?? [],
    tuitionCents,
  });
  return {
    id: overrides.id ?? "pi_test_1",
    status: overrides.status ?? "succeeded",
    amount:
      overrides.amount ??
      computeRegistrationTotalCents(overrides.cart ?? [], tuitionCents),
    currency: STRIPE_CURRENCY,
    metadata: { ...metadata, ...overrides.metadata },
  };
}

async function enqueue(intentId: string) {
  return enqueuePaymentVerification({
    paymentIntentId: intentId,
    orgId: DEFAULT_ORG_ID,
    playerId: PLAYER,
    programId: PROGRAM,
    clinicId: CLINIC,
  });
}

const retrieveOk: (intent: Awaited<ReturnType<typeof makeIntent>>) => RetrievePaymentIntent =
  (intent) => async () => intent;

describe("payment verification worker", () => {
  const saved = {
    maxAttempts: process.env.PAYMENT_VERIFICATION_MAX_ATTEMPTS,
    backoffMs: process.env.PAYMENT_VERIFICATION_BACKOFF_MS,
  };

  beforeEach(() => {
    resetMemoryRegistrationDb(sampleData);
    delete process.env.PAYMENT_VERIFICATION_MAX_ATTEMPTS;
    delete process.env.PAYMENT_VERIFICATION_BACKOFF_MS;
  });

  afterEach(() => {
    for (const [name, value] of [
      ["PAYMENT_VERIFICATION_MAX_ATTEMPTS", saved.maxAttempts],
      ["PAYMENT_VERIFICATION_BACKOFF_MS", saved.backoffMs],
    ] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it("verifies a succeeded payment and enrolls the player (success case)", async () => {
    const intent = await makeIntent();
    expect(await enqueue(intent.id)).toBe(true);

    const processed = await processPaymentVerifications(retrieveOk(intent));

    expect(processed).toBe(1);
    const job = await getPaymentVerification(intent.id);
    expect(job?.status).toBe("enrolled");
    const state = await getRegistrationState(DEFAULT_ORG_ID);
    const child = state.players.find((player) => player.id === PLAYER)!;
    expect(child.sessionIds).toContain(CLINIC);
    // Exactly one processed_payment claim: no duplicate records (req 1).
    expect(await getDocStore().count("processed_payments")).toBe(1);
  });

  it("never enqueues the same payment twice (no duplicate records)", async () => {
    const intent = await makeIntent();
    expect(await enqueue(intent.id)).toBe(true);
    expect(await enqueue(intent.id)).toBe(false);
    expect(await getDocStore().count("payment_verifications")).toBe(1);
  });

  it("retries a payment that has not succeeded yet, then enrolls", async () => {
    const intent = await makeIntent({ id: "pi_pending", status: "processing" });
    await enqueue(intent.id);

    await processPaymentVerifications(retrieveOk(intent));

    let job = await getPaymentVerification("pi_pending");
    expect(job?.status).toBe("pending");
    expect(job?.attempts).toBe(1);
    expect(Date.parse(job!.nextAttemptAt)).toBeGreaterThan(Date.now());
    expect(
      (await getRegistrationState(DEFAULT_ORG_ID)).players.find(
        (player) => player.id === PLAYER,
      )!.sessionIds,
    ).not.toContain(CLINIC);

    // Backoff elapses, the next worker run sees the settled payment, enrolls.
    await updatePaymentVerification("pi_pending", {
      nextAttemptAt: new Date().toISOString(),
    });
    await processPaymentVerifications(
      retrieveOk(await makeIntent({ id: "pi_pending" })),
    );
    job = await getPaymentVerification("pi_pending");
    expect(job?.status).toBe("enrolled");
  });

  it("fails a deterministic metadata mismatch without retrying (failure case)", async () => {
    const intent = await makeIntent({
      id: "pi_mismatch",
      metadata: { playerId: "player-someone-else" },
    });
    await enqueue("pi_mismatch");

    await processPaymentVerifications(retrieveOk(intent));

    const job = await getPaymentVerification("pi_mismatch");
    expect(job?.status).toBe("failed");
    expect(job?.lastError).toBe("Payment metadata player mismatch.");
    expect(
      (await getRegistrationState(DEFAULT_ORG_ID)).players.find(
        (player) => player.id === PLAYER,
      )!.sessionIds,
    ).not.toContain(CLINIC);
  });

  it("retries transient Stripe errors and fails after exhausting attempts", async () => {
    process.env.PAYMENT_VERIFICATION_MAX_ATTEMPTS = "2";
    await enqueue("pi_flaky");

    const alwaysThrows: RetrievePaymentIntent = async () => {
      throw new Error("Stripe is down.");
    };
    await processPaymentVerifications(alwaysThrows);
    let job = await getPaymentVerification("pi_flaky");
    expect(job?.status).toBe("pending");
    expect(job?.attempts).toBe(1);

    // Backoff elapses; the second run exhausts the remaining attempt.
    await updatePaymentVerification("pi_flaky", {
      nextAttemptAt: new Date().toISOString(),
    });
    await processPaymentVerifications(alwaysThrows);
    job = await getPaymentVerification("pi_flaky");
    expect(job?.status).toBe("failed");
    expect(job?.lastError).toContain("Stripe is down.");
  });

  it("fails when the player does not exist", async () => {
    // Metadata must be self-consistent so evaluation passes and the failure
    // comes from the enrollment itself.
    const intent = await makeIntent({ id: "pi_no_player" });
    intent.metadata.playerId = "player-ghost";
    await enqueuePaymentVerification({
      paymentIntentId: intent.id,
      orgId: DEFAULT_ORG_ID,
      playerId: "player-ghost",
      programId: PROGRAM,
      clinicId: CLINIC,
    });

    await processPaymentVerifications(retrieveOk(intent));

    const job = await getPaymentVerification(intent.id);
    expect(job?.status).toBe("failed");
    expect(job?.lastError).toBe("Player not found.");
  });

  it("does not claim a job whose backoff window is still open", async () => {
    const intent = await makeIntent({ id: "pi_backoff", status: "processing" });
    await enqueue("pi_backoff");
    await processPaymentVerifications(retrieveOk(intent));

    // The failed attempt scheduled a future retry; nothing is due yet.
    const processed = await processPaymentVerifications(
      retrieveOk(await makeIntent({ id: "pi_backoff" })),
    );
    expect(processed).toBe(0);
  });

  it("re-enqueues a failed job via retryPaymentVerification", async () => {
    const intent = await makeIntent({
      id: "pi_retry",
      metadata: { amountCents: "999" },
    });
    await enqueue("pi_retry");
    await processPaymentVerifications(retrieveOk(intent));
    expect((await getPaymentVerification("pi_retry"))?.status).toBe("failed");

    expect(await retryPaymentVerification("pi_retry")).toBe(true);
    const job = await getPaymentVerification("pi_retry");
    expect(job?.status).toBe("pending");
    expect(job?.attempts).toBe(0);

    await processPaymentVerifications(
      retrieveOk(await makeIntent({ id: "pi_retry" })),
    );
    expect((await getPaymentVerification("pi_retry"))?.status).toBe("enrolled");
  });

  it("refuses to retry a job that is not failed", async () => {
    const intent = await makeIntent();
    await enqueue(intent.id);
    expect(await retryPaymentVerification(intent.id)).toBe(false);
    await processPaymentVerifications(retrieveOk(intent));
    expect(await retryPaymentVerification(intent.id)).toBe(false);
  });
});
