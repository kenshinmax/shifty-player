import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { ADMIN_VIEWER, requireOrg } from "@/lib/api-viewer";
import {
  deletePlayerInDb,
  getStateForViewer,
  updatePlayerInDb,
} from "@/lib/db/registration-repository";
import type { PlayerInput } from "@/lib/player-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ orgId: string; playerId: string }> },
) {
  const { orgId, playerId } = await context.params;
  const found = await requireOrg(orgId, request);
  if (found.error) return found.error;
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  let body: PlayerInput;
  try {
    body = (await request.json()) as PlayerInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await updatePlayerInDb(orgId, playerId, body);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ state: await getStateForViewer(orgId, ADMIN_VIEWER) });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ orgId: string; playerId: string }> },
) {
  const { orgId, playerId } = await context.params;
  const found = await requireOrg(orgId, request);
  if (found.error) return found.error;
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const result = await deletePlayerInDb(orgId, playerId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ state: await getStateForViewer(orgId, ADMIN_VIEWER) });
}
