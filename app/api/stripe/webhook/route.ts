import { NextResponse } from "next/server";
import { recordMetricsEvent } from "@/lib/metrics";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const globalForWebhook = globalThis as typeof globalThis & {
  __shiftyProcessedPaymentIntents?: Set<string>;
};

function getProcessedPaymentIntents(): Set<string> {
  if (!globalForWebhook.__shiftyProcessedPaymentIntents) {
    globalForWebhook.__shiftyProcessedPaymentIntents = new Set();
  }
  return globalForWebhook.__shiftyProcessedPaymentIntents;
}

/**
 * Stripe webhook for payment_intent.succeeded.
 * Records metrics only — does not write browser localStorage.
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
    const processed = getProcessedPaymentIntents();
    if (!processed.has(paymentIntent.id)) {
      processed.add(paymentIntent.id);
      recordMetricsEvent("payment_succeeded");
    }
  }

  return NextResponse.json({ received: true });
}
