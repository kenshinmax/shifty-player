import type { ReactNode } from "react";
import { OrgProvider } from "@/components/org-provider";
import { RegistrationProvider } from "@/components/registration-provider";
import { DEFAULT_ORG_ID, DEFAULT_ORG_SLUG } from "@/lib/organizations";

// Temporary: keeps /player on the default org until Task 8 removes this page.
export default function PlayerLayout({ children }: { children: ReactNode }) {
  return (
    <OrgProvider
      org={{ id: DEFAULT_ORG_ID, slug: DEFAULT_ORG_SLUG, name: "Shifty Player" }}
    >
      <RegistrationProvider orgId={DEFAULT_ORG_ID}>{children}</RegistrationProvider>
    </OrgProvider>
  );
}
