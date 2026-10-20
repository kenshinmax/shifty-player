"use client";

import { AuthProvider } from "@/components/auth-provider";
import { OrgProvider, type OrgSummary } from "@/components/org-provider";
import { RegistrationProvider } from "@/components/registration-provider";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import { DEFAULT_ORG_ID, DEFAULT_ORG_SLUG } from "@/lib/organizations";

// Temporary until the org layout (Task 7) supplies the org.
const DEFAULT_ORG: OrgSummary = {
  id: DEFAULT_ORG_ID,
  slug: DEFAULT_ORG_SLUG,
  name: "Shifty Player",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <OrgProvider org={DEFAULT_ORG}>
        <RegistrationProvider orgId={DEFAULT_ORG_ID}>
          <div className="flex min-h-full flex-1 flex-col">
            <SiteHeader />
            <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-10">
              {children}
            </div>
            <SiteFooter />
          </div>
          <Toaster />
        </RegistrationProvider>
      </OrgProvider>
    </AuthProvider>
  );
}
