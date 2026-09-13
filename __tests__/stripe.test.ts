import { describe, expect, it } from "vitest";
import {
  CLINIC_FEE_CENTS,
  STRIPE_CURRENCY,
  buildPaymentIntentMetadata,
  evaluatePaymentIntentForEnrollment,
} from "@/lib/stripe";

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
  }> = {},
) {
  const { metadata: metadataOverrides, ...rest } = overrides;
  return {
    id: "pi_test_123",
    status: "succeeded",
    amount: CLINIC_FEE_CENTS,
    currency: STRIPE_CURRENCY,
    ...rest,
    metadata: {
      ...buildPaymentIntentMetadata({
        ...baseExpected,
        parentUserId: "parent-1",
      }),
      ...metadataOverrides,
    },
  };
}

describe("evaluatePaymentIntentForEnrollment", () => {
  it("approves a matching succeeded PaymentIntent", () => {
    expect(evaluatePaymentIntentForEnrollment(makeIntent(), baseExpected)).toEqual(
      { approved: true },
    );
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
  it("includes fee cents and enrollment ids", () => {
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
    });
  });
});
