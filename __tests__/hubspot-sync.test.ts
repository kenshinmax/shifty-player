import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppState } from "@/lib/types";

vi.mock("@/lib/db/auth-repository", () => ({
  getAuthUserById: vi.fn(async (id: string) =>
    id === "user-9"
      ? { id, name: "Jordan Rivera", email: "jordan@example.com", role: "user" }
      : null,
  ),
}));

const { syncEnrollmentToHubSpot } = await import("@/lib/hubspot-sync");

const state: AppState = {
  programs: [
    {
      id: "summer-2027",
      name: "Summer Camp 2027",
      year: 2027,
      status: "trending",
      open: true,
      startMonth: 7,
      endMonth: 8,
    },
  ],
  sessions: [],
  players: [
    {
      id: "p1",
      name: "Kid One",
      email: "kid1@example.com",
      grade: "5",
      level: "beginner",
      programIds: [],
      sessionIds: [],
      parentUserId: "user-9",
      merchandiseOrder: {
        clinicId: "c1",
        items: [],
        tuitionCents: 15000,
        swagCents: 0,
        totalCents: 15000,
        paidAt: "2027-06-01T15:30:00.000Z",
      },
    },
  ],
};

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe("syncEnrollmentToHubSpot", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("updates the contact, then creates a deal associated with it", async () => {
    vi.stubEnv("HUBSPOT_ACCESS_TOKEN", "pat-test");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ results: [{ id: "501" }] }))
      .mockResolvedValueOnce(json({ results: [{ id: "900" }] }))
      .mockResolvedValueOnce(json({}));
    vi.stubGlobal("fetch", fetchMock);

    await syncEnrollmentToHubSpot(state, "p1", "summer-2027", "pi_123");

    const urls = fetchMock.mock.calls.map(([url]) => url);
    expect(urls).toEqual([
      "https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert",
      "https://api.hubapi.com/crm/v3/objects/deals/batch/upsert",
      "https://api.hubapi.com/crm/v4/objects/deals/900/associations/default/contacts/501",
    ]);
    const dealBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(dealBody.inputs[0].properties).toMatchObject({
      dealname: "Summer Camp 2027 – Rivera",
      amount: "150.00",
      shifty_payment_id: "pi_123",
    });
  });

  it("skips the deal when the contact upsert fails", async () => {
    vi.stubEnv("HUBSPOT_ACCESS_TOKEN", "pat-test");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue(new Response("down", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    await syncEnrollmentToHubSpot(state, "p1", "summer-2027", "pi_123");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });
});
