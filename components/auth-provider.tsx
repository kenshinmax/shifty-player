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
  authenticate,
  canAddPlayer,
  canEdit,
  canManageSessions,
  canViewDashboard,
  canViewPlayerDashboard,
  registerParentAccount,
  type AuthUser,
  type SignupInput,
} from "@/lib/auth";
import { loadAuthUser, saveAuthUser } from "@/lib/storage";

type AuthResult =
  | { error: string; user?: undefined }
  | { error: null; user: AuthUser };

type AuthContextValue = {
  user: AuthUser | null;
  login: (email: string, password: string) => AuthResult;
  signup: (input: SignupInput) => AuthResult;
  logout: () => void;
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
    setUser(loadAuthUser());
    setHydrated(true);
  }, []);

  const login = useCallback((email: string, password: string): AuthResult => {
    const nextUser = authenticate(email, password);
    if (!nextUser) {
      return { error: "Invalid email or password." };
    }
    setUser(nextUser);
    saveAuthUser(nextUser);
    return { error: null, user: nextUser };
  }, []);

  const signup = useCallback((input: SignupInput): AuthResult => {
    const result = registerParentAccount(input);
    if (result.error || !result.user) {
      return { error: result.error ?? "Unable to create account." };
    }
    setUser(result.user);
    saveAuthUser(result.user);
    return { error: null, user: result.user };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    saveAuthUser(null);
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
