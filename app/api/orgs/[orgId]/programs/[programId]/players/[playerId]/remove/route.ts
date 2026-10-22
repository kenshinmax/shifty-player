import { NextResponse } from "next/server";
import { requireOrgAdmin } from "@/lib/api-auth";
import { ADMIN_VIEWER, requireOrg } from "@/lib/api-viewer";
import {
  getStateForViewer,
  removePlayerFromProgramInDb,
} from "@/lib/db/registration-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ orgId: string; programId: string; playerId: string }> },
) {
  const { orgId, programId, playerId } = await context.params;
  const found = await requireOrg(orgId, request);
  if (found.error) return found.error;
  const auth = await requireOrgAdmin(request, orgId);
  if (auth.error) return auth.error;

  const result = await removePlayerFromProgramInDb(orgId, playerId, programId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ state: await getStateForViewer(orgId, ADMIN_VIEWER) });
}
