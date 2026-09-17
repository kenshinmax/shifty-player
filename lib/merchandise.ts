import { CLINIC_FEE_CENTS } from "@/lib/stripe-constants";

/** Apparel sizes offered for team gear. */
export const MERCHANDISE_SIZES = [
  "YS",
  "YM",
  "YL",
  "AS",
  "AM",
  "AL",
  "AXL",
] as const;

export type MerchandiseSize = (typeof MERCHANDISE_SIZES)[number];

export type MerchandiseSkuId = "tshirt" | "shorts";

export type MerchandiseItem = {
  id: MerchandiseSkuId;
  name: string;
  /** Unit price in USD (whole dollars for MVP). */
  priceUsd: number;
  /** Public path for the product thumbnail shown at checkout. */
  imageSrc?: string;
};

export const MERCHANDISE_CATALOG: MerchandiseItem[] = [
  {
    id: "tshirt",
    name: "Team T-Shirt",
    priceUsd: 25,
    imageSrc: "/bbal-tshirt-swag.png",
  },
  { id: "shorts", name: "Team Shorts", priceUsd: 30 },
];

export type CartLine = {
  skuId: MerchandiseSkuId;
  size: MerchandiseSize;
  quantity: number;
};

export type MerchandiseOrderItem = {
  skuId: string;
  name: string;
  size: string;
  quantity: number;
  unitCents: number;
};

export type MerchandiseOrder = {
  clinicId: string;
  items: MerchandiseOrderItem[];
  tuitionCents: number;
  swagCents: number;
  totalCents: number;
  paidAt: string;
};

const MAX_LINE_QUANTITY = 10;
const MAX_CART_LINES = 8;

export function getMerchandiseItem(
  skuId: string,
): MerchandiseItem | undefined {
  return MERCHANDISE_CATALOG.find((item) => item.id === skuId);
}

export function isMerchandiseSize(value: unknown): value is MerchandiseSize {
  return (
    typeof value === "string" &&
    (MERCHANDISE_SIZES as readonly string[]).includes(value)
  );
}

export function isMerchandiseSkuId(value: unknown): value is MerchandiseSkuId {
  return value === "tshirt" || value === "shorts";
}

/** Normalize unknown JSON into a cart; returns error if invalid. */
export function parseCart(value: unknown): CartLine[] | { error: string } {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return { error: "Cart must be an array." };
  if (value.length > MAX_CART_LINES) {
    return { error: `Cart may have at most ${MAX_CART_LINES} lines.` };
  }

  const lines: CartLine[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      return { error: "Invalid cart line." };
    }
    const row = entry as Record<string, unknown>;
    if (!isMerchandiseSkuId(row.skuId)) {
      return { error: "Unknown merchandise item." };
    }
    if (!isMerchandiseSize(row.size)) {
      return { error: "Invalid merchandise size." };
    }
    const quantity = Number(row.quantity);
    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_LINE_QUANTITY
    ) {
      return {
        error: `Quantity must be between 1 and ${MAX_LINE_QUANTITY}.`,
      };
    }
    lines.push({ skuId: row.skuId, size: row.size, quantity });
  }
  return lines;
}

export function validateCart(cart: CartLine[]): string | null {
  const parsed = parseCart(cart);
  if ("error" in parsed) return parsed.error;
  return null;
}

export function computeSwagCents(cart: CartLine[]): number {
  let total = 0;
  for (const line of cart) {
    const item = getMerchandiseItem(line.skuId);
    if (!item) continue;
    total += item.priceUsd * 100 * line.quantity;
  }
  return total;
}

export function computeRegistrationTotalCents(cart: CartLine[]): number {
  return CLINIC_FEE_CENTS + computeSwagCents(cart);
}

/** Compact JSON for Stripe metadata (keep under 500 chars). */
export function serializeCartForMetadata(cart: CartLine[]): string {
  return JSON.stringify(
    cart.map((line) => [line.skuId, line.size, line.quantity]),
  );
}

export function parseCartFromMetadata(
  swagJson: string | undefined,
): CartLine[] | { error: string } {
  if (!swagJson || swagJson === "[]") return [];
  try {
    const raw: unknown = JSON.parse(swagJson);
    if (!Array.isArray(raw)) return { error: "Invalid swag metadata." };
    const lines: CartLine[] = [];
    for (const entry of raw) {
      if (!Array.isArray(entry) || entry.length !== 3) {
        return { error: "Invalid swag metadata line." };
      }
      const [skuId, size, quantity] = entry;
      lines.push({
        skuId: skuId as MerchandiseSkuId,
        size: size as MerchandiseSize,
        quantity: Number(quantity),
      });
    }
    return parseCart(lines);
  } catch {
    return { error: "Could not parse swag metadata." };
  }
}

export function buildMerchandiseOrder(
  clinicId: string,
  cart: CartLine[],
  paidAt: string = new Date().toISOString(),
): MerchandiseOrder {
  const items: MerchandiseOrderItem[] = cart.map((line) => {
    const catalog = getMerchandiseItem(line.skuId)!;
    return {
      skuId: line.skuId,
      name: catalog.name,
      size: line.size,
      quantity: line.quantity,
      unitCents: catalog.priceUsd * 100,
    };
  });
  const swagCents = computeSwagCents(cart);
  return {
    clinicId,
    items,
    tuitionCents: CLINIC_FEE_CENTS,
    swagCents,
    totalCents: CLINIC_FEE_CENTS + swagCents,
    paidAt,
  };
}
