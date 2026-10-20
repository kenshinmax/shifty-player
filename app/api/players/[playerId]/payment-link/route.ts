import { NextResponse } from "next/server";
import { markPaymentLinkSentInDb } from "@/lib/db/registration-repository";
import { DEFAULT_ORG_ID } from "@/lib/organizations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ playerId: string }> },
) {
  const { playerId } = await context.params;
  const result = await markPaymentLinkSentInDb(DEFAULT_ORG_ID, playerId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ state: result.state });
}
