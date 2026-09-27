import Stripe from "stripe";
import {
  buildMerchandiseOrder,
  computeRegistrationTotalCents,
  computeSwagCents,
  parseCartFromMetadata,
  serializeCartForMetadata,
  type CartLine,
} from "@/lib/merchandise";
import { CLINIC_FEE_CENTS } from "@/lib/stripe-constants";

export { CLINIC_FEE_CENTS };
export const STRIPE_CURRENCY = "usd";

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripePublishableKey(): string | null {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  return key || null;
}

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key, {
      apiVersion: "2026-08-26.dahlia",
      typescript: true,
    });
  }
  return stripeClient;
}

export type PaymentIntentMetadataInput = {
  playerId: string;
  programId: string;
  clinicId: string;
  parentUserId: string;
  cart?: CartLine[];
  /** Clinic tuition in cents (from clinic.priceUsd or default). */
  tuitionCents?: number;
};

export function buildPaymentIntentMetadata(
  input: PaymentIntentMetadataInput,
): Record<string, string> {
  const cart = input.cart ?? [];
  const tuitionCents =
    typeof input.tuitionCents === "number" && input.tuitionCents > 0
      ? input.tuitionCents
      : CLINIC_FEE_CENTS;
  const swagCents = computeSwagCents(cart);
  const amountCents = computeRegistrationTotalCents(cart, tuitionCents);
  return {
    playerId: input.playerId,
    programId: input.programId,
    clinicId: input.clinicId,
    parentUserId: input.parentUserId,
    amountCents: String(amountCents),
    tuitionCents: String(tuitionCents),
    swagCents: String(swagCents),
    swagJson: serializeCartForMetadata(cart),
  };
}

export type EnrollmentApprovalInput = {
  paymentIntentId: string;
  playerId: string;
  programId: string;
  clinicId: string;
  /** Expected tuition from clinic at verification time. */
  tuitionCents?: number;
};

export type EnrollmentApprovalSuccess = {
  approved: true;
  cart: CartLine[];
  tuitionCents: number;
};

/**
 * Pure validation of a retrieved PaymentIntent against expected enrollment.
 * Recomputes total from metadata swagJson + tuition (clinic price).
 */
export function evaluatePaymentIntentForEnrollment(
  paymentIntent: {
    id: string;
    status: string;
    amount: number;
    currency: string;
    metadata: Stripe.Metadata;
  },
  expected: Omit<EnrollmentApprovalInput, "paymentIntentId">,
): EnrollmentApprovalSuccess | { approved: false; error: string } {
  if (paymentIntent.status !== "succeeded") {
    return {
      approved: false,
      error: `Payment is not complete (status: ${paymentIntent.status}).`,
    };
  }
  if (paymentIntent.currency !== STRIPE_CURRENCY) {
    return { approved: false, error: "Payment currency is invalid." };
  }
  if (paymentIntent.metadata.playerId !== expected.playerId) {
    return { approved: false, error: "Payment metadata player mismatch." };
  }
  if (paymentIntent.metadata.programId !== expected.programId) {
    return { approved: false, error: "Payment metadata program mismatch." };
  }
  if (paymentIntent.metadata.clinicId !== expected.clinicId) {
    return { approved: false, error: "Payment metadata clinic mismatch." };
  }

  const cartResult = parseCartFromMetadata(paymentIntent.metadata.swagJson);
  if ("error" in cartResult) {
    return { approved: false, error: cartResult.error };
  }
  const cart = cartResult;

  const metadataTuition = Number(paymentIntent.metadata.tuitionCents);
  const tuitionCents =
    typeof expected.tuitionCents === "number" && expected.tuitionCents > 0
      ? expected.tuitionCents
      : Number.isFinite(metadataTuition) && metadataTuition > 0
        ? metadataTuition
        : CLINIC_FEE_CENTS;

  if (
    typeof expected.tuitionCents === "number" &&
    Number.isFinite(metadataTuition) &&
    metadataTuition !== expected.tuitionCents
  ) {
    return { approved: false, error: "Payment metadata tuition mismatch." };
  }

  const expectedSwag = computeSwagCents(cart);
  const expectedTotal = computeRegistrationTotalCents(cart, tuitionCents);

  if (paymentIntent.amount !== expectedTotal) {
    return { approved: false, error: "Payment amount does not match order total." };
  }
  if (paymentIntent.metadata.amountCents !== String(expectedTotal)) {
    return { approved: false, error: "Payment metadata amount mismatch." };
  }
  if (
    paymentIntent.metadata.swagCents !== undefined &&
    paymentIntent.metadata.swagCents !== String(expectedSwag)
  ) {
    return { approved: false, error: "Payment metadata swag mismatch." };
  }

  return { approved: true, cart, tuitionCents };
}

export async function approveEnrollmentFromPaymentIntent(
  input: EnrollmentApprovalInput,
): Promise<EnrollmentApprovalSuccess | { approved: false; error: string }> {
  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.retrieve(
    input.paymentIntentId,
  );
  return evaluatePaymentIntentForEnrollment(paymentIntent, input);
}

export function merchandiseOrderFromPaymentIntentMetadata(
  clinicId: string,
  metadata: Stripe.Metadata,
  paidAt?: string,
) {
  const cartResult = parseCartFromMetadata(metadata.swagJson);
  if ("error" in cartResult) return null;
  const tuition = Number(metadata.tuitionCents);
  return buildMerchandiseOrder(
    clinicId,
    cartResult,
    paidAt,
    Number.isFinite(tuition) && tuition > 0 ? tuition : CLINIC_FEE_CENTS,
  );
}
