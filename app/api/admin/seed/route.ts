import { NextResponse } from "next/server";
import { seedRegistrationState } from "@/lib/db/registration-repository";
import { sampleData } from "@/lib/sample-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Dev/test helper: reset registration collections to sample data. */
export async function POST() {
  // Unauthenticated and destructive, so it must never be reachable in production.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  try {
    const state = await seedRegistrationState(sampleData);
    return NextResponse.json({ state });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to seed database.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
