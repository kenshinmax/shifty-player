import { DEFAULT_ORG_SLUG } from "@/lib/organizations";

/**
 * `admin` runs the whole platform; `owner` runs one organization (`orgId`);
 * `user` is a parent.
 */
export type UserRole = "user" | "admin" | "owner";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** Owners only: the organization they run. */
  orgId?: string;
  orgSlug?: string;
};

export type DemoAccount = AuthUser & {
  password: string;
};

export type SignupInput = {
  name: string;
  email: string;
  password: string;
  /** Parent agreed to receive marketing emails (camps, renewals, offers). */
  marketingOptIn?: boolean;
};

/** Seed demo accounts (passwords hashed server-side on first auth seed). */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: "user-1",
    name: "Jordan Rivera",
    email: "user@demo.com",
    password: "user",
    role: "user",
  },
  {
    id: "admin-1",
    name: "Alex Admin",
    email: "admin@demo.com",
    password: "admin",
    role: "admin",
  },
];

export function validateSignupInput(input: SignupInput): string | null {
  if (!input.name.trim()) return "Name is required.";
  if (!input.email.trim()) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    return "Enter a valid email.";
  }
  if (input.password.length < 4) {
    return "Password must be at least 4 characters.";
  }
  return null;
}

/** Platform admin: sees and manages every organization. */
export function isPlatformAdmin(user: AuthUser | null): boolean {
  return user?.role === "admin";
}

/** Admin or owner: staff who run an org rather than register children. */
export function isOrgStaff(user: AuthUser | null): boolean {
  return user?.role === "admin" || user?.role === "owner";
}

/** Platform admins manage every org; owners manage only their own. */
export function canManageOrg(user: AuthUser | null, orgId: string): boolean {
  if (user?.role === "admin") return true;
  return user?.role === "owner" && user.orgId === orgId;
}

export function canAddPlayer(user: AuthUser | null): boolean {
  return user !== null;
}

export function canEdit(user: AuthUser | null): boolean {
  return isOrgStaff(user);
}

export function canManageSessions(user: AuthUser | null): boolean {
  return isOrgStaff(user);
}

export function canViewDashboard(user: AuthUser | null): boolean {
  return isOrgStaff(user);
}

export function canViewPlayerDashboard(user: AuthUser | null): boolean {
  return user?.role === "user";
}

/** Default landing path after a successful sign-in. */
export function getPostLoginPath(user: AuthUser): string {
  if (user.role === "admin") return `/o/${DEFAULT_ORG_SLUG}/admin`;
  if (user.role === "owner" && user.orgSlug) return `/o/${user.orgSlug}/admin`;
  return "/account";
}

/** Safe relative redirect target after login (defaults to post-login path). */
export function resolveLoginRedirect(
  user: AuthUser,
  nextPath: string | null | undefined,
): string {
  if (nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")) {
    return nextPath;
  }
  return getPostLoginPath(user);
}
