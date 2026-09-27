import { NextResponse } from "next/server";
import {
  getUserForSession,
  readSessionToken,
} from "@/lib/db/auth-repository";
import type { AuthUser } from "@/lib/auth";

type AdminOk = { user: AuthUser; error?: undefined };
type AdminDenied = { user?: undefined; error: NextResponse };

/** Require an authenticated admin session for mutating admin APIs. */
export async function requireAdmin(request: Request): Promise<AdminOk | AdminDenied> {
  const token = readSessionToken(request.headers.get("cookie"));
  const user = await getUserForSession(token);
  if (!user) {
    return {
      error: NextResponse.json({ error: "Sign in required." }, { status: 401 }),
    };
  }
  if (user.role !== "admin") {
    return {
      error: NextResponse.json(
        { error: "Admin access required." },
        { status: 403 },
      ),
    };
  }
  return { user };
}
