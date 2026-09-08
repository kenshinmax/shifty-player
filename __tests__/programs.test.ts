import { describe, expect, it } from "vitest";
import {
  formatProgramTimeframe,
  getActiveProgramsForPlayer,
  getAvailableClinicsForProgram,
  getClinicsForProgram,
  getOpenPrograms,
} from "@/lib/programs";
import { sampleData } from "@/lib/sample-data";

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
    );
    expect(clinics).toHaveLength(6);
    expect(available).toHaveLength(4);
    expect(available.map((clinic) => clinic.label)).toEqual([
      "Week 1",
      "Week 2",
      "Week 3",
      "Week 4",
    ]);
    expect(formatProgramTimeframe(summer)).toBe("July – August 2026");
  });

  it("builds active program rows with enrollment status", () => {
    const lucas = sampleData.players.find(
      (player) => player.name === "Lucas Rivera",
    )!;
    const maya = sampleData.players.find(
      (player) => player.name === "Maya Rivera",
    )!;

    expect(getActiveProgramsForPlayer(lucas, sampleData.programs)).toEqual([
      {
        id: "player-child-2:program-holiday-2025",
        date: "December 2025",
        playerName: "Lucas Rivera",
        programName: "Holiday 2025",
        location: "TBD",
        status: "enrolled",
      },
    ]);
    expect(getActiveProgramsForPlayer(maya, sampleData.programs)).toEqual([]);
  });
});
