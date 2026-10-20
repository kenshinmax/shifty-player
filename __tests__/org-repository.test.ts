import { describe, expect, it } from "vitest";
import { createMemoryStore, type DocStore } from "@/lib/db/doc-store";
import type { OrgWriteOps } from "@/lib/db/org-diff";
import { forOrg } from "@/lib/db/org-repository";
import type { Child, Enrollment, Order, OrgProgram, OrgSession } from "@/lib/types";

const NOW = "2026-01-01T00:00:00.000Z";

function program(orgId: string, id = `p-${orgId}`): OrgProgram {
  return { id, orgId, name: `Program ${id}` } as unknown as OrgProgram;
}
function session(orgId: string, id = `s-${orgId}`): OrgSession {
  return { id, orgId, programId: `p-${orgId}` } as unknown as OrgSession;
}
function enrollment(orgId: string, childId: string, status: Enrollment["status"] = "pending"): Enrollment {
  return {
    id: `enr-${childId}-s-${orgId}`,
    orgId,
    childId,
    programId: `p-${orgId}`,
    sessionId: `s-${orgId}`,
    status,
    createdAt: NOW,
  };
}
function order(orgId: string): Order {
  return {
    id: `ord-${orgId}`,
    orgId,
    childId: `c-${orgId}`,
    sessionId: `s-${orgId}`,
    items: [],
    tuitionCents: 100,
    swagCents: 0,
    totalCents: 100,
    platformFeeCents: 0,
    paidAt: NOW,
  };
}
function child(id: string, extra: Partial<Child> = {}): Child {
  return { id, name: id, email: `${id}@x.com`, grade: "5", level: "beginner", ...extra } as Child;
}
function emptyOps(): OrgWriteOps {
  return {
    programs: { upsert: [], remove: [] },
    sessions: { upsert: [], remove: [] },
    children: { upsert: [], remove: [] },
    enrollments: { upsert: [], remove: [] },
    orders: { upsert: [] },
  };
}

function seeded(): DocStore {
  return createMemoryStore({
    programs: [program("o1"), program("o2")],
    sessions: [session("o1"), session("o2")],
    enrollments: [enrollment("o1", "c-o1"), enrollment("o2", "c-o2")],
    orders: [order("o1"), order("o2")],
    children: [child("c-o1"), child("c-o2")],
  });
}

async function snapshot(store: DocStore) {
  return {
    programs: await store.find("programs", { orgId: "o2" }),
    sessions: await store.find("sessions", { orgId: "o2" }),
    enrollments: await store.find("enrollments", { orgId: "o2" }),
    orders: await store.find("orders", { orgId: "o2" }),
  };
}

