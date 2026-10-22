"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useOrg, useOrgHref } from "@/components/org-provider";
import { canManageOrg, getPostLoginPath } from "@/lib/auth";

/**
 * Whether the signed-in user can open this org's admin pages. Anyone else is
 * sent away: owners to their own org's admin, parents to their account, and
 * visitors to the org home page.
 */
export function useOrgAdminAccess(): boolean {
  const router = useRouter();
  const { user } = useAuth();
  const org = useOrg();
  const orgHref = useOrgHref();
  const allowed = canManageOrg(user, org.id);

  useEffect(() => {
    if (allowed) return;
    if (user?.role === "owner") router.replace(getPostLoginPath(user));
    else if (user?.role === "user") router.replace("/account");
    else router.replace(orgHref("/"));
  }, [allowed, user, router, orgHref]);

  return allowed;
}
