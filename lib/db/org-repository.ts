import { getDocStore, type DocStore } from "@/lib/db/doc-store";
import type { OrgDocuments } from "@/lib/db/legacy-state";
import type { OrgWriteOps } from "@/lib/db/org-diff";
import type { Child, Enrollment, Order, OrgProgram, OrgSession } from "@/lib/types";

export type OrgRepository = {
  orgId: string;
  /** programs, sessions, active enrollments and orders of this org. */
  loadOrgDocuments(): Promise<Omit<OrgDocuments, "children">>;
  /** Children visible to this org: a non-removed enrollment here, or createdByOrgId === orgId. */
  roster(): Promise<Child[]>;
  applyWrites(ops: OrgWriteOps): Promise<void>;
  markEnrollmentPaid(id: string, paidAt: string, stripePaymentIntentId?: string): Promise<boolean>;
  /** Removes every org-owned doc of this org (programs, sessions, enrollments, orders). Seed only. */
  clearOrgDocuments(): Promise<void>;
};

export function forOrg(orgId: string, store: DocStore = getDocStore()): OrgRepository {
  const mine = { orgId };

  function assertOwned(docs: readonly { orgId: string }[]): void {
    if (docs.some((d) => d.orgId !== orgId)) {
      throw new Error("Document belongs to another organization.");
    }
  }

  return {
    orgId,

    async loadOrgDocuments() {
      const [programs, sessions, enrollments, orders] = await Promise.all([
        store.find<OrgProgram>("programs", mine),
        store.find<OrgSession>("sessions", mine),
        store.find<Enrollment>("enrollments", mine),
        store.find<Order>("orders", mine),
      ]);
      return {
        programs,
        sessions,
        enrollments: enrollments.filter((e) => e.status !== "removed"),
        orders,
      };
    },

    async roster() {
      const enrollments = await store.find<Enrollment>("enrollments", mine);
      const enrolled = new Set(
        enrollments.filter((e) => e.status !== "removed").map((e) => e.childId),
      );
      const children = await store.find<Child>("children");
      return children.filter((c) => enrolled.has(c.id) || c.createdByOrgId === orgId);
    },

    async applyWrites(ops) {
      // Validate everything first so a rejected batch writes nothing.
      assertOwned(ops.programs.upsert);
      assertOwned(ops.sessions.upsert);
      assertOwned(ops.enrollments.upsert);
      assertOwned(ops.orders.upsert);

      for (const doc of ops.programs.upsert) {
        await store.replaceOne("programs", { orgId, id: doc.id }, doc);
      }
      for (const doc of ops.sessions.upsert) {
        await store.replaceOne("sessions", { orgId, id: doc.id }, doc);
      }
      for (const doc of ops.children.upsert) {
        await store.replaceOne("children", { id: doc.id }, doc);
      }
      for (const doc of ops.enrollments.upsert) {
        await store.replaceOne("enrollments", { orgId, id: doc.id }, doc);
      }
      for (const doc of ops.orders.upsert) {
        await store.replaceOne("orders", { orgId, id: doc.id }, doc);
      }

      if (ops.programs.remove.length) {
        await store.deleteMany("programs", { orgId, id: { $in: ops.programs.remove } });
      }
      if (ops.sessions.remove.length) {
        await store.deleteMany("sessions", { orgId, id: { $in: ops.sessions.remove } });
      }
      if (ops.children.remove.length) {
        await store.deleteMany("children", { id: { $in: ops.children.remove } });
        await store.updateMany(
          "enrollments",
          { orgId, childId: { $in: ops.children.remove } },
          { status: "removed" },
        );
      }
      if (ops.enrollments.remove.length) {
        await store.updateMany(
          "enrollments",
          { orgId, id: { $in: ops.enrollments.remove } },
          { status: "removed" },
        );
      }
    },

    async markEnrollmentPaid(id, paidAt, stripePaymentIntentId) {
      const matched = await store.updateMany(
        "enrollments",
        { orgId, id },
        {
          status: "paid",
          paidAt,
          ...(stripePaymentIntentId !== undefined ? { stripePaymentIntentId } : {}),
        },
      );
      return matched > 0;
    },

    async clearOrgDocuments() {
      await store.deleteMany("programs", mine);
      await store.deleteMany("sessions", mine);
      await store.deleteMany("enrollments", mine);
      await store.deleteMany("orders", mine);
    },
  };
}
