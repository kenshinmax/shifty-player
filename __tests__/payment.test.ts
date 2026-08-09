import { describe, expect, it } from "vitest";
import { buildPaymentLink } from "@/lib/payment";
import { markPaymentLinkSent } from "@/lib/player-store";
import { sampleData } from "@/lib/sample-data";

describe("payment links", () => {
  it("builds a payment link for a player", () => {
    const player = sampleData.players[0];
    const link = buildPaymentLink(player);
    expect(link).toContain(player.id);
    expect(link).toContain(encodeURIComponent(player.email));
  });

  it("marks a payment link as sent", () => {
    const playerId = sampleData.players[0].id;
    const next = markPaymentLinkSent(sampleData, playerId, "2026-08-07T12:00:00.000Z");
    expect(
      next.players.find((player) => player.id === playerId)?.paymentLinkSentAt,
    ).toBe("2026-08-07T12:00:00.000Z");
  });
});
