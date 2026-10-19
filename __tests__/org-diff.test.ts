import { describe, expect, it } from "vitest";
import { splitLegacyState, type OrgDocuments } from "@/lib/db/legacy-state";
import { diffOrgDocuments, isEmptyWriteOps } from "@/lib/db/org-diff";
import { sampleData } from "@/lib/sample-data";
import { normalizeRegistrationState } from "@/lib/storage";
import type { AppState, Player } from "@/lib/types";

const NOW = "2026-01-01T00:00:00.000Z";
const ORG = "org-x";
const CLINIC = "clinic-summer-2026-w1";

function baseDocs(): OrgDocuments {
  const base = normalizeRegistrationState(sampleData);
  const order: NonNullable<Player["merchandiseOrder"]> = {
    clinicId: CLINIC,
    items: [{ skuId: "tee", name: "Tee", size: "M", quantity: 1, unitCents: 2500 }],
    tuitionCents: 15000,
    swagCents: 2500,
    totalCents: 17500,
    paidAt: "2026-03-01T10:00:00.000Z",
  };
  const state: AppState = {
    ...base,
    players: base.players.map((p) =>
      p.id === "player-1"
        ? {
            ...p,
            programIds: [...p.programIds, "program-summer-2026"],
            sessionIds: [...p.sessionIds, CLINIC],
            merchandiseOrder: order,
          }
        : p,
    ),
  };
  return splitLegacyState(state, ORG, undefined, NOW);
}

function clone(docs: OrgDocuments): OrgDocuments {
  return structuredClone(docs);
}

describe("diffOrgDocuments", () => {
  it("no changes yields empty ops", () => {
    const ops = diffOrgDocuments(baseDocs(), baseDocs());
    expect(isEmptyWriteOps(ops)).toBe(true);
  });

  it("key order does not count as a change", () => {
    const before = baseDocs();
    const after = clone(before);
    after.programs = after.programs.map((p) => Object.fromEntries(Object.entries(p).reverse()) as typeof p);
    expect(isEmptyWriteOps(diffOrgDocuments(before, after))).toBe(true);
  });

  it("updated program is upserted, others untouched", () => {
    const before = baseDocs();
    const after = clone(before);
    after.programs[0] = { ...after.programs[0], name: "Renamed" };
    const ops = diffOrgDocuments(before, after);
    expect(ops.programs.upsert).toEqual([after.programs[0]]);
    expect(ops.programs.remove).toEqual([]);
    expect(ops.sessions).toEqual({ upsert: [], remove: [] });
    expect(ops.children).toEqual({ upsert: [], remove: [] });
    expect(ops.enrollments).toEqual({ upsert: [], remove: [] });
    expect(ops.orders.upsert).toEqual([]);
  });

  it("missing session is removed", () => {
    const before = baseDocs();
    const after = clone(before);
    const gone = after.sessions.pop()!;
    const ops = diffOrgDocuments(before, after);
    expect(ops.sessions.remove).toEqual([gone.id]);
    expect(ops.sessions.upsert).toEqual([]);
  });

  it("new session is upserted", () => {
    const before = baseDocs();
    const after = clone(before);
    const added = { ...after.sessions[0], id: "session-new" };
    after.sessions.push(added);
    const ops = diffOrgDocuments(before, after);
    expect(ops.sessions.upsert).toEqual([added]);
    expect(ops.sessions.remove).toEqual([]);
  });

  it("dropped enrollment is listed for removal", () => {
    const before = baseDocs();
    const after = clone(before);
    const dropped = after.enrollments.pop()!;
    const ops = diffOrgDocuments(before, after);
    expect(ops.enrollments.remove).toEqual([dropped.id]);
    expect(ops.enrollments.upsert).toEqual([]);
  });

  it("re-added enrollment is upserted", () => {
    const after = baseDocs();
    const before = clone(after);
    const readded = before.enrollments.pop()!;
    const ops = diffOrgDocuments(before, after);
    expect(ops.enrollments.upsert).toEqual([readded]);
    expect(ops.enrollments.remove).toEqual([]);
  });

  it("orders are never removed", () => {
    const before = baseDocs();
    const after = clone(before);
    const order = after.orders[0];
    after.orders = after.orders.slice(1);
    after.enrollments = after.enrollments.filter((e) => e.childId !== order.childId);
    after.children = after.children.filter((c) => c.id !== order.childId);
    const ops = diffOrgDocuments(before, after);
    expect(ops.children.remove).toEqual([order.childId]);
    expect("remove" in ops.orders).toBe(false);
    expect(ops.orders.upsert).toEqual([]);
  });

  it("new order is upserted but a changed existing order is not", () => {
    const before = baseDocs();
    const after = clone(before);
    after.orders[0] = { ...after.orders[0], totalCents: 1 };
    expect(diffOrgDocuments(before, after).orders.upsert).toEqual([]);

    const added = { ...before.orders[0], id: "ord-new" };
    after.orders.push(added);
    expect(diffOrgDocuments(before, after).orders.upsert).toEqual([added]);
  });
});