describe("org repository", () => {
  it("loadOrgDocuments returns only this org's docs and excludes removed enrollments", async () => {
    const store = seeded();
    await store.insertOne("enrollments", enrollment("o1", "gone", "removed"));
    const docs = await forOrg("o1", store).loadOrgDocuments();
    expect(docs.programs.map((p) => p.id)).toEqual(["p-o1"]);
    expect(docs.sessions.map((s) => s.id)).toEqual(["s-o1"]);
    expect(docs.enrollments.map((e) => e.id)).toEqual(["enr-c-o1-s-o1"]);
    expect(docs.orders.map((o) => o.id)).toEqual(["ord-o1"]);
  });

  it("applyWrites never touches the other org", async () => {
    const store = seeded();
    const before = await snapshot(store);
    const ops = emptyOps();
    ops.programs = { upsert: [program("o1", "p-new")], remove: ["p-o1"] };
    ops.sessions = { upsert: [session("o1", "s-new")], remove: ["s-o1"] };
    ops.enrollments = { upsert: [enrollment("o1", "c-new")], remove: ["enr-c-o1-s-o1"] };
    ops.orders = { upsert: [{ ...order("o1"), id: "ord-new" }] };
    ops.children = { upsert: [child("c-new")], remove: ["c-o1"] };
    await forOrg("o1", store).applyWrites(ops);
    expect(await snapshot(store)).toEqual(before);
    expect((await store.find("programs", { orgId: "o1" })).map((p) => (p as OrgProgram).id)).toEqual(["p-new"]);
  });

  it("rejects a doc stamped with another orgId and writes nothing", async () => {
    const store = seeded();
    const ops = emptyOps();
    ops.programs.upsert = [program("o1", "p-fine"), program("o2", "p-bad")];
    ops.sessions.upsert = [session("o1", "s-fine")];
    await expect(forOrg("o1", store).applyWrites(ops)).rejects.toThrow(
      "Document belongs to another organization.",
    );
    expect(await store.count("programs")).toBe(2);
    expect(await store.count("sessions")).toBe(2);
  });

  it("cannot overwrite another org's record by id", async () => {
    const store = seeded();
    const ops = emptyOps();
    ops.programs.upsert = [program("o1", "p-o2")];
    await expect(forOrg("o1", store).applyWrites(ops)).rejects.toThrow();
    expect(await store.findOne("programs", { id: "p-o2" })).toMatchObject({ orgId: "o2" });
  });

  it("removing an enrollment marks it removed; upserting it again revives it", async () => {
    const store = seeded();
    const repo = forOrg("o1", store);
    const id = "enr-c-o1-s-o1";
    const remove = emptyOps();
    remove.enrollments.remove = [id];
    await repo.applyWrites(remove);
    expect(await store.findOne("enrollments", { id })).toMatchObject({ status: "removed" });
    expect((await repo.loadOrgDocuments()).enrollments).toEqual([]);

    const revive = emptyOps();
    revive.enrollments.upsert = [enrollment("o1", "c-o1", "paid")];
    await repo.applyWrites(revive);
    expect(await store.findOne("enrollments", { id })).toMatchObject({ status: "paid" });
    expect((await repo.loadOrgDocuments()).enrollments).toHaveLength(1);
  });

  it("removing a child deletes it and removes its enrollments in this org", async () => {
    const store = seeded();
    const ops = emptyOps();
    ops.children.remove = ["c-o1"];
    await forOrg("o1", store).applyWrites(ops);
    expect(await store.findOne("children", { id: "c-o1" })).toBeNull();
    expect(await store.findOne("enrollments", { id: "enr-c-o1-s-o1" })).toMatchObject({ status: "removed" });
    expect(await store.findOne("enrollments", { id: "enr-c-o2-s-o2" })).toMatchObject({ status: "pending" });
  });

  it("roster applies the visibility rule", async () => {
    const store = createMemoryStore({
      children: [
        child("c1"),
        child("c2"),
        child("c3", { createdByOrgId: "o1" }),
        child("c4"),
      ],
      enrollments: [
        enrollment("o1", "c1"),
        enrollment("o1", "c2", "removed"),
        enrollment("o2", "c4"),
      ],
    });
    const roster = await forOrg("o1", store).roster();
    expect(roster.map((c) => c.id)).toEqual(["c1", "c3"]);
  });

  it("cannot replace or delete a child enrolled only with another org", async () => {
    const store = createMemoryStore({
      children: [child("c4")],
      enrollments: [enrollment("o2", "c4")],
    });
    const before = await store.findOne("children", { id: "c4" });

    const upsert = emptyOps();
    upsert.children.upsert = [child("c4", { name: "Hijacked" })];
    await expect(forOrg("o1", store).applyWrites(upsert)).rejects.toThrow(
      "Child belongs to another organization.",
    );

    const remove = emptyOps();
    remove.children.remove = ["c4"];
    await expect(forOrg("o1", store).applyWrites(remove)).rejects.toThrow(
      "Child belongs to another organization.",
    );

    expect(await store.findOne("children", { id: "c4" })).toEqual(before);
    expect(await store.findOne("enrollments", { childId: "c4" })).toMatchObject({ status: "pending" });
  });

  it("rejects the whole batch before writing anything", async () => {
    const store = createMemoryStore({
      children: [child("c4")],
      enrollments: [enrollment("o2", "c4")],
    });
    const ops = emptyOps();
    ops.programs.upsert = [program("o1", "p-fine")];
    ops.children.upsert = [child("c4", { name: "Hijacked" })];
    await expect(forOrg("o1", store).applyWrites(ops)).rejects.toThrow(
      "Child belongs to another organization.",
    );
    expect(await store.count("programs")).toBe(0);
  });

  it("may write a child when the same batch enrolls it here", async () => {
    const store = createMemoryStore({
      children: [child("c4")],
      enrollments: [enrollment("o2", "c4")],
    });
    const ops = emptyOps();
    ops.children.upsert = [child("c4", { paymentLinkSentAt: NOW })];
    ops.enrollments.upsert = [enrollment("o1", "c4", "paid")];
    await forOrg("o1", store).applyWrites(ops);
    expect(await store.findOne("children", { id: "c4" })).toMatchObject({ paymentLinkSentAt: NOW });
    expect(await store.findOne("enrollments", { orgId: "o1", childId: "c4" })).toMatchObject({
      status: "paid",
    });
  });

  it("may write a new child or one this org created", async () => {
    const store = createMemoryStore({ children: [child("mine", { createdByOrgId: "o1" })] });
    const ops = emptyOps();
    ops.children.upsert = [child("brand-new"), child("mine", { createdByOrgId: "o1", name: "Renamed" })];
    await forOrg("o1", store).applyWrites(ops);
    expect(await store.count("children")).toBe(2);
    expect(await store.findOne("children", { id: "mine" })).toMatchObject({ name: "Renamed" });
  });

  it("markEnrollmentPaid sets status, paidAt and stripePaymentIntentId; false for an unknown id or another org's id", async () => {
    const store = seeded();
    const repo = forOrg("o1", store);
    expect(await repo.markEnrollmentPaid("enr-c-o1-s-o1", NOW, "pi_1")).toBe(true);
    expect(await store.findOne("enrollments", { id: "enr-c-o1-s-o1" })).toMatchObject({
      status: "paid",
      paidAt: NOW,
      stripePaymentIntentId: "pi_1",
    });
    expect(await repo.markEnrollmentPaid("nope", NOW)).toBe(false);
    expect(await repo.markEnrollmentPaid("enr-c-o2-s-o2", NOW, "pi_2")).toBe(false);
    expect(await store.findOne("enrollments", { id: "enr-c-o2-s-o2" })).toMatchObject({ status: "pending" });
  });

  it("markEnrollmentPaid leaves stripePaymentIntentId untouched when omitted", async () => {
    const store = seeded();
    await forOrg("o1", store).markEnrollmentPaid("enr-c-o1-s-o1", NOW);
    const doc = await store.findOne<Enrollment>("enrollments", { id: "enr-c-o1-s-o1" });
    expect(doc?.status).toBe("paid");
    expect(doc?.stripePaymentIntentId).toBeUndefined();
  });

  it("clearOrgDocuments removes only this org's docs", async () => {
    const store = seeded();
    await forOrg("o1", store).clearOrgDocuments();
    expect(await store.count("programs", { orgId: "o1" })).toBe(0);
    expect(await store.count("enrollments", { orgId: "o1" })).toBe(0);
    expect(await store.count("orders", { orgId: "o1" })).toBe(0);
    expect(await snapshot(store)).toMatchObject({ programs: [expect.anything()] });
    expect(await store.count("children")).toBe(2);
  });
});
