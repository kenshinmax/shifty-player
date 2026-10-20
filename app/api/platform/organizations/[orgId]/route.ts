import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { orgNotFound } from "@/lib/api-viewer";
import {
  getOrganizationById,
  publishOrganization,
} from "@/lib/db/platform-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Publishes a draft org. Other status changes arrive with Phase 3. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ orgId: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const { orgId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  if (typeof body !== "object" || body === null || (body as { status?: unknown }).status !== "live") {
    return NextResponse.json(
      { error: 'Only { "status": "live" } is supported.' },
      { status: 400 },
    );
  }

  if (!(await getOrganizationById(orgId))) return orgNotFound();
  const result = await publishOrganization(orgId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ organization: result.organization });
}
