import { NextResponse } from "next/server";
import {
  requireEnrollableChild,
  requireOrg,
  resolveUser,
  signInRequired,
} from "@/lib/api-viewer";
import { enqueuePaymentVerification } from "@/lib/db/payment-verification-repository";
import { isStripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ConfirmEnrollmentBody = {
  orgId?: unknown;
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
 * Persists the verification request and returns immediately; the async worker
 * verifies the PaymentIntent with Stripe, enrolls the player, and records the
 * final status. Clients poll the status endpoint for the outcome.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured.", demoMode: true },
      { status: 503 },
    );
  }

  const user = await resolveUser(request);
  if (!user) return signInRequired();

  let body: ConfirmEnrollmentBody;
  try {
    body = (await request.json()) as ConfirmEnrollmentBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const orgId = requireNonEmptyString(body.orgId);
  const paymentIntentId = requireNonEmptyString(body.paymentIntentId);
  const playerId = requireNonEmptyString(body.playerId);
  const programId = requireNonEmptyString(body.programId);
  const clinicId = requireNonEmptyString(body.clinicId);

  if (!orgId || !paymentIntentId || !playerId || !programId || !clinicId) {
    return NextResponse.json(
      {
        error:
          "orgId, paymentIntentId, playerId, programId, and clinicId are required.",
      },
      { status: 400 },
    );
  }

  const found = await requireOrg(orgId, request);
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

  // Unique-keyed: a re-request or the webhook's copy never duplicates the job.
  await enqueuePaymentVerification({
    paymentIntentId,
    orgId,
    playerId,
    programId,
    clinicId,
  });

  return NextResponse.json({ status: "pending", paymentIntentId });
}
