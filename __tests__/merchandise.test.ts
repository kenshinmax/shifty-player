import { describe, expect, it } from "vitest";
import {
  MERCHANDISE_CATALOG,
  buildMerchandiseOrder,
  computeRegistrationTotalCents,
  computeSwagCents,
  parseCart,
  parseCartFromMetadata,
  serializeCartForMetadata,
  validateCart,
} from "@/lib/merchandise";
import { CLINIC_FEE_CENTS } from "@/lib/stripe-constants";

describe("merchandise cart", () => {
  it("exposes t-shirt and shorts catalog", () => {
    expect(MERCHANDISE_CATALOG.map((item) => item.id)).toEqual([
      "tshirt",
      "shorts",
    ]);
  });

  it("validates cart lines", () => {
    expect(validateCart([])).toBeNull();
    expect(
      validateCart([{ skuId: "tshirt", size: "AM", quantity: 1 }]),
    ).toBeNull();
    expect(
      validateCart([{ skuId: "tshirt", size: "XXL" as "AM", quantity: 1 }]),
    ).toMatch(/size/i);
    expect(
      parseCart([{ skuId: "hoodie", size: "AM", quantity: 1 }]),
    ).toEqual({ error: "Unknown merchandise item." });
  });

  it("computes swag and registration totals from catalog prices", () => {
    const cart = [
      { skuId: "tshirt" as const, size: "AM" as const, quantity: 2 },
      { skuId: "shorts" as const, size: "YL" as const, quantity: 1 },
    ];
    expect(computeSwagCents(cart)).toBe(25 * 100 * 2 + 30 * 100);
    expect(computeRegistrationTotalCents(cart)).toBe(
      CLINIC_FEE_CENTS + 25 * 100 * 2 + 30 * 100,
    );
    expect(computeRegistrationTotalCents([])).toBe(CLINIC_FEE_CENTS);
  });

  it("round-trips compact metadata JSON", () => {
    const cart = [
      { skuId: "tshirt" as const, size: "YS" as const, quantity: 1 },
    ];
    const serialized = serializeCartForMetadata(cart);
    expect(serialized.length).toBeLessThan(500);
    expect(parseCartFromMetadata(serialized)).toEqual(cart);
    expect(parseCartFromMetadata(undefined)).toEqual([]);
  });

  it("builds a merchandise order snapshot", () => {
    const order = buildMerchandiseOrder(
      "clinic-1",
      [{ skuId: "shorts", size: "AL", quantity: 1 }],
      "2026-07-01T12:00:00.000Z",
    );
    expect(order).toMatchObject({
      clinicId: "clinic-1",
      tuitionCents: CLINIC_FEE_CENTS,
      swagCents: 3000,
      totalCents: CLINIC_FEE_CENTS + 3000,
      paidAt: "2026-07-01T12:00:00.000Z",
      items: [
        {
          skuId: "shorts",
          name: "Team Shorts",
          size: "AL",
          quantity: 1,
          unitCents: 3000,
        },
      ],
    });
  });
});
