import { NextResponse } from "next/server";
import {
  deletePlayerInDb,
  updatePlayerInDb,
} from "@/lib/db/registration-repository";
import { DEFAULT_ORG_ID } from "@/lib/organizations";
import type { PlayerInput } from "@/lib/player-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ playerId: string }> },
) {
  const { playerId } = await context.params;
  let body: PlayerInput;
  try {
    body = (await request.json()) as PlayerInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await updatePlayerInDb(DEFAULT_ORG_ID, playerId, body);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ state: result.state });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ playerId: string }> },
) {
  const { playerId } = await context.params;
  const result = await deletePlayerInDb(DEFAULT_ORG_ID, playerId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ state: result.state });
}
