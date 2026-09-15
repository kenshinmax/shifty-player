import { NextResponse } from "next/server";
import { setProgramOpenInDb } from "@/lib/db/registration-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PatchBody = { open?: unknown };

export async function PATCH(
  request: Request,
  context: { params: Promise<{ programId: string }> },
) {
  const { programId } = await context.params;
  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.open !== "boolean") {
    return NextResponse.json(
      { error: "open (boolean) is required." },
      { status: 400 },
    );
  }

  const result = await setProgramOpenInDb(programId, body.open);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ state: result.state });
}
