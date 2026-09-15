import { NextResponse } from "next/server";
import { getRegistrationState } from "@/lib/db/registration-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await getRegistrationState();
    return NextResponse.json({ state });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load state.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
