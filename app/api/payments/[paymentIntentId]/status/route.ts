import { NextResponse } from "next/server";
import {
  requireEnrollableChild,
  resolveUser,
  signInRequired,
  viewerFor,
} from "@/lib/api-viewer";
import {
  getPaymentVerification,
} from "@/lib/db/payment-verification-repository";
import {
  getStateForViewer,
} from "@/lib/db/registration-repository";
import { canManageOrg } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verification status for one PaymentIntent (requirement 3). The parent who
 * paid (or org staff) may poll; the enrolled state is returned once complete
 * so the client can sync without a second fetch.
 */
export async function GET(
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

  // Same access rule as enrolling: the child's parent or the org's staff.
  const access = await requireEnrollableChild(
    user,
    verification.orgId,
    verification.playerId,
  );
  if (access.error) return access.error;

  return NextResponse.json({
    paymentIntentId,
    status: verification.status,
    attempts: verification.attempts,
    lastError: verification.lastError ?? null,
    ...(verification.status === "enrolled"
      ? {
          state: await getStateForViewer(
            verification.orgId,
            viewerFor(user, verification.orgId),
          ),
        }
      : {}),
    ...(canManageOrg(user, verification.orgId) ? { orgId: verification.orgId } : {}),
  });
}
