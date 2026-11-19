import { describe, expect, it } from "vitest";
import { getBookingSurchargeBreakdown, getBookingTotalFromBreakdown, getServicePriceBreakdown, getServiceQuantityForRoom, roundVndAmount } from "./bookingPricing";

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

describe("getServiceQuantityForRoom", () => {
  it("keeps an explicitly selected quantity instead of multiplying by room guests", () => {
    expect(getServiceQuantityForRoom({ quantity: 1 }, 3)).toBe(1);
    expect(getServiceQuantityForRoom({ quantity: 1, applyToRoom: false }, 3)).toBe(1);
  });

  it("uses the guest count only when the service is explicitly applied to the whole room", () => {
    expect(getServiceQuantityForRoom({ quantity: 1, applyToRoom: true }, 3)).toBe(3);
  });
});

describe("roundVndAmount", () => {
  it("removes floating-point residue from whole-dong amounts", () => {
    expect(roundVndAmount(3938.999999999993)).toBe(3939);
  });
});

describe("getBookingTotalFromBreakdown", () => {
  it("uses the full itemized surcharge instead of a stale stored surcharge amount", () => {
    expect(getBookingTotalFromBreakdown({
      storedTotal: 258000,
      roomTotal: 8000,
      serviceTotal: 250000,
      surchargeTotal: 4000,
      discountTotal: 0,
    })).toBe(262000);
  });
});

describe("getBookingSurchargeBreakdown", () => {
  it("keeps a cancelled room's cancellation surcharge but excludes its stay fees", () => {
    expect(getBookingSurchargeBreakdown([
      { bookingStatusType: "CANCELLED", earlyCheckInFee: 200, otherSurcharges: 1344 },
      { bookingStatusType: "PENDING", earlyCheckInFee: 300, lateCheckOutFee: 400, otherSurcharges: 50 },
    ])).toEqual({
      earlyCheckinFeeTotal: 300,
      lateCheckoutFeeTotal: 400,
      otherSurchargesTotal: 1394,
    });
  });
});
