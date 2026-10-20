import { beforeEach, describe, expect, it } from "vitest";
import { getDocStore, resetMemoryStore } from "@/lib/db/doc-store";
import { addChild, childrenForParent, organizationsForParent } from "@/lib/db/family-repository";
import { defaultOrganization } from "@/lib/organizations";
import type { Enrollment, Organization } from "@/lib/types";

const NOW = "2026-01-01T00:00:00.000Z";

function org(id: string, name: string, status: Organization["status"] = "live"): Organization {
  return { ...defaultOrganization(), id, slug: id, name, status };
}
function enrollment(orgId: string, childId: string, status: Enrollment["status"]): Enrollment {
  return {
    id: `enr-${childId}-${orgId}`,
    orgId,
    childId,
    programId: `p-${orgId}`,
    sessionId: `s-${orgId}`,
    status,
    createdAt: NOW,
  };
}

describe("family repository", () => {
  beforeEach(() => resetMemoryStore({}));

  it("rejects invalid child input", async () => {
    const result = await addChild("u1", "P@Example.com", { name: " ", grade: "5", level: "beginner" });
    expect(result).toEqual({ error: "Name is required." });
  });

  it("adds a child and lists it for the parent only", async () => {
    const result = await addChild("u1", "P@Example.com", { name: "Sam", grade: "5", level: "beginner" });
    if (!("child" in result)) throw new Error("expected child");
    expect(result.child.email).toBe("p@example.com");
    expect(result.child.parentUserId).toBe("u1");
    expect(result.child.id).toMatch(/^player-/);
    expect(result.child.avatarUrl).toContain("seed=Sam");
    expect((await childrenForParent("u1")).map((c) => c.id)).toEqual([result.child.id]);
    expect(await childrenForParent("u2")).toEqual([]);
  });

  it("lists live orgs where a child has a non-removed enrollment", async () => {
    const store = getDocStore();
    await store.insertOne("organizations", org("o1", "Beta"));
    await store.insertOne("organizations", org("o2", "Alpha"));
    await store.insertOne("organizations", org("o3", "Gamma", "suspended"));
    const result = await addChild("u1", "p@example.com", { name: "Sam", grade: "5", level: "beginner" });
    if (!("child" in result)) throw new Error("expected child");
    const id = result.child.id;
    await store.insertOne("enrollments", enrollment("o1", id, "pending"));
    await store.insertOne("enrollments", { ...enrollment("o1", id, "paid"), id: "dup" });
    await store.insertOne("enrollments", enrollment("o2", id, "removed"));
    await store.insertOne("enrollments", enrollment("o3", id, "paid"));
    expect((await organizationsForParent("u1")).map((o) => o.id)).toEqual(["o1"]);
    expect(await organizationsForParent("u2")).toEqual([]);
  });
});
