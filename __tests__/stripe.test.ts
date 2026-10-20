import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as postWebhook } from "@/app/api/stripe/webhook/route";
import { getDocStore } from "@/lib/db/doc-store";
import {
  getRegistrationState,
  resetMemoryRegistrationDb,
} from "@/lib/db/registration-repository";
import { DEFAULT_ORG_ID } from "@/lib/organizations";
import { getClinicTuitionCents } from "@/lib/programs";
import { sampleData } from "@/lib/sample-data";
import {
  CLINIC_FEE_CENTS,
  STRIPE_CURRENCY,
  buildPaymentIntentMetadata,
  evaluatePaymentIntentForEnrollment,
  getStripe,
} from "@/lib/stripe";
import { computeRegistrationTotalCents } from "@/lib/merchandise";

// HubSpot sync is scheduled with after(), which needs a request scope.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(),
}));

const baseExpected = {
  playerId: "player-1",
  programId: "program-1",
  clinicId: "clinic-1",
};

function makeIntent(
  overrides: Partial<{
    id: string;
    status: string;
    amount: number;
    currency: string;
    metadata: Record<string, string>;
    cart: { skuId: "tshirt" | "shorts"; size: "AM"; quantity: number }[];
  }> = {},
) {
  const { metadata: metadataOverrides, cart = [], ...rest } = overrides;
  const meta = buildPaymentIntentMetadata({
    ...baseExpected,
    orgId: DEFAULT_ORG_ID,
    parentUserId: "parent-1",
    cart,
  });
  return {
    id: "pi_test_123",
    status: "succeeded",
    amount: computeRegistrationTotalCents(cart),
    currency: STRIPE_CURRENCY,
    ...rest,
    metadata: {
      ...meta,
      ...metadataOverrides,
    },
  };
}

describe("evaluatePaymentIntentForEnrollment", () => {
  it("approves a matching succeeded PaymentIntent (tuition only)", () => {
    expect(evaluatePaymentIntentForEnrollment(makeIntent(), baseExpected)).toEqual(
      { approved: true, cart: [], tuitionCents: CLINIC_FEE_CENTS },
    );
  });

  it("approves tuition plus swag when metadata matches recomputed total", () => {
    const cart = [{ skuId: "tshirt" as const, size: "AM" as const, quantity: 1 }];
    const result = evaluatePaymentIntentForEnrollment(
      makeIntent({ cart }),
      baseExpected,
    );
    expect(result).toEqual({
      approved: true,
      cart,
      tuitionCents: CLINIC_FEE_CENTS,
    });
  });

  it("rejects non-succeeded status", () => {
    const result = evaluatePaymentIntentForEnrollment(
      makeIntent({ status: "requires_payment_method" }),
      baseExpected,
    );
    expect(result.approved).toBe(false);
    if (!result.approved) {
      expect(result.error).toMatch(/not complete/i);
    }
  });

  it("rejects amount mismatch", () => {
    const result = evaluatePaymentIntentForEnrollment(
      makeIntent({ amount: 100 }),
      baseExpected,
    );
    expect(result.approved).toBe(false);
    if (!result.approved) {
      expect(result.error).toMatch(/amount/i);
    }
  });

  it("rejects currency mismatch", () => {
    const result = evaluatePaymentIntentForEnrollment(
      makeIntent({ currency: "eur" }),
      baseExpected,
    );
    expect(result.approved).toBe(false);
    if (!result.approved) {
      expect(result.error).toMatch(/currency/i);
    }
  });

  it("rejects player metadata mismatch", () => {
    const result = evaluatePaymentIntentForEnrollment(
      makeIntent({ metadata: { playerId: "other-player" } }),
      baseExpected,
    );
    expect(result.approved).toBe(false);
    if (!result.approved) {
      expect(result.error).toMatch(/player/i);
    }
  });

  it("rejects program metadata mismatch", () => {
    const result = evaluatePaymentIntentForEnrollment(
      makeIntent({ metadata: { programId: "other-program" } }),
      baseExpected,
    );
    expect(result.approved).toBe(false);
    if (!result.approved) {
      expect(result.error).toMatch(/program/i);
    }
  });

  it("rejects clinic metadata mismatch", () => {
    const result = evaluatePaymentIntentForEnrollment(
      makeIntent({ metadata: { clinicId: "other-clinic" } }),
      baseExpected,
    );
    expect(result.approved).toBe(false);
    if (!result.approved) {
      expect(result.error).toMatch(/clinic/i);
    }
  });

  it("rejects amountCents metadata mismatch", () => {
    const result = evaluatePaymentIntentForEnrollment(
      makeIntent({ metadata: { amountCents: "1" } }),
      baseExpected,
    );
    expect(result.approved).toBe(false);
    if (!result.approved) {
      expect(result.error).toMatch(/amount/i);
    }
  });
});

