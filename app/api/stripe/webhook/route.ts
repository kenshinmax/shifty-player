import { NextResponse } from "next/server";
import { enqueuePaymentVerification } from "@/lib/db/payment-verification-repository";
import { DEFAULT_ORG_ID } from "@/lib/organizations";
import {
  getStripe,
  isStripeConfigured,
} from "@/lib/stripe";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook for payment_intent.succeeded. Persists the verification
 * request (requirement 3); the async worker verifies, enrolls idempotently
 * (requirement 1), records metrics and syncs HubSpot.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured." },
      { status: 503 },
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not configured." },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header." },
      { status: 400 },
    );
  }

  const rawBody = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid webhook signature.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const playerId = paymentIntent.metadata.playerId;
    const programId = paymentIntent.metadata.programId;
    const clinicId = paymentIntent.metadata.clinicId;
    // Intents created before orgs existed carry no orgId.
    const orgId = paymentIntent.metadata.orgId ?? DEFAULT_ORG_ID;
    if (playerId && programId && clinicId) {
      await enqueuePaymentVerification({
        paymentIntentId: paymentIntent.id,
        orgId,
        playerId,
        programId,
        clinicId,
      });
    }
  }

  return NextResponse.json({ received: true });
}
