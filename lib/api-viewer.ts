import { NextResponse } from "next/server";
import type { AuthUser } from "@/lib/auth";
import { getUserForSession, readSessionToken } from "@/lib/db/auth-repository";
import { getOrganizationById } from "@/lib/db/platform-repository";
import { ORG_NOT_FOUND, type Viewer } from "@/lib/db/registration-repository";
import type { Organization } from "@/lib/types";

/** Who is calling: admin role → admin, any other signed-in user → parent, else public. */
export async function resolveViewer(
  request: Request,
): Promise<{ user: AuthUser | null; viewer: Viewer }> {
  const user = await getUserForSession(readSessionToken(request.headers.get("cookie")));
  if (!user) return { user: null, viewer: { kind: "public" } };
  if (user.role === "admin") return { user, viewer: { kind: "admin" } };
  return { user, viewer: { kind: "parent", userId: user.id } };
}

export function orgNotFound(): NextResponse {
  return NextResponse.json({ error: ORG_NOT_FOUND }, { status: 404 });
}

/** Only live orgs are reachable; missing and non-live orgs look identical. */
export async function requireLiveOrg(
  orgId: string,
): Promise<{ org: Organization; error?: undefined } | { org?: undefined; error: NextResponse }> {
  const org = await getOrganizationById(orgId);
  if (!org || org.status !== "live") return { error: orgNotFound() };
  return { org };
}
