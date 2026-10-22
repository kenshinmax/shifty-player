import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  assignOwner,
  listOwners,
  parseOwnerInput,
  validateOwnerInput,
} from "@/lib/db/auth-repository";
import {
  createOrganization,
  listAllOrganizations,
} from "@/lib/db/platform-repository";
import type { OrganizationOwner } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const [organizations, owners] = await Promise.all([
    listAllOrganizations(),
    listOwners(),
  ]);
  return NextResponse.json({
    organizations: organizations.map((org) => ({
      ...org,
      owners: owners
        .filter((owner) => owner.orgId === org.id)
        .map(({ name, email }): OrganizationOwner => ({ name, email })),
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const { name, slug, owner } = body as { name?: unknown; slug?: unknown; owner?: unknown };

  // Check the owner first so a bad email never leaves an ownerless draft behind.
  const ownerInput = owner === undefined ? null : parseOwnerInput(owner);
  if (ownerInput) {
    const ownerError = await validateOwnerInput(ownerInput);
    if (ownerError) return NextResponse.json({ error: ownerError }, { status: 400 });
  }

  const result = await createOrganization({
    name: typeof name === "string" ? name : "",
    slug: typeof slug === "string" ? slug : "",
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  if (ownerInput) {
    const created = await assignOwner(ownerInput, result.organization);
    if (created.error) {
      return NextResponse.json({ error: created.error }, { status: 400 });
    }
  }
  return NextResponse.json({ organization: result.organization }, { status: 201 });
}
