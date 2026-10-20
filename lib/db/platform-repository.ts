import { getDocStore, type DocStore } from "@/lib/db/doc-store";
import { DEFAULT_ORG_ID, defaultOrganization } from "@/lib/organizations";
import { validateSlug } from "@/lib/slug";
import type { Organization } from "@/lib/types";

/** Creates the default org doc if absent; an existing one is left untouched. */
export async function ensureDefaultOrganization(store: DocStore = getDocStore()): Promise<void> {
  // Reads run on every request, so only attempt the insert when the doc is missing.
  if (await store.findOne<Organization>("organizations", { id: DEFAULT_ORG_ID })) return;
  // false means a concurrent request inserted it first, which is fine.
  await store.insertOne("organizations", defaultOrganization());
}

async function readableStore(): Promise<DocStore> {
  const store = getDocStore();
  await ensureDefaultOrganization(store);
  return store;
}

export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  return (await readableStore()).findOne<Organization>("organizations", { slug });
}

export async function getOrganizationById(id: string): Promise<Organization | null> {
  return (await readableStore()).findOne<Organization>("organizations", { id });
}

function byName(a: Organization, b: Organization): number {
  return a.name.localeCompare(b.name);
}

export async function listLiveOrganizations(): Promise<Organization[]> {
  const orgs = await (await readableStore()).find<Organization>("organizations", { status: "live" });
  return orgs.sort(byName);
}

/** Every org regardless of status — for admin screens only. */
export async function listAllOrganizations(): Promise<Organization[]> {
  const orgs = await (await readableStore()).find<Organization>("organizations");
  return orgs.sort(byName);
}

export type OrganizationInput = { name: string; slug: string };

/** Creates a draft org; it stays hidden from the public until published. */
export async function createOrganization(
  input: OrganizationInput,
): Promise<{ organization: Organization } | { error: string }> {
  const name = input.name.trim();
  const slug = input.slug.trim();
  if (!name) return { error: "Name is required." };
  const slugError = validateSlug(slug);
  if (slugError) return { error: slugError };

  const store = await readableStore();
  if (await store.findOne<Organization>("organizations", { slug })) {
    return { error: "That URL is taken." };
  }
  const organization: Organization = {
    id: `org-${crypto.randomUUID()}`,
    slug,
    name,
    status: "draft",
    stripeChargesEnabled: false,
    platformFeeBps: 0,
    hubspotEnabled: false,
    createdAt: new Date().toISOString(),
  };
  await store.insertOne("organizations", organization);
  return { organization };
}

export async function publishOrganization(
  id: string,
): Promise<{ organization: Organization } | { error: string }> {
  const store = await readableStore();
  const existing = await store.findOne<Organization>("organizations", { id });
  if (!existing) return { error: "Organization not found." };
  if (existing.status !== "draft") {
    return { error: "Only draft organizations can be published." };
  }
  const organization: Organization = {
    ...existing,
    status: "live",
    approvedAt: new Date().toISOString(),
  };
  await store.replaceOne("organizations", { id }, organization);
  return { organization };
}
