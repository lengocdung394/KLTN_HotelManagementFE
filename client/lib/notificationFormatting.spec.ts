import { describe, expect, it } from "vitest";
import { formatToastDescription } from "./notificationFormatting";

describe("formatToastDescription", () => {
  it("places fields separated by common dividers on separate lines", () => {
    expect(formatToastDescription(
      "Mã booking: #BK-1 | Khách hàng: Lan · Số tiền: 500.000đ • Phương thức: Tiền mặt",
    )).toBe("Mã booking: #BK-1\nKhách hàng: Lan\nSố tiền: 500.000đ\nPhương thức: Tiền mặt");
  });

  it("places service fields separated by commas on separate lines without splitting names", () => {
    expect(formatToastDescription(
      'Dịch vụ "Đồ ăn, thức uống", giá 250.000đ/người, danh mục Ăn uống, trạng thái đang hoạt động.',
    )).toBe(
      'Dịch vụ "Đồ ăn, thức uống"\ngiá 250.000đ/người\ndanh mục Ăn uống\ntrạng thái đang hoạt động.',
    );
  });

  it("leaves descriptions without dividers unchanged", () => {
    expect(formatToastDescription("Booking updated successfully.")).toBe("Booking updated successfully.");
  });

  it("preserves non-text descriptions", () => {
    expect(formatToastDescription(null)).toBeNull();
  });
});
