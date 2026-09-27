import { describe, expect, it } from "vitest";
import {
  CLINIC_FEE_CENTS,
  STRIPE_CURRENCY,
  buildPaymentIntentMetadata,
  evaluatePaymentIntentForEnrollment,
} from "@/lib/stripe";
import { computeRegistrationTotalCents } from "@/lib/merchandise";

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
  it("includes tuition, swag, and total for empty cart", () => {
    expect(
      buildPaymentIntentMetadata({
        playerId: "p1",
        programId: "prog1",
        clinicId: "c1",
        parentUserId: "parent1",
      }),
    ).toEqual({
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
