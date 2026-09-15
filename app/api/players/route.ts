import { NextResponse } from "next/server";
import { createPlayerInDb } from "@/lib/db/registration-repository";
import type { PlayerInput } from "@/lib/player-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: PlayerInput;
  try {
    body = (await request.json()) as PlayerInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await createPlayerInDb(body);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ state: result.state });
}
