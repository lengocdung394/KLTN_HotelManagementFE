import { describe, expect, it } from "vitest";
import { formatVnd } from "./currency";

describe("formatVnd", () => {
  it("uses the English number format and VND code", () => {
    expect(formatVnd(2000, "en")).toBe("2,000 VND");
  });

  it("uses the Vietnamese number format and đồng symbol", () => {
    expect(formatVnd(2000, "vi")).toBe("2.000đ");
  });

  it("returns a placeholder for non-finite amounts", () => {
    expect(formatVnd(Number.NaN, "en")).toBe("-");
  });
});
