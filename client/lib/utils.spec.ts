import { describe, it, expect } from "vitest";
import { cn } from "./utils";
import { sumRoomPriceForRange } from "./bookingPricing";
import { calculatePromotionDiscount, promotionEligibilityMessage } from "./promotionPricing";
import { CUSTOMER_REFRESH_EVENTS, buildCustomerSocketPayload, buildSeasonalRateSocketPayload, SEASONAL_RATE_UPDATE_EVENT } from "./socket";
import { extractRoomSeasonalRatePage } from "../services/roomApi";

describe("calculatePromotionDiscount", () => {
  const roomTotal = 300000;
  const serviceTotal = 200000;
  const subtotal = roomTotal + serviceTotal;

  it("applies the percentage cap to the room amount", () => {
    expect(calculatePromotionDiscount({ type: "ROOM", value: 20, valueType: "PERCENTAGE", maxDiscountAmount: 25000 }, roomTotal, serviceTotal, subtotal)).toBe(25000);
  });

  it("applies the percentage cap to the service amount", () => {
    expect(calculatePromotionDiscount({ type: "SERVICE", value: 20, valueType: "PERCENTAGE", maxDiscountAmount: 15000 }, roomTotal, serviceTotal, subtotal)).toBe(15000);
  });

  it("applies the percentage cap to the full subtotal", () => {
    expect(calculatePromotionDiscount({ type: "TOTAL", value: 20, valueType: "PERCENTAGE", maxDiscountAmount: 70000 }, roomTotal, serviceTotal, subtotal)).toBe(70000);
  });

  it("does not discount more than the amount in scope", () => {
    expect(calculatePromotionDiscount({ type: "SERVICE", value: 100, valueType: "PERCENTAGE", maxDiscountAmount: 500000 }, roomTotal, serviceTotal, subtotal)).toBe(serviceTotal);
  });
});

describe("promotionEligibilityMessage", () => {
  it("checks booking, room, and service minimums even when the discount scope is room", () => {
    const message = promotionEligibilityMessage({
      type: "ROOM",
      value: 10,
      valueType: "PERCENTAGE",
      minBookingValue: 500000,
      minRoomValue: 100000,
      minServiceValue: 200000,
      active: true,
    }, 400000, 90000, 100000);

    expect(message).toContain("Tổng booking cần đạt 500.000đ");
    expect(message).toContain("Tiền phòng cần đạt 100.000đ");
    expect(message).toContain("Tiền dịch vụ cần đạt 200.000đ");
  });

  it("allows a promotion only when every configured minimum is met", () => {
    expect(promotionEligibilityMessage({
      type: "ROOM",
      value: 10,
      valueType: "PERCENTAGE",
      minBookingValue: 300000,
      minRoomValue: 100000,
      minServiceValue: 50000,
      active: true,
    }, 300000, 100000, 50000)).toBe("");
  });
});

describe("sumRoomPriceForRange", () => {
  it("should sum room price for each day including nightly surcharge", () => {
    const room = { id: "A-101" };
    const range = { checkIn: "2026-09-22", checkOut: "2026-09-24" };
    const getPriceForDate = (entry: typeof room, date: string) => date === "2026-09-22" ? 100000 : 150000;

    expect(sumRoomPriceForRange(room, range, getPriceForDate, 20000)).toBe(290000);
  });
});

describe("customer socket refresh payload", () => {
  it("should include hotel id and customer details for customer creation updates", () => {
    const payload = buildCustomerSocketPayload(12, { id: "c-1", name: "Nguyễn Văn A", phone: "0901234567" });

    expect(CUSTOMER_REFRESH_EVENTS).toContain("customer_created");
    expect(payload).toMatchObject({
      hotelId: 12,
      customer: { id: "c-1", name: "Nguyễn Văn A", phone: "0901234567" },
    });
    expect(payload.createdAt).toBeTypeOf("string");
  });
});

describe("seasonal rate socket update payload", () => {
  it("should build a normalized array payload for seasonal rate announcements", () => {
    const payload = buildSeasonalRateSocketPayload(12, [
      {
        roomType: "STANDARD",
        rateName: "Lễ 2/9",
        startDate: "2026-09-28",
        endDate: "2026-09-30",
        price: 1200000,
      },
    ]);

    expect(SEASONAL_RATE_UPDATE_EVENT).toBe("seasonal_rate_announcement_update");
    expect(payload).toMatchObject({
      hotelId: 12,
      event: "seasonal_rate_announcement_update",
      data: [
        {
          roomType: "STANDARD",
          rateName: "Lễ 2/9",
          startDate: "2026-09-28",
          endDate: "2026-09-30",
          price: 1200000,
        },
      ],
    });
    expect(payload.createdAt).toBeTypeOf("string");
  });
});

describe("room seasonal rate response parsing", () => {
  it("should parse array result payloads from the backend", () => {
    const payload = {
      code: 200,
      message: "OK",
      result: [
        {
          id: 5,
          rateName: "Lễ 2/9",
          startDate: "2026-09-28",
          endDate: "2026-09-30",
          roomType: "STANDARD",
          price: 1200000,
        },
      ],
    };

    expect(extractRoomSeasonalRatePage(payload).content).toHaveLength(1);
    expect(extractRoomSeasonalRatePage(payload).content[0].rateName).toBe("Lễ 2/9");
  });
});

describe("cn function", () => {
  it("should merge classes correctly", () => {
    expect(cn("text-red-500", "bg-blue-500")).toBe("text-red-500 bg-blue-500");
  });

  it("should handle conditional classes", () => {
    const isActive = true;
    expect(cn("base-class", isActive && "active-class")).toBe(
      "base-class active-class",
    );
  });

  it("should handle false and null conditions", () => {
    const isActive = false;
    expect(cn("base-class", isActive && "active-class", null)).toBe(
      "base-class",
    );
  });

  it("should merge tailwind classes properly", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("should work with object notation", () => {
    expect(cn("base", { conditional: true, "not-included": false })).toBe(
      "base conditional",
    );
  });
});
