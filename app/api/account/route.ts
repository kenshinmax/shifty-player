import { NextResponse } from "next/server";
import { resolveUser } from "@/lib/api-viewer";
import { childrenForParent, organizationsForParent } from "@/lib/db/family-repository";
import { getStateForViewer } from "@/lib/db/registration-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const [children, orgs] = await Promise.all([
    childrenForParent(user.id),
    organizationsForParent(user.id),
  ]);
  const organizations = await Promise.all(
    orgs.map(async (org) => ({
      organization: { id: org.id, slug: org.slug, name: org.name },
      state: await getStateForViewer(org.id, { kind: "parent", userId: user.id }),
    })),
  );
  return NextResponse.json({ children, organizations });
}
