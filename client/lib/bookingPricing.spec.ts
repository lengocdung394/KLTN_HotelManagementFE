import { describe, expect, it } from "vitest";
import { getServicePriceBreakdown } from "./bookingPricing";

describe("getServicePriceBreakdown", () => {
  it("uses the stored price for booked quantity and current price for newly added quantity", () => {
    const lines = getServicePriceBreakdown({
      quantity: 4,
      originalQuantity: 3,
      price: 250000,
      isExisting: true,
    }, 200000);

    expect(lines).toEqual([
      { quantity: 3, unitPrice: 250000, isAdditional: false },
      { quantity: 1, unitPrice: 200000, isAdditional: true },
    ]);
    expect(lines.reduce((total, line) => total + line.quantity * line.unitPrice, 0)).toBe(950000);
  });
});
