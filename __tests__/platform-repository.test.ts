import { beforeEach, describe, expect, it } from "vitest";
import { getDocStore, resetMemoryStore } from "@/lib/db/doc-store";
import {
  getOrganizationById,
  getOrganizationBySlug,
  listLiveOrganizations,
} from "@/lib/db/platform-repository";
import { DEFAULT_ORG_ID, DEFAULT_ORG_SLUG, defaultOrganization } from "@/lib/organizations";
import type { Organization } from "@/lib/types";

function org(id: string, name: string, status: Organization["status"]): Organization {
  return { ...defaultOrganization(), id, slug: id, name, status };
}

describe("platform repository", () => {
  beforeEach(() => resetMemoryStore({}));

  it("finds the default org by slug and id, creating it on demand", async () => {
    expect((await getOrganizationBySlug(DEFAULT_ORG_SLUG))?.id).toBe(DEFAULT_ORG_ID);
    expect((await getOrganizationById(DEFAULT_ORG_ID))?.slug).toBe(DEFAULT_ORG_SLUG);
  });

  it("returns null for an unknown slug or id", async () => {
    expect(await getOrganizationBySlug("nope")).toBeNull();
    expect(await getOrganizationById("nope")).toBeNull();
  });

  it("lists only live orgs sorted by name", async () => {
    const store = getDocStore();
    await store.insertOne("organizations", org("o-z", "Zeta", "live"));
    await store.insertOne("organizations", org("o-a", "Alpha", "live"));
    await store.insertOne("organizations", org("o-d", "Draft Co", "draft"));
    await store.insertOne("organizations", org("o-s", "Suspended Co", "suspended"));
    const names = (await listLiveOrganizations()).map((o) => o.name);
    expect(names).toEqual(["Alpha", "Shifty Player", "Zeta"]);
  });
});
