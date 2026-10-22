import { beforeEach, describe, expect, it } from "vitest";
import { POST as postProgram } from "@/app/api/orgs/[orgId]/programs/route";
import { GET as getOrgState } from "@/app/api/orgs/[orgId]/state/route";
import {
  GET as listOrgs,
  POST as createOrg,
} from "@/app/api/platform/organizations/route";
import { PATCH as patchOrg } from "@/app/api/platform/organizations/[orgId]/route";
import { POST as addOwner } from "@/app/api/platform/organizations/[orgId]/owners/route";
import { canManageOrg, getPostLoginPath, type AuthUser } from "@/lib/auth";
import {
  authenticateUser,
  buildSessionCookie,
  createSession,
  resetAuthStore,
} from "@/lib/db/auth-repository";
import { resetMemoryRegistrationDb } from "@/lib/db/registration-repository";
import { DEFAULT_ORG_ID } from "@/lib/organizations";
import { sampleData } from "@/lib/sample-data";
import type { Organization, OrganizationWithOwners } from "@/lib/types";

const LIST_URL = "http://localhost/api/platform/organizations";
const OWNER = { name: "Sam Coach", email: "sam@bayhoops.com", password: "hoops" };
const PROGRAM_INPUT = {
  name: "Fall Clinic",
  description: "Owner-made program",
  startDate: "2026-11-01",
  endDate: "2026-11-30",
  open: true,
  spots: 10,
};

async function cookieFor(userId: string): Promise<Record<string, string>> {
  return { cookie: buildSessionCookie(await createSession(userId)) };
}

