import { NextResponse } from "next/server";
import { enrollPaidInDb, getRegistrationState } from "@/lib/db/registration-repository";
import { DEFAULT_ORG_ID } from "@/lib/organizations";
import {
  buildMerchandiseOrder,
  parseCart,
} from "@/lib/merchandise";
import { getClinicTuitionCents } from "@/lib/programs";

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
 * Server-side paid enrollment. Used by demo checkout and after Stripe verify.
 * Accepts optional cart for merchandise order snapshot.
 */
export async function POST(request: Request) {
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

  const state = await getRegistrationState(DEFAULT_ORG_ID);
  const clinic = state.sessions.find((session) => session.id === clinicId);
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
    DEFAULT_ORG_ID,
    playerId,
    programId,
    clinicId,
    merchandiseOrder.paidAt,
    merchandiseOrder,
  );
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ state: result.state });
}
