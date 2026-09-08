import { describe, expect, it } from "vitest";
import {
  formatProgramDate,
  getCompletedProgramsForUser,
} from "@/lib/player-history";

describe("player-history", () => {
  it("returns completed programs for a demo child", () => {
    const programs = getCompletedProgramsForUser("player-child-1");
    expect(programs.length).toBeGreaterThan(0);
    expect(programs[0]).toMatchObject({
      date: expect.any(String),
      grade: expect.any(String),
      gamesPlayed: expect.any(Number),
    });
  });

  it("returns an empty list for unknown users", () => {
    expect(getCompletedProgramsForUser("unknown")).toEqual([]);
  });

  it("formats program dates as month and year", () => {
    expect(formatProgramDate("2025-07")).toBe("July 2025");
  });
});
