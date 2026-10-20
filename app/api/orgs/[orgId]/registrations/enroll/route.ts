import { NextResponse } from "next/server";
import {
  requireEnrollableChild,
  requireOrg,
  resolveViewer,
  signInRequired,
} from "@/lib/api-viewer";
import { enrollPaidInDb, getStateForViewer } from "@/lib/db/registration-repository";
import {
  buildMerchandiseOrder,
  parseCart,
} from "@/lib/merchandise";
import { getClinicTuitionCents } from "@/lib/programs";
import { isStripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  playerId?: unknown;
  programId?: unknown;
  clinicId?: unknown;
  cart?: unknown;
};

function requireString(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim();
}

/**
 * Server-side paid enrollment without a payment. Used by the demo checkout, and
 * by admins once Stripe is configured; parents then pay through
 * /api/stripe/confirm-enrollment. Accepts optional cart for merchandise order snapshot.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await context.params;
  const found = await requireOrg(orgId, request);
  if (found.error) return found.error;
  const { user, viewer } = await resolveViewer(request);
  if (!user) return signInRequired();
  if (isStripeConfigured() && viewer.kind !== "admin") {
    return NextResponse.json({ error: "Online payment is required." }, { status: 409 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const playerId = requireString(body.playerId);
  const programId = requireString(body.programId);
  const clinicId = requireString(body.clinicId);
  if (!playerId || !programId || !clinicId) {
    return NextResponse.json(
      { error: "playerId, programId, and clinicId are required." },
      { status: 400 },
    );
  }

  const cartResult = parseCart(body.cart);
  if ("error" in cartResult) {
    return NextResponse.json({ error: cartResult.error }, { status: 400 });
  }

  const access = await requireEnrollableChild(user, orgId, playerId);
  if (access.error) return access.error;
  const clinic = access.state.sessions.find((session) => session.id === clinicId);
  if (!clinic) {
    return NextResponse.json({ error: "Clinic not found." }, { status: 404 });
  }

  const merchandiseOrder = buildMerchandiseOrder(
    clinicId,
    cartResult,
    new Date().toISOString(),
    getClinicTuitionCents(clinic),
  );
  const result = await enrollPaidInDb(
    orgId,
    playerId,
    programId,
    clinicId,
    merchandiseOrder.paidAt,
    merchandiseOrder,
  );
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ state: await getStateForViewer(orgId, viewer) });
}
