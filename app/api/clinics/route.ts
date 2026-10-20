import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createClinicInDb } from "@/lib/db/registration-repository";
import { DEFAULT_ORG_ID } from "@/lib/organizations";
import type { SessionInput } from "@/lib/player-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  let body: SessionInput;
  try {
    body = (await request.json()) as SessionInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await createClinicInDb(DEFAULT_ORG_ID, body);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ state: result.state });
}
