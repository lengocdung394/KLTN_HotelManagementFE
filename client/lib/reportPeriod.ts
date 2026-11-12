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
export type ReportDateBucket = {
  label: string;
  startDate: string;
  endDate: string;
  fullDate: string;
};
export type BookingRevenuePoint = {
  date: string;
  roomRevenue: number;
  serviceRevenue: number;
};

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

  const revenueByDate = new Map(
    dailyRevenue.map(({ date, revenue }) => [date, Number(revenue ?? 0)]),
  );
  return buildReportDateBuckets(period, startDate, endDate, locale).map((bucket) => ({
    label: bucket.label,
    revenue: sumRevenueInRange(revenueByDate, bucket.startDate, bucket.endDate),
    fullDate: bucket.fullDate,
  }));
};

export const buildBookingRevenueChartData = (
  revenueByDate: BookingRevenuePoint[],
  period: ReportPeriod,
  startDate: string,
  endDate: string,
  locale: string,
) => {
  const revenueMap = new Map(revenueByDate.map((item) => [item.date, item]));
  return buildReportDateBuckets(period, startDate, endDate, locale).map((bucket) => {
    const revenue = revenueMap.get(bucket.startDate);
    return {
      label: bucket.label,
      fullDate: bucket.fullDate,
      roomRevenue: revenue?.roomRevenue ?? 0,
      serviceRevenue: revenue?.serviceRevenue ?? 0,
    };
  });
};

export const buildReportDateBuckets = (
  period: ReportPeriod,
  startDate: string,
  endDate: string,
  locale: string,
): ReportDateBucket[] => {
  if (!startDate || !endDate || startDate > endDate) return [];

  const option = reportPeriodOptions.find((item) => item.value === period);
  const unit = option?.unit ?? "day";
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const formatDate = (date: Date) => date.toLocaleDateString(locale);

  if (unit === "month") {
    const buckets: ReportDateBucket[] = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const bucketEnd = period === "month-year" ? new Date(end.getFullYear(), 11, 31) : end;
    const lastMonth = new Date(bucketEnd.getFullYear(), bucketEnd.getMonth(), 1);
    while (cursor <= lastMonth) {
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const monthStartKey = formatLocalDate(cursor);
      const monthEndKey = formatLocalDate(monthEnd);
      const bucketStart = monthStartKey < startDate ? startDate : monthStartKey;
      const currentBucketEnd = monthEndKey > formatLocalDate(bucketEnd) ? formatLocalDate(bucketEnd) : monthEndKey;
      buckets.push({
        label: cursor.toLocaleDateString(locale, { month: "short" }),
        startDate: bucketStart,
        endDate: currentBucketEnd,
        fullDate: cursor.toLocaleDateString(locale, { month: "long", year: "numeric" }),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return buckets;
  }

  if (unit === "week") {
    const buckets: ReportDateBucket[] = [];
    if (period === "week-month") {
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      const bucketEnd = new Date(end.getFullYear(), end.getMonth() + 1, 0);
      const lastMonth = new Date(bucketEnd.getFullYear(), bucketEnd.getMonth(), 1);
      while (cursor <= lastMonth) {
        const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
        for (let week = 0; week < 4; week += 1) {
          const weekStart = new Date(cursor.getFullYear(), cursor.getMonth(), week * 7 + 1);
          const weekEnd = week === 3
            ? monthEnd
            : new Date(cursor.getFullYear(), cursor.getMonth(), (week + 1) * 7);
          const weekStartKey = formatLocalDate(weekStart);
          const weekEndKey = formatLocalDate(weekEnd);
          const bucketStart = weekStartKey < startDate ? startDate : weekStartKey;
          buckets.push({
            label: localizedWeekLabel(week + 1, locale),
            startDate: bucketStart,
            endDate: weekEndKey,
            fullDate: `${formatDate(parseLocalDate(bucketStart))} – ${formatDate(weekEnd)}`,
          });
        }
        cursor.setMonth(cursor.getMonth() + 1);
      }
      return buckets;
    }

    const firstMonday = new Date(start);
    firstMonday.setDate(firstMonday.getDate() - ((firstMonday.getDay() + 6) % 7));
    const bucketEnd = period === "week-year" ? new Date(end.getFullYear(), 11, 31) : end;
    for (const monday = new Date(firstMonday); monday <= bucketEnd; monday.setDate(monday.getDate() + 7)) {
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      const mondayKey = formatLocalDate(monday);
      const sundayKey = formatLocalDate(sunday);
      const bucketStart = mondayKey < startDate ? startDate : mondayKey;
      const currentBucketEnd = sundayKey > formatLocalDate(bucketEnd) ? bucketEnd : sunday;
      buckets.push({
        label: localizedWeekLabel(buckets.length + 1, locale),
        startDate: bucketStart,
        endDate: formatLocalDate(currentBucketEnd),
        fullDate: `${formatDate(parseLocalDate(bucketStart))} – ${formatDate(currentBucketEnd)}`,
      });
    }
    return buckets;
  }

  const chartEnd = new Date(end);
  if (period === "day-week") {
    chartEnd.setDate(chartEnd.getDate() + (6 - ((chartEnd.getDay() + 6) % 7)));
  } else if (period === "day-month") {
    chartEnd.setMonth(chartEnd.getMonth() + 1, 0);
  } else if (period === "day-year") {
    chartEnd.setMonth(11, 31);
  }

  const buckets: ReportDateBucket[] = [];
  for (const cursor = new Date(start); cursor <= chartEnd; cursor.setDate(cursor.getDate() + 1)) {
    const date = formatLocalDate(cursor);
    const label = period === "day-week"
      ? cursor.toLocaleDateString(locale, { weekday: "short" })
      : period === "day-year"
        ? cursor.toLocaleDateString(locale, { day: "2-digit", month: "short" })
        : date.slice(8, 10);
    buckets.push({
      label,
      startDate: date,
      endDate: date,
      fullDate: formatDate(cursor),
    });
  }
  return buckets;
};

const sumRevenueInRange = (revenueByDate: Map<string, number>, startDate: string, endDate: string) =>
  [...revenueByDate.entries()].reduce(
    (total, [date, amount]) => total + (date >= startDate && date <= endDate ? amount : 0),
    0,
  );

const localizedWeekLabel = (week: number, locale: string) =>
  locale.toLowerCase().startsWith("vi") ? `Tuần ${week}` : `Week ${week}`;
