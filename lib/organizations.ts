import type { Organization } from "@/lib/types";

export const DEFAULT_ORG_ID = "org-shifty-player";
export const DEFAULT_ORG_SLUG = "shifty-player";

export function defaultOrganization(now?: string): Organization {
  return {
    id: DEFAULT_ORG_ID,
    slug: DEFAULT_ORG_SLUG,
    name: "Shifty Player",
    status: "live",
    stripeChargesEnabled: false,
    platformFeeBps: 0,
    hubspotEnabled: true,
    createdAt: now ?? new Date().toISOString(),
  };
}
