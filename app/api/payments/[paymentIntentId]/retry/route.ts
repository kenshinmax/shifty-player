import { NextResponse } from "next/server";
import {
  requireEnrollableChild,
  resolveUser,
  signInRequired,
} from "@/lib/api-viewer";
import {
  getPaymentVerification,
  retryPaymentVerification,
} from "@/lib/db/payment-verification-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Re-enqueues a failed verification (requirement 4). Only the paying parent or
 * org staff may retry, and only jobs that exhausted their attempts and failed.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ paymentIntentId: string }> },
) {
  const { paymentIntentId } = await context.params;
  const user = await resolveUser(request);
  if (!user) return signInRequired();

  const verification = await getPaymentVerification(paymentIntentId);
  if (!verification) {
    return NextResponse.json(
      { error: "Verification not found." },
      { status: 404 },
    );
  }

  const access = await requireEnrollableChild(
    user,
    verification.orgId,
    verification.playerId,
  );
  if (access.error) return access.error;

  const retried = await retryPaymentVerification(paymentIntentId);
  if (!retried) {
    return NextResponse.json(
      { error: `Verification is ${verification.status}; only failed verifications can be retried.` },
      { status: 409 },
    );
  }
  return NextResponse.json({ status: "pending", paymentIntentId });
}
