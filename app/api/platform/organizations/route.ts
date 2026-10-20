import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  createOrganization,
  listAllOrganizations,
} from "@/lib/db/platform-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  return NextResponse.json({ organizations: await listAllOrganizations() });
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
  const { name, slug } = body as { name?: unknown; slug?: unknown };

  const result = await createOrganization({
    name: typeof name === "string" ? name : "",
    slug: typeof slug === "string" ? slug : "",
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ organization: result.organization }, { status: 201 });
}
