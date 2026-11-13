import { describe, expect, it } from "vitest";
import { normalizeCustomer } from "./customerApi";

describe("customer loyalty tier normalization", () => {
  it("uses the backend tier instead of branch-specific booking counts", () => {
    expect(normalizeCustomer({
      visits: 1,
      totalSpend: 100_000,
      loyaltyTier: { description: "Hạng Vàng", minSpent: 15_000_000 },
    }).tier).toBe("gold");
  });

  it.each([
    [0, "bronze"],
    [4_999_999, "bronze"],
    [5_000_000, "silver"],
    [14_999_999, "silver"],
    [15_000_000, "gold"],
    [39_999_999, "gold"],
    [40_000_000, "platinum"],
  ] as const)("assigns the tier for total spend %i", (totalSpend, tier) => {
    expect(normalizeCustomer({ visits: 100, totalSpend }).tier).toBe(tier);
  });

  it("recognizes enum names and Vietnamese descriptions for all tiers", () => {
    expect(normalizeCustomer({ loyaltyTier: "BRONZE" }).tier).toBe("bronze");
    expect(normalizeCustomer({ loyaltyTier: { description: "Hạng Bạc" } }).tier).toBe("silver");
    expect(normalizeCustomer({ loyaltyTier: { description: "Hạng Bạch Kim" } }).tier).toBe("platinum");
  });
});
