import { NextResponse } from "next/server";
import { enrollPaidInDb } from "@/lib/db/registration-repository";
import {
  buildMerchandiseOrder,
  parseCart,
} from "@/lib/merchandise";

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

  const merchandiseOrder = buildMerchandiseOrder(clinicId, cartResult);
  const result = await enrollPaidInDb(
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
