import { NextResponse } from "next/server";
import { recordMetricsEvent } from "@/lib/metrics";
import { buildMerchandiseOrder } from "@/lib/merchandise";
import {
  claimProcessedPayment,
  enrollPaidInDb,
  getRegistrationState,
} from "@/lib/db/registration-repository";
import { getClinicTuitionCents } from "@/lib/programs";
import {
  evaluatePaymentIntentForEnrollment,
  getStripe,
  isStripeConfigured,
} from "@/lib/stripe";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook for payment_intent.succeeded.
 * Idempotently enrolls in MongoDB (including swag order) and records metrics.
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
    if (playerId && programId && clinicId) {
      const state = await getRegistrationState();
      const clinic = state.sessions.find((session) => session.id === clinicId);
      const tuitionCents = clinic
        ? getClinicTuitionCents(clinic)
        : undefined;
      const evaluation = evaluatePaymentIntentForEnrollment(paymentIntent, {
        playerId,
        programId,
        clinicId,
        tuitionCents,
      });
      if (evaluation.approved) {
        const merchandiseOrder = buildMerchandiseOrder(
          clinicId,
          evaluation.cart,
          new Date().toISOString(),
          evaluation.tuitionCents,
        );
        await enrollPaidInDb(
          playerId,
          programId,
          clinicId,
          merchandiseOrder.paidAt,
          merchandiseOrder,
        );
      }
    }
    const claimed = await claimProcessedPayment(paymentIntent.id);
    if (claimed) {
      recordMetricsEvent("payment_succeeded");
    }
  }

  return NextResponse.json({ received: true });
}
