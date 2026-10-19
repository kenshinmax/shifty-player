import { describe, expect, it } from "vitest";
import {
  assembleLegacyState,
  enrollmentId,
  splitLegacyState,
  type OrgDocuments,
} from "@/lib/db/legacy-state";
import { sampleData } from "@/lib/sample-data";
import { normalizeRegistrationState } from "@/lib/storage";
import type { AppState, Order, Player } from "@/lib/types";

const NOW = "2026-01-01T00:00:00.000Z";
const ORG = "org-x";
const CLINIC = "clinic-summer-2026-w1";
const PAID_AT = "2026-03-01T10:00:00.000Z";

const merchandiseOrder: NonNullable<Player["merchandiseOrder"]> = {
  clinicId: CLINIC,
  items: [{ skuId: "tee", name: "Tee", size: "M", quantity: 1, unitCents: 2500 }],
  tuitionCents: 15000,
  swagCents: 2500,
  totalCents: 17500,
  paidAt: PAID_AT,
};

function stateWithOrder(): AppState {
  const base = normalizeRegistrationState(sampleData);
  return {
    ...base,
    players: base.players.map((p) =>
      p.id === "player-1"
        ? {
            ...p,
            programIds: [...p.programIds, "program-summer-2026"],
            sessionIds: [...p.sessionIds, CLINIC],
            merchandiseOrder,
          }
        : p,
    ),
  };
}

describe("legacy state adapter", () => {
  it("round-trips sample data", () => {
    const state = normalizeRegistrationState(sampleData);
    const docs = splitLegacyState(state, ORG, undefined, NOW);
    expect(assembleLegacyState(docs)).toEqual(state);
  });

  it("round-trips a state with a merchandise order", () => {
    const state = normalizeRegistrationState(stateWithOrder());
    const docs = splitLegacyState(state, ORG, undefined, NOW);
    expect(assembleLegacyState(docs)).toEqual(state);
  });

  it("stamps orgId on programs, sessions, enrollments and orders", () => {
    const docs = splitLegacyState(stateWithOrder(), ORG, undefined, NOW);
    for (const list of [docs.programs, docs.sessions, docs.enrollments, docs.orders]) {
      expect(list.length).toBeGreaterThan(0);
      expect(list.every((d) => d.orgId === ORG)).toBe(true);
    }
  });

  it("child without parent is created by the org", () => {
    const docs = splitLegacyState(sampleData, ORG, undefined, NOW);
    const p1 = docs.children.find((c) => c.id === "player-1")!;
    const kid = docs.children.find((c) => c.id === "player-child-1")!;
    expect(p1.createdByOrgId).toBe(ORG);
    expect("createdByOrgId" in kid).toBe(false);
    expect(kid.parentUserId).toBe("user-1");
  });

  it("enrollment ids are deterministic", () => {
    expect(enrollmentId("player-1", "session-2026-01")).toBe("enr-player-1-session-2026-01");
    const docs = splitLegacyState(sampleData, ORG, undefined, NOW);
    expect(docs.enrollments.some((e) => e.id === "enr-player-1-session-2026-01")).toBe(true);
  });

  it("order clinic marks enrollment paid", () => {
    const docs = splitLegacyState(stateWithOrder(), ORG, undefined, NOW);
    const mine = docs.enrollments.filter((e) => e.childId === "player-1");
    const paid = mine.find((e) => e.sessionId === CLINIC)!;
    expect(paid.status).toBe("paid");
    expect(paid.paidAt).toBe(PAID_AT);
    expect(mine.filter((e) => e.sessionId !== CLINIC).every((e) => e.status === "pending")).toBe(true);
    expect(docs.orders).toHaveLength(1);
    expect(docs.orders[0].id).toBe(`ord-player-1-${CLINIC}-${Date.parse(PAID_AT)}`);
    expect(docs.orders[0].platformFeeCents).toBe(0);
  });

  it("existing enrollment fields are preserved", () => {
    const first = splitLegacyState(sampleData, ORG, undefined, NOW);
    const target = first.enrollments.find((e) => e.id === "enr-player-1-session-2026-01")!;
    const existing: OrgDocuments = {
      ...first,
      enrollments: [
        {
          ...target,
          status: "paid",
          paidAt: "2025-12-01T00:00:00.000Z",
          stripePaymentIntentId: "pi_9",
          createdAt: "2020-01-01T00:00:00.000Z",
        },
      ],
    };
    const docs = splitLegacyState(sampleData, ORG, existing, "2030-01-01T00:00:00.000Z");
    const e = docs.enrollments.find((x) => x.id === target.id)!;
    expect(e.status).toBe("paid");
    expect(e.stripePaymentIntentId).toBe("pi_9");
    expect(e.createdAt).toBe("2020-01-01T00:00:00.000Z");
    expect(e.paidAt).toBe("2025-12-01T00:00:00.000Z");
  });

  it("drops sessionIds whose session does not exist", () => {
    const state: AppState = {
      ...sampleData,
      players: [{ ...sampleData.players[0], sessionIds: ["session-2026-01", "ghost"] }],
    };
    const docs = splitLegacyState(state, ORG, undefined, NOW);
    expect(docs.enrollments.map((e) => e.sessionId)).toEqual(["session-2026-01"]);
  });

  it("carries unreferenced existing orders into the result unchanged", () => {
    const orphan: Order = {
      id: "ord-gone-clinic-1",
      orgId: ORG,
      childId: "gone",
      sessionId: "clinic-x",
      items: [],
      tuitionCents: 1,
      swagCents: 0,
      totalCents: 1,
      platformFeeCents: 0,
      paidAt: "2025-01-01T00:00:00.000Z",
    };
    const existing: OrgDocuments = {
      programs: [], sessions: [], children: [], enrollments: [], orders: [orphan],
    };
    const docs = splitLegacyState(stateWithOrder(), ORG, existing, NOW);
    expect(docs.orders).toHaveLength(2);
    expect(docs.orders[0]).toBe(orphan);
    expect(docs.orders[1].childId).toBe("player-1");
    // deterministic
    expect(splitLegacyState(stateWithOrder(), ORG, existing, NOW)).toEqual(docs);
  });

  it("keeps the payment link flag of a player with no registrations", () => {
    const base = normalizeRegistrationState(sampleData);
    const state = normalizeRegistrationState({
      ...base,
      players: base.players.map((p) =>
        p.id === "player-1"
          ? { ...p, programIds: [], sessionIds: [], paymentLinkSentAt: PAID_AT }
          : p,
      ),
    });
    const docs = splitLegacyState(state, ORG, undefined, NOW);
    expect(docs.children.find((c) => c.id === "player-1")?.paymentLinkSentAt).toBe(PAID_AT);
    expect(assembleLegacyState(docs)).toEqual(state);
  });

  it("uses the latest of the child and active enrollment link dates", () => {
    const docs = splitLegacyState(normalizeRegistrationState(sampleData), ORG, undefined, NOW);
    const later = "2027-01-01T00:00:00.000Z";
    const child = docs.children.find((c) => c.id === "player-1")!;
    child.paymentLinkSentAt = "2025-01-01T00:00:00.000Z";
    for (const e of docs.enrollments) {
      if (e.childId === "player-1") e.paymentLinkSentAt = later;
    }
    const player = assembleLegacyState(docs).players.find((p) => p.id === "player-1")!;
    expect(player.paymentLinkSentAt).toBe(later);
  });
});
