import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { OrgProvider } from "@/components/org-provider";
import { RegistrationProvider } from "@/components/registration-provider";
import { getUserForSession, sessionCookieName } from "@/lib/db/auth-repository";
import { getOrganizationBySlug } from "@/lib/db/platform-repository";

/** Admins can open draft (unpublished) orgs to set them up. */
async function viewerIsAdmin(): Promise<boolean> {
  const token = (await cookies()).get(sessionCookieName())?.value;
  return (await getUserForSession(token))?.role === "admin";
}

export default async function OrgLayout({
  children,
  params,
}: LayoutProps<"/o/[slug]">) {
  const { slug } = await params;
  const org = await getOrganizationBySlug(slug);
  if (!org || (org.status !== "live" && !(await viewerIsAdmin()))) {
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
