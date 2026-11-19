import { describe, expect, it } from "vitest";
import { formatToastDescription } from "./notificationFormatting";

describe("formatToastDescription", () => {
  it("places fields separated by common dividers on separate lines", () => {
    expect(formatToastDescription(
      "Mã booking: #BK-1 | Khách hàng: Lan · Số tiền: 500.000đ • Phương thức: Tiền mặt",
    )).toBe("Mã booking: #BK-1\nKhách hàng: Lan\nSố tiền: 500.000đ\nPhương thức: Tiền mặt");
  });

  it("leaves descriptions without dividers unchanged", () => {
    expect(formatToastDescription("Booking updated successfully.")).toBe("Booking updated successfully.");
  });

  it("preserves non-text descriptions", () => {
    expect(formatToastDescription(null)).toBeNull();
  });
});
