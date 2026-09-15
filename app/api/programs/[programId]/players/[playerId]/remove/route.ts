import { NextResponse } from "next/server";
import { removePlayerFromProgramInDb } from "@/lib/db/registration-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ programId: string; playerId: string }> },
) {
  const { programId, playerId } = await context.params;
  const result = await removePlayerFromProgramInDb(playerId, programId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ state: result.state });
}
