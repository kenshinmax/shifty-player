import { createHash, randomBytes, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { getDb, isMongoConfigured } from "@/lib/mongo";
import {
  DEMO_ACCOUNTS,
  type AuthUser,
  type DemoAccount,
  type SignupInput,
  type UserRole,
  validateSignupInput,
} from "@/lib/auth";

const USERS = "users";
const AUTH_SESSIONS = "auth_sessions";
const SESSION_COOKIE = "shifty_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export type StoredUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  passwordHash: string;
  marketingOptIn?: boolean;
  /** Owners only: the organization they run. */
  orgId?: string;
  orgSlug?: string;
};

export type AuthSession = {
  id: string;
  userId: string;
  expiresAt: string;
};

type MemoryAuth = {
  users: StoredUser[];
  sessions: AuthSession[];
};

type MemoryGlobal = typeof globalThis & {
  __shiftyAuthMemory?: MemoryAuth;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function seedUsers(): Promise<StoredUser[]> {
  const users: StoredUser[] = [];
  for (const account of DEMO_ACCOUNTS) {
    users.push({
      id: account.id,
      name: account.name,
      email: account.email.toLowerCase(),
      role: account.role,
      passwordHash: await bcrypt.hash(account.password, 10),
    });
  }
  return users;
}

function getMemoryAuth(): MemoryAuth {
  const g = globalThis as MemoryGlobal;
  if (!g.__shiftyAuthMemory) {
    g.__shiftyAuthMemory = { users: [], sessions: [] };
  }
  return g.__shiftyAuthMemory;
}

export async function ensureAuthSeeded(): Promise<void> {
  if (!isMongoConfigured()) {
    const memory = getMemoryAuth();
    if (memory.users.length === 0) {
      memory.users = await seedUsers();
    }
    return;
  }

  const db = await getDb();
  const count = await db.collection(USERS).countDocuments();
  if (count === 0) {
    const users = await seedUsers();
    await db.collection(USERS).insertMany(users as never);
  }
}

export async function resetAuthStore(): Promise<void> {
  if (!isMongoConfigured()) {
    const g = globalThis as MemoryGlobal;
    g.__shiftyAuthMemory = {
      users: await seedUsers(),
      sessions: [],
    };
    return;
  }

  const db = await getDb();
  await db.collection(USERS).deleteMany({});
  await db.collection(AUTH_SESSIONS).deleteMany({});
  const users = await seedUsers();
  await db.collection(USERS).insertMany(users as never);
}

function toAuthUser(user: StoredUser): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    ...(user.orgId ? { orgId: user.orgId, orgSlug: user.orgSlug } : {}),
  };
}

async function findUserByEmail(email: string): Promise<StoredUser | null> {
  await ensureAuthSeeded();
  const normalized = email.trim().toLowerCase();

  if (!isMongoConfigured()) {
    return (
      getMemoryAuth().users.find((user) => user.email === normalized) ?? null
    );
  }

  const db = await getDb();
  const doc = await db.collection(USERS).findOne({ email: normalized });
  if (!doc) return null;
  const { _id: _ignored, ...user } = doc as StoredUser & { _id?: unknown };
  return user as StoredUser;
}

async function findUserById(id: string): Promise<StoredUser | null> {
  await ensureAuthSeeded();

  if (!isMongoConfigured()) {
    return getMemoryAuth().users.find((user) => user.id === id) ?? null;
  }

  const db = await getDb();
  const doc = await db.collection(USERS).findOne({ id });
  if (!doc) return null;
  const { _id: _ignored, ...user } = doc as StoredUser & { _id?: unknown };
  return user as StoredUser;
}

/** Public lookup used by integrations (e.g. HubSpot sync) to find a parent. */
export async function getAuthUserById(id: string): Promise<AuthUser | null> {
  const user = await findUserById(id);
  return user ? toAuthUser(user) : null;
}

export async function authenticateUser(
  email: string,
  password: string,
): Promise<AuthUser | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return toAuthUser(user);
}

export async function registerUser(
  input: SignupInput,
): Promise<{ error: string; user?: undefined } | { error: null; user: AuthUser }> {
  const validationError = validateSignupInput(input);
  if (validationError) return { error: validationError };

  const existing = await findUserByEmail(input.email);
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  const user: StoredUser = {
    id: `user-${crypto.randomUUID()}`,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    role: "user",
    passwordHash: await bcrypt.hash(input.password, 10),
    marketingOptIn: input.marketingOptIn === true,
  };

  if (!isMongoConfigured()) {
    getMemoryAuth().users.push(user);
  } else {
    const db = await getDb();
    await db.collection(USERS).insertOne(user as never);
  }

  return { error: null, user: toAuthUser(user) };
}

export type OwnerInput = { name: string; email: string; password: string };

/** Reads `{ name, email, password }`; missing fields become empty strings and fail validation. */
export function parseOwnerInput(value: unknown): OwnerInput {
  const fields = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  const text = (key: string) => (typeof fields[key] === "string" ? (fields[key] as string) : "");
  return { name: text("name"), email: text("email"), password: text("password") };
}

