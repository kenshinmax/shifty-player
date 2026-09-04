import { describe, expect, it } from "vitest";
import {
  formatSeasonDate,
  getCompletedSeasonsForUser,
} from "@/lib/player-history";

describe("player-history", () => {
  it("returns completed seasons for a demo child", () => {
    const seasons = getCompletedSeasonsForUser("player-child-1");
    expect(seasons.length).toBeGreaterThan(0);
    expect(seasons[0]).toMatchObject({
      date: expect.any(String),
      grade: expect.any(String),
      gamesPlayed: expect.any(Number),
    });
  });

  it("returns an empty list for unknown users", () => {
    expect(getCompletedSeasonsForUser("unknown")).toEqual([]);
  });

  it("formats season dates as month and year", () => {
    expect(formatSeasonDate("2025-07")).toBe("July 2025");
  });
});
