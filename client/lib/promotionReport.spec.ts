import { describe, expect, it } from "vitest";
import type { PromotionUsageReport } from "../services/reportApi";
import { buildPromotionSavingsChartData, buildPromotionScopeBreakdown, getPromotionScope } from "./promotionReport";

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

  it("keeps the unknown-scope series while grouping promotions into four monthly weeks", () => {
    const data = buildPromotionSavingsChartData(
      [
        { date: "2026-11-01", ROOM: 10, SERVICE: 0, TOTAL: 0, UNKNOWN: 20 },
        { date: "2026-11-08", ROOM: 0, SERVICE: 0, TOTAL: 0, UNKNOWN: 5 },
      ],
      "week-month",
      "2026-11-01",
      "2026-11-09",
      "en-US",
    );

    expect(data.map(({ label, ROOM, UNKNOWN }) => ({ label, ROOM, UNKNOWN }))).toEqual([
      { label: "Week 1", ROOM: 10, UNKNOWN: 20 },
      { label: "Week 2", ROOM: 0, UNKNOWN: 5 },
      { label: "Week 3", ROOM: 0, UNKNOWN: 0 },
      { label: "Week 4", ROOM: 0, UNKNOWN: 0 },
    ]);
  });
});
