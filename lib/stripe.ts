import Stripe from "stripe";
import { CLINIC_WEEKLY_FEE_USD } from "@/lib/programs";

export const STRIPE_CURRENCY = "usd";
export const CLINIC_FEE_CENTS = CLINIC_WEEKLY_FEE_USD * 100;

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
};

export function buildPaymentIntentMetadata(
  input: PaymentIntentMetadataInput,
): Record<string, string> {
  return {
    playerId: input.playerId,
    programId: input.programId,
    clinicId: input.clinicId,
    parentUserId: input.parentUserId,
    amountCents: String(CLINIC_FEE_CENTS),
  };
}

export type EnrollmentApprovalInput = {
  paymentIntentId: string;
  playerId: string;
  programId: string;
  clinicId: string;
};

/**
 * Pure validation of a retrieved PaymentIntent against expected enrollment.
 * Used by confirm-enrollment and unit tests.
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
): { approved: true } | { approved: false; error: string } {
  if (paymentIntent.status !== "succeeded") {
    return {
      approved: false,
      error: `Payment is not complete (status: ${paymentIntent.status}).`,
    };
  }
  if (paymentIntent.amount !== CLINIC_FEE_CENTS) {
    return { approved: false, error: "Payment amount does not match clinic fee." };
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
  if (paymentIntent.metadata.amountCents !== String(CLINIC_FEE_CENTS)) {
    return { approved: false, error: "Payment metadata amount mismatch." };
  }
  return { approved: true };
}

export async function approveEnrollmentFromPaymentIntent(
  input: EnrollmentApprovalInput,
): Promise<{ approved: true } | { approved: false; error: string }> {
  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.retrieve(
    input.paymentIntentId,
  );
  return evaluatePaymentIntentForEnrollment(paymentIntent, input);
}
