import { describe, expect, it } from "vitest";
import type { PromotionUsageReport } from "../services/reportApi";
import { buildPromotionScopeBreakdown, getPromotionScope } from "./promotionReport";

const promotion = (promotionId: string, savings: number): PromotionUsageReport => ({
  promotionId,
  promotionName: promotionId,
  promotionCode: promotionId,
  usageCount: 2,
  userCount: 1,
  savings,
});

describe("promotion reporting scopes", () => {
  it("groups savings and usage by room, service, and whole-booking scope", () => {
    const breakdown = buildPromotionScopeBreakdown(
      [promotion("room", 100), promotion("service", 200), promotion("total", 300)],
      new Map([
        ["room", "ROOM"],
        ["service", "SERVICE"],
        ["total", "TOTAL"],
      ]),
    );

    expect(breakdown.map(({ scope, savings, usageCount, promotionCount }) => ({
      scope,
      savings,
      usageCount,
      promotionCount,
    }))).toEqual([
      { scope: "ROOM", savings: 100, usageCount: 2, promotionCount: 1 },
      { scope: "SERVICE", savings: 200, usageCount: 2, promotionCount: 1 },
      { scope: "TOTAL", savings: 300, usageCount: 2, promotionCount: 1 },
    ]);
  });

  it("uses the report scope when catalog metadata is unavailable and identifies unknown values", () => {
    expect(buildPromotionScopeBreakdown(
      [{ ...promotion("room", 100), scope: "ROOM" }, promotion("unknown", 50)],
      new Map(),
    ).map(({ scope, savings }) => ({ scope, savings }))).toEqual([
      { scope: "ROOM", savings: 100 },
      { scope: "UNKNOWN", savings: 50 },
    ]);
    expect(getPromotionScope("invalid")).toBe("UNKNOWN");
  });
});
