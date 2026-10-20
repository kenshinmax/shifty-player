import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { ADMIN_VIEWER, requireLiveOrg } from "@/lib/api-viewer";
import { createProgramInDb, getStateForViewer } from "@/lib/db/registration-repository";
import type { ProgramInput } from "@/lib/player-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await context.params;
  const found = await requireLiveOrg(orgId);
  if (found.error) return found.error;
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  let body: ProgramInput;
  try {
    body = (await request.json()) as ProgramInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await createProgramInDb(orgId, body);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    state: await getStateForViewer(orgId, ADMIN_VIEWER),
    programId: result.programId,
  });
}
