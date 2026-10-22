import { NextResponse } from "next/server";
import { requireOrgAdmin } from "@/lib/api-auth";
import { ADMIN_VIEWER, requireOrg } from "@/lib/api-viewer";
import {
  deleteClinicInDb,
  getStateForViewer,
  setClinicAvailableInDb,
  updateClinicInDb,
} from "@/lib/db/registration-repository";
import type { SessionInput } from "@/lib/player-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PatchBody = Partial<SessionInput> & { available?: boolean };

export async function PATCH(
  request: Request,
  context: { params: Promise<{ orgId: string; clinicId: string }> },
) {
  const { orgId, clinicId } = await context.params;
  const found = await requireOrg(orgId, request);
  if (found.error) return found.error;
  const auth = await requireOrgAdmin(request, orgId);
  if (auth.error) return auth.error;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.available === "boolean" && body.year === undefined) {
    const result = await setClinicAvailableInDb(orgId, clinicId, body.available);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ state: await getStateForViewer(orgId, ADMIN_VIEWER) });
  }

  const result = await updateClinicInDb(orgId, clinicId, {
    year: Number(body.year),
    month: Number(body.month),
    week: body.week,
    label: body.label,
    status: body.status,
    programId: body.programId,
    capacity: body.capacity,
    priceUsd: body.priceUsd,
    available: body.available,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ state: await getStateForViewer(orgId, ADMIN_VIEWER) });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ orgId: string; clinicId: string }> },
) {
  const { orgId, clinicId } = await context.params;
  const found = await requireOrg(orgId, request);
  if (found.error) return found.error;
  const auth = await requireOrgAdmin(request, orgId);
  if (auth.error) return auth.error;

  const result = await deleteClinicInDb(orgId, clinicId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ state: await getStateForViewer(orgId, ADMIN_VIEWER) });
}
