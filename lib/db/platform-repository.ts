import { getDocStore, type DocStore } from "@/lib/db/doc-store";
import { DEFAULT_ORG_ID, defaultOrganization } from "@/lib/organizations";
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

export async function listLiveOrganizations(): Promise<Organization[]> {
  const orgs = await (await readableStore()).find<Organization>("organizations", { status: "live" });
  return orgs.sort((a, b) => a.name.localeCompare(b.name));
}
