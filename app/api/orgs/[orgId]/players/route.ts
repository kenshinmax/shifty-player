import { NextResponse } from "next/server";
import { requireOrgAdmin } from "@/lib/api-auth";
import { ADMIN_VIEWER, requireOrg } from "@/lib/api-viewer";
import { createPlayerInDb, getStateForViewer } from "@/lib/db/registration-repository";
import type { PlayerInput } from "@/lib/player-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await context.params;
  const found = await requireOrg(orgId, request);
  if (found.error) return found.error;
  const auth = await requireOrgAdmin(request, orgId);
  if (auth.error) return auth.error;

  let body: PlayerInput;
  try {
    body = (await request.json()) as PlayerInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await createPlayerInDb(orgId, body);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ state: await getStateForViewer(orgId, ADMIN_VIEWER) });
}
