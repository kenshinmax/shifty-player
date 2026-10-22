import { describe, expect, it } from "vitest";
import {
  buildClinicEnrollment,
  buildPlayerTrend,
  sumPaidRevenue,
} from "@/lib/insights";
import { CLINIC_WEEKLY_FEE_USD } from "@/lib/programs";
import type { Player, Session } from "@/lib/types";

function session(overrides: Partial<Session> & Pick<Session, "id">): Session {
  return {
    programId: "p1",
    year: 2026,
    month: 7,
    status: "trending",
    available: true,
    capacity: 20,
    ...overrides,
  };
}

function player(overrides: Partial<Player> & Pick<Player, "id">): Player {
  return {
    name: overrides.id,
    email: `${overrides.id}@example.com`,
    grade: "5",
    level: "beginner",
    programIds: ["p1"],
    sessionIds: [],
    ...overrides,
  };
}

const sessions = [
  session({ id: "jul-w2", month: 7, week: 2 }),
  session({ id: "jul-w1", month: 7, week: 1 }),
  session({ id: "aug-w1", month: 8, week: 1, capacity: 0 }),
  session({ id: "other", programId: "p2", year: 2025, month: 12 }),
];

describe("buildPlayerTrend", () => {
  it("counts each player once per month, oldest month first", () => {
    const players = [
      player({ id: "a", sessionIds: ["jul-w1", "jul-w2"] }),
      player({ id: "b", sessionIds: ["jul-w1", "aug-w1"] }),
      player({ id: "c", sessionIds: ["other"] }),
    ];

    expect(buildPlayerTrend(players, sessions)).toEqual([
      { year: 2025, month: 12, label: "December", players: 1 },
      { year: 2026, month: 7, label: "July", players: 2 },
      { year: 2026, month: 8, label: "August", players: 1 },
    ]);
  });

  it("keeps only the most recent months", () => {
    const points = buildPlayerTrend([], sessions, 2);
    expect(points.map((point) => point.month)).toEqual([7, 8]);
  });

  it("returns no points when there are no sessions", () => {
    expect(buildPlayerTrend([player({ id: "a" })], [])).toEqual([]);
  });
});

describe("buildClinicEnrollment", () => {
  it("lists a program's clinics in order with enrollment and capacity", () => {
    const players = [
      player({ id: "a", sessionIds: ["jul-w1"] }),
      player({ id: "b", sessionIds: ["jul-w1", "aug-w1"] }),
    ];

    expect(
      buildClinicEnrollment({ players, sessions }, "p1").map(
        ({ sessionId, label, enrolled, capacity }) => ({
          sessionId,
          label,
          enrolled,
          capacity,
        }),
      ),
    ).toEqual([
      { sessionId: "jul-w1", label: "W1", enrolled: 2, capacity: 20 },
      { sessionId: "jul-w2", label: "W2", enrolled: 0, capacity: 20 },
      { sessionId: "aug-w1", label: "W1", enrolled: 1, capacity: 50 },
    ]);
  });

  it("prefers server seat counts", () => {
    const bars = buildClinicEnrollment(
      { players: [], sessions, seatCounts: { "jul-w1": 7 } },
      "p1",
    );
    expect(bars[0].enrolled).toBe(7);
  });
});

describe("sumPaidRevenue", () => {
  it("adds the Financials amount for paid players only", () => {
    const players = [
      player({
        id: "a",
        sessionIds: ["jul-w1", "jul-w2"],
        paymentLinkSentAt: "2026-07-01T00:00:00.000Z",
      }),
      player({ id: "b", sessionIds: ["jul-w1"] }),
    ];
    expect(sumPaidRevenue(players)).toBe(2 * CLINIC_WEEKLY_FEE_USD);
  });
});
