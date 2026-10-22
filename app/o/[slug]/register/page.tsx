"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { isOrgStaff } from "@/lib/auth";
import { useOrgHref } from "@/components/org-provider";
import { ParentProgramRegistration } from "@/components/parent-program-registration";

export default function OrgRegisterPage() {
  const router = useRouter();
  const orgHref = useOrgHref();
  const { user, canViewPlayerDashboard } = useAuth();

  useEffect(() => {
    if (!user) {
      router.replace(orgHref("/"));
      return;
    }
    if (!canViewPlayerDashboard) {
      router.replace(orgHref(isOrgStaff(user) ? "/admin" : "/"));
    }
  }, [user, canViewPlayerDashboard, router, orgHref]);

  if (!user || !canViewPlayerDashboard) {
    return <p className="text-muted-foreground">Redirecting…</p>;
  }

  return <ParentProgramRegistration />;
}
