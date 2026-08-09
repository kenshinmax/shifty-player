"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePlayerStore } from "@/lib/player-store";

type RegistrationStore = ReturnType<typeof usePlayerStore>;

const RegistrationContext = createContext<RegistrationStore | null>(null);

export function RegistrationProvider({ children }: { children: ReactNode }) {
  const store = usePlayerStore();
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
