import { NextResponse } from "next/server";
import type { AuthUser } from "@/lib/auth";
import { getUserForSession, readSessionToken } from "@/lib/db/auth-repository";
import { getOrganizationById } from "@/lib/db/platform-repository";
import {
  getRegistrationState,
  ORG_NOT_FOUND,
  type Viewer,
} from "@/lib/db/registration-repository";
import type { AppState, Organization } from "@/lib/types";

/** Who is calling: admin role → admin, any other signed-in user → parent, else public. */
export async function resolveViewer(
  request: Request,
): Promise<{ user: AuthUser | null; viewer: Viewer }> {
  const user = await getUserForSession(readSessionToken(request.headers.get("cookie")));
  if (!user) return { user: null, viewer: { kind: "public" } };
  if (user.role === "admin") return { user, viewer: { kind: "admin" } };
  return { user, viewer: { kind: "parent", userId: user.id } };
}

/** The viewer behind a route that already passed requireAdmin. */
export const ADMIN_VIEWER: Viewer = { kind: "admin" };

export function orgNotFound(): NextResponse {
  return NextResponse.json({ error: ORG_NOT_FOUND }, { status: 404 });
}

/**
 * Live orgs are reachable by everyone. Admins can also open draft (or
 * suspended) orgs; for anyone else missing and non-live orgs look identical.
 */
export async function requireOrg(
  orgId: string,
  request: Request,
): Promise<{ org: Organization; error?: undefined } | { org?: undefined; error: NextResponse }> {
  const org = await getOrganizationById(orgId);
  if (!org) return { error: orgNotFound() };
  if (org.status === "live") return { org };
  const { viewer } = await resolveViewer(request);
  return viewer.kind === "admin" ? { org } : { error: orgNotFound() };
}

export function signInRequired(): NextResponse {
  return NextResponse.json({ error: "Sign in required." }, { status: 401 });
}

/**
 * The repository lets any parent's child enroll for the first time, so routes
 * that enroll or charge for a child check that the caller is an admin or that
 * child's parent. Returns the org's full internal state for server-side lookups.
 */
export async function requireEnrollableChild(
  user: AuthUser,
  orgId: string,
  playerId: string,
): Promise<{ state: AppState; error?: undefined } | { state?: undefined; error: NextResponse }> {
  const state = await getRegistrationState(orgId);
  const child = state.players.find((player) => player.id === playerId);
  if (!child || (user.role !== "admin" && child.parentUserId !== user.id)) {
    return {
      error: NextResponse.json({ error: "Player not found." }, { status: 404 }),
    };
  }
  return { state };
}
