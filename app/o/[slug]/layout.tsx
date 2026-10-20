import { notFound } from "next/navigation";
import { OrgProvider } from "@/components/org-provider";
import { RegistrationProvider } from "@/components/registration-provider";
import { getOrganizationBySlug } from "@/lib/db/platform-repository";

export default async function OrgLayout({
  children,
  params,
}: LayoutProps<"/o/[slug]">) {
  const { slug } = await params;
  const org = await getOrganizationBySlug(slug);
  if (!org || org.status !== "live") {
    notFound();
  }

  return (
    <OrgProvider org={{ id: org.id, slug: org.slug, name: org.name }}>
      {/* Keyed so registration state resets when switching orgs. */}
      <RegistrationProvider key={org.id} orgId={org.id}>
        {children}
      </RegistrationProvider>
    </OrgProvider>
  );
}
