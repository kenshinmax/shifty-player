import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  destroySession,
  readSessionToken,
} from "@/lib/db/auth-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = readSessionToken(request.headers.get("cookie"));
  await destroySession(token);
  const response = NextResponse.json({ ok: true });
  response.headers.set("Set-Cookie", clearSessionCookie());
  return response;
}
