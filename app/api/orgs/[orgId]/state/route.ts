import { NextResponse } from "next/server";
import { requireLiveOrg, resolveViewer } from "@/lib/api-viewer";
import { getStateForViewer } from "@/lib/db/registration-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await context.params;
  const found = await requireLiveOrg(orgId);
  if (found.error) return found.error;

  const { viewer } = await resolveViewer(request);
  return NextResponse.json({ state: await getStateForViewer(found.org.id, viewer) });
}
