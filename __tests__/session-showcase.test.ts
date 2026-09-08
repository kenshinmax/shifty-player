import { describe, expect, it } from "vitest";
import { sampleData } from "@/lib/sample-data";
import {
  getLatestSession,
  getMoreSessions,
  sortSessionsByRecent,
} from "@/lib/session-showcase";

describe("session-showcase", () => {
  it("sorts sessions newest first", () => {
    const sorted = sortSessionsByRecent(sampleData.sessions);
    expect(sorted[0]).toMatchObject({ year: 2026, month: 8, week: 6 });
  });

  it("returns the latest primary clinic for a program", () => {
    expect(getLatestSession(sampleData.sessions)?.label).toBe("Week 1");
    expect(getLatestSession([])).toBeUndefined();
  });

  it("returns remaining sessions for the table", () => {
    const more = getMoreSessions(sampleData.sessions);
    expect(more).toHaveLength(sampleData.sessions.length - 1);
    expect(more.every((session) => session.label !== "Week 1")).toBe(true);
  });
});
