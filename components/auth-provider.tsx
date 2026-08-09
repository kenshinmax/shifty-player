"use client";

import {
  createContext,
  useCallback,
  useContext,
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
  type AuthUser,
} from "@/lib/auth";

type AuthContextValue = {
  user: AuthUser | null;
  login: (email: string, password: string) => { error: string | null };
  logout: () => void;
  canAddPlayer: boolean;
  canEdit: boolean;
  canManageSessions: boolean;
  canViewDashboard: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  const login = useCallback((email: string, password: string) => {
    const nextUser = authenticate(email, password);
    if (!nextUser) {
      return { error: "Invalid email or password." };
    }
    setUser(nextUser);
    return { error: null };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login,
      logout,
      canAddPlayer: canAddPlayer(user),
      canEdit: canEdit(user),
      canManageSessions: canManageSessions(user),
      canViewDashboard: canViewDashboard(user),
    }),
    [user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
