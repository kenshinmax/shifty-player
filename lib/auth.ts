export type UserRole = "user" | "admin";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type DemoAccount = AuthUser & {
  password: string;
};

/** Client-only demo accounts (no real auth backend). */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: "user-1",
    name: "Jordan Player",
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

export function authenticate(
  email: string,
  password: string,
): AuthUser | null {
  const match = DEMO_ACCOUNTS.find(
    (account) =>
      account.email.toLowerCase() === email.trim().toLowerCase() &&
      account.password === password,
  );
  if (!match) return null;

  return {
    id: match.id,
    name: match.name,
    email: match.email,
    role: match.role,
  };
}

export function canAddPlayer(user: AuthUser | null): boolean {
  return user !== null;
}

export function canEdit(user: AuthUser | null): boolean {
  return user?.role === "admin";
}

export function canManageSessions(user: AuthUser | null): boolean {
  return user?.role === "admin";
}

export function canViewDashboard(user: AuthUser | null): boolean {
  return user?.role === "admin";
}
