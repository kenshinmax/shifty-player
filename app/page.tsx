import { HomeContent } from "@/components/home-content";
import { OrgProvider } from "@/components/org-provider";
import { RegistrationProvider } from "@/components/registration-provider";
import { DEFAULT_ORG_ID, DEFAULT_ORG_SLUG } from "@/lib/organizations";

// Temporary: shows the default org's home until Task 8 replaces this page.
export default function HomePage() {
  return (
    <OrgProvider
      org={{ id: DEFAULT_ORG_ID, slug: DEFAULT_ORG_SLUG, name: "Shifty Player" }}
    >
      <RegistrationProvider orgId={DEFAULT_ORG_ID}>
        <HomeContent />
      </RegistrationProvider>
    </OrgProvider>
  );
}
