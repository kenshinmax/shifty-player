"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  canAddPlayer,
  canEdit,
  canManageSessions,
  canViewDashboard,
  canViewPlayerDashboard,
  type AuthUser,
  type SignupInput,
} from "@/lib/auth";

type AuthResult =
  | { error: string; user?: undefined }
  | { error: null; user: AuthUser };

type AuthContextValue = {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<AuthResult>;
  signup: (input: SignupInput) => Promise<AuthResult>;
  logout: () => Promise<void>;
  canAddPlayer: boolean;
  canEdit: boolean;
  canManageSessions: boolean;
  canViewDashboard: boolean;
  canViewPlayerDashboard: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const body = (await response.json()) as { user: AuthUser | null };
        if (!cancelled) setUser(body.user ?? null);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = (await response.json()) as {
        user?: AuthUser;
        error?: string;
      };
      if (!response.ok || !body.user) {
        return { error: body.error ?? "Invalid email or password." };
      }
      setUser(body.user);
      return { error: null, user: body.user };
    },
    [],
  );

  const signup = useCallback(async (input: SignupInput): Promise<AuthResult> => {
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = (await response.json()) as {
      user?: AuthUser;
      error?: string;
    };
    if (!response.ok || !body.user) {
      return { error: body.error ?? "Unable to create account." };
    }
    setUser(body.user);
    return { error: null, user: body.user };
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login,
      signup,
      logout,
      canAddPlayer: canAddPlayer(user),
      canEdit: canEdit(user),
      canManageSessions: canManageSessions(user),
      canViewDashboard: canViewDashboard(user),
      canViewPlayerDashboard: canViewPlayerDashboard(user),
    }),
    [user, login, signup, logout],
  );

  if (!hydrated) {
    return null;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
