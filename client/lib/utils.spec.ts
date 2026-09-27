import { describe, it, expect } from "vitest";
import { cn } from "./utils";
import { sumRoomPriceForRange } from "./bookingPricing";
import { CUSTOMER_REFRESH_EVENTS, buildCustomerSocketPayload } from "./socket";

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
