import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { OrgProvider } from "@/components/org-provider";
import { RegistrationProvider } from "@/components/registration-provider";
import { canManageOrg } from "@/lib/auth";
import { getUserForSession, sessionCookieName } from "@/lib/db/auth-repository";
import { getOrganizationBySlug } from "@/lib/db/platform-repository";

/** The platform admin and the org's owner can open it while draft to set it up. */
async function viewerManagesOrg(orgId: string): Promise<boolean> {
  const token = (await cookies()).get(sessionCookieName())?.value;
  return canManageOrg(await getUserForSession(token), orgId);
}

export default async function OrgLayout({
  children,
  params,
}: LayoutProps<"/o/[slug]">) {
  const { slug } = await params;
  const org = await getOrganizationBySlug(slug);
  if (!org || (org.status !== "live" && !(await viewerManagesOrg(org.id)))) {
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
