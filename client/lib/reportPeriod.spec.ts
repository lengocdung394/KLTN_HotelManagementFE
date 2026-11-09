import { describe, expect, it } from "vitest";
import { buildRevenueChartData, getReportDateRange } from "./reportPeriod";

describe("report period comparison ranges", () => {
  it("supports daily comparisons in a week, month, and year", () => {
    expect(getReportDateRange("day-week", "2026-11-09", "2026-11-09")).toEqual({
      startDate: "2026-11-09",
      endDate: "2026-11-09",
    });
    expect(getReportDateRange("day-month", "2026-11-09", "2026-11-09")).toEqual({
      startDate: "2026-11-01",
      endDate: "2026-11-09",
    });
    expect(getReportDateRange("day-year", "2026-11-09", "2026-11-09")).toEqual({
      startDate: "2026-01-01",
      endDate: "2026-11-09",
    });
  });

  it("supports weekly comparisons in a month and year, and monthly comparisons in a year", () => {
    expect(getReportDateRange("week-month", "2026-11-09", "2026-11-09")).toEqual({
      startDate: "2026-11-01",
      endDate: "2026-11-09",
    });
    expect(getReportDateRange("week-year", "2026-11-09", "2026-11-09")).toEqual({
      startDate: "2026-01-01",
      endDate: "2026-11-09",
    });
    expect(getReportDateRange("month-year", "2026-11-09", "2026-11-09")).toEqual({
      startDate: "2026-01-01",
      endDate: "2026-11-09",
    });
  });

  it("fills missing dates and aggregates revenue into calendar weeks", () => {
    const data = buildRevenueChartData(
      [
        { date: "2026-11-02", revenue: 100 },
        { date: "2026-11-08", revenue: 200 },
        { date: "2026-11-09", revenue: 300 },
      ],
      "week-month",
      "2026-11-01",
      "2026-11-09",
      "vi-VN",
    );

    expect(data.map(({ label, revenue }) => ({ label, revenue }))).toEqual([
      { label: "Tuần 1", revenue: 0 },
      { label: "Tuần 2", revenue: 300 },
      { label: "Tuần 3", revenue: 300 },
    ]);
  });

  it("creates a comparable daily point for every date in the selected range", () => {
    const data = buildRevenueChartData(
      [{ date: "2026-11-02", revenue: 100 }, { date: "2026-11-04", revenue: 300 }],
      "day-month",
      "2026-11-01",
      "2026-11-04",
      "vi-VN",
    );

    expect(data.map(({ label, revenue }) => ({ label, revenue }))).toEqual([
      { label: "01", revenue: 0 },
      { label: "02", revenue: 100 },
      { label: "03", revenue: 0 },
      { label: "04", revenue: 300 },
    ]);
  });

  it("shows all seven weekdays when the selected week is still in progress", () => {
    const data = buildRevenueChartData(
      [{ date: "2026-11-09", revenue: 250 }],
      "day-week",
      "2026-11-09",
      "2026-11-09",
      "en-US",
    );

    expect(data).toHaveLength(7);
    expect(data.map(({ revenue }) => revenue)).toEqual([250, 0, 0, 0, 0, 0, 0]);
  });

  it("aggregates monthly revenue and includes months without revenue", () => {
    const data = buildRevenueChartData(
      [{ date: "2026-02-03", revenue: 500 }, { date: "2026-04-15", revenue: 700 }],
      "month-year",
      "2026-01-01",
      "2026-04-30",
      "en-US",
    );

    expect(data.map(({ label, revenue }) => ({ label, revenue }))).toEqual([
      { label: "Jan", revenue: 0 },
      { label: "Feb", revenue: 500 },
      { label: "Mar", revenue: 0 },
      { label: "Apr", revenue: 700 },
    ]);
  });
});
