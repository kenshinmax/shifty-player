"use client";

import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { useOrg } from "@/components/org-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Organization } from "@/lib/types";

function optionLabel(org: Pick<Organization, "name" | "status">): string {
  return org.status === "live" ? org.name : `${org.name} (${org.status})`;
}

/** Admin-only switcher between organizations' admin dashboards. */
export function OrgSwitcher({ organizations }: { organizations: Organization[] }) {
  const router = useRouter();
  const current = useOrg();

  const labelFor = (slug: string | null) => {
    const org = organizations.find((entry) => entry.slug === slug);
    return org ? optionLabel(org) : current.name;
  };

  return (
    <div className="flex items-center gap-2" data-testid="org-switcher">
      <Building2 className="size-4 text-muted-foreground" aria-hidden />
      <Select
        value={current.slug}
        onValueChange={(slug) => {
          if (slug && slug !== current.slug) router.push(`/o/${slug}/admin`);
        }}
      >
        <SelectTrigger
          aria-label="Organization"
          className="min-w-56 bg-background"
          data-testid="org-switcher-trigger"
        >
          <SelectValue>{(slug: string | null) => labelFor(slug)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {organizations.map((org) => (
            <SelectItem key={org.id} value={org.slug}>
              {optionLabel(org)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
