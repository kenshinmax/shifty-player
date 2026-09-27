import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  setProgramOpenInDb,
  updateProgramInDb,
} from "@/lib/db/registration-repository";
import type { ProgramInput } from "@/lib/player-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PatchBody = Partial<ProgramInput> & { open?: unknown };

export async function PATCH(
  request: Request,
  context: { params: Promise<{ programId: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const { programId } = await context.params;
  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Availability-only toggle (dashboard quick action).
  if (
    typeof body.open === "boolean" &&
    body.name === undefined &&
    body.description === undefined &&
    body.startDate === undefined
  ) {
    const result = await setProgramOpenInDb(programId, body.open);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ state: result.state });
  }

  const input: ProgramInput = {
    name: String(body.name ?? ""),
    description: String(body.description ?? ""),
    startDate: String(body.startDate ?? ""),
    endDate: String(body.endDate ?? ""),
    open: Boolean(body.open),
    spots: Number(body.spots),
    location:
      typeof body.location === "string" ? body.location : undefined,
  };

  const result = await updateProgramInDb(programId, input);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ state: result.state });
}
