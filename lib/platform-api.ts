import type {
  Organization,
  OrganizationOwner,
  OrganizationWithOwners,
} from "@/lib/types";

type OrganizationResult = { organization?: Organization; error?: string };

const ORGS_URL = "/api/platform/organizations";

export async function fetchOrganizations(): Promise<OrganizationWithOwners[]> {
  const response = await fetch(ORGS_URL, { cache: "no-store" });
  const body = (await response.json()) as {
    organizations?: OrganizationWithOwners[];
    error?: string;
  };
  if (!response.ok || !body.organizations) {
    throw new Error(body.error ?? "Failed to load organizations.");
  }
  return body.organizations;
}

async function sendJson(
  url: string,
  method: string,
  payload: unknown,
): Promise<OrganizationResult> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json()) as OrganizationResult;
  if (!response.ok) return { error: body.error ?? "Request failed." };
  return body;
}

export type OwnerFields = { name: string; email: string; password: string };

export function apiCreateOrganization(input: {
  name: string;
  slug: string;
  owner?: OwnerFields;
}) {
  return sendJson(ORGS_URL, "POST", input);
}

export function apiPublishOrganization(orgId: string) {
  return sendJson(`${ORGS_URL}/${orgId}`, "PATCH", { status: "live" });
}

export async function apiAddOwner(
  orgId: string,
  owner: OwnerFields,
): Promise<{ owner?: OrganizationOwner; error?: string }> {
  const response = await fetch(`${ORGS_URL}/${orgId}/owners`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(owner),
  });
  const body = (await response.json()) as { owner?: OrganizationOwner; error?: string };
  if (!response.ok) return { error: body.error ?? "Request failed." };
  return body;
}
