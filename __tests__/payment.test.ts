import { describe, expect, it } from "vitest";
import {
  buildPaymentLink,
  filterPlayersByPaymentStatus,
  formatTransactionDate,
  formatUsdAmount,
  getPlayerPaymentAmount,
  getPlayerTenure,
  sortPlayersByTransactionDate,
} from "@/lib/payment";
import { markPaymentLinkSent } from "@/lib/player-store";
import { sampleData } from "@/lib/sample-data";
import { CLINIC_WEEKLY_FEE_USD } from "@/lib/programs";

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

  it("formats financial display fields for players", () => {
    const lucas = sampleData.players.find(
      (player) => player.name === "Lucas Rivera",
    )!;
    const alex = sampleData.players.find(
      (player) => player.name === "Alex Johnson",
    )!;

    expect(formatUsdAmount(CLINIC_WEEKLY_FEE_USD)).toBe("$460.00");
    expect(getPlayerPaymentAmount(alex)).toBe(CLINIC_WEEKLY_FEE_USD);
    expect(formatTransactionDate(lucas.paymentLinkSentAt)).toContain("2025");
    expect(getPlayerTenure(alex, sampleData.programs)).toBe("new");
    expect(getPlayerTenure(lucas, sampleData.programs)).toBe("new");
  });

  it("sorts by transaction date and filters paid/unpaid", () => {
    const older = {
      ...sampleData.players[0],
      id: "p-old",
      name: "Older Paid",
      paymentLinkSentAt: "2025-01-01T10:00:00.000Z",
    };
    const newer = {
      ...sampleData.players[0],
      id: "p-new",
      name: "Newer Paid",
      paymentLinkSentAt: "2025-11-20T12:00:00.000Z",
    };
    const unpaid = {
      ...sampleData.players[0],
      id: "p-unpaid",
      name: "Unpaid Player",
      paymentLinkSentAt: undefined,
    };

    const sorted = sortPlayersByTransactionDate([unpaid, older, newer]);
    expect(sorted.map((player) => player.id)).toEqual([
      "p-new",
      "p-old",
      "p-unpaid",
    ]);

    expect(filterPlayersByPaymentStatus(sorted, "paid")).toHaveLength(2);
    expect(filterPlayersByPaymentStatus(sorted, "unpaid")).toHaveLength(1);
    expect(filterPlayersByPaymentStatus(sorted, "all")).toHaveLength(3);
  });
});
