import { describe, expect, it } from "vitest";
import {
  formatClinicLabel,
  formatProgramTimeframe,
  getActiveProgramsForPlayer,
  getAvailableClinicsForProgram,
  getClinicCapacity,
  getClinicPriceUsd,
  getClinicsForProgram,
  getOpenPrograms,
  getRemainingClinicSpots,
  buildSeatCounts,
  seatsTaken,
  CLINIC_WEEKLY_FEE_USD,
} from "@/lib/programs";
import { sampleData } from "@/lib/sample-data";
import { DEFAULT_CLINIC_CAPACITY, type Player, type Session } from "@/lib/types";

describe("programs", () => {
  it("returns only admin-open programs", () => {
    const programs = getOpenPrograms(sampleData.programs);
    expect(programs.every((program) => program.open)).toBe(true);
    expect(programs.map((program) => program.name)).toEqual([
      "Summer Camp 2026",
      "Winter 2026",
      "Holiday 2025",
      "Fall Classic 2025",
    ]);
  });

  it("lists six clinics for Summer Camp but only four available", () => {
    const summer = sampleData.programs.find(
      (program) => program.name === "Summer Camp 2026",
    )!;
    const clinics = getClinicsForProgram(sampleData.sessions, summer.id);
    const available = getAvailableClinicsForProgram(
      sampleData,
      summer.id,
    );
    expect(clinics).toHaveLength(6);
    expect(available).toHaveLength(4);
    expect(available.map((clinic) => clinic.label)).toEqual([
      "Week 1",
      "Week 2",
      "Week 3",
      "Week 4",
    ]);
    expect(formatProgramTimeframe(summer)).toBe(
      "July 1, 2026 – August 15, 2026",
    );
  });

  it("tracks remaining spots against clinic capacity (default 50)", () => {
    const winter = sampleData.sessions.find(
      (session) => session.id === "session-2026-01",
    )!;
    expect(getClinicCapacity(winter)).toBe(DEFAULT_CLINIC_CAPACITY);
    expect(getRemainingClinicSpots(sampleData, winter)).toBe(
      DEFAULT_CLINIC_CAPACITY - 10,
    );
  });

  it("resolves clinic price with default fallback", () => {
    const winter = sampleData.sessions.find(
      (session) => session.id === "session-2026-01",
    )!;
    expect(getClinicPriceUsd(winter)).toBe(CLINIC_WEEKLY_FEE_USD);
    expect(getClinicPriceUsd({ ...winter, priceUsd: 500 })).toBe(500);
    expect(formatClinicLabel(winter)).not.toMatch(/\(.*\)/);
  });

  it("builds active program rows with enrollment status", () => {
    const lucas = sampleData.players.find(
      (player) => player.name === "Lucas Rivera",
    )!;
    const maya = sampleData.players.find(
      (player) => player.name === "Maya Rivera",
    )!;

    expect(getActiveProgramsForPlayer(lucas, sampleData.programs, sampleData.sessions)).toEqual([
      {
        id: "player-child-2:program-holiday-2025:session-2025-12",
        date: "December 1, 2025 – December 31, 2025",
        playerName: "Lucas Rivera",
        programName: "Holiday 2025",
        clinicName: "Holiday (December 2025)",
        location: "TBD",
        status: "enrolled",
      },
    ]);
    expect(
      getActiveProgramsForPlayer(maya, sampleData.programs, sampleData.sessions),
    ).toEqual([]);
  });

  describe("seat counts", () => {
    const player = (id: string, sessionIds: string[]) =>
      ({ id, sessionIds, programIds: [] }) as unknown as Player;

    it("seatsTaken prefers seatCounts", () => {
      const state = { players: [], seatCounts: { s1: 7 } };
      expect(seatsTaken(state, "s1")).toBe(7);
      expect(seatsTaken(state, "s2")).toBe(0);
    });

    it("seatsTaken falls back to counting players", () => {
      const state = {
        players: [player("a", ["s1"]), player("b", ["s1", "s2"])],
      };
      expect(seatsTaken(state, "s1")).toBe(2);
      expect(seatsTaken(state, "s2")).toBe(1);
    });

    it("remaining spots use seatCounts when players are hidden", () => {
      const clinic = { id: "s1", capacity: 10 } as unknown as Session;
      expect(
        getRemainingClinicSpots(
          { players: [], seatCounts: { s1: 10 } },
          clinic,
        ),
      ).toBe(0);
    });

    it("buildSeatCounts counts each player once per clinic", () => {
      const counts = buildSeatCounts([
        player("a", ["s1", "s1", "s2"]),
        player("b", ["s1"]),
      ]);
      expect(counts).toEqual({ s1: 2, s2: 1 });
    });
  });
});
