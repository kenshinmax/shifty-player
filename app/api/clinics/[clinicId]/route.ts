import { NextResponse } from "next/server";
import {
  deleteClinicInDb,
  setClinicAvailableInDb,
  updateClinicInDb,
} from "@/lib/db/registration-repository";
import type { SessionInput } from "@/lib/player-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PatchBody = Partial<SessionInput> & { available?: boolean };

export async function PATCH(
  request: Request,
  context: { params: Promise<{ clinicId: string }> },
) {
  const { clinicId } = await context.params;
  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.available === "boolean" && body.year === undefined) {
    const result = await setClinicAvailableInDb(clinicId, body.available);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ state: result.state });
  }

  const result = await updateClinicInDb(clinicId, {
    year: Number(body.year),
    month: Number(body.month),
    week: body.week,
    label: body.label,
    status: body.status,
    programId: body.programId,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ state: result.state });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ clinicId: string }> },
) {
  const { clinicId } = await context.params;
  const result = await deleteClinicInDb(clinicId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ state: result.state });
}
