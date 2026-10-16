import { describe, expect, it } from "vitest";
import { promotionEligibilityMessage } from "./promotionPricing";

const expiredPromotion = {
  active: false,
  status: "EXPIRED",
  startDate: "2025-01-01T00:00:00",
  endDate: "2025-01-31T23:59:59",
};

describe("promotion eligibility for existing bookings", () => {
  it("allows the existing promotion when applyAt was within its validity period", () => {
    expect(promotionEligibilityMessage(
      { ...expiredPromotion, used: true },
      500_000,
      300_000,
      200_000,
      { alreadyApplied: true, applyAt: "2025-01-15T12:00:00" },
    )).toBe("");
  });

  it("rejects an existing promotion applied after its expiration date", () => {
    expect(promotionEligibilityMessage(
      expiredPromotion,
      500_000,
      300_000,
      200_000,
      { alreadyApplied: true, applyAt: "2025-02-01T00:00:00" },
    )).toContain("Mã khuyến mãi không còn hiệu lực");
  });

  it("rejects an expired promotion when newly applying it", () => {
    expect(promotionEligibilityMessage(
      expiredPromotion,
      500_000,
      300_000,
      200_000,
    )).toContain("Mã khuyến mãi không còn hiệu lực");
  });
});
