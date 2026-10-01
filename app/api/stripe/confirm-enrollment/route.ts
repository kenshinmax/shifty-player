import { after, NextResponse } from "next/server";
import { syncEnrollmentToHubSpot } from "@/lib/hubspot-sync";
import { buildMerchandiseOrder } from "@/lib/merchandise";
import {
  claimProcessedPayment,
  enrollPaidInDb,
  getRegistrationState,
} from "@/lib/db/registration-repository";
import { getClinicTuitionCents } from "@/lib/programs";
import {
  approveEnrollmentFromPaymentIntent,
  isStripeConfigured,
} from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ConfirmEnrollmentBody = {
  paymentIntentId?: unknown;
  playerId?: unknown;
  programId?: unknown;
  clinicId?: unknown;
};

function requireNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  return value.trim();
}

/**
 * Verifies PaymentIntent with Stripe, then enrolls the player (and swag order).
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured.", demoMode: true },
      { status: 503 },
    );
  }

  let body: ConfirmEnrollmentBody;
  try {
    body = (await request.json()) as ConfirmEnrollmentBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const paymentIntentId = requireNonEmptyString(body.paymentIntentId);
  const playerId = requireNonEmptyString(body.playerId);
  const programId = requireNonEmptyString(body.programId);
  const clinicId = requireNonEmptyString(body.clinicId);

  if (!paymentIntentId || !playerId || !programId || !clinicId) {
    return NextResponse.json(
      {
        error:
          "paymentIntentId, playerId, programId, and clinicId are required.",
      },
      { status: 400 },
    );
  }

  try {
    const state = await getRegistrationState();
    const clinic = state.sessions.find((session) => session.id === clinicId);
    if (!clinic) {
      return NextResponse.json(
        { approved: false, error: "Clinic not found." },
        { status: 404 },
      );
    }
    const tuitionCents = getClinicTuitionCents(clinic);

    const result = await approveEnrollmentFromPaymentIntent({
      paymentIntentId,
      playerId,
      programId,
      clinicId,
      tuitionCents,
    });

    if (!result.approved) {
      return NextResponse.json(
        { approved: false, error: result.error },
        { status: 400 },
      );
    }

    const merchandiseOrder = buildMerchandiseOrder(
      clinicId,
      result.cart,
      new Date().toISOString(),
      result.tuitionCents,
    );
    const enrolled = await enrollPaidInDb(
      playerId,
      programId,
      clinicId,
      merchandiseOrder.paidAt,
      merchandiseOrder,
    );
    if ("error" in enrolled) {
      return NextResponse.json(
        { approved: false, error: enrolled.error },
        { status: 400 },
      );
    }

    // The webhook may claim this payment first; whichever path claims it syncs HubSpot.
    const claimed = await claimProcessedPayment(paymentIntentId);
    if (claimed) {
      const enrolledState = enrolled.state;
      after(() =>
        syncEnrollmentToHubSpot(
          enrolledState,
          playerId,
          programId,
          paymentIntentId,
        ),
      );
    }

    return NextResponse.json({ approved: true, state: enrolled.state });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to verify payment with Stripe.";
    return NextResponse.json({ approved: false, error: message }, { status: 500 });
  }
}
