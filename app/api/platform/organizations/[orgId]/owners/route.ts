import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { orgNotFound } from "@/lib/api-viewer";
import { assignOwner, parseOwnerInput } from "@/lib/db/auth-repository";
import { getOrganizationById } from "@/lib/db/platform-repository";
import type { OrganizationOwner } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Gives an existing org its owner: an existing account by email, or a new one. */
export async function POST(
  request: Request,
  context: { params: Promise<{ orgId: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const { orgId } = await context.params;
  const org = await getOrganizationById(orgId);
  if (!org) return orgNotFound();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await assignOwner(parseOwnerInput(body), org);
  if (result.error !== null) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const owner: OrganizationOwner = { name: result.user.name, email: result.user.email };
  return NextResponse.json({ owner }, { status: 201 });
}
