"use client";

import { AuthProvider } from "@/components/auth-provider";
import { RegistrationProvider } from "@/components/registration-provider";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <RegistrationProvider>
        <SiteHeader />
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-10">
          {children}
        </div>
        <Toaster />
      </RegistrationProvider>
    </AuthProvider>
  );
}