describe("buildPaymentIntentMetadata", () => {
  it("payment intent metadata includes orgId", () => {
    const meta = buildPaymentIntentMetadata({
      orgId: "org-b",
      playerId: "p1",
      programId: "prog1",
      clinicId: "c1",
      parentUserId: "parent1",
    });
    expect(meta.orgId).toBe("org-b");
  });

  it("includes tuition, swag, and total for empty cart", () => {
    expect(
      buildPaymentIntentMetadata({
        orgId: "org-1",
        playerId: "p1",
        programId: "prog1",
        clinicId: "c1",
        parentUserId: "parent1",
      }),
    ).toEqual({
      orgId: "org-1",
      playerId: "p1",
      programId: "prog1",
      clinicId: "c1",
      parentUserId: "parent1",
      amountCents: String(CLINIC_FEE_CENTS),
      tuitionCents: String(CLINIC_FEE_CENTS),
      swagCents: "0",
      swagJson: "[]",
    });
  });

  it("includes swag subtotal when cart has items", () => {
    const meta = buildPaymentIntentMetadata({
      orgId: "org-1",
      playerId: "p1",
      programId: "prog1",
      clinicId: "c1",
      parentUserId: "parent1",
      cart: [{ skuId: "shorts", size: "AM", quantity: 2 }],
    });
    expect(meta.swagCents).toBe("6000");
    expect(meta.amountCents).toBe(String(CLINIC_FEE_CENTS + 6000));
  });
});

describe("stripe webhook", () => {
  const WEBHOOK_SECRET = "whsec_test_secret";
  const PLAYER = "player-child-1";
  const PROGRAM = "program-summer-2026";
  const CLINIC = "clinic-summer-2026-w1";
  const saved = {
    key: process.env.STRIPE_SECRET_KEY,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  };

  beforeEach(() => {
    resetMemoryRegistrationDb(sampleData);
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  afterEach(() => {
    for (const [name, value] of [
      ["STRIPE_SECRET_KEY", saved.key],
      ["STRIPE_WEBHOOK_SECRET", saved.secret],
    ] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  async function deliver(metadataOrgId: string | undefined, intentId: string) {
    const state = await getRegistrationState(DEFAULT_ORG_ID);
    const clinic = state.sessions.find((session) => session.id === CLINIC)!;
    const tuitionCents = getClinicTuitionCents(clinic);
    const metadata = buildPaymentIntentMetadata({
      orgId: metadataOrgId ?? "",
      playerId: PLAYER,
      programId: PROGRAM,
      clinicId: CLINIC,
      parentUserId: "user-1",
      tuitionCents,
    });
    if (metadataOrgId === undefined) delete metadata.orgId;
    const payload = JSON.stringify({
      id: `evt_${intentId}`,
      object: "event",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: intentId,
          object: "payment_intent",
          status: "succeeded",
          amount: computeRegistrationTotalCents([], tuitionCents),
          currency: STRIPE_CURRENCY,
          metadata,
        },
      },
    });
    const signature = getStripe().webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
    });
    return postWebhook(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": signature },
        body: payload,
      }),
    );
  }

  it("webhook falls back to the default org without metadata.orgId", async () => {
    const res = await deliver(undefined, "pi_no_org");
    expect(res.status).toBe(200);
    const state = await getRegistrationState(DEFAULT_ORG_ID);
    const child = state.players.find((player) => player.id === PLAYER)!;
    expect(child.sessionIds).toContain(CLINIC);
  });

  it("webhook does not enroll for an unknown org", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await deliver("org-missing", "pi_missing_org");
    expect(res.status).toBe(200);
    expect(await getDocStore().count("enrollments", { childId: PLAYER })).toBe(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