type OwnerPlan =
  | { kind: "create"; input: OwnerInput }
  | { kind: "assign"; user: StoredUser };

/**
 * An existing account (matched by email) is assigned as-is, keeping its
 * name and password; otherwise all three fields are needed for a new account.
 */
async function planOwner(input: OwnerInput): Promise<{ error: string } | { plan: OwnerPlan }> {
  const email = input.email.trim();
  if (!email) return { error: "Email is required." };
  const existing = await findUserByEmail(email);
  if (!existing) {
    const validationError = validateSignupInput(input);
    return validationError ? { error: validationError } : { plan: { kind: "create", input } };
  }
  if (existing.role === "admin") {
    return { error: "The platform admin can't be an organization owner." };
  }
  if (existing.role === "owner") {
    return { error: "That account already owns an organization." };
  }
  return { plan: { kind: "assign", user: existing } };
}

/** Checks an owner's details before anything is written. */
export async function validateOwnerInput(input: OwnerInput): Promise<string | null> {
  const result = await planOwner(input);
  return "error" in result ? result.error : null;
}

/**
 * Makes `org`'s single owner: assigns the existing account with that email,
 * or creates a new one.
 */
export async function assignOwner(
  input: OwnerInput,
  org: { id: string; slug: string },
): Promise<{ error: string; user?: undefined } | { error: null; user: AuthUser }> {
  if ((await listOwners()).some((owner) => owner.orgId === org.id)) {
    return { error: "This organization already has an owner." };
  }
  const result = await planOwner(input);
  if ("error" in result) return { error: result.error };
  const ownership = { role: "owner" as const, orgId: org.id, orgSlug: org.slug };

  if (result.plan.kind === "assign") {
    const user: StoredUser = { ...result.plan.user, ...ownership };
    if (!isMongoConfigured()) {
      const users = getMemoryAuth().users;
      users[users.findIndex((entry) => entry.id === user.id)] = user;
    } else {
      const db = await getDb();
      await db.collection(USERS).updateOne({ id: user.id }, { $set: ownership });
    }
    return { error: null, user: toAuthUser(user) };
  }

  const { input: fields } = result.plan;
  const user: StoredUser = {
    id: `owner-${crypto.randomUUID()}`,
    name: fields.name.trim(),
    email: fields.email.trim().toLowerCase(),
    passwordHash: await bcrypt.hash(fields.password, 10),
    ...ownership,
  };

  if (!isMongoConfigured()) {
    getMemoryAuth().users.push(user);
  } else {
    const db = await getDb();
    await db.collection(USERS).insertOne(user as never);
  }

  return { error: null, user: toAuthUser(user) };
}

/** Owner accounts across all orgs, for the platform admin's org list. */
export async function listOwners(): Promise<AuthUser[]> {
  await ensureAuthSeeded();
  if (!isMongoConfigured()) {
    return getMemoryAuth().users.filter((user) => user.role === "owner").map(toAuthUser);
  }
  const db = await getDb();
  const docs = await db.collection(USERS).find({ role: "owner" }).toArray();
  return docs.map((doc) => toAuthUser(doc as unknown as StoredUser));
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const session: AuthSession = {
    id: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  };

  if (!isMongoConfigured()) {
    getMemoryAuth().sessions.push(session);
  } else {
    const db = await getDb();
    await db.collection(AUTH_SESSIONS).insertOne(session as never);
  }

  return token;
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  const id = hashToken(token);

  if (!isMongoConfigured()) {
    const memory = getMemoryAuth();
    memory.sessions = memory.sessions.filter((session) => session.id !== id);
    return;
  }

  const db = await getDb();
  await db.collection(AUTH_SESSIONS).deleteOne({ id });
}

export async function getUserForSession(
  token: string | undefined,
): Promise<AuthUser | null> {
  if (!token) return null;
  const id = hashToken(token);

  let session: AuthSession | null = null;
  if (!isMongoConfigured()) {
    session =
      getMemoryAuth().sessions.find((entry) => entry.id === id) ?? null;
  } else {
    const db = await getDb();
    const doc = await db.collection(AUTH_SESSIONS).findOne({ id });
    if (doc) {
      const { _id: _ignored, ...rest } = doc as AuthSession & { _id?: unknown };
      session = rest as AuthSession;
    }
  }

  if (!session) return null;
  if (Date.parse(session.expiresAt) < Date.now()) {
    await destroySession(token);
    return null;
  }

  const user = await findUserById(session.userId);
  return user ? toAuthUser(user) : null;
}

export function sessionCookieName(): string {
  return SESSION_COOKIE;
}

export function buildSessionCookie(token: string): string {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readSessionToken(cookieHeader: string | null): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq);
    if (name === SESSION_COOKIE) {
      return part.slice(eq + 1);
    }
  }
  return undefined;
}

/** Test helper: sync-style authenticate against memory/demo hashes is async now. */
export async function authenticateDemoAccount(
  email: string,
  password: string,
): Promise<AuthUser | null> {
  return authenticateUser(email, password);
}

export function passwordsEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Bridge for tests that still use DemoAccount shape. */
export function demoAccountFromStored(user: StoredUser, password: string): DemoAccount {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    password,
  };
}
