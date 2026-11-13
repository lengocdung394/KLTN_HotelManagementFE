import { useEffect, useState } from "react";
import { useAppDispatch } from "../store/hooks";
import { getPromotionScope } from "../lib/promotionReport";
import { buildReportDateBuckets, type ReportPeriod } from "../lib/reportPeriod";
import { reportApi, type HotelReport } from "../services/reportApi";

type DailyPromotionSavings = {
  date: string;
  roomRevenue: number;
  serviceRevenue: number;
  ROOM: number;
  SERVICE: number;
  TOTAL: number;
  UNKNOWN: number;
};

type DailyPromotionSavingsState = {
  data: DailyPromotionSavings[];
  isLoading: boolean;
  isError: boolean;
};

const summarizeReport = (
  date: string,
  report: HotelReport,
  scopeByPromotionId: ReadonlyMap<string, unknown>,
): DailyPromotionSavings => {
  const daily: DailyPromotionSavings = {
    date,
    roomRevenue: Number(report.roomRevenue ?? 0),
    serviceRevenue: Number(report.serviceRevenue ?? 0),
    ROOM: 0,
    SERVICE: 0,
    TOTAL: 0,
    UNKNOWN: 0,
  };
  report.promotions.forEach((promotion) => {
    const scope = getPromotionScope(
      scopeByPromotionId.get(promotion.promotionId)
        ?? promotion.type
        ?? promotion.scope
        ?? promotion.promotionScope,
    );
    daily[scope] += Number(promotion.savings ?? 0);
  });
  return daily;
};

export default function usePeriodReportData(
  enabled: boolean,
  period: ReportPeriod,
  startDate: string,
  endDate: string,
  hotelIds: Array<number | undefined>,
  scopeByPromotionId: ReadonlyMap<string, unknown>,
  refreshKey = 0,
) {
  const dispatch = useAppDispatch();
  const [state, setState] = useState<DailyPromotionSavingsState>({
    data: [],
    isLoading: false,
    isError: false,
  });

  useEffect(() => {
    const buckets = enabled
      ? buildReportDateBuckets(period, startDate, endDate, "en-US")
      : [];
    if (!enabled || buckets.length === 0 || buckets.length > 366 || hotelIds.length === 0) {
      setState({ data: [], isLoading: false, isError: false });
      return;
    }

    let active = true;
    const requests: Array<{ abort: () => void }> = [];
    setState({ data: [], isLoading: true, isError: false });

    const run = async () => {
      const byDate = new Map(buckets.map((bucket) => [
        bucket.startDate,
        {
          date: bucket.startDate,
          roomRevenue: 0,
          serviceRevenue: 0,
          ROOM: 0,
          SERVICE: 0,
          TOTAL: 0,
          UNKNOWN: 0,
        } satisfies DailyPromotionSavings,
      ]));
      const jobs = buckets
        .filter((bucket) => bucket.startDate <= endDate)
        .flatMap((bucket) => {
          const bucketEnd = bucket.endDate > endDate ? endDate : bucket.endDate;
          if (bucket.startDate > bucketEnd) return [];
          return hotelIds.map((hotelId) => ({
            startDate: bucket.startDate,
            endDate: bucketEnd,
            hotelId,
          }));
        });
      let nextIndex = 0;
      const worker = async () => {
        while (nextIndex < jobs.length) {
          const job = jobs[nextIndex];
          nextIndex += 1;
          const request = dispatch(reportApi.endpoints.getHotelReport.initiate(
            {
              startDate: job.startDate,
              endDate: job.endDate,
              ...(job.hotelId === undefined ? {} : { hotelId: job.hotelId }),
            },
            { subscribe: false, forceRefetch: refreshKey > 0 },
          ));
          requests.push(request);
          const report = await request.unwrap();
          const daily = summarizeReport(job.startDate, report, scopeByPromotionId);
          const row = byDate.get(job.startDate);
          if (!row) throw new Error(`Missing promotion row for ${job.startDate}`);
          row.roomRevenue += daily.roomRevenue;
          row.serviceRevenue += daily.serviceRevenue;
          row.ROOM += daily.ROOM;
          row.SERVICE += daily.SERVICE;
          row.TOTAL += daily.TOTAL;
          row.UNKNOWN += daily.UNKNOWN;
        }
      };

      try {
        if (jobs.length === 0) throw new Error("No hotel reports available for daily promotion chart");
        await Promise.all(Array.from({ length: Math.min(4, jobs.length) }, worker));
        const rows = [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
        if (active) setState({ data: rows, isLoading: false, isError: false });
      } catch {
        requests.forEach((request) => request.abort());
        if (active) setState({ data: [], isLoading: false, isError: true });
      }
    };

    void run();
    return () => {
      active = false;
      requests.forEach((request) => request.abort());
    };
  }, [dispatch, enabled, endDate, hotelIds, period, refreshKey, scopeByPromotionId, startDate]);

  return state;
}
