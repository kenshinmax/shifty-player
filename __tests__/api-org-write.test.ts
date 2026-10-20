import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH as patchProgram } from "@/app/api/orgs/[orgId]/programs/[programId]/route";
import { POST as removeFromProgram } from "@/app/api/orgs/[orgId]/programs/[programId]/players/[playerId]/remove/route";
import {
  DELETE as deleteClinic,
  PATCH as patchClinic,
} from "@/app/api/orgs/[orgId]/clinics/[clinicId]/route";
import { POST as postClinic } from "@/app/api/orgs/[orgId]/clinics/route";
import { POST as postPlayer } from "@/app/api/orgs/[orgId]/players/route";
import {
  DELETE as deletePlayer,
  PATCH as patchPlayer,
} from "@/app/api/orgs/[orgId]/players/[playerId]/route";
import { POST as postPaymentLink } from "@/app/api/orgs/[orgId]/players/[playerId]/payment-link/route";
import { POST as postEnroll } from "@/app/api/orgs/[orgId]/registrations/enroll/route";
import { POST as postPaymentIntent } from "@/app/api/stripe/create-payment-intent/route";
import {
  buildSessionCookie,
  createSession,
  ensureAuthSeeded,
} from "@/lib/db/auth-repository";
import { getDocStore } from "@/lib/db/doc-store";
import { resetMemoryRegistrationDb } from "@/lib/db/registration-repository";
import { DEFAULT_ORG_ID, defaultOrganization } from "@/lib/organizations";
import { sampleData } from "@/lib/sample-data";
import type { Child, Enrollment, OrgProgram, OrgSession } from "@/lib/types";

const ORG_B = "org-b";
const B_PROGRAM = "program-org-b";
const B_CLINIC = "clinic-org-b";
const B_CHILD = "b-child";

const PROGRAM_INPUT = {
  name: "Hijack",
  description: "Not yours",
  startDate: "2026-03-01",
  endDate: "2026-03-31",
  open: true,
  spots: 10,
};
const CLINIC_INPUT = { year: 2026, month: 3, week: 9, label: "Hijack", capacity: 5 };
const PLAYER_INPUT = {
  name: "Hijacked Kid",
  email: "hijack@example.com",
  grade: "5",
  level: "beginner",
  sessionIds: ["clinic-summer-2026-w1"],
};

async function cookieFor(userId: string): Promise<Record<string, string>> {
  await ensureAuthSeeded();
  return { cookie: buildSessionCookie(await createSession(userId)) };
}

