import {
  AUTH_ACCOUNTS_STORAGE_KEY,
  loadJson,
  saveJson,
} from "./storage";

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

export type SignupInput = {
  name: string;
  email: string;
  password: string;
};

/** Seed demo accounts (no real auth backend). */
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

function seedAccounts(): DemoAccount[] {
  return DEMO_ACCOUNTS.map((account) => ({ ...account }));
}

function readStoredAccounts(): DemoAccount[] {
  const stored = loadJson<DemoAccount[] | null>(AUTH_ACCOUNTS_STORAGE_KEY, null);
  if (!Array.isArray(stored) || stored.length === 0) return seedAccounts();
  return stored;
}

/** Runtime account list — starts from demo seed / localStorage; signup adds parents. */
let accounts: DemoAccount[] = seedAccounts();

function ensureAccountsHydrated(): void {
  if (typeof window === "undefined") return;
  accounts = readStoredAccounts();
}

function persistAccounts(): void {
  saveJson(AUTH_ACCOUNTS_STORAGE_KEY, accounts);
}

/** Reset runtime accounts to the demo seed (useful in tests). */
export function resetAccounts(): void {
  accounts = seedAccounts();
  if (typeof window !== "undefined") {
    saveJson(AUTH_ACCOUNTS_STORAGE_KEY, accounts);
  }
}

function toAuthUser(account: DemoAccount): AuthUser {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
  };
}

export function findAccountByEmail(email: string): DemoAccount | undefined {
  ensureAccountsHydrated();
  const normalized = email.trim().toLowerCase();
  return accounts.find(
    (account) => account.email.toLowerCase() === normalized,
  );
}

export function authenticate(
  email: string,
  password: string,
): AuthUser | null {
  const match = findAccountByEmail(email);
  if (!match || match.password !== password) return null;
  return toAuthUser(match);
}

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

/** Create a parent (role: user) account for program registration. */
export function registerParentAccount(
  input: SignupInput,
): { error: string; user?: undefined } | { error: null; user: AuthUser } {
  ensureAccountsHydrated();
  const validationError = validateSignupInput(input);
  if (validationError) return { error: validationError };

  if (findAccountByEmail(input.email)) {
    return { error: "An account with that email already exists." };
  }

  const account: DemoAccount = {
    id: `user-${crypto.randomUUID()}`,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    password: input.password,
    role: "user",
  };
  accounts = [...accounts, account];
  persistAccounts();
  return { error: null, user: toAuthUser(account) };
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

export function canViewPlayerDashboard(user: AuthUser | null): boolean {
  return user?.role === "user";
}

/** Default landing path after a successful sign-in. */
export function getPostLoginPath(user: AuthUser): string {
  if (user.role === "admin") return "/dashboard";
  return "/player";
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
