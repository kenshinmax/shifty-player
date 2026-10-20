import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiAddChild,
  apiCreateProgram,
  fetchRegistrationState,
} from "@/lib/registration-api";

describe("registration api client", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ state: { players: [] } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads state from the organization route", async () => {
    await fetchRegistrationState("org-x");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/orgs/org-x/state");
  });

  it("creates programs under the organization", async () => {
    await apiCreateProgram("org-x", {
      name: "Fall",
      startDate: "2026-09-01",
      endDate: "2026-10-01",
    } as never);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/orgs/org-x/programs");
    expect(init.method).toBe("POST");
  });

  it("adds a child without sending parent ids", async () => {
    await apiAddChild({ name: "Sam", grade: "5", level: "beginner" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/account/children");
    expect(JSON.parse(init.body)).toEqual({
      name: "Sam",
      grade: "5",
      level: "beginner",
    });
  });
});
