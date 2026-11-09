import { describe, expect, it } from "vitest";
import {
  buildBookingRevenueChartData,
  buildReportDateBuckets,
  buildRevenueChartData,
  getReportDateRange,
} from "./reportPeriod";

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

  it("fills missing dates and aggregates monthly revenue into four fixed weeks", () => {
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
      { label: "Tuần 1", revenue: 100 },
      { label: "Tuần 2", revenue: 500 },
      { label: "Tuần 3", revenue: 0 },
      { label: "Tuần 4", revenue: 0 },
    ]);
  });

  it("shows all days in the selected month and fills missing revenue with zero", () => {
    const data = buildRevenueChartData(
      [{ date: "2026-11-02", revenue: 100 }, { date: "2026-11-04", revenue: 300 }],
      "day-month",
      "2026-11-01",
      "2026-11-04",
      "vi-VN",
    );

    expect(data).toHaveLength(30);
    expect(data.slice(0, 4).map(({ label, revenue }) => ({ label, revenue }))).toEqual([
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

    expect(data.slice(0, 4).map(({ label, revenue }) => ({ label, revenue }))).toEqual([
      { label: "Jan", revenue: 0 },
      { label: "Feb", revenue: 500 },
      { label: "Mar", revenue: 0 },
      { label: "Apr", revenue: 700 },
    ]);
    expect(data).toHaveLength(12);
  });

  it("builds full-week, full-month, and full-year daily buckets", () => {
    expect(buildReportDateBuckets("day-week", "2026-11-09", "2026-11-09", "en-US")).toHaveLength(7);
    expect(buildReportDateBuckets("day-month", "2026-02-01", "2026-02-09", "en-US")).toHaveLength(28);
    expect(buildReportDateBuckets("day-year", "2026-01-01", "2026-11-09", "en-US")).toHaveLength(365);
  });

  it("creates weekly buckets for a year and twelve monthly buckets for a year", () => {
    expect(buildReportDateBuckets("week-year", "2026-01-01", "2026-11-09", "en-US")).toHaveLength(53);
    expect(buildReportDateBuckets("month-year", "2026-01-01", "2026-11-09", "en-US")).toHaveLength(12);
  });

  it("keeps room and service revenue split within the same reporting buckets", () => {
    const data = buildBookingRevenueChartData(
      [
        { date: "2026-11-01", roomRevenue: 700, serviceRevenue: 40 },
        { date: "2026-11-08", roomRevenue: 300, serviceRevenue: 60 },
      ],
      "week-month",
      "2026-11-01",
      "2026-11-09",
      "en-US",
    );

    expect(data.map(({ label, roomRevenue, serviceRevenue }) => ({
      label,
      roomRevenue,
      serviceRevenue,
    }))).toEqual([
      { label: "Week 1", roomRevenue: 700, serviceRevenue: 40 },
      { label: "Week 2", roomRevenue: 300, serviceRevenue: 60 },
      { label: "Week 3", roomRevenue: 0, serviceRevenue: 0 },
      { label: "Week 4", roomRevenue: 0, serviceRevenue: 0 },
    ]);
  });
});
