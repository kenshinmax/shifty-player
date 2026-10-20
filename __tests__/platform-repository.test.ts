import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDocStore, resetMemoryStore } from "@/lib/db/doc-store";
import {
  createOrganization,
  getOrganizationById,
  getOrganizationBySlug,
  listAllOrganizations,
  listLiveOrganizations,
  publishOrganization,
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

  it("only inserts the default org when it is missing", async () => {
    const store = getDocStore();
    const insertOne = vi.spyOn(store, "insertOne");
    await getOrganizationById(DEFAULT_ORG_ID);
    await getOrganizationBySlug(DEFAULT_ORG_SLUG);
    await listLiveOrganizations();
    expect(insertOne).toHaveBeenCalledTimes(1);
    insertOne.mockRestore();
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

  it("lists every org, drafts included, sorted by name", async () => {
    const store = getDocStore();
    await store.insertOne("organizations", org("o-d", "Draft Co", "draft"));
    await store.insertOne("organizations", org("o-a", "Alpha", "live"));
    const names = (await listAllOrganizations()).map((o) => o.name);
    expect(names).toEqual(["Alpha", "Draft Co", "Shifty Player"]);
  });

  it("creates a draft org with a trimmed name", async () => {
    const result = await createOrganization({ name: "  Bay Hoops ", slug: "bay-hoops" });
    if ("error" in result) throw new Error(result.error);
    expect(result.organization).toMatchObject({
      name: "Bay Hoops",
      slug: "bay-hoops",
      status: "draft",
      stripeChargesEnabled: false,
      platformFeeBps: 0,
      hubspotEnabled: false,
    });
    expect(result.organization.id).toMatch(/^org-/);
    expect(await getOrganizationBySlug("bay-hoops")).toEqual(result.organization);
    expect((await listLiveOrganizations()).map((o) => o.slug)).not.toContain("bay-hoops");
  });

  it("rejects a missing name, a bad slug, a reserved slug and a taken slug", async () => {
    expect(await createOrganization({ name: " ", slug: "bay-hoops" })).toEqual({
      error: "Name is required.",
    });
    expect(await createOrganization({ name: "Bay", slug: "Bay Hoops" })).toEqual({
      error: "Use 3–40 lowercase letters, numbers and single dashes.",
    });
    expect(await createOrganization({ name: "Admin", slug: "admin" })).toEqual({
      error: "That URL is reserved.",
    });
    expect(await createOrganization({ name: "Copy", slug: DEFAULT_ORG_SLUG })).toEqual({
      error: "That URL is taken.",
    });
    expect(await listAllOrganizations()).toHaveLength(1);
  });

  it("publishes a draft org", async () => {
    const created = await createOrganization({ name: "Bay Hoops", slug: "bay-hoops" });
    if ("error" in created) throw new Error(created.error);
    const result = await publishOrganization(created.organization.id);
    if ("error" in result) throw new Error(result.error);
    expect(result.organization.status).toBe("live");
    expect(result.organization.approvedAt).toEqual(expect.any(String));
    expect((await listLiveOrganizations()).map((o) => o.slug)).toContain("bay-hoops");
  });

  it("does not publish an unknown or suspended org", async () => {
    await getDocStore().insertOne("organizations", org("o-s", "Suspended Co", "suspended"));
    expect(await publishOrganization("nope")).toEqual({ error: "Organization not found." });
    expect(await publishOrganization("o-s")).toEqual({
      error: "Only draft organizations can be published.",
    });
  });
});
