"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { useParams, usePathname } from "next/navigation";

export type OrgSummary = { id: string; slug: string; name: string };

const OrgContext = createContext<OrgSummary | null>(null);

export function OrgProvider({
  org,
  children,
}: {
  org: OrgSummary;
  children: ReactNode;
}) {
  return <OrgContext.Provider value={org}>{children}</OrgContext.Provider>;
}

export function useOrg(): OrgSummary {
  const org = useContext(OrgContext);
  if (!org) {
    throw new Error("useOrg must be used within OrgProvider");
  }
  return org;
}

/** The current org, or null on platform pages outside `/o/[slug]`. */
export function useOptionalOrg(): OrgSummary | null {
  return useContext(OrgContext);
}

/**
 * The org slug for the current page, or null on platform pages. The header,
 * footer and login dialog can render in AppShell, above the org layout's
 * OrgProvider, so the `/o/[slug]` route params are the fallback there.
 */
export function useNavOrgSlug(): string | null {
  const org = useOptionalOrg();
  const pathname = usePathname();
  const params = useParams<{ slug?: string }>();
  if (org) return org.slug;
  return pathname.startsWith("/o/") ? (params.slug ?? null) : null;
}

export function useOrgHref(): (path: string) => string {
  const { slug } = useOrg();
  return useCallback(
    (path: string) => (path === "/" ? `/o/${slug}` : `/o/${slug}${path}`),
    [slug],
  );
}
