import { getAuthUserById } from "@/lib/db/auth-repository";
import {
  buildEnrollmentProperties,
  buildRegistrationDealProperties,
  upsertHubSpotContact,
  upsertHubSpotDeal,
} from "@/lib/hubspot";
import type { AppState } from "@/lib/types";

/**
 * After a paid clinic enrollment: update the parent's HubSpot contact and
 * record the registration as a closed-won deal on it.
 */
export async function syncEnrollmentToHubSpot(
  state: AppState,
  playerId: string,
  programId: string,
  paymentIntentId: string,
): Promise<void> {
  const enrollment = buildEnrollmentProperties(state, playerId, programId);
  if (!enrollment) return;
  const parent = await getAuthUserById(enrollment.parentUserId);
  if (!parent) return;

  const contact = await upsertHubSpotContact(
    parent.email,
    enrollment.properties,
  );
  if (!contact.ok || contact.skipped || !contact.id) return;

  const deal = buildRegistrationDealProperties(
    state,
    playerId,
    programId,
    paymentIntentId,
    parent.name,
  );
  if (!deal) return;
  await upsertHubSpotDeal(deal, contact.id);
}
