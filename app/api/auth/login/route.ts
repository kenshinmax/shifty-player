import { NextResponse } from "next/server";
import {
  authenticateUser,
  buildSessionCookie,
  createSession,
} from "@/lib/db/auth-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  const user = await authenticateUser(email, password);
  if (!user) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 },
    );
  }

  const token = await createSession(user.id);
  const response = NextResponse.json({ user });
  response.headers.set("Set-Cookie", buildSessionCookie(token));
  return response;
}
