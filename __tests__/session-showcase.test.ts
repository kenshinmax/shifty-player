import { describe, expect, it } from "vitest";
import { sampleData } from "@/lib/sample-data";
import {
  sliceSessionsForShowcase,
  sortSessionsByRecent,
} from "@/lib/session-showcase";

describe("session-showcase", () => {
  it("sorts sessions newest first", () => {
    const sorted = sortSessionsByRecent(sampleData.sessions);
    expect(sorted[0]).toMatchObject({ year: 2026, month: 1 });
    expect(sorted[1]).toMatchObject({ year: 2025, month: 12 });
  });

  it("slices into megatron, two cards, and four table rows", () => {
    const { featured, cards, table } = sliceSessionsForShowcase(
      sampleData.sessions,
    );

    expect(featured?.label).toBe("Winter");
    expect(cards).toHaveLength(2);
    expect(table).toHaveLength(4);
    expect(cards[0].label).toBe("Holiday");
    expect(table[0].label).toBe("October Skills");
  });
});
