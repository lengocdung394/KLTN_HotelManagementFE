export type ReportPeriod =
  | "day-week"
  | "day-month"
  | "day-year"
  | "week-month"
  | "week-year"
  | "month-year"
  | "custom";
export type ReportDateRange = { startDate: string; endDate: string };
export type DailyRevenuePoint = { date: string; revenue: number };
export type RevenueChartPoint = { label: string; revenue: number; fullDate: string };

const parseLocalDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const formatLocalDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const reportPeriodOptions: Array<{ value: Exclude<ReportPeriod, "custom">; unit: "day" | "week" | "month"; scope: "week" | "month" | "year" }> = [
  { value: "day-week", unit: "day", scope: "week" },
  { value: "day-month", unit: "day", scope: "month" },
  { value: "day-year", unit: "day", scope: "year" },
  { value: "week-month", unit: "week", scope: "month" },
  { value: "week-year", unit: "week", scope: "year" },
  { value: "month-year", unit: "month", scope: "year" },
];

export const getReportDateRange = (
  period: Exclude<ReportPeriod, "custom">,
  anchorDate: string,
  today: string,
): ReportDateRange => {
  const anchor = parseLocalDate(anchorDate);
  const option = reportPeriodOptions.find((item) => item.value === period);
  if (!option) throw new Error(`Unknown report period: ${period}`);

  let start: Date;
  let end: Date;
  if (option.scope === "week") {
    start = new Date(anchor);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    end = new Date(start);
    end.setDate(end.getDate() + 6);
  } else if (option.scope === "month") {
    start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  } else {
    start = new Date(anchor.getFullYear(), 0, 1);
    end = new Date(anchor.getFullYear(), 11, 31);
  }

  const todayDate = parseLocalDate(today);
  if (end > todayDate) end = todayDate;

  return {
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(end),
  };
};

export const buildRevenueChartData = (
  dailyRevenue: DailyRevenuePoint[],
  period: ReportPeriod,
  startDate: string,
  endDate: string,
  locale: string,
): RevenueChartPoint[] => {
  if (!startDate || !endDate || startDate > endDate) return [];

  const option = reportPeriodOptions.find((item) => item.value === period);
  const unit = option?.unit ?? "day";
  const revenueByDate = new Map(
    dailyRevenue.map(({ date, revenue }) => [date, Number(revenue ?? 0)]),
  );
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const formatDate = (date: Date) => date.toLocaleDateString(locale);
  const dateKeys: string[] = [];

  if (unit === "month") {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const lastMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= lastMonth) {
      dateKeys.push(formatLocalDate(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return dateKeys.map((monthStart) => {
      const month = parseLocalDate(monthStart);
      const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
      const bucketStart = monthStart < startDate ? startDate : monthStart;
      const monthEndKey = formatLocalDate(monthEnd);
      const bucketEnd = monthEndKey > endDate ? endDate : monthEndKey;
      const revenue = sumRevenueInRange(revenueByDate, bucketStart, bucketEnd);
      return {
        label: month.toLocaleDateString(locale, { month: "short" }),
        revenue,
        fullDate: month.toLocaleDateString(locale, { month: "long", year: "numeric" }),
      };
    });
  }

  if (unit === "week") {
    const firstMonday = new Date(start);
    firstMonday.setDate(firstMonday.getDate() - ((firstMonday.getDay() + 6) % 7));
    const weekStarts: string[] = [];
    for (const cursor = new Date(firstMonday); cursor <= end; cursor.setDate(cursor.getDate() + 7)) {
      weekStarts.push(formatLocalDate(cursor));
    }

    return weekStarts.map((weekStart, index) => {
      const monday = parseLocalDate(weekStart);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      const bucketStart = weekStart < startDate ? startDate : weekStart;
      const sundayKey = formatLocalDate(sunday);
      const bucketEnd = sundayKey > endDate ? endDate : sundayKey;
      const bucketStartDate = parseLocalDate(bucketStart);
      const bucketEndDate = parseLocalDate(bucketEnd);
      return {
        label: localizedWeekLabel(index + 1, locale),
        revenue: sumRevenueInRange(revenueByDate, bucketStart, bucketEnd),
        fullDate: `${formatDate(bucketStartDate)} – ${formatDate(bucketEndDate)}`,
      };
    });
  }

  const chartEnd = new Date(end);
  if (period === "day-week") {
    chartEnd.setDate(chartEnd.getDate() + (6 - ((chartEnd.getDay() + 6) % 7)));
  }
  const cursor = new Date(start);
  while (cursor <= chartEnd) {
    dateKeys.push(formatLocalDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dateKeys.map((date) => {
    const parsedDate = parseLocalDate(date);
    const label = period === "day-week"
      ? parsedDate.toLocaleDateString(locale, { weekday: "short" })
      : period === "day-year"
        ? parsedDate.toLocaleDateString(locale, { day: "2-digit", month: "short" })
        : date.slice(8, 10);
    return {
      label,
      revenue: revenueByDate.get(date) ?? 0,
      fullDate: formatDate(parsedDate),
    };
  });
};

const sumRevenueInRange = (revenueByDate: Map<string, number>, startDate: string, endDate: string) =>
  [...revenueByDate.entries()].reduce(
    (total, [date, amount]) => total + (date >= startDate && date <= endDate ? amount : 0),
    0,
  );

const localizedWeekLabel = (week: number, locale: string) =>
  locale.toLowerCase().startsWith("vi") ? `Tuần ${week}` : `Week ${week}`;