function request(headers: Record<string, string>, body?: unknown, method = "POST") {
  return new Request("http://localhost/api/orgs/x", {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function ctx<T extends Record<string, string>>(params: T) {
  return { params: Promise.resolve({ orgId: DEFAULT_ORG_ID, ...params }) };
}

async function seedOrgB(): Promise<void> {
  const store = getDocStore();
  await store.insertOne("organizations", {
    ...defaultOrganization(),
    id: ORG_B,
    slug: ORG_B,
    name: "Org B",
  });
  const program: OrgProgram = { ...sampleData.programs[0], id: B_PROGRAM, orgId: ORG_B };
  const session: OrgSession = {
    ...sampleData.sessions[0],
    id: B_CLINIC,
    programId: B_PROGRAM,
    orgId: ORG_B,
  };
  const child: Child = {
    id: B_CHILD,
    createdByOrgId: ORG_B,
    name: "Org B Kid",
    email: "b@example.com",
    grade: "5",
    level: "beginner",
  };
  const enrollment: Enrollment = {
    id: `enr-${B_CHILD}-${B_CLINIC}`,
    orgId: ORG_B,
    childId: B_CHILD,
    programId: B_PROGRAM,
    sessionId: B_CLINIC,
    status: "pending",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  await store.insertOne("programs", program);
  await store.insertOne("sessions", session);
  await store.insertOne("children", child);
  await store.insertOne("enrollments", enrollment);
}

async function orgBDocs() {
  const store = getDocStore();
  return {
    programs: await store.find("programs", { orgId: ORG_B }),
    sessions: await store.find("sessions", { orgId: ORG_B }),
    enrollments: await store.find("enrollments", { orgId: ORG_B }),
    orders: await store.find("orders", { orgId: ORG_B }),
    child: await store.findOne("children", { id: B_CHILD }),
  };
}

describe("org mutation APIs", () => {
  beforeEach(async () => {
    resetMemoryRegistrationDb(sampleData);
    await seedOrgB();
  });

  describe("cannot touch another org's records", () => {
    const cases: [string, (cookie: Record<string, string>) => Promise<Response>][] = [
      ["program PATCH", (c) =>
        patchProgram(request(c, PROGRAM_INPUT, "PATCH"), ctx({ programId: B_PROGRAM }))],
      ["program open toggle", (c) =>
        patchProgram(request(c, { open: false }, "PATCH"), ctx({ programId: B_PROGRAM }))],
      ["clinic POST", (c) =>
        postClinic(request(c, { ...CLINIC_INPUT, programId: B_PROGRAM }), ctx({}))],
      ["clinic PATCH to another org's program", (c) =>
        patchClinic(
          request(c, { ...CLINIC_INPUT, programId: B_PROGRAM }, "PATCH"),
          ctx({ clinicId: "clinic-summer-2026-w1" }),
        )],
      ["clinic PATCH", (c) =>
        patchClinic(request(c, CLINIC_INPUT, "PATCH"), ctx({ clinicId: B_CLINIC }))],
      ["clinic DELETE", (c) =>
        deleteClinic(request(c, undefined, "DELETE"), ctx({ clinicId: B_CLINIC }))],
      ["player PATCH", (c) =>
        patchPlayer(request(c, PLAYER_INPUT, "PATCH"), ctx({ playerId: B_CHILD }))],
      ["player DELETE", (c) =>
        deletePlayer(request(c, undefined, "DELETE"), ctx({ playerId: B_CHILD }))],
      ["payment-link", (c) =>
        postPaymentLink(request(c), ctx({ playerId: B_CHILD }))],
      ["remove-from-program", (c) =>
        removeFromProgram(request(c), ctx({ programId: B_PROGRAM, playerId: B_CHILD }))],
    ];

    it.each(cases)("%s", async (_name, call) => {
      const before = await orgBDocs();
      const res = await call(await cookieFor("admin-1"));
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      // A validation error would pass vacuously; the lookup must be what fails.
      expect((await res.json()).error).toMatch(/not found/i);
      expect(await orgBDocs()).toEqual(before);
    });
  });

  it("player routes now require admin", async () => {
    const calls = [
      postPlayer(request({}, PLAYER_INPUT), ctx({})),
      patchPlayer(request({}, PLAYER_INPUT, "PATCH"), ctx({ playerId: "player-1" })),
      deletePlayer(request({}, undefined, "DELETE"), ctx({ playerId: "player-1" })),
      postPaymentLink(request({}), ctx({ playerId: "player-1" })),
    ];
    for (const res of await Promise.all(calls)) {
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Sign in required." });
    }
  });

  it("admin creates a player and gets the viewer state back", async () => {
    const res = await postPlayer(request(await cookieFor("admin-1"), PLAYER_INPUT), ctx({}));
    expect(res.status).toBe(200);
    const { state } = await res.json();
    const names = state.players.map((p: { name: string }) => p.name);
    expect(names).toContain("Hijacked Kid");
    expect(names).not.toContain("Org B Kid");
  });

  it("unknown org is 404", async () => {
    const res = await postPlayer(request(await cookieFor("admin-1"), PLAYER_INPUT), {
      params: Promise.resolve({ orgId: "nope" }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Organization not found." });
  });

  const ENROLL = {
    playerId: "player-child-1",
    programId: "program-summer-2026",
    clinicId: "clinic-summer-2026-w1",
  };

  it("enroll requires sign-in", async () => {
    const res = await postEnroll(request({}, ENROLL), ctx({}));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Sign in required." });
  });

  it("parent enrolls their own child and sees only their children", async () => {
    // Without Stripe this is the demo checkout.
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const res = await postEnroll(request(await cookieFor("user-1"), ENROLL), ctx({}));
    expect(res.status).toBe(200);
    const { state } = await res.json();
    expect(state.players.length).toBeGreaterThan(0);
    expect(
      state.players.every((p: { parentUserId?: string }) => p.parentUserId === "user-1"),
    ).toBe(true);
    const child = state.players.find((p: { id: string }) => p.id === ENROLL.playerId);
    expect(child.sessionIds).toContain(ENROLL.clinicId);
    vi.unstubAllEnvs();
  });

  describe("enroll when Stripe is configured", () => {
    beforeEach(() => {
      vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
    });
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("rejects a parent's unpaid enrollment", async () => {
      const store = getDocStore();
      const before = {
        enrollments: await store.find("enrollments", {}),
        orders: await store.find("orders", {}),
      };
      const res = await postEnroll(request(await cookieFor("user-1"), ENROLL), ctx({}));
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: "Online payment is required." });
      expect({
        enrollments: await store.find("enrollments", {}),
        orders: await store.find("orders", {}),
      }).toEqual(before);
    });

    it("still lets an admin enroll", async () => {
      const res = await postEnroll(request(await cookieFor("admin-1"), ENROLL), ctx({}));
      expect(res.status).toBe(200);
      const { state } = await res.json();
      const child = state.players.find((p: { id: string }) => p.id === ENROLL.playerId);
      expect(child.sessionIds).toContain(ENROLL.clinicId);
    });
  });

  it("enroll rejects another parent's child", async () => {
    await getDocStore().insertOne("children", {
      id: "other-child",
      parentUserId: "someone-else",
      name: "Not Mine",
      email: "else@example.com",
      grade: "4",
      level: "beginner",
    });
    const res = await postEnroll(
      request(await cookieFor("user-1"), { ...ENROLL, playerId: "other-child" }),
      ctx({}),
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Player not found." });
    expect(await getDocStore().count("enrollments", { childId: "other-child" })).toBe(0);
  });

  it("payment intent requires sign-in and the child's parent", async () => {
    const previous = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    try {
      const body = { ...ENROLL, orgId: DEFAULT_ORG_ID };
      const anon = await postPaymentIntent(request({}, body));
      expect(anon.status).toBe(401);
      const missingOrg = await postPaymentIntent(
        request(await cookieFor("user-1"), ENROLL),
      );
      expect(missingOrg.status).toBe(400);
      const notMine = await postPaymentIntent(
        request(await cookieFor("user-1"), { ...body, playerId: "player-1" }),
      );
      expect(notMine.status).toBe(404);
      expect(await notMine.json()).toEqual({ error: "Player not found." });
    } finally {
      if (previous === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = previous;
    }
  });

  it("old global state route is gone", () => {
    const api = path.resolve(__dirname, "../app/api");
    for (const dir of ["state", "programs", "clinics", "players", "registrations"]) {
      expect(fs.existsSync(path.join(api, dir))).toBe(false);
    }
    expect(fs.existsSync(path.join(api, "state/route.ts"))).toBe(false);
  });
});
