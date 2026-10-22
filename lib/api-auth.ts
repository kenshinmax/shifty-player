import { NextResponse } from "next/server";
import {
  getUserForSession,
  readSessionToken,
} from "@/lib/db/auth-repository";
import { canManageOrg, isPlatformAdmin, type AuthUser } from "@/lib/auth";

type AdminOk = { user: AuthUser; error?: undefined };
type AdminDenied = { user?: undefined; error: NextResponse };

async function requireUser(
  request: Request,
  allowed: (user: AuthUser) => boolean,
): Promise<AdminOk | AdminDenied> {
  const token = readSessionToken(request.headers.get("cookie"));
  const user = await getUserForSession(token);
  if (!user) {
    return {
      error: NextResponse.json({ error: "Sign in required." }, { status: 401 }),
    };
  }
  if (!allowed(user)) {
    return {
      error: NextResponse.json(
        { error: "Admin access required." },
        { status: 403 },
      ),
    };
  }
  return { user };
}

/** Require the platform admin, for APIs that span every organization. */
export function requireAdmin(request: Request): Promise<AdminOk | AdminDenied> {
  return requireUser(request, isPlatformAdmin);
}

/** Require the platform admin or the owner of `orgId`, for that org's admin APIs. */
export function requireOrgAdmin(
  request: Request,
  orgId: string,
): Promise<AdminOk | AdminDenied> {
  return requireUser(request, (user) => canManageOrg(user, orgId));
}
