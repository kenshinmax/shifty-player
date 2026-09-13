import { sampleData } from "./sample-data";
import { DEFAULT_CLINIC_CAPACITY, type AppState, type Session } from "./types";

export const REGISTRATION_STORAGE_KEY = "shifty-player-registration";
export const AUTH_USER_STORAGE_KEY = "shifty-player-auth-user";
export const AUTH_ACCOUNTS_STORAGE_KEY = "shifty-player-auth-accounts";

export type StoredAuthUser = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function normalizeSession(session: Session): Session {
  return {
    ...session,
    capacity:
      typeof session.capacity === "number" && session.capacity > 0
        ? session.capacity
        : DEFAULT_CLINIC_CAPACITY,
  };
}

export function normalizeRegistrationState(state: AppState): AppState {
  return {
    ...state,
    programs: state.programs.map((program) => ({
      ...program,
      spots:
        typeof program.spots === "number" && program.spots > 0
          ? program.spots
          : DEFAULT_CLINIC_CAPACITY,
    })),
    sessions: state.sessions.map(normalizeSession),
  };
}

function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as AppState;
  return (
    Array.isArray(candidate.programs) &&
    Array.isArray(candidate.sessions) &&
    Array.isArray(candidate.players)
  );
}

export function parseRegistrationState(raw: string): AppState | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isAppState(parsed)
      ? normalizeRegistrationState(parsed)
      : null;
  } catch {
    return null;
  }
}

export function loadRegistrationState(): AppState {
  if (!canUseStorage()) return sampleData;
  try {
    const raw = localStorage.getItem(REGISTRATION_STORAGE_KEY);
    if (!raw) return sampleData;
    return parseRegistrationState(raw) ?? sampleData;
  } catch {
    return sampleData;
  }
}

export function saveRegistrationState(state: AppState): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(REGISTRATION_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function loadAuthUser(): StoredAuthUser | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(AUTH_USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuthUser;
    if (!parsed?.id || !parsed?.email || !parsed?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveAuthUser(user: StoredAuthUser | null): void {
  if (!canUseStorage()) return;
  try {
    if (!user) {
      localStorage.removeItem(AUTH_USER_STORAGE_KEY);
      return;
    }
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function loadJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota / private-mode failures.
  }
}
