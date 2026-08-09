import type { Player } from "./types";

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
