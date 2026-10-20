import { beforeEach, describe, expect, it } from "vitest";
import { GET as getAccount } from "@/app/api/account/route";
import { POST as postChild } from "@/app/api/account/children/route";
import { GET as getOrgState } from "@/app/api/orgs/[orgId]/state/route";
import {
  buildSessionCookie,
  createSession,
  ensureAuthSeeded,
} from "@/lib/db/auth-repository";
import { getDocStore } from "@/lib/db/doc-store";
import { resetMemoryRegistrationDb } from "@/lib/db/registration-repository";
import { DEFAULT_ORG_ID, defaultOrganization } from "@/lib/organizations";
import { sampleData } from "@/lib/sample-data";
import type { Child } from "@/lib/types";

const SAMPLE_PLAYER_EMAIL = "alex.johnson@example.com";

async function cookieFor(userId: string): Promise<{ cookie: string }> {
  await ensureAuthSeeded();
  return { cookie: buildSessionCookie(await createSession(userId)) };
}

function stateRequest(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/orgs/x/state", { headers });
}

function ctx(orgId: string) {
  return { params: Promise.resolve({ orgId }) };
}

describe("org state and account read APIs", () => {
  beforeEach(() => resetMemoryRegistrationDb(sampleData));

  it("public state has no players and has seat counts", async () => {
    const res = await getOrgState(stateRequest(), ctx(DEFAULT_ORG_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.state.players).toEqual([]);
    expect(Object.keys(body.state.seatCounts).length).toBeGreaterThan(0);
    expect(JSON.stringify(body)).not.toContain(SAMPLE_PLAYER_EMAIL);
  });

  it("parent state contains only their children", async () => {
    const res = await getOrgState(
      stateRequest(await cookieFor("user-1")),
      ctx(DEFAULT_ORG_ID),
    );
    const { state } = await res.json();
    expect(state.players.length).toBeGreaterThan(0);
    expect(
      state.players.every((p: { parentUserId?: string }) => p.parentUserId === "user-1"),
    ).toBe(true);
  });

  it("admin state contains the roster", async () => {
    const res = await getOrgState(
      stateRequest(await cookieFor("admin-1")),
      ctx(DEFAULT_ORG_ID),
    );
    const { state } = await res.json();
    expect(state.players.length).toBeGreaterThan(2);
    expect(JSON.stringify(state)).toContain(SAMPLE_PLAYER_EMAIL);
  });

  it("unknown org is 404", async () => {
    const res = await getOrgState(stateRequest(), ctx("nope"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Organization not found." });
  });

  it("suspended org is 404", async () => {
    await getDocStore().insertOne("organizations", {
      ...defaultOrganization(),
      id: "org-sus",
      slug: "sus",
      name: "Suspended",
      status: "suspended",
    });
    const res = await getOrgState(stateRequest(), ctx("org-sus"));
    expect(res.status).toBe(404);
  });

  it("account requires sign-in", async () => {
    const res = await getAccount(new Request("http://localhost/api/account"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Sign in required." });
  });

  it("account lists the default org for user-1", async () => {
    const res = await getAccount(
      new Request("http://localhost/api/account", { headers: await cookieFor("user-1") }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.children.length).toBeGreaterThan(0);
    expect(body.organizations).toHaveLength(1);
    expect(body.organizations[0].organization).toEqual({
      id: DEFAULT_ORG_ID,
      slug: "shifty-player",
      name: "Shifty Player",
    });
    expect(
      body.organizations[0].state.players.every(
        (p: { parentUserId?: string }) => p.parentUserId === "user-1",
      ),
    ).toBe(true);
  });

  it("adding a child uses the session user, not the body", async () => {
    const res = await postChild(
      new Request("http://localhost/api/account/children", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await cookieFor("user-1")) },
        body: JSON.stringify({
          name: "Casey",
          grade: "4",
          level: "beginner",
          parentUserId: "someone-else",
          parentEmail: "evil@example.com",
        }),
      }),
    );
    expect(res.status).toBe(200);
    const { child } = await res.json();
    const stored = await getDocStore().findOne<Child>("children", { id: child.id });
    expect(stored?.parentUserId).toBe("user-1");
    expect(stored?.email).toBe("user@demo.com");
  });

  it("adding a child requires sign-in and valid input", async () => {
    const anon = await postChild(
      new Request("http://localhost/api/account/children", {
        method: "POST",
        body: JSON.stringify({ name: "Casey", grade: "4", level: "beginner" }),
      }),
    );
    expect(anon.status).toBe(401);
    const bad = await postChild(
      new Request("http://localhost/api/account/children", {
        method: "POST",
        headers: await cookieFor("user-1"),
        body: JSON.stringify({ name: " ", grade: "4", level: "beginner" }),
      }),
    );
    expect(bad.status).toBe(400);
  });

  it("adding a child rejects a non-object body and an unknown level", async () => {
    const post = async (body: string) =>
      postChild(
        new Request("http://localhost/api/account/children", {
          method: "POST",
          headers: await cookieFor("user-1"),
          body,
        }),
      );
    for (const body of ["null", "42", '"Casey"']) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid JSON body." });
    }
    for (const level of ["expert", 3, undefined]) {
      const res = await post(JSON.stringify({ name: "Casey", grade: "4", level }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Level is required." });
    }
    expect(await getDocStore().count("children", { name: "Casey" })).toBe(0);
  });
});
