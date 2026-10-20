import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { removePlayerFromProgramInDb } from "@/lib/db/registration-repository";
import { DEFAULT_ORG_ID } from "@/lib/organizations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ programId: string; playerId: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const { programId, playerId } = await context.params;
  const result = await removePlayerFromProgramInDb(DEFAULT_ORG_ID, playerId, programId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ state: result.state });
}
