import { useEffect, useMemo, useState } from "react";
import { BarChart3, BedDouble, Building2, CalendarDays, Check, ChevronDown, ConciergeBell, PanelLeftClose, PanelLeftOpen, RefreshCw, RotateCcw, Tag, Wallet, XCircle } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { reportApi, type HotelReport } from "../services/reportApi";
import { useGetPromotionsQuery, type Promotion } from "../services/promotionApi";
import type { SuperAdminBranch } from "../services/superAdminApi";
import { useAppDispatch } from "../store/hooks";
import ListPagination from "./ListPagination";
import {
  buildBookingRevenueChartData,
  buildRevenueChartData,
  getReportDateRange,
  reportPeriodOptions,
  type ReportPeriod,
} from "../lib/reportPeriod";
import {
  buildPromotionScopeBreakdown,
  buildPromotionSavingsChartData,
  formatReportCurrencyAxis,
  getPromotionScope,
  promotionScopeColors,
  type PromotionScope,
} from "../lib/promotionReport";
import usePeriodReportData from "../hooks/usePeriodReportData";

type Props = {
  branches: SuperAdminBranch[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
};

type BranchReportState = {
  report: HotelReport | null;
  hasError: boolean;
};

const EMPTY_PROMOTIONS: Promotion[] = [];

const localDateString = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const roomStatusLabels: Record<string, string> = {
  READY: "Sẵn sàng",
  IN_USE: "Đang sử dụng",
  CLEANING: "Đang dọn",
  MAINTENANCE: "Bảo trì",
  UNKNOWN: "Chưa xác định",
};

const roomStatusColors: Record<string, string> = {
  READY: "#22c55e",
  IN_USE: "#2563eb",
  CLEANING: "#f59e0b",
  MAINTENANCE: "#f17b83",
  UNKNOWN: "#94a3b8",
};

const roomTypeLabels: Record<string, string> = {
  STANDARD: "Phòng tiêu chuẩn",
  DELUXE: "Phòng cao cấp",
  SUITE: "Phòng thượng hạng",
  FAMILY: "Phòng gia đình",
};

const promotionScopeLabels: Record<PromotionScope, string> = {
  ROOM: "Tiền phòng",
  SERVICE: "Tiền dịch vụ",
  TOTAL: "Tổng booking",
  UNKNOWN: "Chưa xác định",
};

const StatCard = ({
  label,
  value,
  detail,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Building2;
  color: string;
}) => (
  <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
        <p className="mt-1 text-xs text-slate-400">{detail}</p>
      </div>
      <span className={`grid h-11 w-11 place-items-center rounded-xl ${color}`}>
        <Icon size={20} />
      </span>
    </div>
  </article>
);

export default function SuperAdminResourceStatsPanel({ branches, isLoading, isError, onRetry }: Props) {
  const [selectedBranchId, setSelectedBranchId] = useState("all");
  const [isBranchPickerOpen, setIsBranchPickerOpen] = useState(false);
  const today = localDateString(new Date());
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("day-month");
  const [comparisonUnit, setComparisonUnit] = useState<"day" | "week" | "month">("day");
  const [comparisonScope, setComparisonScope] = useState<"week" | "month" | "year">("month");
  const initialRange = getReportDateRange("day-month", today, today);
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [branchReports, setBranchReports] = useState<Record<number, BranchReportState>>({});
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isReportTocVisible, setIsReportTocVisible] = useState(true);
  const [cancelledPage, setCancelledPage] = useState(1);
  const [cancelledPageSize, setCancelledPageSize] = useState(10);
  const [branchPage, setBranchPage] = useState(1);
  const [branchPageSize, setBranchPageSize] = useState(10);
  const {
    data: availablePromotions = EMPTY_PROMOTIONS,
    isError: isPromotionCatalogError,
    isFetching: isPromotionCatalogFetching,
    refetch: refetchPromotionCatalog,
  } = useGetPromotionsQuery(
    selectedBranchId === "all"
      ? { page: 0, size: 100 }
      : { hotelId: Number(selectedBranchId), page: 0, size: 100 },
    { skip: branches.length === 0 },
  );
  const promotionScopeById = useMemo(
    () => new Map(availablePromotions.map((promotion) => [promotion.id, promotion.type])),
    [availablePromotions],
  );
  const dispatch = useAppDispatch();
  const hasValidDateRange = Boolean(startDate && endDate && startDate <= endDate);
  const reportSections = [
    { id: "super-admin-stats-overview", label: "Tổng quan" },
    { id: "super-admin-stats-booking-revenue", label: "Doanh thu booking" },
    { id: "super-admin-stats-services", label: "Doanh thu dịch vụ" },
    { id: "super-admin-stats-promotions", label: "Khuyến mãi" },
    { id: "super-admin-stats-rooms", label: "Thống kê phòng" },
    { id: "super-admin-stats-cancellations", label: "Booking đã hủy" },
    { id: "super-admin-stats-branches", label: "Thống kê theo chi nhánh" },
  ];
  const [activeReportSection, setActiveReportSection] = useState(reportSections[0].id);

  const scrollToReportSection = (sectionId: string) => {
    setActiveReportSection(sectionId);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    let active = true;

    if (!hasValidDateRange || branches.length === 0) {
      setBranchReports({});
      setIsLoadingReports(false);
      return () => {
        active = false;
      };
    }

    setBranchReports({});
    setIsLoadingReports(true);
    void Promise.all(branches.map(async (branch) => {
      try {
        const report = await dispatch(reportApi.endpoints.getHotelReport.initiate({
          startDate,
          endDate,
          hotelId: branch.id,
        }, { subscribe: false, forceRefetch: true })).unwrap();
        return [branch.id, { report, hasError: false }] as const;
      } catch {
        return [branch.id, { report: null, hasError: true }] as const;
      }
    })).then((entries) => {
      if (active) {
        setBranchReports(Object.fromEntries(entries));
        setIsLoadingReports(false);
      }
    });

    return () => {
      active = false;
    };
  }, [branches, dispatch, endDate, hasValidDateRange, retryCount, startDate]);

  const visibleBranches = useMemo(
    () => selectedBranchId === "all"
      ? branches
      : branches.filter((branch) => String(branch.id) === selectedBranchId),
    [branches, selectedBranchId],
  );
  const reports = visibleBranches.flatMap((branch) => {
    const report = branchReports[branch.id]?.report;
    return report ? [report] : [];
  });
  const hasReportErrors = visibleBranches.some((branch) => branchReports[branch.id]?.hasError);
  const isStatsLoading = isLoading || isLoadingReports
    || (hasValidDateRange && visibleBranches.length > 0 && reports.length === 0 && !hasReportErrors);
  const allReportsLoaded = visibleBranches.length > 0
    && reports.length === visibleBranches.length
    && !hasReportErrors;

  useEffect(() => {
    const reportElements = document.querySelectorAll<HTMLElement>("[data-super-admin-report-section]");
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleSections = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);
        const visibleSection = visibleSections[0];
        if (visibleSection) setActiveReportSection(visibleSection.target.id);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );

    reportElements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [allReportsLoaded, branches.length, hasValidDateRange]);

  const totalBookings = reports.reduce((total, report) => total + (report.totalBookingCount ?? 0), 0);
  const totalRooms = reports.reduce((total, report) => total + (report.totalRoomCount ?? 0), 0);
  const totalRoomRevenue = reports.reduce((total, report) => total + Number(report.roomRevenue ?? 0), 0);
  const totalServiceRevenue = reports.reduce((total, report) => total + Number(report.serviceRevenue ?? 0), 0);
  const totalPromotionSavings = reports.reduce((total, report) => total + Number(report.promotionSavings ?? 0), 0);
  const totalRevenue = reports.reduce((total, report) => total + Number(report.cashReceived ?? 0), 0);
  const totalCashReceived = reports.reduce((total, report) => total + Number(report.cashReceivedCash ?? 0), 0);
  const totalBankReceived = reports.reduce((total, report) => total + Number(report.cashReceivedBank ?? 0), 0);
  const totalRefunded = reports.reduce((total, report) => total + Number(report.cashRefunded ?? 0), 0);
  const totalChangeReturned = reports.reduce((total, report) => total + Number(report.cashChangeReturned ?? 0), 0);
  const totalNetReceived = reports.reduce((total, report) => total + Number(report.netCashReceived ?? 0), 0);
  const totalCancelledBookings = reports.reduce((total, report) => total + (report.cancelledBookingCount ?? 0), 0);
  const totalServiceUsage = reports.reduce((total, report) => total + (report.serviceUsageCount ?? 0), 0);
  const totalPromotionUsage = reports.reduce((total, report) => total + (report.promotionUsageCount ?? 0), 0);
  const dailyServiceRevenue = useMemo(() => {
    const values = new Map<string, number>();
    reports.forEach((report) => report.dailyServiceRevenue.forEach((item) => {
      values.set(item.date, (values.get(item.date) ?? 0) + Number(item.revenue ?? 0));
    }));
    return buildRevenueChartData(
      [...values.entries()].map(([date, revenue]) => ({ date, revenue })),
      reportPeriod,
      startDate,
      endDate,
      "vi-VN",
    );
  }, [endDate, reportPeriod, reports, startDate]);
  const promotionBreakdown = useMemo(() => {
    const values = new Map<string, { id: string; name: string; code: string; scope: PromotionScope; usageCount: number; userCount: number; savings: number }>();
    reports.forEach((report) => report.promotions.forEach((promotion) => {
      const key = `${promotion.promotionId}:${promotion.promotionCode}`;
      const current = values.get(key) ?? {
        id: promotion.promotionId,
        name: promotion.promotionName,
        code: promotion.promotionCode,
        scope: getPromotionScope(
          promotionScopeById.get(promotion.promotionId)
            ?? promotion.type
            ?? promotion.scope
            ?? promotion.promotionScope,
        ),
        usageCount: 0,
        userCount: 0,
        savings: 0,
      };
      current.usageCount += promotion.usageCount;
      current.userCount += promotion.userCount;
      current.savings += Number(promotion.savings ?? 0);
      values.set(key, current);
    }));
    return [...values.values()].sort((left, right) => right.usageCount - left.usageCount);
  }, [promotionScopeById, reports]);
  const promotionScopeBreakdown = useMemo(
    () => buildPromotionScopeBreakdown(
      reports.flatMap((report) => report.promotions),
      promotionScopeById,
    ),
    [promotionScopeById, reports],
  );
  const promotionScopesTotalSavings = promotionScopeBreakdown.reduce((total, item) => total + item.savings, 0);
  const dailyReportHotelIds = useMemo(
    () => visibleBranches.map((branch) => branch.id),
    [visibleBranches],
  );
  const periodReportData = usePeriodReportData(
    reportPeriod !== "custom" && allReportsLoaded,
    reportPeriod,
    startDate,
    endDate,
    dailyReportHotelIds,
    promotionScopeById,
    retryCount,
  );
  const bookingRevenueChartData = reportPeriod === "custom"
    ? [{
        label: `${startDate} – ${endDate}`,
        fullDate: `${startDate} – ${endDate}`,
        roomRevenue: reports.reduce((total, report) => total + Number(report.roomRevenue ?? 0), 0),
        serviceRevenue: reports.reduce((total, report) => total + Number(report.serviceRevenue ?? 0), 0),
      }]
    : buildBookingRevenueChartData(
        periodReportData.data,
        reportPeriod,
        startDate,
        endDate,
        "vi-VN",
      );
  const roomStatusBreakdown = useMemo(() => {
    const values = new Map<string, number>();
    reports.forEach((report) => report.roomStatuses.forEach((status) => {
      values.set(status.status, (values.get(status.status) ?? 0) + status.roomCount);
    }));
    return [...values.entries()].map(([status, roomCount]) => ({
      status,
      roomCount,
      name: roomStatusLabels[status] ?? status,
      color: roomStatusColors[status] ?? "#94a3b8",
    }));
  }, [reports]);
  const roomTypeBreakdown = useMemo(() => {
    const values = new Map<string, number>();
    reports.forEach((report) => report.roomTypeBookings.forEach((item) => {
      values.set(item.roomType, (values.get(item.roomType) ?? 0) + item.bookingCount);
    }));
    return [...values.entries()]
      .map(([roomType, bookingCount]) => ({ roomType, bookingCount, name: roomTypeLabels[roomType] ?? roomType }))
      .sort((left, right) => right.bookingCount - left.bookingCount);
  }, [reports]);
  const cancelledBookingDetails = reports.flatMap((report) => {
    const branch = branches.find((item) => branchReports[item.id]?.report === report);
    return (report.cancelledBookings ?? []).map((booking) => ({
      ...booking,
      branchName: branch?.name ?? "Chi nhánh",
      rowKey: `${branch?.id ?? "branch"}-${booking.bookingId}`,
    }));
  });
  const cancelledTotalPages = Math.max(1, Math.ceil(cancelledBookingDetails.length / cancelledPageSize));
  const safeCancelledPage = Math.min(cancelledPage, cancelledTotalPages);
  const paginatedCancelledBookings = cancelledBookingDetails.slice(
    (safeCancelledPage - 1) * cancelledPageSize,
    safeCancelledPage * cancelledPageSize,
  );
  const branchTotalPages = Math.max(1, Math.ceil(visibleBranches.length / branchPageSize));
  const safeBranchPage = Math.min(branchPage, branchTotalPages);
  const paginatedBranches = visibleBranches.slice((safeBranchPage - 1) * branchPageSize, safeBranchPage * branchPageSize);

  useEffect(() => {
    setCancelledPage(1);
    setBranchPage(1);
  }, [selectedBranchId, startDate, endDate]);
  useEffect(() => {
    if (cancelledPage > cancelledTotalPages) setCancelledPage(cancelledTotalPages);
  }, [cancelledPage, cancelledTotalPages]);
  useEffect(() => {
    if (branchPage > branchTotalPages) setBranchPage(branchTotalPages);
  }, [branchPage, branchTotalPages]);
  const formatCount = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
  const formatMoney = (value: number) =>
    `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value)}đ`;
  const displayCount = (value: number) => isStatsLoading || hasReportErrors || !allReportsLoaded ? "—" : formatCount(value);
  const selectedBranchName = visibleBranches.length === 1 ? visibleBranches[0].name : null;
  const reportScopeLabel = selectedBranchName ? `chi nhánh ${selectedBranchName}` : "toàn bộ chi nhánh";
  const selectReportPeriod = (period: Exclude<ReportPeriod, "custom">) => {
    const option = reportPeriodOptions.find((item) => item.value === period);
    if (!option) return;
    const range = getReportDateRange(period, today, today);
    setReportPeriod(period);
    setComparisonUnit(option.unit);
    setComparisonScope(option.scope);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  };
  const resetReportFilters = () => {
    const range = getReportDateRange("day-month", today, today);
    setSelectedBranchId("all");
    setReportPeriod("day-month");
    setComparisonUnit("day");
    setComparisonScope("month");
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  };
  const hasReportFilters = Boolean(
    selectedBranchId !== "all"
    || reportPeriod !== "day-month"
    || comparisonUnit !== "day"
    || comparisonScope !== "month"
    || startDate !== initialRange.startDate
    || endDate !== initialRange.endDate,
  );
  const handleReportRefreshOrReset = () => {
    if (hasReportFilters) {
      resetReportFilters();
      return;
    }
    setRetryCount((count) => count + 1);
    void refetchPromotionCatalog();
  };
  const reportDateScopeLabel = reportPeriod === "custom"
    ? "trong khoảng tùy chọn"
    : `trong ${comparisonScope === "week" ? "tuần" : comparisonScope === "month" ? "tháng" : "năm"}`;
  const reportPeriodOptionLabels: Record<Exclude<ReportPeriod, "custom">, string> = {
    "day-week": "Ngày trong tuần",
    "day-month": "Ngày trong tháng",
    "day-year": "Ngày trong năm",
    "week-month": "Tuần trong tháng",
    "week-year": "Tuần trong năm",
    "month-year": "Tháng trong năm",
  };
  const reportPeriodLabel = reportPeriod === "custom"
    ? "ngày trong khoảng tùy chọn"
    : reportPeriodOptionLabels[reportPeriod].toLowerCase();
  const promotionSavingsByScope = promotionScopeBreakdown
    .filter((item) => item.savings > 0)
    .map((item) => ({
      scope: item.scope,
      label: promotionScopeLabels[item.scope],
      savings: item.savings,
      color: promotionScopeColors[item.scope],
    }));
  const promotionChartData = reportPeriod !== "custom"
    ? buildPromotionSavingsChartData(
        periodReportData.data,
        reportPeriod,
        startDate,
        endDate,
        "vi-VN",
      )
    : [{
        label: reportDateScopeLabel,
        fullDate: reportDateScopeLabel,
        ROOM: promotionSavingsByScope.find((item) => item.scope === "ROOM")?.savings ?? 0,
        SERVICE: promotionSavingsByScope.find((item) => item.scope === "SERVICE")?.savings ?? 0,
        TOTAL: promotionSavingsByScope.find((item) => item.scope === "TOTAL")?.savings ?? 0,
        UNKNOWN: promotionSavingsByScope.find((item) => item.scope === "UNKNOWN")?.savings ?? 0,
      }];

  return (
    <section className="mt-2 space-y-5" aria-labelledby="resource-stats-title">
      <header className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <BarChart3 size={21} />
          </span>
          <div>
            <h2 id="resource-stats-title" className="text-lg font-bold text-slate-900">
              {selectedBranchName ? `Thống kê ${selectedBranchName}` : "Thống kê toàn hệ thống"}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Tổng hợp booking, doanh thu, dịch vụ và khuyến mãi tại {reportScopeLabel} trong khoảng ngày đã chọn.
            </p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(120px,0.8fr)_minmax(120px,0.8fr)_minmax(190px,1.2fr)_minmax(160px,1fr)_minmax(160px,1fr)_40px]">
          <label className="block min-w-0 text-xs font-semibold text-slate-500">
            Theo
            <select
              value={comparisonUnit}
              onChange={(event) => {
                const nextUnit = event.target.value as "day" | "week" | "month";
                const nextPeriod = reportPeriodOptions.find(
                  (option) => option.unit === nextUnit && option.scope === comparisonScope,
                ) ?? reportPeriodOptions.find((option) => option.unit === nextUnit);
                if (nextPeriod) selectReportPeriod(nextPeriod.value);
              }}
              aria-label="Chọn đơn vị so sánh"
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-blue-400"
            >
              <option value="day">Ngày</option>
              <option value="week">Tuần</option>
              <option value="month">Tháng</option>
            </select>
          </label>
          <label className="block min-w-0 text-xs font-semibold text-slate-500">
            Trong
            <select
              value={comparisonScope}
              onChange={(event) => {
                const nextPeriod = reportPeriodOptions.find(
                  (option) => option.unit === comparisonUnit && option.scope === event.target.value,
                );
                if (nextPeriod) selectReportPeriod(nextPeriod.value);
              }}
              aria-label="Chọn khoảng so sánh"
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-blue-400"
            >
              {reportPeriodOptions
                .filter((option) => option.unit === comparisonUnit)
                .map(({ scope }) => (
                  <option key={scope} value={scope}>
                    {scope === "week" ? "Tuần" : scope === "month" ? "Tháng" : "Năm"}
                  </option>
                ))}
            </select>
          </label>
          <div className="min-w-0 text-xs font-semibold text-slate-500">
            <span>Chi nhánh</span>
            <Popover open={isBranchPickerOpen} onOpenChange={setIsBranchPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={isLoading || isError}
                  aria-label="Tìm và chọn chi nhánh"
                  className="mt-1 flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 text-left text-sm font-normal text-slate-700 outline-none hover:bg-slate-50 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                >
                  <span className="truncate">
                    {selectedBranchName ?? "Tất cả chi nhánh"}
                  </span>
                  <ChevronDown size={15} className="shrink-0 text-slate-400" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-0">
                <Command>
                  <CommandInput placeholder="Tìm chi nhánh..." />
                  <CommandList>
                    <CommandEmpty>Không tìm thấy chi nhánh.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="Tất cả chi nhánh"
                        onSelect={() => {
                          setSelectedBranchId("all");
                          setIsBranchPickerOpen(false);
                        }}
                      >
                        <Check className={`mr-2 h-4 w-4 ${selectedBranchId === "all" ? "opacity-100" : "opacity-0"}`} />
                        Tất cả chi nhánh
                      </CommandItem>
                      {branches.map((branch) => (
                        <CommandItem
                          key={branch.id}
                          value={`${branch.name} ${branch.provinceName ?? ""}`}
                          onSelect={() => {
                            setSelectedBranchId(String(branch.id));
                            setIsBranchPickerOpen(false);
                          }}
                        >
                          <Check className={`mr-2 h-4 w-4 ${selectedBranchId === String(branch.id) ? "opacity-100" : "opacity-0"}`} />
                          <span className="truncate">{branch.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <label className="block min-w-0 text-xs font-semibold text-slate-500">
            Từ ngày
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => { setStartDate(event.target.value); setReportPeriod("custom"); }}
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-blue-400"
            />
          </label>
          <label className="block min-w-0 text-xs font-semibold text-slate-500">
            Đến ngày
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              max={today}
              onChange={(event) => { setEndDate(event.target.value); setReportPeriod("custom"); }}
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-blue-400"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleReportRefreshOrReset}
              disabled={!hasReportFilters && (isStatsLoading || isPromotionCatalogFetching)}
              aria-label={hasReportFilters ? "Xóa bộ lọc" : "Tải lại thống kê"}
              title={hasReportFilters ? "Xóa bộ lọc" : "Tải lại thống kê"}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {hasReportFilters
                ? <RotateCcw size={15} />
                : <RefreshCw size={16} className={isStatsLoading || isPromotionCatalogFetching ? "animate-spin" : ""} />}
            </button>
          </div>
        </div>
      </header>

      {!hasValidDateRange && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.
        </p>
      )}
      {hasReportErrors && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <span>Không thể tải báo cáo từ một số chi nhánh. Các số tổng hợp được ẩn để tránh hiển thị thiếu dữ liệu.</span>
          <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="font-semibold underline underline-offset-2">
            Thử tải lại
          </button>
        </div>
      )}

      <div className={`grid grid-cols-1 items-start gap-5 ${isReportTocVisible ? "lg:grid-cols-[220px_minmax(0,1fr)]" : "lg:grid-cols-1"}`}>
        {isReportTocVisible && <nav className="hidden lg:sticky lg:top-6 lg:block" aria-label="Mục lục thống kê Super Admin">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 px-2 pb-3">
              <h3 className="text-sm font-bold text-slate-800">Mục lục</h3>
              <div className="flex items-center gap-1">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{reportSections.length}</span>
                <button
                  type="button"
                  onClick={() => setIsReportTocVisible(false)}
                  aria-label="Thu gọn mục lục"
                  title="Thu gọn mục lục"
                  className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                >
                  <PanelLeftClose size={16} />
                </button>
              </div>
            </div>
            <ol className="space-y-1">
              {reportSections.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => scrollToReportSection(item.id)}
                    aria-current={activeReportSection === item.id ? "location" : undefined}
                    className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs leading-5 transition ${
                      activeReportSection === item.id
                        ? "bg-blue-50 font-semibold text-blue-700"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                    }`}
                  >
                    <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md text-[10px] ${
                      activeReportSection === item.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                    }`}>
                      {index + 1}
                    </span>
                    {item.label}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </nav>}

        <div className="min-w-0 space-y-5">
        {!isReportTocVisible && (
          <div className="hidden justify-end lg:flex">
            <button
              type="button"
              onClick={() => setIsReportTocVisible(true)}
              aria-label="Mở mục lục"
              title="Mở mục lục"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
            >
              <PanelLeftOpen size={16} />
              Mở mục lục
            </button>
          </div>
        )}
        <nav className="overflow-x-auto lg:hidden" aria-label="Mục lục thống kê Super Admin">
          <div className="flex min-w-max gap-2 rounded-xl border border-slate-200/80 bg-white p-2 shadow-sm">
            {reportSections.map((item, index) => (
              <button
                type="button"
                key={item.id}
                onClick={() => scrollToReportSection(item.id)}
                aria-current={activeReportSection === item.id ? "location" : undefined}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  activeReportSection === item.id ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>{index + 1}.</span>
                {item.label}
              </button>
            ))}
          </div>
        </nav>

      <section id="super-admin-stats-overview" data-super-admin-report-section className="scroll-mt-24 space-y-5">
        <div>
          <h3 className="mb-2 text-sm font-bold text-slate-700">Hoạt động</h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label="Chi nhánh"
              value={isLoading || isError ? "—" : visibleBranches.length}
              detail={selectedBranchName ? "Đang xem chi nhánh đã chọn" : "Tổng số chi nhánh trong hệ thống"}
              icon={Building2}
              color="bg-blue-50 text-blue-700"
            />
            <StatCard
              label="Tổng lượt đặt phòng"
              value={displayCount(totalBookings)}
              detail={`Booking tạo trong kỳ · ${reportScopeLabel}`}
              icon={CalendarDays}
              color="bg-cyan-50 text-cyan-700"
            />
            <StatCard
              label="Booking đã hủy"
              value={displayCount(totalCancelledBookings)}
              detail={`Trong khoảng ngày đã chọn · ${reportScopeLabel}`}
              icon={XCircle}
              color="bg-rose-50 text-rose-700"
            />
            <StatCard
              label="Tổng số phòng"
              value={displayCount(totalRooms)}
              detail={`Theo trạng thái hiện tại · ${reportScopeLabel}`}
              icon={BedDouble}
              color="bg-cyan-50 text-cyan-700"
            />
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-bold text-slate-700">Doanh thu vận hành</h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label="Tiền phòng"
              value={isStatsLoading || hasReportErrors || !allReportsLoaded ? "—" : formatMoney(totalRoomRevenue)}
              detail={`Theo các đêm lưu trú · ${reportScopeLabel}`}
              icon={Wallet}
              color="bg-blue-50 text-blue-700"
            />
            <StatCard
              label="Doanh thu dịch vụ"
              value={isStatsLoading || hasReportErrors || !allReportsLoaded ? "—" : formatMoney(totalServiceRevenue)}
              detail={`Từ ${displayCount(totalServiceUsage)} lượt dịch vụ · ${reportScopeLabel}`}
              icon={ConciergeBell}
              color="bg-violet-50 text-violet-700"
            />
            <StatCard
              label="Giá trị khuyến mãi"
              value={isStatsLoading || hasReportErrors || !allReportsLoaded ? "—" : formatMoney(totalPromotionSavings)}
              detail={`Tổng tiền giảm trên booking · ${reportScopeLabel}`}
              icon={Tag}
              color="bg-amber-50 text-amber-700"
            />
            <StatCard
              label="Lượt sử dụng dịch vụ"
              value={displayCount(totalServiceUsage)}
              detail={`Tổng lượt dùng · ${reportScopeLabel}`}
              icon={ConciergeBell}
              color="bg-violet-50 text-violet-700"
            />
            <StatCard
              label="Lượt dùng khuyến mãi"
              value={displayCount(totalPromotionUsage)}
              detail={`Tổng lượt áp dụng · ${reportScopeLabel}`}
              icon={Tag}
              color="bg-emerald-50 text-emerald-700"
            />
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-bold text-slate-700">Dòng tiền</h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label="Tổng tiền đã thu booking"
              value={isStatsLoading || hasReportErrors || !allReportsLoaded ? "—" : formatMoney(totalRevenue)}
              detail={isStatsLoading || hasReportErrors || !allReportsLoaded
                ? `Tiền mặt và chuyển khoản · ${reportScopeLabel}`
                : `Tiền mặt ${formatMoney(totalCashReceived)} · Chuyển khoản ${formatMoney(totalBankReceived)}`}
              icon={Wallet}
              color="bg-amber-50 text-amber-700"
            />
            <StatCard
              label="Tổng tiền hoàn lại"
              value={isStatsLoading || hasReportErrors || !allReportsLoaded ? "—" : formatMoney(totalRefunded)}
              detail={`Giao dịch hoàn tiền trong kỳ · ${reportScopeLabel}`}
              icon={Wallet}
              color="bg-rose-50 text-rose-700"
            />
            <StatCard
              label="Tiền thừa trả khách"
              value={isStatsLoading || hasReportErrors || !allReportsLoaded ? "—" : formatMoney(totalChangeReturned)}
              detail={`Tiền thừa từ giao dịch tiền mặt · ${reportScopeLabel}`}
              icon={Wallet}
              color="bg-orange-50 text-orange-700"
            />
            <StatCard
              label="Tiền thu ròng"
              value={isStatsLoading || hasReportErrors || !allReportsLoaded ? "—" : formatMoney(totalNetReceived)}
              detail="Tổng thu trừ hoàn tiền và tiền thừa"
              icon={Wallet}
              color="bg-violet-50 text-violet-700"
            />
          </div>
        </div>
      </section>

      {allReportsLoaded && (
        <>
          <div className="space-y-5">
            <section id="super-admin-stats-booking-revenue" data-super-admin-report-section className="scroll-mt-24 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900">Doanh thu booking theo {reportPeriodLabel}</h3>
                  <p className="mt-1 text-xs text-slate-400">Gồm doanh thu phòng và dịch vụ · Tổng hợp {reportScopeLabel} · đ</p>
                </div>
                <BedDouble size={18} className="text-blue-600" />
              </div>
              {reportPeriod !== "custom" && periodReportData.isLoading ? (
                <p className="py-12 text-center text-sm text-slate-400">Đang tải doanh thu booking…</p>
              ) : reportPeriod !== "custom" && periodReportData.isError ? (
                <p role="alert" className="py-12 text-center text-sm text-rose-600">Không thể tải doanh thu booking theo kỳ.</p>
              ) : bookingRevenueChartData.every((item) => item.roomRevenue === 0 && item.serviceRevenue === 0) && reportPeriod === "custom" ? (
                <p className="py-12 text-center text-sm text-slate-400">Không có doanh thu booking trong kỳ.</p>
              ) : (
                <ResponsiveContainer width="100%" height={reportPeriod === "day-month" ? 320 : 290}>
                  <BarChart data={bookingRevenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f5" />
                    <XAxis
                      dataKey="label"
                      interval={reportPeriod === "day-month" || reportPeriod === "day-week" || reportPeriod === "week-month" ? 0 : "preserveStartEnd"}
                      angle={reportPeriod === "day-month" ? -45 : 0}
                      textAnchor={reportPeriod === "day-month" ? "end" : "middle"}
                      height={reportPeriod === "day-month" ? 48 : 30}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(value) => formatReportCurrencyAxis(Number(value), "vi")} />
                    <Tooltip
                      labelFormatter={(_label, entries) => entries[0]?.payload.fullDate ?? ""}
                      formatter={(value, name) => [formatMoney(Number(value)), name]}
                    />
                    <Legend verticalAlign="bottom" height={30} iconType="circle" wrapperStyle={{ fontSize: 12, color: "#334155" }} />
                    <Bar dataKey="roomRevenue" name="Doanh thu phòng" fill="#2563eb" stackId="booking-revenue" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="serviceRevenue" name="Doanh thu dịch vụ" fill="#10b981" stackId="booking-revenue" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>
            <section id="super-admin-stats-services" data-super-admin-report-section className="scroll-mt-24 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900">Doanh thu dịch vụ theo {reportPeriodLabel}</h3>
                  <p className="mt-1 text-xs text-slate-400">Tổng hợp {reportScopeLabel} · đ</p>
                </div>
                <ConciergeBell size={18} className="text-violet-600" />
              </div>
              {dailyServiceRevenue.every((item) => item.revenue === 0) && reportPeriod === "custom" ? (
                <p className="py-12 text-center text-sm text-slate-400">Không có dữ liệu doanh thu dịch vụ trong kỳ.</p>
              ) : (
                <ResponsiveContainer width="100%" height={reportPeriod === "day-month" ? 320 : 290}>
                  <BarChart data={dailyServiceRevenue}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f5" />
                    <XAxis
                      dataKey="label"
                      interval={reportPeriod === "day-month" || reportPeriod === "day-week" || reportPeriod === "week-month" ? 0 : "preserveStartEnd"}
                      angle={reportPeriod === "day-month" ? -45 : 0}
                      textAnchor={reportPeriod === "day-month" ? "end" : "middle"}
                      height={reportPeriod === "day-month" ? 48 : 30}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(value) => formatReportCurrencyAxis(Number(value), "vi")} />
                    <Tooltip
                      labelFormatter={(_label, entries) => entries[0]?.payload.fullDate ?? ""}
                      formatter={(value) => [formatMoney(Number(value)), "Doanh thu dịch vụ"]}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={30}
                      iconType="circle"
                      wrapperStyle={{ fontSize: 12, color: "#334155" }}
                    />
                    <Bar
                      dataKey="revenue"
                      name="Doanh thu dịch vụ"
                      fill="#6d28d9"
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>

            <section id="super-admin-stats-promotions" data-super-admin-report-section className="scroll-mt-24 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="font-bold text-slate-900">Hiệu quả khuyến mãi {reportDateScopeLabel}</h3>
                <p className="mt-1 text-xs text-slate-400">Phân loại theo tiền phòng, tiền dịch vụ và tổng booking</p>
              </div>
              {isPromotionCatalogError && (
                <p role="status" className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Không tải được loại khuyến mãi; một số chương trình có thể hiện là chưa xác định.
                </p>
              )}
              {promotionBreakdown.length === 0
                && reportPeriod === "custom" ? (
                <p className="py-12 text-center text-sm text-slate-400">Không có khuyến mãi được áp dụng trong kỳ.</p>
              ) : (
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                  <p className="mb-2 text-center text-xs font-semibold text-slate-600">
                    {reportPeriod !== "custom" ? "Tiền giảm theo thời gian" : "Số tiền giảm theo loại"}
                  </p>
                  {reportPeriod !== "custom" && periodReportData.isLoading ? (
                    <p className="py-12 text-center text-xs text-slate-400">Đang tải dữ liệu khuyến mãi…</p>
                  ) : reportPeriod !== "custom" && periodReportData.isError ? (
                    <p role="alert" className="py-12 text-center text-xs text-rose-600">Không thể tải dữ liệu khuyến mãi theo ngày.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={promotionChartData} margin={{ top: 8, right: 12, left: 0, bottom: reportPeriod === "day-month" ? 22 : 8 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f5" />
                        <XAxis
                          dataKey="label"
                          axisLine={false}
                          tickLine={false}
                          interval={reportPeriod === "day-month" || reportPeriod === "day-week" || reportPeriod === "week-month" ? 0 : "preserveStartEnd"}
                          angle={reportPeriod === "day-month" ? -45 : 0}
                          textAnchor={reportPeriod === "day-month" ? "end" : "middle"}
                          height={reportPeriod === "day-month" ? 48 : 30}
                          tick={{ fontSize: 10, fill: "#64748b" }}
                        />
                        <YAxis
                          type="number"
                          domain={[0, "dataMax"]}
                          allowDecimals={false}
                          axisLine={false}
                          tickLine={false}
                          width={52}
                          tick={{ fontSize: 9, fill: "#94a3b8" }}
                          tickFormatter={(value) => formatReportCurrencyAxis(Number(value), "vi")}
                        />
                        <Tooltip
                          labelFormatter={(_label, entries) => {
                            return entries[0]?.payload.fullDate ?? "";
                          }}
                          formatter={(value, name) => [formatMoney(Number(value)), name]}
                        />
                        <Legend verticalAlign="bottom" height={28} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="ROOM" name={promotionScopeLabels.ROOM} fill={promotionScopeColors.ROOM} stackId="savings" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="SERVICE" name={promotionScopeLabels.SERVICE} fill={promotionScopeColors.SERVICE} stackId="savings" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="TOTAL" name={promotionScopeLabels.TOTAL} fill={promotionScopeColors.TOTAL} stackId="savings" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="UNKNOWN" name={promotionScopeLabels.UNKNOWN} fill={promotionScopeColors.UNKNOWN} stackId="savings" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                  {promotionScopesTotalSavings === 0 && !periodReportData.isLoading && !periodReportData.isError && (
                    <p className="py-3 text-center text-xs text-slate-400">Chưa có số tiền giảm để so sánh.</p>
                  )}
                </div>
              )}
            </section>
          </div>

          <div id="super-admin-stats-rooms" data-super-admin-report-section className="scroll-mt-24 grid gap-5 xl:grid-cols-2">
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="font-bold text-slate-900">Tình trạng phòng hiện tại</h3>
                <p className="mt-1 text-xs text-slate-400">Tổng số phòng theo trạng thái · {reportScopeLabel}</p>
              </div>
              {roomStatusBreakdown.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-400">Chưa có dữ liệu trạng thái phòng.</p>
              ) : (
                <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={roomStatusBreakdown} dataKey="roomCount" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={4}>
                        {roomStatusBreakdown.map((entry) => <Cell key={entry.status} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={28} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {roomStatusBreakdown.map((item) => (
                      <div key={item.status} className="rounded-xl bg-slate-50 p-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <p className="text-xs font-semibold text-slate-500">{item.name}</p>
                        </div>
                        <p className="mt-2 text-xl font-bold text-slate-900">{formatCount(item.roomCount)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="font-bold text-slate-900">Booking theo loại phòng</h3>
                <p className="mt-1 text-xs text-slate-400">Số lượt đặt theo loại phòng · {reportScopeLabel}</p>
              </div>
              {roomTypeBreakdown.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-400">Không có dữ liệu loại phòng trong kỳ.</p>
              ) : (
                <div className="space-y-3">
                  {roomTypeBreakdown.map((item) => {
                    const maxCount = roomTypeBreakdown[0]?.bookingCount ?? 0;
                    const width = maxCount > 0 ? `${(item.bookingCount / maxCount) * 100}%` : "0%";
                    return (
                      <div key={item.roomType}>
                        <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                          <span className="font-medium text-slate-700">{item.name}</span>
                          <span className="font-semibold tabular-nums text-slate-900">{formatCount(item.bookingCount)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-blue-500" style={{ width }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <section id="super-admin-stats-cancellations" data-super-admin-report-section className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <h3 className="font-bold text-slate-900">Chi tiết booking đã hủy</h3>
              <p className="mt-1 text-xs text-slate-400">Phân loại theo {reportScopeLabel}, kênh đặt và lý do hủy trong kỳ</p>
            </div>
            {cancelledBookingDetails.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">Không có booking bị hủy trong khoảng ngày này.</p>
            ) : (
              <>
                <div className="max-h-[380px] overflow-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs font-semibold text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Chi nhánh</th>
                      <th className="px-5 py-3">Mã booking</th>
                      <th className="px-5 py-3">Kênh đặt</th>
                      <th className="px-5 py-3">Lý do hủy</th>
                      <th className="px-5 py-3">Thời điểm</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedCancelledBookings.map((booking) => (
                      <tr key={booking.rowKey} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3 font-medium text-slate-700">{booking.branchName}</td>
                        <td className="whitespace-nowrap px-5 py-3 font-semibold text-slate-800">{booking.bookingId}</td>
                        <td className="px-5 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            booking.bookingChannel === "ONLINE" ? "bg-blue-50 text-blue-700" :
                              booking.bookingChannel === "OFFLINE" ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-600"
                          }`}>
                            {booking.bookingChannel === "ONLINE" ? "Online" : booking.bookingChannel === "OFFLINE" ? "Tại quầy" : "Không rõ"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-600">{booking.reason}</td>
                        <td className="whitespace-nowrap px-5 py-3 text-slate-500">
                          {booking.cancelledAt ? new Date(booking.cancelledAt).toLocaleString("vi-VN") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
                <ListPagination totalItems={cancelledBookingDetails.length} page={safeCancelledPage} pageSize={cancelledPageSize} mode="table" onPageChange={setCancelledPage} onPageSizeChange={setCancelledPageSize} />
              </>
            )}
          </section>
        </>
      )}

      <section id="super-admin-stats-branches" data-super-admin-report-section className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Thống kê theo chi nhánh</h3>
            <p className="mt-1 text-sm text-slate-500">
              Dữ liệu báo cáo từ {startDate} đến {endDate}.
            </p>
          </div>
          <p className="text-sm text-slate-500">
            {selectedBranchName ? `Đang xem: ${selectedBranchName}` : "Tổng hợp tất cả chi nhánh"}
          </p>
        </div>

        {isLoading ? (
          <p className="p-10 text-center text-sm text-slate-500">Đang tải danh sách chi nhánh...</p>
        ) : isError ? (
          <div className="p-10 text-center">
            <p role="alert" className="text-sm text-rose-600">Không thể tải danh sách chi nhánh.</p>
            <button type="button" onClick={onRetry} className="mt-3 text-sm font-semibold text-blue-700 hover:underline">Thử tải lại</button>
          </div>
        ) : branches.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">Chưa có chi nhánh trong hệ thống.</p>
        ) : visibleBranches.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">Không tìm thấy chi nhánh được chọn.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-left">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3">Chi nhánh</th>
                  <th scope="col" className="px-5 py-3">Tỉnh / thành</th>
                  <th scope="col" className="px-5 py-3 text-right">Lượt đặt phòng</th>
                  <th scope="col" className="px-5 py-3 text-right">Booking đã hủy</th>
                  <th scope="col" className="px-5 py-3 text-right">Tiền booking đã thu</th>
                  <th scope="col" className="px-5 py-3 text-center">Dịch vụ</th>
                  <th scope="col" className="px-5 py-3 text-center">Khuyến mãi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedBranches.map((branch) => {
                  const branchReport = branchReports[branch.id];
                  const report = branchReport?.report;
                  const hasBranchReportError = branchReport?.hasError;
                  const isBranchLoading = !branchReport && (isLoadingReports || isStatsLoading);
                  const value = (count: number | undefined) =>
                    hasBranchReportError || isBranchLoading || !report ? "—" : formatCount(count ?? 0);
                  return (
                    <tr key={branch.id} className="transition hover:bg-slate-50/70">
                      <th scope="row" className="px-5 py-4 font-semibold text-slate-800">
                        <div className="flex items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700">
                            <Building2 size={16} />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate">{branch.name}</p>
                            <p className="mt-0.5 max-w-64 truncate text-xs font-normal text-slate-400">{branch.address || "Chưa có địa chỉ"}</p>
                          </div>
                        </div>
                      </th>
                      <td className="px-5 py-4 text-sm text-slate-600">{branch.provinceName || "—"}</td>
                      <td className="px-5 py-4 text-right text-sm font-semibold tabular-nums text-slate-700">{value(report?.totalBookingCount)}</td>
                      <td className="px-5 py-4 text-right text-sm font-semibold tabular-nums text-rose-700">{value(report?.cancelledBookingCount)}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        {hasBranchReportError || isBranchLoading || !report ? (
                          <span className="text-sm font-semibold text-slate-800">—</span>
                        ) : (
                          <div>
                            <p className="text-sm font-semibold tabular-nums text-slate-800">{formatMoney(Number(report.cashReceived ?? 0))}</p>
                            <p className="mt-1 text-[11px] tabular-nums text-slate-500">
                              <span className="text-green-700">TM {formatMoney(Number(report.cashReceivedCash ?? 0))}</span>
                              <span className="mx-1.5 text-slate-300">·</span>
                              <span className="text-sky-700">CK {formatMoney(Number(report.cashReceivedBank ?? 0))}</span>
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex min-w-12 justify-center rounded-lg bg-violet-50 px-3 py-1.5 text-sm font-bold text-violet-700">{value(report?.serviceUsageCount)}</span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex min-w-12 justify-center rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-700">{value(report?.promotionUsageCount)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
            <ListPagination totalItems={visibleBranches.length} page={safeBranchPage} pageSize={branchPageSize} mode="table" onPageChange={setBranchPage} onPageSizeChange={setBranchPageSize} />
          </>
        )}
      </section>
      <div aria-hidden="true" className="h-64" />
        </div>
      </div>
    </section>
  );
}
