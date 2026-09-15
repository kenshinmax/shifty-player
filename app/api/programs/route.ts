import { NextResponse } from "next/server";
import { createProgramInDb } from "@/lib/db/registration-repository";
import type { ProgramInput } from "@/lib/player-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: ProgramInput;
  try {
    body = (await request.json()) as ProgramInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await createProgramInDb(body);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    state: result.state,
    programId: result.programId,
  });
}
