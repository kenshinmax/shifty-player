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
    expect(sorted[0]).toMatchObject({ year: 2026, month: 1 });
    expect(sorted[1]).toMatchObject({ year: 2025, month: 12 });
  });

  it("returns the latest session", () => {
    expect(getLatestSession(sampleData.sessions)?.label).toBe("Winter");
    expect(getLatestSession([])).toBeUndefined();
  });

  it("returns remaining sessions for the table", () => {
    const more = getMoreSessions(sampleData.sessions);
    expect(more[0]?.label).toBe("Holiday");
    expect(more).toHaveLength(sampleData.sessions.length - 1);
    expect(more.every((session) => session.label !== "Winter")).toBe(true);
  });
});
