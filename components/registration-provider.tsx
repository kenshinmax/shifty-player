"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { usePlayerStore } from "@/lib/use-player-store";

type RegistrationStore = ReturnType<typeof usePlayerStore>;

const RegistrationContext = createContext<RegistrationStore | null>(null);

export function RegistrationProvider({
  orgId,
  children,
}: {
  orgId: string;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const store = usePlayerStore(orgId, user?.id ?? null);

  if (!store.hydrated) {
    return null;
  }

  return (
    <RegistrationContext.Provider value={store}>
      {children}
    </RegistrationContext.Provider>
  );
}

export function useRegistration() {
  const context = useContext(RegistrationContext);
  if (!context) {
    throw new Error("useRegistration must be used within RegistrationProvider");
  }
  return context;
}
