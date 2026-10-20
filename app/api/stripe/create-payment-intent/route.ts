import { NextResponse } from "next/server";
import {
  requireEnrollableChild,
  requireLiveOrg,
  resolveViewer,
  signInRequired,
} from "@/lib/api-viewer";
import {
  parseCart,
  computeRegistrationTotalCents,
} from "@/lib/merchandise";
import { getClinicTuitionCents } from "@/lib/programs";
import {
  STRIPE_CURRENCY,
  buildPaymentIntentMetadata,
  getStripe,
  isStripeConfigured,
} from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreatePaymentIntentBody = {
  orgId?: unknown;
  playerId?: unknown;
  programId?: unknown;
  clinicId?: unknown;
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
 * Amount is always server-computed from clinic price + catalog.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured.", demoMode: true },
      { status: 503 },
    );
  }

  const { user } = await resolveViewer(request);
  if (!user) return signInRequired();

  let body: CreatePaymentIntentBody;
  try {
    body = (await request.json()) as CreatePaymentIntentBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const orgId = requireNonEmptyString(body.orgId);
  const playerId = requireNonEmptyString(body.playerId);
  const programId = requireNonEmptyString(body.programId);
  const clinicId = requireNonEmptyString(body.clinicId);
  // The payer is the session user, never a body-supplied id.
  const parentUserId = user.id;

  if (!orgId || !playerId || !programId || !clinicId) {
    return NextResponse.json(
      {
        error: "orgId, playerId, programId, and clinicId are required.",
      },
      { status: 400 },
    );
  }

  const cartResult = parseCart(body.cart);
  if ("error" in cartResult) {
    return NextResponse.json({ error: cartResult.error }, { status: 400 });
  }
  const cart = cartResult;

  const found = await requireLiveOrg(orgId);
  if (found.error) return found.error;
  const access = await requireEnrollableChild(user, orgId, playerId);
  if (access.error) return access.error;
  const clinic = access.state.sessions.find((session) => session.id === clinicId);
  if (!clinic) {
    return NextResponse.json({ error: "Clinic not found." }, { status: 404 });
  }
  if (clinic.programId !== programId) {
    return NextResponse.json(
      { error: "Clinic does not belong to that program." },
      { status: 400 },
    );
  }

  const tuitionCents = getClinicTuitionCents(clinic);
  const amount = computeRegistrationTotalCents(cart, tuitionCents);

  try {
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: STRIPE_CURRENCY,
      automatic_payment_methods: { enabled: true },
      metadata: buildPaymentIntentMetadata({
        orgId,
        playerId,
        programId,
        clinicId,
        parentUserId,
        cart,
        tuitionCents,
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
