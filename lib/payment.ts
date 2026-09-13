import { CLINIC_WEEKLY_FEE_USD } from "./programs";
import type { Player, Program } from "./types";

const PAYMENT_BASE_URL = "https://pay.shifty-player.example/checkout";

/** Build a mock payment link for a player registration. */
export function buildPaymentLink(player: Player): string {
  const params = new URLSearchParams({
    playerId: player.id,
    name: player.name,
    email: player.email,
  });
  return `${PAYMENT_BASE_URL}?${params.toString()}`;
}

/**
 * Stripe confirmation model (localStorage MVP):
 *
 * 1. Server creates a PaymentIntent with metadata:
 *    { playerId, programId, clinicId, parentUserId, amountCents }
 * 2. Client confirms with Stripe Payment Element (card never hits our servers).
 * 3. Client calls confirm-enrollment; server retrieves the PaymentIntent and
 *    checks status / amount / metadata, then returns { approved: true }.
 * 4. Only then the client calls completePaidClinicRegistration (localStorage).
 * 5. Webhook `payment_intent.succeeded` records metrics idempotently — it cannot
 *    write browser storage.
 *
 * Do not enroll from a forged client “success” without server verify.
 */
export const STRIPE_ENROLLMENT_SOURCE = "stripe.payment_intent.succeeded";

export function formatUsdAmount(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatTransactionDate(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** Newest paid transactions first; unpaid players follow, sorted by name. */
export function sortPlayersByTransactionDate(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    const aPaid = a.paymentLinkSentAt
      ? Date.parse(a.paymentLinkSentAt)
      : Number.NaN;
    const bPaid = b.paymentLinkSentAt
      ? Date.parse(b.paymentLinkSentAt)
      : Number.NaN;
    const aHasDate = Number.isFinite(aPaid);
    const bHasDate = Number.isFinite(bPaid);

    if (aHasDate && bHasDate) return bPaid - aPaid;
    if (aHasDate !== bHasDate) return aHasDate ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export type FinancialsPaymentFilter = "all" | "paid" | "unpaid";

/** Paid / enrolled in financials terms — same signal as Active Programs "enrolled". */
export function isPlayerPaid(player: Player): boolean {
  return Boolean(player.paymentLinkSentAt);
}

export function filterPlayersByPaymentStatus(
  players: Player[],
  filter: FinancialsPaymentFilter,
): Player[] {
  if (filter === "paid") {
    return players.filter((player) => isPlayerPaid(player));
  }
  if (filter === "unpaid") {
    return players.filter((player) => !isPlayerPaid(player));
  }
  return players;
}

/** Estimated registration amount from enrolled clinics (demo). */
export function getPlayerPaymentAmount(player: Player): number {
  const clinics = Math.max(player.sessionIds.length, 1);
  return clinics * CLINIC_WEEKLY_FEE_USD;
}

/**
 * Returning = enrolled in more than one program, or any completed program.
 * Otherwise the player is treated as new.
 */
export function getPlayerTenure(
  player: Player,
  programs: Program[],
): "new" | "returning" {
  if (player.programIds.length > 1) return "returning";
  const completed = player.programIds.some((programId) => {
    const program = programs.find((entry) => entry.id === programId);
    return program?.status === "completed";
  });
  return completed ? "returning" : "new";
}
