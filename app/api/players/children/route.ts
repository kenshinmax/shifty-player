import { NextResponse } from "next/server";
import { addChildInDb } from "@/lib/db/registration-repository";
import type { ChildInput } from "@/lib/player-store";
import type { Level } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  parentUserId?: unknown;
  parentEmail?: unknown;
  name?: unknown;
  grade?: unknown;
  level?: unknown;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parentUserId =
    typeof body.parentUserId === "string" ? body.parentUserId.trim() : "";
  const parentEmail =
    typeof body.parentEmail === "string" ? body.parentEmail.trim() : "";
  if (!parentUserId || !parentEmail) {
    return NextResponse.json(
      { error: "parentUserId and parentEmail are required." },
      { status: 400 },
    );
  }

  const input: ChildInput = {
    name: typeof body.name === "string" ? body.name : "",
    grade: typeof body.grade === "string" ? body.grade : "",
    level: body.level as Level,
  };

  const result = await addChildInDb(parentUserId, parentEmail, input);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    state: result.state,
    childId: result.childId,
  });
}
