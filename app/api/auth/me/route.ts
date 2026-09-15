import { NextResponse } from "next/server";
import {
  getUserForSession,
  readSessionToken,
} from "@/lib/db/auth-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = readSessionToken(request.headers.get("cookie"));
  const user = await getUserForSession(token);
  return NextResponse.json({ user });
}
