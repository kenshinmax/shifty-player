import Stripe from "stripe";
import {
  buildMerchandiseOrder,
  computeRegistrationTotalCents,
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
};

export function buildPaymentIntentMetadata(
  input: PaymentIntentMetadataInput,
): Record<string, string> {
  const cart = input.cart ?? [];
  const swagCents = computeRegistrationTotalCents(cart) - CLINIC_FEE_CENTS;
  const amountCents = computeRegistrationTotalCents(cart);
  return {
    playerId: input.playerId,
    programId: input.programId,
    clinicId: input.clinicId,
    parentUserId: input.parentUserId,
    amountCents: String(amountCents),
    tuitionCents: String(CLINIC_FEE_CENTS),
    swagCents: String(swagCents),
    swagJson: serializeCartForMetadata(cart),
  };
}

export type EnrollmentApprovalInput = {
  paymentIntentId: string;
  playerId: string;
  programId: string;
  clinicId: string;
};

export type EnrollmentApprovalSuccess = {
  approved: true;
  cart: CartLine[];
};

/**
 * Pure validation of a retrieved PaymentIntent against expected enrollment.
 * Recomputes total from metadata swagJson (server catalog prices).
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
  const expectedTotal = computeRegistrationTotalCents(cart);
  const expectedSwag = expectedTotal - CLINIC_FEE_CENTS;

  if (paymentIntent.amount !== expectedTotal) {
    return { approved: false, error: "Payment amount does not match order total." };
  }
  if (paymentIntent.metadata.amountCents !== String(expectedTotal)) {
    return { approved: false, error: "Payment metadata amount mismatch." };
  }
  if (
    paymentIntent.metadata.tuitionCents !== undefined &&
    paymentIntent.metadata.tuitionCents !== String(CLINIC_FEE_CENTS)
  ) {
    return { approved: false, error: "Payment metadata tuition mismatch." };
  }
  if (
    paymentIntent.metadata.swagCents !== undefined &&
    paymentIntent.metadata.swagCents !== String(expectedSwag)
  ) {
    return { approved: false, error: "Payment metadata swag mismatch." };
  }

  return { approved: true, cart };
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
  return buildMerchandiseOrder(clinicId, cartResult, paidAt);
}
