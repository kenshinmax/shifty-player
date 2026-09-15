import { NextResponse } from "next/server";
import { seedRegistrationState } from "@/lib/db/registration-repository";
import { sampleData } from "@/lib/sample-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Dev/test helper: reset registration collections to sample data. */
export async function POST() {
  try {
    const state = await seedRegistrationState(sampleData);
    return NextResponse.json({ state });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to seed database.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
