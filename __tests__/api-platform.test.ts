import { beforeEach, describe, expect, it } from "vitest";
import {
  GET as listOrgs,
  POST as createOrg,
} from "@/app/api/platform/organizations/route";
import { PATCH as patchOrg } from "@/app/api/platform/organizations/[orgId]/route";
import {
  buildSessionCookie,
  createSession,
  ensureAuthSeeded,
} from "@/lib/db/auth-repository";
import { resetMemoryStore } from "@/lib/db/doc-store";
import { DEFAULT_ORG_SLUG } from "@/lib/organizations";
import type { Organization } from "@/lib/types";

async function cookieFor(userId: string): Promise<Record<string, string>> {
  await ensureAuthSeeded();
  return { cookie: buildSessionCookie(await createSession(userId)) };
}

function jsonRequest(url: string, method: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const LIST_URL = "http://localhost/api/platform/organizations";

describe("platform organization APIs", () => {
  beforeEach(() => resetMemoryStore({}));

  it("requires sign-in and the admin role", async () => {
    expect((await listOrgs(new Request(LIST_URL))).status).toBe(401);
    expect((await listOrgs(new Request(LIST_URL, { headers: await cookieFor("user-1") }))).status).toBe(403);
    const created = await createOrg(
      jsonRequest(LIST_URL, "POST", { name: "Bay Hoops", slug: "bay-hoops" }, await cookieFor("user-1")),
    );
    expect(created.status).toBe(403);
    const published = await patchOrg(
      jsonRequest(`${LIST_URL}/x`, "PATCH", { status: "live" }, await cookieFor("user-1")),
      { params: Promise.resolve({ orgId: "x" }) },
    );
    expect(published.status).toBe(403);
  });

  it("creates a draft org, lists it, then publishes it", async () => {
    const admin = await cookieFor("admin-1");
    const created = await createOrg(
      jsonRequest(LIST_URL, "POST", { name: "Bay Hoops", slug: "bay-hoops" }, admin),
    );
    expect(created.status).toBe(201);
    const { organization } = (await created.json()) as { organization: Organization };
    expect(organization).toMatchObject({ name: "Bay Hoops", slug: "bay-hoops", status: "draft" });

    const listed = (await (await listOrgs(new Request(LIST_URL, { headers: admin }))).json()) as {
      organizations: Organization[];
    };
    expect(listed.organizations.map((o) => [o.slug, o.status])).toEqual([
      ["bay-hoops", "draft"],
      [DEFAULT_ORG_SLUG, "live"],
    ]);

    const published = await patchOrg(
      jsonRequest(`${LIST_URL}/${organization.id}`, "PATCH", { status: "live" }, admin),
      { params: Promise.resolve({ orgId: organization.id }) },
    );
    expect(published.status).toBe(200);
    expect(((await published.json()) as { organization: Organization }).organization.status).toBe("live");
  });

  it("returns 400 with the validation message for bad input", async () => {
    const admin = await cookieFor("admin-1");
    const taken = await createOrg(
      jsonRequest(LIST_URL, "POST", { name: "Copy", slug: DEFAULT_ORG_SLUG }, admin),
    );
    expect(taken.status).toBe(400);
    expect(await taken.json()).toEqual({ error: "That URL is taken." });

    const notObject = await createOrg(jsonRequest(LIST_URL, "POST", null, admin));
    expect(notObject.status).toBe(400);
    expect(await notObject.json()).toEqual({ error: "Invalid JSON body." });

    const badStatus = await patchOrg(
      jsonRequest(`${LIST_URL}/x`, "PATCH", { status: "suspended" }, admin),
      { params: Promise.resolve({ orgId: "x" }) },
    );
    expect(badStatus.status).toBe(400);
    expect(await badStatus.json()).toEqual({ error: 'Only { "status": "live" } is supported.' });
  });

  it("returns 404 when publishing an unknown org", async () => {
    const res = await patchOrg(
      jsonRequest(`${LIST_URL}/nope`, "PATCH", { status: "live" }, await cookieFor("admin-1")),
      { params: Promise.resolve({ orgId: "nope" }) },
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Organization not found." });
  });
});
