import { createHash, randomBytes, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { getDb, isMongoConfigured } from "@/lib/mongo";
import {
  DEMO_ACCOUNTS,
  type AuthUser,
  type DemoAccount,
  type SignupInput,
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
  role: "user" | "admin";
  passwordHash: string;
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
  };

  if (!isMongoConfigured()) {
    getMemoryAuth().users.push(user);
  } else {
    const db = await getDb();
    await db.collection(USERS).insertOne(user as never);
  }

  return { error: null, user: toAuthUser(user) };
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
