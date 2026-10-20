import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { ADMIN_VIEWER, requireOrg } from "@/lib/api-viewer";
import {
  getStateForViewer,
  markPaymentLinkSentInDb,
} from "@/lib/db/registration-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ orgId: string; playerId: string }> },
) {
  const { orgId, playerId } = await context.params;
  const found = await requireOrg(orgId, request);
  if (found.error) return found.error;
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const result = await markPaymentLinkSentInDb(orgId, playerId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ state: await getStateForViewer(orgId, ADMIN_VIEWER) });
}
