import { describe, expect, it } from "vitest";
import { getAvailableClinics } from "@/lib/clinics";
import { sampleData } from "@/lib/sample-data";

describe("clinics", () => {
  it("returns trending and in-progress sessions as available clinics", () => {
    const clinics = getAvailableClinics(sampleData.sessions);
    expect(clinics).toHaveLength(3);
    expect(clinics.map((session) => session.label)).toEqual([
      "Winter",
      "Holiday",
      "Fall Classic",
    ]);
    expect(clinics.every((session) => session.status !== "completed")).toBe(
      true,
    );
  });
});
