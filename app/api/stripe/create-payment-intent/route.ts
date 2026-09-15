import { NextResponse } from "next/server";
import {
  parseCart,
  computeRegistrationTotalCents,
} from "@/lib/merchandise";
import {
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
  cart?: unknown;
};

function requireNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  return value.trim();
}

/**
 * Creates a PaymentIntent for clinic registration (+ optional swag).
 * Amount is always server-computed from catalog + clinic fee.
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

  const playerId = requireNonEmptyString(body.playerId);
  const programId = requireNonEmptyString(body.programId);
  const clinicId = requireNonEmptyString(body.clinicId);
  const parentUserId = requireNonEmptyString(body.parentUserId);

  if (!playerId || !programId || !clinicId || !parentUserId) {
    return NextResponse.json(
      {
        error:
          "playerId, programId, clinicId, and parentUserId are required.",
      },
      { status: 400 },
    );
  }

  const cartResult = parseCart(body.cart);
  if ("error" in cartResult) {
    return NextResponse.json({ error: cartResult.error }, { status: 400 });
  }
  const cart = cartResult;
  const amount = computeRegistrationTotalCents(cart);

  try {
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: STRIPE_CURRENCY,
      automatic_payment_methods: { enabled: true },
      metadata: buildPaymentIntentMetadata({
        playerId,
        programId,
        clinicId,
        parentUserId,
        cart,
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
      amountCents: amount,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create payment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
