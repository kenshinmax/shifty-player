import { after, NextResponse } from "next/server";
import {
  buildSessionCookie,
  createSession,
  registerUser,
} from "@/lib/db/auth-repository";
import type { SignupInput } from "@/lib/auth";
import { buildSignupProperties, upsertHubSpotContact } from "@/lib/hubspot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: SignupInput;
  try {
    body = (await request.json()) as SignupInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await registerUser(body);
  if (result.error || !result.user) {
    return NextResponse.json(
      { error: result.error ?? "Unable to create account." },
      { status: 400 },
    );
  }

  // Create the parent in HubSpot after the response is sent, so a slow or
  // failing CRM call never blocks account creation.
  const newUser = result.user;
  const marketingOptIn = body.marketingOptIn === true;
  after(async () => {
    await upsertHubSpotContact(
      newUser.email,
      buildSignupProperties(newUser, marketingOptIn),
    );
  });

  const token = await createSession(result.user.id);
  const response = NextResponse.json({ user: result.user });
  response.headers.set("Set-Cookie", buildSessionCookie(token));
  return response;
}
