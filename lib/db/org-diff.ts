import type { OrgDocuments } from "@/lib/db/legacy-state";
import type { Child, Enrollment, Order, OrgProgram, OrgSession } from "@/lib/types";

export type Changes<T> = { upsert: T[]; remove: string[] };

export type OrgWriteOps = {
  programs: Changes<OrgProgram>;
  sessions: Changes<OrgSession>;
  children: Changes<Child>;
  /** remove -> set status "removed" (never deleted). */
  enrollments: Changes<Enrollment>;
  /** Orders are append-only: only ids absent from `before`; never updated or removed. */
  orders: { upsert: Order[] };
};

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, canonical(v)]),
    );
  }
  return value;
}

function sameDocument(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function diffCollection<T extends { id: string }>(before: T[], after: T[]): Changes<T> {
  const beforeById = new Map(before.map((d) => [d.id, d]));
  const afterIds = new Set(after.map((d) => d.id));
  return {
    upsert: after.filter((d) => {
      const prev = beforeById.get(d.id);
      return !prev || !sameDocument(prev, d);
    }),
    remove: before.filter((d) => !afterIds.has(d.id)).map((d) => d.id),
  };
}

export function diffOrgDocuments(before: OrgDocuments, after: OrgDocuments): OrgWriteOps {
  const knownOrders = new Set(before.orders.map((o) => o.id));
  return {
    programs: diffCollection(before.programs, after.programs),
    sessions: diffCollection(before.sessions, after.sessions),
    children: diffCollection(before.children, after.children),
    enrollments: diffCollection(before.enrollments, after.enrollments),
    orders: { upsert: after.orders.filter((o) => !knownOrders.has(o.id)) },
  };
}

export function isEmptyWriteOps(ops: OrgWriteOps): boolean {
  const collections = [ops.programs, ops.sessions, ops.children, ops.enrollments];
  return (
    collections.every((c) => c.upsert.length === 0 && c.remove.length === 0) &&
    ops.orders.upsert.length === 0
  );
}
