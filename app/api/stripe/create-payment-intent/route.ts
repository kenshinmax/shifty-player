import { NextResponse } from "next/server";
import {
  CLINIC_FEE_CENTS,
  STRIPE_CURRENCY,
  buildPaymentIntentMetadata,
  getStripe,
  isStripeConfigured,
} from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreatePaymentIntentBody = {
  playerId?: unknown;
  programId?: unknown;
  clinicId?: unknown;
  parentUserId?: unknown;
};

function requireNonEmptyString(value: unknown, field: string): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  return value.trim();
}

/**
 * Creates a PaymentIntent for clinic registration.
 * Amount is always server-computed from CLINIC_WEEKLY_FEE_USD.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured.", demoMode: true },
      { status: 503 },
    );
  }

  let body: CreatePaymentIntentBody;
  try {
    body = (await request.json()) as CreatePaymentIntentBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const playerId = requireNonEmptyString(body.playerId, "playerId");
  const programId = requireNonEmptyString(body.programId, "programId");
  const clinicId = requireNonEmptyString(body.clinicId, "clinicId");
  const parentUserId = requireNonEmptyString(body.parentUserId, "parentUserId");

  if (!playerId || !programId || !clinicId || !parentUserId) {
    return NextResponse.json(
      {
        error:
          "playerId, programId, clinicId, and parentUserId are required.",
      },
      { status: 400 },
    );
  }

  try {
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: CLINIC_FEE_CENTS,
      currency: STRIPE_CURRENCY,
      automatic_payment_methods: { enabled: true },
      metadata: buildPaymentIntentMetadata({
        playerId,
        programId,
        clinicId,
        parentUserId,
      }),
    });

    if (!paymentIntent.client_secret) {
      return NextResponse.json(
        { error: "PaymentIntent missing client secret." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create payment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
