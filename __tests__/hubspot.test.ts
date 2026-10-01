import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildEnrollmentProperties,
  buildRegistrationDealProperties,
  buildSignupProperties,
  upsertHubSpotContact,
  upsertHubSpotDeal,
} from "@/lib/hubspot";
import type { AppState, Player } from "@/lib/types";

function player(overrides: Partial<Player>): Player {
  return {
    id: "p1",
    name: "Kid One",
    email: "kid1@example.com",
    grade: "5",
    level: "beginner",
    programIds: [],
    sessionIds: [],
    ...overrides,
  };
}

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
    player({
      id: "p1",
      grade: "5",
      parentUserId: "user-9",
      merchandiseOrder: {
        clinicId: "c1",
        items: [],
        tuitionCents: 15000,
        swagCents: 2500,
        totalCents: 17500,
        paidAt: "2027-06-01T15:30:00.000Z",
      },
    }),
    player({ id: "p2", name: "Kid Two", grade: "3", parentUserId: "user-9" }),
    player({ id: "p3", grade: "8", parentUserId: "someone-else" }),
    player({ id: "orphan", parentUserId: undefined }),
  ],
};

describe("hubspot", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds signup properties with name split and consent", () => {
    const props = buildSignupProperties(
      { name: "Maria  De La Cruz", email: "maria@example.com" },
      true,
      new Date("2026-09-26T12:00:00Z"),
    );
    expect(props).toMatchObject({
      firstname: "Maria",
      lastname: "De La Cruz",
      lifecyclestage: "lead",
      shifty_marketing_opt_in: "true",
      shifty_signup_date: "2026-09-26",
    });
  });

  it("builds enrollment properties across a parent's children only", () => {
    const result = buildEnrollmentProperties(state, "p1", "summer-2027");
    expect(result).toEqual({
      parentUserId: "user-9",
      properties: {
        lifecyclestage: "customer",
        shifty_player_count: "2",
        shifty_player_grades: "3, 5",
        shifty_last_program: "Summer Camp 2027",
        shifty_last_payment_date: "2027-06-01",
        shifty_last_payment_amount: "175.00",
      },
    });
  });

  it("never sends children's names or emails", () => {
    const result = buildEnrollmentProperties(state, "p1", "summer-2027");
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("Kid");
    expect(serialized).not.toContain("kid1@example.com");
  });

  it("skips players without a parent account", () => {
    expect(buildEnrollmentProperties(state, "orphan", "summer-2027")).toBeNull();
  });

  it("is a no-op without an access token", async () => {
    vi.stubEnv("HUBSPOT_ACCESS_TOKEN", "");
    const fetchMock = vi.fn();
    const result = await upsertHubSpotContact("a@b.com", {}, fetchMock);
    expect(result).toEqual({ ok: true, skipped: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("upserts by lowercased email with bearer auth", async () => {
    vi.stubEnv("HUBSPOT_ACCESS_TOKEN", "pat-test");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    const result = await upsertHubSpotContact(
      " Parent@Example.com ",
      { firstname: "Pat" },
      fetchMock,
    );
    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert");
    expect(init.headers.Authorization).toBe("Bearer pat-test");
    expect(JSON.parse(init.body)).toEqual({
      inputs: [
        {
          idProperty: "email",
          id: "parent@example.com",
          properties: { firstname: "Pat", email: "parent@example.com" },
        },
      ],
    });
  });

  it("returns an error instead of throwing when HubSpot fails", async () => {
    vi.stubEnv("HUBSPOT_ACCESS_TOKEN", "pat-test");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = vi.fn().mockResolvedValue(new Response("bad property", { status: 400 }));
    const result = await upsertHubSpotContact("a@b.com", {}, failing);
    expect(result.ok).toBe(false);
    const throwing = vi.fn().mockRejectedValue(new Error("network down"));
    const result2 = await upsertHubSpotContact("a@b.com", {}, throwing);
    expect(result2).toMatchObject({ ok: false });
    errorSpy.mockRestore();
  });

  it("returns the contact id from the upsert response", async () => {
    vi.stubEnv("HUBSPOT_ACCESS_TOKEN", "pat-test");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ results: [{ id: "501" }] }), { status: 200 }),
      );
    const result = await upsertHubSpotContact("a@b.com", {}, fetchMock);
    expect(result).toEqual({ ok: true, id: "501" });
  });

  it("builds a closed-won deal named by program and family surname", () => {
    const deal = buildRegistrationDealProperties(
      state,
      "p1",
      "summer-2027",
      "pi_123",
      "Jordan Rivera",
    );
    expect(deal).toEqual({
      dealname: "Summer Camp 2027 – Rivera",
      amount: "175.00",
      closedate: "2027-06-01",
      pipeline: "default",
      dealstage: "closedwon",
      shifty_payment_id: "pi_123",
      shifty_program: "Summer Camp 2027",
    });
    expect(JSON.stringify(deal)).not.toContain("Kid");
  });

  it("uses the configured deal pipeline and stage", () => {
    vi.stubEnv("HUBSPOT_DEAL_PIPELINE", "reg-pipeline");
    vi.stubEnv("HUBSPOT_DEAL_STAGE", "reg-won");
    const deal = buildRegistrationDealProperties(state, "p1", "summer-2027", "pi_1", "Pat");
    expect(deal).toMatchObject({ pipeline: "reg-pipeline", dealstage: "reg-won" });
  });

  it("skips the deal when there is no paid order", () => {
    expect(
      buildRegistrationDealProperties(state, "p2", "summer-2027", "pi_1", "Pat"),
    ).toBeNull();
  });

  it("upserts the deal by payment id and associates it with the contact", async () => {
    vi.stubEnv("HUBSPOT_ACCESS_TOKEN", "pat-test");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ results: [{ id: "900" }] }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const properties = { dealname: "Camp – Rivera", shifty_payment_id: "pi_123" };
    const result = await upsertHubSpotDeal(properties, "501", fetchMock);

    expect(result).toEqual({ ok: true, id: "900" });
    const [upsertUrl, upsertInit] = fetchMock.mock.calls[0];
    expect(upsertUrl).toBe("https://api.hubapi.com/crm/v3/objects/deals/batch/upsert");
    expect(JSON.parse(upsertInit.body)).toEqual({
      inputs: [{ idProperty: "shifty_payment_id", id: "pi_123", properties }],
    });
    const [assocUrl, assocInit] = fetchMock.mock.calls[1];
    expect(assocUrl).toBe(
      "https://api.hubapi.com/crm/v4/objects/deals/900/associations/default/contacts/501",
    );
    expect(assocInit.method).toBe("PUT");
  });

  it("does not associate when the deal upsert fails", async () => {
    vi.stubEnv("HUBSPOT_ACCESS_TOKEN", "pat-test");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue(new Response("nope", { status: 400 }));
    const result = await upsertHubSpotDeal({ shifty_payment_id: "pi_1" }, "501", fetchMock);
    expect(result.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });
});
