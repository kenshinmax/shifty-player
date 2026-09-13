import { describe, expect, it } from "vitest";
import {
  formatProgramTimeframe,
  getActiveProgramsForPlayer,
  getAvailableClinicsForProgram,
  getClinicCapacity,
  getClinicsForProgram,
  getOpenPrograms,
  getRemainingClinicSpots,
} from "@/lib/programs";
import { sampleData } from "@/lib/sample-data";
import { DEFAULT_CLINIC_CAPACITY } from "@/lib/types";

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
      sampleData.sessions,
      summer.id,
      sampleData.players,
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
    expect(getRemainingClinicSpots(sampleData.players, winter)).toBe(
      DEFAULT_CLINIC_CAPACITY - 10,
    );
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
});
