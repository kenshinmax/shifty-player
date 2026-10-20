"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";

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

export function useOrgHref(): (path: string) => string {
  const { slug } = useOrg();
  return useCallback(
    (path: string) => (path === "/" ? `/o/${slug}` : `/o/${slug}${path}`),
    [slug],
  );
}
