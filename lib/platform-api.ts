import type { Organization } from "@/lib/types";

type OrganizationResult = { organization?: Organization; error?: string };

const ORGS_URL = "/api/platform/organizations";

export async function fetchOrganizations(): Promise<Organization[]> {
  const response = await fetch(ORGS_URL, { cache: "no-store" });
  const body = (await response.json()) as {
    organizations?: Organization[];
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

export function apiCreateOrganization(input: { name: string; slug: string }) {
  return sendJson(ORGS_URL, "POST", input);
}

export function apiPublishOrganization(orgId: string) {
  return sendJson(`${ORGS_URL}/${orgId}`, "PATCH", { status: "live" });
}
