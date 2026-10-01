import type { AppState } from "@/lib/types";

/**
 * HubSpot CRM sync (server-only).
 *
 * Parents become HubSpot contacts when they sign up, and are updated when a
 * clinic payment succeeds, so marketing lists can target them for renewals,
 * upsells and win-back campaigns. Each paid registration is also recorded as
 * a closed-won deal on the parent's contact for revenue reporting.
 *
 * Without HUBSPOT_ACCESS_TOKEN every call is a no-op, so local dev, CI and
 * e2e keep working without a HubSpot account.
 *
 * Children's names, emails and other personal details are intentionally never
 * sent; only aggregate info (player count, grades, program) goes to HubSpot.
 */

const HUBSPOT_API = "https://api.hubapi.com";

export type HubSpotProperties = Record<string, string>;

export type HubSpotSyncResult =
  | { ok: true; skipped?: false; id?: string }
  | { ok: true; skipped: true }
  | { ok: false; error: string };

/** Custom contact properties this app writes. Created by scripts/hubspot-setup.mjs. */
export const HUBSPOT_CUSTOM_PROPERTIES = [
  "shifty_marketing_opt_in",
  "shifty_signup_date",
  "shifty_player_count",
  "shifty_player_grades",
  "shifty_last_program",
  "shifty_last_payment_date",
  "shifty_last_payment_amount",
] as const;

export function isHubSpotConfigured(): boolean {
  return Boolean(process.env.HUBSPOT_ACCESS_TOKEN?.trim());
}

function toHubSpotDate(iso: string): string {
  // HubSpot date properties accept YYYY-MM-DD.
  return iso.slice(0, 10);
}

export function buildSignupProperties(
  user: { name: string; email: string },
  marketingOptIn: boolean,
  now: Date = new Date(),
): HubSpotProperties {
  const [firstname, ...rest] = user.name.trim().split(/\s+/);
  return {
    email: user.email,
    firstname: firstname ?? "",
    lastname: rest.join(" "),
    lifecyclestage: "lead",
    shifty_marketing_opt_in: marketingOptIn ? "true" : "false",
    shifty_signup_date: toHubSpotDate(now.toISOString()),
  };
}

/**
 * Properties for a parent after a paid clinic enrollment.
 * Returns null when the player has no parent account to attribute it to.
 */
export function buildEnrollmentProperties(
  state: AppState,
  playerId: string,
  programId: string,
): { parentUserId: string; properties: HubSpotProperties } | null {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player?.parentUserId) return null;

  const children = state.players.filter(
    (entry) => entry.parentUserId === player.parentUserId,
  );
  const grades = [...new Set(children.map((child) => child.grade))]
    .filter(Boolean)
    .sort();
  const program = state.programs.find((entry) => entry.id === programId);
  const order = player.merchandiseOrder;

  const properties: HubSpotProperties = {
    lifecyclestage: "customer",
    shifty_player_count: String(children.length),
    shifty_player_grades: grades.join(", "),
    shifty_last_program: program?.name ?? programId,
  };
  if (order) {
    properties.shifty_last_payment_date = toHubSpotDate(order.paidAt);
    properties.shifty_last_payment_amount = (order.totalCents / 100).toFixed(2);
  }

  return { parentUserId: player.parentUserId, properties };
}

type HubSpotResponse =
  | { ok: true; body: unknown }
  | { ok: false; error: string };

/** Authenticated HubSpot call that logs and returns failures instead of throwing. */
async function hubspotRequest(
  token: string,
  method: "POST" | "PUT",
  path: string,
  body: unknown,
  fetchImpl: typeof fetch,
): Promise<HubSpotResponse> {
  try {
    const response = await fetchImpl(`${HUBSPOT_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const error = `HubSpot ${path} failed (${response.status}): ${await response.text()}`;
      console.error(error);
      return { ok: false, error };
    }
    const text = await response.text();
    return { ok: true, body: text ? JSON.parse(text) : null };
  } catch (err) {
    const error = `HubSpot ${path} failed: ${err instanceof Error ? err.message : String(err)}`;
    console.error(error);
    return { ok: false, error };
  }
}

/** Record id of the first result in a batch upsert response, if present. */
function firstResultId(body: unknown): string | undefined {
  const results = (body as { results?: { id?: unknown }[] } | null)?.results;
  const id = results?.[0]?.id;
  return typeof id === "string" ? id : undefined;
}

/**
 * Create or update a contact keyed by email (single idempotent call).
 * Never throws: failures are returned and logged so callers can't break
 * signup or checkout because HubSpot is down.
 */
export async function upsertHubSpotContact(
  email: string,
  properties: HubSpotProperties,
  fetchImpl: typeof fetch = fetch,
): Promise<HubSpotSyncResult> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN?.trim();
  if (!token) return { ok: true, skipped: true };

  const normalizedEmail = email.trim().toLowerCase();
  const result = await hubspotRequest(
    token,
    "POST",
    "/crm/v3/objects/contacts/batch/upsert",
    {
      inputs: [
        {
          idProperty: "email",
          id: normalizedEmail,
          properties: { ...properties, email: normalizedEmail },
        },
      ],
    },
    fetchImpl,
  );
  if (!result.ok) return result;
  return { ok: true, id: firstResultId(result.body) };
}

/**
 * Deal for one paid registration (player + program), named by program and
 * family surname so no child details reach HubSpot.
 * Returns null when there is no paid order to report.
 */
export function buildRegistrationDealProperties(
  state: AppState,
  playerId: string,
  programId: string,
  paymentIntentId: string,
  parentName: string,
): HubSpotProperties | null {
  const player = state.players.find((entry) => entry.id === playerId);
  const order = player?.merchandiseOrder;
  if (!order) return null;

  const program = state.programs.find((entry) => entry.id === programId);
  const programName = program?.name ?? programId;
  const surname = parentName.trim().split(/\s+/).at(-1) ?? "";

  return {
    dealname: surname ? `${programName} – ${surname}` : programName,
    amount: (order.totalCents / 100).toFixed(2),
    closedate: toHubSpotDate(order.paidAt),
    pipeline: process.env.HUBSPOT_DEAL_PIPELINE?.trim() || "default",
    dealstage: process.env.HUBSPOT_DEAL_STAGE?.trim() || "closedwon",
    shifty_payment_id: paymentIntentId,
    shifty_program: programName,
  };
}

/**
 * Create or update a deal keyed by the Stripe payment id (so retries never
 * duplicate it) and associate it with the parent's contact.
 */
export async function upsertHubSpotDeal(
  properties: HubSpotProperties,
  contactId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<HubSpotSyncResult> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN?.trim();
  if (!token) return { ok: true, skipped: true };

  const upserted = await hubspotRequest(
    token,
    "POST",
    "/crm/v3/objects/deals/batch/upsert",
    {
      inputs: [
        {
          idProperty: "shifty_payment_id",
          id: properties.shifty_payment_id,
          properties,
        },
      ],
    },
    fetchImpl,
  );
  if (!upserted.ok) return upserted;
  const dealId = firstResultId(upserted.body);
  if (!dealId) {
    const error = "HubSpot deal upsert returned no deal id.";
    console.error(error);
    return { ok: false, error };
  }

  const associated = await hubspotRequest(
    token,
    "PUT",
    `/crm/v4/objects/deals/${dealId}/associations/default/contacts/${contactId}`,
    null,
    fetchImpl,
  );
  if (!associated.ok) return associated;
  return { ok: true, id: dealId };
}
