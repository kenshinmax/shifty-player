import { NextResponse } from "next/server";
import { resolveViewer } from "@/lib/api-viewer";
import { addChild } from "@/lib/db/family-repository";
import type { ChildInput } from "@/lib/player-store";
import { LEVELS, type Level } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { name?: unknown; grade?: unknown; level?: unknown };

export async function POST(request: Request) {
  const { user } = await resolveViewer(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!LEVELS.includes(body.level as Level)) {
    return NextResponse.json({ error: "Level is required." }, { status: 400 });
  }

  const input: ChildInput = {
    name: typeof body.name === "string" ? body.name : "",
    grade: typeof body.grade === "string" ? body.grade : "",
    level: body.level as Level,
  };

  // Parent identity comes from the session only; body ids are ignored.
  const result = await addChild(user.id, user.email, input);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ child: result.child });
}