function jsonRequest(
  url: string,
  method: string,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function orgParams(orgId: string) {
  return { params: Promise.resolve({ orgId }) };
}

/** Creates a draft org with OWNER as its owner and signs the owner in. */
async function createOwnedOrg(): Promise<{ org: Organization; owner: Record<string, string> }> {
  const res = await createOrg(
    jsonRequest(
      LIST_URL,
      "POST",
      { name: "Bay Hoops", slug: "bay-hoops", owner: OWNER },
      await cookieFor("admin-1"),
    ),
  );
  expect(res.status).toBe(201);
  const { organization } = (await res.json()) as { organization: Organization };
  const user = await authenticateUser(OWNER.email, OWNER.password);
  return { org: organization, owner: await cookieFor(user!.id) };
}

describe("canManageOrg", () => {
  const owner: AuthUser = {
    id: "o",
    name: "O",
    email: "o@example.com",
    role: "owner",
    orgId: "org-a",
    orgSlug: "a",
  };

  it("lets the platform admin manage every org and owners only their own", () => {
    const admin: AuthUser = { id: "a", name: "A", email: "a@example.com", role: "admin" };
    const parent: AuthUser = { id: "p", name: "P", email: "p@example.com", role: "user" };
    expect(canManageOrg(admin, "org-a")).toBe(true);
    expect(canManageOrg(admin, "org-b")).toBe(true);
    expect(canManageOrg(owner, "org-a")).toBe(true);
    expect(canManageOrg(owner, "org-b")).toBe(false);
    expect(canManageOrg(parent, "org-a")).toBe(false);
    expect(canManageOrg(null, "org-a")).toBe(false);
  });

  it("sends owners to their own org's admin after sign-in", () => {
    expect(getPostLoginPath(owner)).toBe("/o/a/admin");
  });
});

describe("organization owners", () => {
  beforeEach(async () => {
    resetMemoryRegistrationDb(sampleData);
    await resetAuthStore();
  });

  it("creates the owner with the org and lists them to the platform admin", async () => {
    const { org } = await createOwnedOrg();

    const user = await authenticateUser(OWNER.email, OWNER.password);
    expect(user).toMatchObject({ role: "owner", orgId: org.id, orgSlug: "bay-hoops" });

    const listed = (await (
      await listOrgs(new Request(LIST_URL, { headers: await cookieFor("admin-1") }))
    ).json()) as { organizations: OrganizationWithOwners[] };
    const owners = Object.fromEntries(listed.organizations.map((o) => [o.slug, o.owners]));
    expect(owners["bay-hoops"]).toEqual([{ name: OWNER.name, email: OWNER.email }]);
    expect(owners["shifty-player"]).toEqual([]);
  });

  it("rejects an unusable owner email without creating the org", async () => {
    const admin = await cookieFor("admin-1");
    const res = await createOrg(
      jsonRequest(
        LIST_URL,
        "POST",
        { name: "Bay Hoops", slug: "bay-hoops", owner: { ...OWNER, email: "admin@demo.com" } },
        admin,
      ),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "The platform admin can't be an organization owner.",
    });

    const listed = (await (await listOrgs(new Request(LIST_URL, { headers: admin }))).json()) as {
      organizations: Organization[];
    };
    expect(listed.organizations.map((o) => o.slug)).toEqual(["shifty-player"]);
  });

  it("assigns an existing account by email, keeping its name and password", async () => {
    const res = await addOwner(
      jsonRequest(
        `${LIST_URL}/${DEFAULT_ORG_ID}/owners`,
        "POST",
        { name: "", email: "USER@demo.com", password: "" },
        await cookieFor("admin-1"),
      ),
      orgParams(DEFAULT_ORG_ID),
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      owner: { name: "Jordan Rivera", email: "user@demo.com" },
    });
    expect(await authenticateUser("user@demo.com", "user")).toMatchObject({
      id: "user-1",
      role: "owner",
      orgId: DEFAULT_ORG_ID,
    });
  });

  it("allows one owner per org, and one org per owner", async () => {
    const { org } = await createOwnedOrg();
    const admin = await cookieFor("admin-1");

    const second = await addOwner(
      jsonRequest(`${LIST_URL}/${org.id}/owners`, "POST", { ...OWNER, email: "two@example.com" }, admin),
      orgParams(org.id),
    );
    expect(second.status).toBe(400);
    expect(await second.json()).toEqual({ error: "This organization already has an owner." });

    const elsewhere = await addOwner(
      jsonRequest(`${LIST_URL}/${DEFAULT_ORG_ID}/owners`, "POST", OWNER, admin),
      orgParams(DEFAULT_ORG_ID),
    );
    expect(elsewhere.status).toBe(400);
    expect(await elsewhere.json()).toEqual({ error: "That account already owns an organization." });
  });

  it("adds an owner to an existing org", async () => {
    const res = await addOwner(
      jsonRequest(`${LIST_URL}/${DEFAULT_ORG_ID}/owners`, "POST", OWNER, await cookieFor("admin-1")),
      orgParams(DEFAULT_ORG_ID),
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ owner: { name: OWNER.name, email: OWNER.email } });
    expect(await authenticateUser(OWNER.email, OWNER.password)).toMatchObject({
      role: "owner",
      orgId: DEFAULT_ORG_ID,
    });
  });

  it("keeps platform APIs closed to owners", async () => {
    const { org, owner } = await createOwnedOrg();
    expect((await listOrgs(new Request(LIST_URL, { headers: owner }))).status).toBe(403);
    const created = await createOrg(
      jsonRequest(LIST_URL, "POST", { name: "Mine Too", slug: "mine-too" }, owner),
    );
    expect(created.status).toBe(403);
    const published = await patchOrg(
      jsonRequest(`${LIST_URL}/${org.id}`, "PATCH", { status: "live" }, owner),
      orgParams(org.id),
    );
    expect(published.status).toBe(403);
    const added = await addOwner(
      jsonRequest(`${LIST_URL}/${org.id}/owners`, "POST", { ...OWNER, email: "x@y.com" }, owner),
      orgParams(org.id),
    );
    expect(added.status).toBe(403);
  });

  it("lets an owner open and manage only their own org", async () => {
    const { org, owner } = await createOwnedOrg();

    // Their own draft org is visible to them, as admin.
    const ownState = await getOrgState(
      jsonRequest(`http://localhost/api/orgs/${org.id}/state`, "GET", undefined, owner),
      orgParams(org.id),
    );
    expect(ownState.status).toBe(200);

    const created = await postProgram(
      jsonRequest("http://localhost/api/orgs/x/programs", "POST", PROGRAM_INPUT, owner),
      orgParams(org.id),
    );
    expect(created.status).toBe(200);

    // Another org's admin APIs are closed, and its roster stays hidden.
    const otherProgram = await postProgram(
      jsonRequest("http://localhost/api/orgs/x/programs", "POST", PROGRAM_INPUT, owner),
      orgParams(DEFAULT_ORG_ID),
    );
    expect(otherProgram.status).toBe(403);
    const otherState = (await (
      await getOrgState(
        jsonRequest(`http://localhost/api/orgs/${DEFAULT_ORG_ID}/state`, "GET", undefined, owner),
        orgParams(DEFAULT_ORG_ID),
      )
    ).json()) as { state: { players: unknown[] } };
    expect(otherState.state.players).toEqual([]);
  });

  it("hides an owner's draft org from other owners", async () => {
    const { org } = await createOwnedOrg();
    await addOwner(
      jsonRequest(
        `${LIST_URL}/${DEFAULT_ORG_ID}/owners`,
        "POST",
        { ...OWNER, email: "other@example.com" },
        await cookieFor("admin-1"),
      ),
      orgParams(DEFAULT_ORG_ID),
    );
    const other = await authenticateUser("other@example.com", OWNER.password);

    const res = await getOrgState(
      jsonRequest(
        `http://localhost/api/orgs/${org.id}/state`,
        "GET",
        undefined,
        await cookieFor(other!.id),
      ),
      orgParams(org.id),
    );
    expect(res.status).toBe(404);
  });
});
