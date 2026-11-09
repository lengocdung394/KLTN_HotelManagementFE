import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart3, BedDouble, CalendarDays, Tag, TrendingUp, XCircle } from "lucide-react";
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
import { useGetHotelReportQuery } from "../services/reportApi";
import { useGetPromotionsQuery } from "../services/promotionApi";
import { useGetSuperAdminBranchesQuery } from "../services/superAdminApi";
import { useAppSelector } from "../store/hooks";
import { localizedText } from "../i18n";
import ListPagination from "../components/ListPagination";
import {
  buildRevenueChartData,
  getReportDateRange,
  reportPeriodOptions,
  type ReportPeriod,
} from "../lib/reportPeriod";
import {
  buildPromotionScopeBreakdown,
  getPromotionScope,
  promotionScopeColors,
  promotionScopeLabelKey,
} from "../lib/promotionReport";

const localDateString = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const formatMoney = (amount: number) =>
  localizedText(
    `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(amount ?? 0))}đ`,
    `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(amount ?? 0))} VND`,
  );

const roomStatusLabel = (status: string) => {
  if (status === "READY") return localizedText("Sẵn sàng", "Ready");
  if (status === "IN_USE") return localizedText("Đang sử dụng", "In use");
  if (status === "CLEANING") return localizedText("Đang dọn", "Cleaning");
  if (status === "MAINTENANCE") return localizedText("Bảo trì", "Maintenance");
  return status;
};

const roomStatusColors: Record<string, string> = {
  READY: "#22c55e",
  IN_USE: "#2563eb",
  CLEANING: "#f59e0b",
  MAINTENANCE: "#f17b83",
};

const roomTypeLabel = (type: string) => {
  if (type === "STANDARD") return localizedText("Phòng Tiêu chuẩn", "Standard room");
  if (type === "DELUXE") return localizedText("Phòng Cao cấp", "Deluxe room");
  if (type === "SUITE") return localizedText("Phòng Thượng hạng", "Suite");
  if (type === "FAMILY") return localizedText("Phòng Gia đình", "Family room");
  return type;
};

const refundStatusLabel = (status: string | null) => {
  const labels: Record<string, string> = {
    PENDING: localizedText("Chờ xử lý", "Pending"),
    APPROVED: localizedText("Đã duyệt", "Approved"),
    REFUNDED: localizedText("Đã hoàn", "Refunded"),
    REFUND_BANK_DETAILS_REQUIRED: localizedText("Chờ thông tin ngân hàng", "Bank details required"),
    REFUND_REVIEW_PENDING: localizedText("Chờ duyệt", "Pending review"),
    REFUND_APPROVED: localizedText("Đã duyệt", "Approved"),
    REFUND_REJECTED: localizedText("Từ chối", "Rejected"),
    PAYOUT_PROCESSING: localizedText("Đang chuyển khoản", "Payout processing"),
    PAYOUT_FAILED: localizedText("Chuyển khoản thất bại", "Payout failed"),
  };
  return status ? labels[status] ?? status : localizedText("Không xác định", "Unknown");
};

const paymentMethodLabel = (method: string | null) => {
  if (method === "CASH") return localizedText("Tiền mặt", "Cash");
  if (method === "BANK") return localizedText("Chuyển khoản", "Bank transfer");
  if (method === "EWALLET") return localizedText("Ví điện tử", "E-wallet");
  return localizedText("Không xác định", "Unknown");
};

export default function ReportWorkspace() {
  const { t } = useTranslation();
  const { hotelId, roles } = useAppSelector((state) => state.auth);
  const isSystemAdmin = roles.includes("ROLE_SUPER_ADMIN");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const today = localDateString(new Date());
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("day-month");
  const [comparisonUnit, setComparisonUnit] = useState<"day" | "week" | "month">("day");
  const [comparisonScope, setComparisonScope] = useState<"week" | "month" | "year">("month");
  const initialRange = getReportDateRange("day-month", today, today);
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [refundPages, setRefundPages] = useState<Record<string, number>>({});
  const [refundPageSizes, setRefundPageSizes] = useState<Record<string, number>>({});
  const [cancelledPage, setCancelledPage] = useState(1);
  const [cancelledPageSize, setCancelledPageSize] = useState(10);
  const { data: branches = [], isLoading: isLoadingBranches, isError: isBranchesError } =
    useGetSuperAdminBranchesQuery(undefined, { skip: !isSystemAdmin });
  const reportHotelId = isSystemAdmin ? Number(selectedBranchId) : Number(hotelId);
  const canLoadReport = Number.isFinite(reportHotelId)
    && reportHotelId > 0
    && Boolean(startDate)
    && Boolean(endDate)
    && startDate <= endDate;
  const {
    data: report,
    isLoading,
    isFetching,
    isError,
  } = useGetHotelReportQuery(
    {
      startDate,
      endDate,
      ...(isSystemAdmin ? { hotelId: reportHotelId } : {}),
    },
    { skip: !canLoadReport },
  );
  const {
    data: availablePromotions = [],
    isError: isPromotionCatalogError,
  } = useGetPromotionsQuery(
    canLoadReport ? { hotelId: reportHotelId, page: 0, size: 100 } : undefined,
    { skip: !canLoadReport },
  );
  const promotionScopeById = new Map(
    availablePromotions.map((promotion) => [promotion.id, promotion.type]),
  );
  const promotionScopeBreakdown = buildPromotionScopeBreakdown(
    report?.promotions ?? [],
    promotionScopeById,
  ).map((item) => ({
    ...item,
    scopeLabel: t(`promotion.${promotionScopeLabelKey[item.scope]}`),
  }));
  const promotionScopesTotalSavings = promotionScopeBreakdown.reduce((total, item) => total + item.savings, 0);

  const dailyRevenue = buildRevenueChartData(
    report?.dailyServiceRevenue ?? [],
    reportPeriod,
    startDate,
    endDate,
    localizedText("vi-VN", "en-US"),
  );
  const roomStatuses = (report?.roomStatuses ?? []).map((item) => ({
    ...item,
    name: roomStatusLabel(item.status),
    color: roomStatusColors[item.status] ?? "#94a3b8",
  }));
  const roomTypeBookings = (report?.roomTypeBookings ?? [])
    .map((item) => ({
      ...item,
      name: roomTypeLabel(item.roomType),
    }))
    .sort((left, right) => right.bookingCount - left.bookingCount);
  const mostBookedRoomType = roomTypeBookings[0];
  const cancelledBookings = report?.cancelledBookings ?? [];
  const cancelledBookingCount = report?.cancelledBookingCount ?? cancelledBookings.length;
  const onlineCancelledBookingCount = report?.onlineCancelledBookingCount
    ?? cancelledBookings.filter((booking) => booking.bookingChannel === "ONLINE").length;
  const offlineCancelledBookingCount = report?.offlineCancelledBookingCount
    ?? cancelledBookings.filter((booking) => booking.bookingChannel === "OFFLINE").length;
  const checkoutSurplusRefunds = report?.checkoutSurplusRefunds ?? [];
  const bookingCancellationRefunds = report?.bookingCancellationRefunds ?? [];
  const cancelledTotalPages = Math.max(1, Math.ceil(cancelledBookings.length / cancelledPageSize));
  const safeCancelledPage = Math.min(cancelledPage, cancelledTotalPages);
  const paginatedCancelledBookings = cancelledBookings.slice(
    (safeCancelledPage - 1) * cancelledPageSize,
    safeCancelledPage * cancelledPageSize,
  );
  const totalBookingCount = report?.totalBookingCount ?? 0;
  const cashReceived = report?.cashReceived ?? 0;
  const cashReceivedCash = report?.cashReceivedCash ?? 0;
  const cashReceivedBank = report?.cashReceivedBank ?? 0;
  const cashRefunded = report?.cashRefunded ?? 0;
  const cashChangeReturned = report?.cashChangeReturned ?? 0;
  const netCashReceived = report?.netCashReceived
    ?? cashReceived - cashRefunded - cashChangeReturned;
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
  const reportPeriodOptionLabels: Record<Exclude<ReportPeriod, "custom">, [string, string]> = {
    "day-week": ["Ngày trong tuần", "Day of week"],
    "day-month": ["Ngày trong tháng", "Day of month"],
    "day-year": ["Ngày trong năm", "Day of year"],
    "week-month": ["Tuần trong tháng", "Week of month"],
    "week-year": ["Tuần trong năm", "Week of year"],
    "month-year": ["Tháng trong năm", "Month of year"],
  };
  const reportPeriodLabel = reportPeriod === "custom"
    ? localizedText("theo ngày trong khoảng tùy chọn", "by day in the selected range")
    : localizedText(`theo ${reportPeriodOptionLabels[reportPeriod][0].toLowerCase()}`, `by ${reportPeriodOptionLabels[reportPeriod][1].toLowerCase()}`);
  const reportScopeLabel = reportPeriod === "custom"
    ? localizedText("trong khoảng tùy chọn", "in the selected range")
    : localizedText(
        `trong ${comparisonScope === "week" ? "tuần" : comparisonScope === "month" ? "tháng" : "năm"}`,
        `in the ${comparisonScope}`,
      );
  const promotionChartData = [{
    period: reportScopeLabel,
    ROOM: promotionScopeBreakdown.find((item) => item.scope === "ROOM")?.savings ?? 0,
    SERVICE: promotionScopeBreakdown.find((item) => item.scope === "SERVICE")?.savings ?? 0,
    TOTAL: promotionScopeBreakdown.find((item) => item.scope === "TOTAL")?.savings ?? 0,
    UNKNOWN: promotionScopeBreakdown.find((item) => item.scope === "UNKNOWN")?.savings ?? 0,
  }];
  const promotionChartIsStacked = comparisonUnit !== "day";
  useEffect(() => {
    setRefundPages({});
    setCancelledPage(1);
  }, [selectedBranchId, startDate, endDate]);
  useEffect(() => {
    if (cancelledPage > cancelledTotalPages) setCancelledPage(cancelledTotalPages);
  }, [cancelledPage, cancelledTotalPages]);
  const reportSections = [
    { id: "report-overview", label: localizedText("Tổng quan", "Overview") },
    { id: "report-service-revenue", label: localizedText("Doanh thu dịch vụ", "Service revenue") },
    { id: "report-promotions", label: localizedText("Khuyến mãi", "Promotions") },
    { id: "report-room-types", label: localizedText("Lượt đặt theo loại phòng", "Bookings by room type") },
    { id: "report-room-status", label: localizedText("Trạng thái phòng", "Room status") },
    { id: "report-cancellations", label: localizedText("Booking đã hủy", "Cancelled bookings") },
  ];
  const [activeReportSection, setActiveReportSection] = useState(reportSections[0].id);

  useEffect(() => {
    if (!report || isError) return;

    const sections = document.querySelectorAll<HTMLElement>("[data-report-section]");
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

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [report, isError]);

  const scrollToReportSection = (sectionId: string) => {
    setActiveReportSection(sectionId);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="mt-6 space-y-5">
      <section className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
            <CalendarDays size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">{localizedText("Báo cáo hoạt động", "Activity report")}</p>
            <p className="mt-1 text-xs text-slate-400">
              {report
                ? `${new Date(`${report.startDate}T00:00:00`).toLocaleDateString(localizedText("vi-VN", "en-US"))} – ${new Date(`${report.endDate}T00:00:00`).toLocaleDateString(localizedText("vi-VN", "en-US"))}`
                : localizedText("Chọn khoảng ngày để xem báo cáo", "Select a date range to view the report")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-xs font-semibold text-slate-500">
            {localizedText("Theo", "By")}
            <select
              value={comparisonUnit}
              onChange={(event) => {
                const nextUnit = event.target.value as "day" | "week" | "month";
                const nextPeriod = reportPeriodOptions.find(
                  (option) => option.unit === nextUnit && option.scope === comparisonScope,
                ) ?? reportPeriodOptions.find((option) => option.unit === nextUnit);
                if (nextPeriod) selectReportPeriod(nextPeriod.value);
              }}
              aria-label={localizedText("Chọn đơn vị so sánh", "Choose comparison unit")}
              className="ml-2 mt-1 h-9 min-w-32 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-blue-400"
            >
              <option value="day">{localizedText("Ngày", "Day")}</option>
              <option value="week">{localizedText("Tuần", "Week")}</option>
              <option value="month">{localizedText("Tháng", "Month")}</option>
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-500">
            {localizedText("Trong", "Within")}
            <select
              value={comparisonScope}
              onChange={(event) => {
                const nextPeriod = reportPeriodOptions.find(
                  (option) => option.unit === comparisonUnit && option.scope === event.target.value,
                );
                if (nextPeriod) selectReportPeriod(nextPeriod.value);
              }}
              aria-label={localizedText("Chọn khoảng so sánh", "Choose comparison range")}
              className="ml-2 mt-1 h-9 min-w-32 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-blue-400"
            >
              {reportPeriodOptions
                .filter((option) => option.unit === comparisonUnit)
                .map(({ scope }) => (
                  <option key={scope} value={scope}>
                    {scope === "week"
                      ? localizedText("Tuần", "Week")
                      : scope === "month"
                        ? localizedText("Tháng", "Month")
                        : localizedText("Năm", "Year")}
                  </option>
                ))}
            </select>
          </label>
          {isSystemAdmin && (
            <label className="block text-xs font-semibold text-slate-500">
              {localizedText("Chi nhánh", "Branch")}
              <select
                value={selectedBranchId}
                onChange={(event) => setSelectedBranchId(event.target.value)}
                aria-label={localizedText("Chọn chi nhánh xem báo cáo", "Select a branch for the report")}
                className="ml-2 mt-1 h-9 min-w-48 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-blue-400"
              >
                <option value="">{isLoadingBranches ? localizedText("Đang tải chi nhánh...", "Loading branches...") : localizedText("Chọn chi nhánh", "Select a branch")}</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </label>
          )}
          <label className="block text-xs font-semibold text-slate-500">
            {localizedText("Từ ngày", "From")}
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => { setStartDate(event.target.value); setReportPeriod("custom"); }}
              className="ml-2 mt-1 h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-blue-400"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-500">
            {localizedText("Đến ngày", "To")}
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              max={today}
              onChange={(event) => { setEndDate(event.target.value); setReportPeriod("custom"); }}
              className="ml-2 mt-1 h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-blue-400"
            />
          </label>
          {startDate > endDate && (
            <p role="alert" className="w-full text-xs text-rose-600">{localizedText("Ngày bắt đầu không được sau ngày kết thúc.", "The start date must be on or before the end date.")}</p>
          )}
        </div>
      </section>

      {isBranchesError && isSystemAdmin && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {localizedText("Không thể tải danh sách chi nhánh.", "Could not load the branch list.")}
        </p>
      )}
      {!isSystemAdmin && !hotelId && (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {localizedText("Chưa xác định được chi nhánh cho tài khoản này.", "No branch is associated with this account.")}
        </p>
      )}
      {isSystemAdmin && !selectedBranchId && !isBranchesError && (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-center text-sm text-slate-500">
          {localizedText("Chọn chi nhánh để xem báo cáo.", "Select a branch to view the report.")}
        </p>
      )}
      {isLoading && (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          {localizedText("Đang tải báo cáo...", "Loading report...")}
        </p>
      )}
      {isError && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {localizedText("Không thể tải báo cáo. Vui lòng thử lại.", "Could not load the report. Please try again.")}
        </p>
      )}
      {isFetching && !isLoading && (
        <p className="text-right text-xs text-slate-400">{localizedText("Đang cập nhật số liệu...", "Updating report data...")}</p>
      )}

      {report && !isError && (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav className="hidden lg:sticky lg:top-6 lg:block" aria-label={localizedText("Mục lục báo cáo", "Report contents")}>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2 px-2 pb-3">
                <h2 className="text-sm font-bold text-slate-800">{localizedText("Mục lục", "Contents")}</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{reportSections.length}</span>
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
          </nav>

          <nav className="overflow-x-auto lg:hidden" aria-label={localizedText("Mục lục báo cáo", "Report contents")}>
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

          <div className="min-w-0 space-y-5">
          <section id="report-overview" data-report-section className="scroll-mt-24 space-y-3">
          <div>
            <h3 className="mb-2 text-sm font-bold text-slate-700">{localizedText("Hoạt động", "Activity")}</h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <article className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-blue-600">
                <BarChart3 size={16} />
                <p className="text-xs font-semibold">{localizedText("Tổng lượt đặt phòng", "Total bookings")}</p>
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900">{totalBookingCount.toLocaleString(localizedText("vi-VN", "en-US"))}</p>
              <p className="mt-1 text-xs text-slate-500">{localizedText("Số booking được tạo trong kỳ, gồm cả booking hủy", "Bookings created during this period, including cancellations")}</p>
            </article>
            <article className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-rose-600">
                <XCircle size={16} />
                <p className="text-xs font-semibold">{localizedText("Booking đã hủy", "Cancelled bookings")}</p>
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900">{cancelledBookingCount.toLocaleString(localizedText("vi-VN", "en-US"))}</p>
              <p className="mt-1 text-xs text-slate-500">{localizedText("Trong khoảng ngày đã chọn", "During the selected date range")}</p>
            </article>
            <article className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-violet-600">
                <BedDouble size={16} />
                <p className="text-xs font-semibold">{localizedText("Tổng số phòng", "Total rooms")}</p>
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900">{report.totalRoomCount.toLocaleString(localizedText("vi-VN", "en-US"))}</p>
              <p className="mt-1 text-xs text-slate-500">{localizedText("Theo trạng thái hiện tại", "By current status")}</p>
            </article>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-bold text-slate-700">{localizedText("Doanh thu vận hành", "Operating revenue")}</h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-blue-600">
                <BedDouble size={16} />
                <p className="text-xs font-semibold">{localizedText("Tiền phòng", "Room revenue")}</p>
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900">{formatMoney(report.roomRevenue)}</p>
              <p className="mt-1 text-xs text-slate-500">{localizedText("Theo các đêm lưu trú trong khoảng ngày đã chọn", "Based on stay nights within the selected date range")}</p>
            </article>
            <article className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-blue-600">
                <TrendingUp size={16} />
                <p className="text-xs font-semibold">{localizedText("Doanh thu dịch vụ", "Service revenue")}</p>
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900">{formatMoney(report.serviceRevenue)}</p>
              <p className="mt-1 text-xs text-slate-500">{localizedText(`Từ ${report.serviceUsageCount} dịch vụ đã sử dụng`, `From ${report.serviceUsageCount} services used`)}</p>
            </article>
            <article className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-amber-600">
                <Tag size={16} />
                <p className="text-xs font-semibold">{localizedText("Giá trị khuyến mãi", "Promotion savings")}</p>
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900">{formatMoney(report.promotionSavings)}</p>
              <p className="mt-1 text-xs text-slate-500">{localizedText("Tổng tiền giảm trên booking", "Total discounts applied to bookings")}</p>
            </article>
            <article className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-emerald-600">
                <Tag size={16} />
                <p className="text-xs font-semibold">{localizedText("Lượt sử dụng khuyến mãi", "Promotion uses")}</p>
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900">{report.promotionUsageCount.toLocaleString(localizedText("vi-VN", "en-US"))}</p>
              <p className="mt-1 text-xs text-slate-500">{localizedText("Trong khoảng ngày đã chọn", "During the selected date range")}</p>
            </article>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-bold text-slate-700">{localizedText("Dòng tiền", "Cash flow")}</h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <article className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-emerald-600">
                <TrendingUp size={16} />
                <p className="text-xs font-semibold">{localizedText("Tổng tiền đã thu booking", "Total booking payments received")}</p>
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900">{formatMoney(cashReceived)}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-2 text-xs">
                <span className="text-slate-500">{localizedText("Tiền mặt", "Cash")}: <strong className="font-semibold text-green-700">{formatMoney(cashReceivedCash)}</strong></span>
                <span className="text-slate-500">{localizedText("Chuyển khoản", "Bank transfer")}: <strong className="font-semibold text-sky-700">{formatMoney(cashReceivedBank)}</strong></span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">{localizedText("Các giao dịch thu tiền thành công trong kỳ", "Successful payment transactions during this period")}</p>
            </article>
            <article className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-rose-600">
                <XCircle size={16} />
                <p className="text-xs font-semibold">{localizedText("Tổng tiền hoàn lại", "Total refunds")}</p>
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900">{formatMoney(cashRefunded)}</p>
              <p className="mt-1 text-xs text-slate-500">{localizedText("Các giao dịch hoàn tiền thực tế trong kỳ", "Refund transactions processed during this period")}</p>
            </article>
            <article className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-amber-600">
                <TrendingUp size={16} />
                <p className="text-xs font-semibold">{localizedText("Tiền thừa trả khách", "Change returned to guests")}</p>
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900">{formatMoney(cashChangeReturned)}</p>
              <p className="mt-1 text-xs text-slate-500">{localizedText("Tiền thừa từ giao dịch tiền mặt", "Change returned from cash transactions")}</p>
            </article>
            <article className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-violet-600">
                <TrendingUp size={16} />
                <p className="text-xs font-semibold">{localizedText("Tiền thu ròng", "Net cash received")}</p>
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900">{formatMoney(netCashReceived)}</p>
              <p className="mt-1 text-xs text-slate-500">{localizedText("Thu vào − hoàn tiền − tiền thừa trả khách", "Received − refunded − change returned")}</p>
            </article>
            </div>
          </div>
          </section>

          <div className="space-y-5">
            <section id="report-service-revenue" data-report-section className="scroll-mt-24 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-900">{localizedText(`Doanh thu dịch vụ ${reportPeriodLabel}`, `Service revenue ${reportPeriodLabel}`)}</h3>
                  <p className="mt-1 text-xs text-slate-400">{localizedText("Tính theo ngày xác nhận sử dụng hoặc checkout · đ", "Based on service confirmation or checkout date · VND")}</p>
                </div>
                <TrendingUp size={18} className="text-emerald-500" />
              </div>
              {dailyRevenue.every((item) => item.revenue === 0) ? (
                <p className="py-12 text-center text-sm text-slate-400">{localizedText("Không có dữ liệu doanh thu trong khoảng ngày này.", "No revenue data for this date range.")}</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dailyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f5" />
                    <XAxis dataKey="label" interval="preserveStartEnd" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(value) => localizedText(`${Math.round(Number(value) / 1000000)}tr`, `${Math.round(Number(value) / 1000000)}M`)} />
                    <Tooltip labelFormatter={(_label, entries) => entries[0]?.payload.fullDate ?? ""} formatter={(value) => [formatMoney(Number(value)), localizedText("Doanh thu dịch vụ", "Service revenue")]} />
                    <Legend
                      verticalAlign="bottom"
                      height={30}
                      iconType="circle"
                      wrapperStyle={{ fontSize: 12, color: "#334155" }}
                    />
                    <Bar
                      dataKey="revenue"
                      name={localizedText("Doanh thu dịch vụ", "Service revenue")}
                      fill="#1d4ed8"
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>

            <section id="report-promotions" data-report-section className="scroll-mt-24 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="font-bold text-slate-900">{localizedText(`Hiệu quả khuyến mãi ${reportScopeLabel}`, `Promotion performance ${reportScopeLabel}`)}</h3>
                <p className="mt-1 text-xs text-slate-400">{localizedText("Phân loại theo tiền phòng, tiền dịch vụ và tổng booking", "Breakdown by room charges, service charges, and total booking")}</p>
              </div>
              {isPromotionCatalogError && (
                <p role="status" className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {localizedText("Không tải được loại khuyến mãi; một số chương trình có thể hiện là chưa xác định.", "Promotion types could not be loaded; some entries may be marked unknown.")}
                </p>
              )}
              {report.promotions.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-400">{localizedText("Không có khuyến mãi được áp dụng trong khoảng ngày này.", "No promotions were used during this date range.")}</p>
              ) : (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                    <p className="mb-2 text-center text-xs font-semibold text-slate-600">{localizedText("Số tiền giảm theo loại", "Discount savings by type")}</p>
                    {promotionScopesTotalSavings > 0 ? (
                      <ResponsiveContainer width="100%" height={230}>
                        <BarChart data={promotionChartData} barCategoryGap={promotionChartIsStacked ? "45%" : "20%"}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f5" />
                          <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(value) => `${Math.round(Number(value) / 1000000)}tr`} />
                          <Tooltip formatter={(value) => [formatMoney(Number(value)), localizedText("Tiền giảm", "Savings")]} />
                          <Legend verticalAlign="bottom" height={32} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="ROOM" name={t("promotion.scopeRoom")} fill={promotionScopeColors.ROOM} stackId={promotionChartIsStacked ? "savings" : undefined} radius={[4, 4, 0, 0]} />
                          <Bar dataKey="SERVICE" name={t("promotion.scopeService")} fill={promotionScopeColors.SERVICE} stackId={promotionChartIsStacked ? "savings" : undefined} radius={[4, 4, 0, 0]} />
                          <Bar dataKey="TOTAL" name={t("promotion.scopeTotal")} fill={promotionScopeColors.TOTAL} stackId={promotionChartIsStacked ? "savings" : undefined} radius={[4, 4, 0, 0]} />
                          {promotionChartData[0].UNKNOWN > 0 && (
                            <Bar dataKey="UNKNOWN" name={t("promotion.scopeUnknown")} fill={promotionScopeColors.UNKNOWN} stackId={promotionChartIsStacked ? "savings" : undefined} radius={[4, 4, 0, 0]} />
                          )}
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="py-12 text-center text-xs text-slate-400">{localizedText("Chưa có số tiền giảm để so sánh.", "No discount savings to compare.")}</p>
                    )}
                  </div>
                  <div className="max-h-[300px] space-y-2 overflow-y-auto">
                    {report.promotions.map((promotion) => {
                      const scope = getPromotionScope(
                        promotionScopeById.get(promotion.promotionId)
                          ?? promotion.type
                          ?? promotion.scope
                          ?? promotion.promotionScope,
                      );
                      return (
                        <article key={promotion.promotionId} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold text-slate-800">{promotion.promotionName}</p>
                              <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ backgroundColor: promotionScopeColors[scope] }}>
                                {t(`promotion.${promotionScopeLabelKey[scope]}`)}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">{promotion.promotionCode}</p>
                            <p className="mt-1 text-xs font-medium text-slate-600">
                              {localizedText(`${promotion.userCount} khách · ${promotion.usageCount} lượt dùng`, `${promotion.userCount} guests · ${promotion.usageCount} uses`)}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-bold text-emerald-700">{formatMoney(promotion.savings)}</p>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          </div>

          <section id="report-room-types" data-report-section className="scroll-mt-24 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900">{localizedText("Lượt đặt theo loại phòng", "Bookings by room type")}</h3>
                <p className="mt-1 text-xs text-slate-400">
                  {localizedText("Số phòng được đặt trong booking tạo ở khoảng ngày đã chọn · không tính phòng hoặc booking đã hủy", "Rooms included in bookings created during the selected date range · excludes cancelled rooms and bookings")}
                </p>
              </div>
              {mostBookedRoomType && mostBookedRoomType.bookingCount > 0 && (
                <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                  {localizedText("Được đặt nhiều nhất:", "Most booked:")} {mostBookedRoomType.name} ({localizedText(`${mostBookedRoomType.bookingCount} lượt`, `${mostBookedRoomType.bookingCount} bookings`)})
                </span>
              )}
            </div>
            {roomTypeBookings.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">{localizedText("Không có dữ liệu đặt phòng trong khoảng ngày này.", "No booking data for this date range.")}</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={roomTypeBookings}
                  layout="vertical"
                  margin={{ top: 4, right: 20, bottom: 4, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#edf0f5" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={130}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                  />
                  <Tooltip formatter={(value) => [`${Number(value).toLocaleString(localizedText("vi-VN", "en-US"))} ${localizedText("lượt", "bookings")}`, localizedText("Lượt đặt", "Bookings")]} />
                  <Bar dataKey="bookingCount" name={localizedText("Lượt đặt", "Bookings")} fill="#2563eb" radius={[0, 5, 5, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </section>

          <section id="report-room-status" data-report-section className="scroll-mt-24 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="mb-3">
              <h3 className="font-bold text-slate-900">{t("report.roomStatusMix")}</h3>
              <p className="mt-1 text-xs text-slate-400">{localizedText("Trạng thái phòng tại thời điểm hiện tại", "Current room status")}</p>
            </div>
            <div className="grid items-center gap-4 md:grid-cols-[260px_1fr]">
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie data={roomStatuses} dataKey="roomCount" nameKey="name" innerRadius={55} outerRadius={82} paddingAngle={4}>
                    {roomStatuses.map((entry) => <Cell key={entry.status} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={28} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {roomStatuses.map((item) => (
                  <div key={item.status} className="rounded-xl bg-slate-50 p-4">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <p className="text-xs font-semibold text-slate-500">{item.name}</p>
                    </div>
                    <p className="mt-3 text-2xl font-bold text-slate-900">{item.roomCount}</p>
                    <p className="mt-1 text-[10px] text-slate-400">{t("report.rooms")}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="report-cancellations" data-report-section className="scroll-mt-24 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900">{localizedText("Booking đã hủy", "Cancelled bookings")}</h3>
                <p className="mt-1 text-xs text-slate-400">{localizedText("Phân loại theo kênh đặt booking và lý do hủy trong khoảng ngày đã chọn", "Grouped by booking channel and cancellation reason within the selected date range")}</p>
              </div>
              <div className="flex gap-2 text-xs font-semibold">
                <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">
                  {localizedText("Trực tuyến", "Online")}: {onlineCancelledBookingCount}
                </span>
                <span className="rounded-full bg-violet-50 px-3 py-1.5 text-violet-700">
                  {localizedText("Tại quầy", "Offline")}: {offlineCancelledBookingCount}
                </span>
              </div>
            </div>
            {!isSystemAdmin && (
              <div className="mb-6 border-b border-slate-100 pb-6">
                <h4 className="mb-3 text-sm font-bold text-slate-800">{localizedText("Theo dõi hoàn tiền", "Refund tracking")}</h4>
                <div className="grid grid-cols-1 gap-4">
                  {[
                    {
                      key: "checkout-surplus",
                      title: localizedText("Hoàn dư khi checkout", "Checkout surplus refunds"),
                      refunds: checkoutSurplusRefunds,
                    },
                    {
                      key: "booking-cancellation",
                      title: localizedText("Hoàn tiền booking bị hủy", "Cancelled booking refunds"),
                      refunds: bookingCancellationRefunds,
                    },
                  ].map(({ key, title, refunds }) => {
                    const refunded = refunds.filter((refund) => refund.status === "REFUNDED");
                    const notCompletedCount = refunds.length - refunded.length;
                    const refundedAmount = refunded.reduce((sum, refund) => sum + Number(refund.amount ?? 0), 0);
                    const pageSize = refundPageSizes[key] ?? 10;
                    const totalPages = Math.max(1, Math.ceil(refunds.length / pageSize));
                    const page = Math.min(refundPages[key] ?? 1, totalPages);
                    const paginatedRefunds = refunds.slice((page - 1) * pageSize, page * pageSize);

                    return (
                      <div key={key} className="min-w-0 rounded-xl border border-slate-200/80 p-4">
                        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                          <h5 className="text-sm font-semibold text-slate-800">{title}</h5>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                              {localizedText("Đã hoàn", "Refunded")}: {refunded.length} · {formatMoney(refundedAmount)}
                            </span>
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
                              {localizedText("Chưa hoàn tất", "Not completed")}: {notCompletedCount}
                            </span>
                          </div>
                        </div>
                        {refunds.length === 0 ? (
                          <p className="py-6 text-center text-xs text-slate-400">
                            {localizedText("Không có khoản hoàn tiền trong khoảng ngày này.", "No refunds during this date range.")}
                          </p>
                        ) : (
                          <>
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[660px] text-left text-xs">
                              <thead>
                                <tr className="border-b border-slate-100 text-slate-500">
                                  <th className="px-2 py-2 font-semibold">{localizedText("Mã booking", "Booking ID")}</th>
                                  <th className="px-2 py-2 font-semibold">{localizedText("Số tiền", "Amount")}</th>
                                  <th className="px-2 py-2 font-semibold">{localizedText("Phương thức", "Method")}</th>
                                  <th className="px-2 py-2 font-semibold">{localizedText("Trạng thái", "Status")}</th>
                                  <th className="px-2 py-2 font-semibold">{localizedText("Yêu cầu lúc", "Requested at")}</th>
                                  <th className="px-2 py-2 font-semibold">{localizedText("Hoàn lúc", "Refunded at")}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {paginatedRefunds.map((refund) => (
                                  <tr key={refund.bookingId} className="border-b border-slate-50 last:border-0">
                                    <td className="whitespace-nowrap px-2 py-2.5 font-semibold text-slate-800">{refund.bookingId}</td>
                                    <td className="whitespace-nowrap px-2 py-2.5 text-slate-700">{formatMoney(refund.amount)}</td>
                                    <td className="whitespace-nowrap px-2 py-2.5 text-slate-600">{paymentMethodLabel(refund.paymentMethod)}</td>
                                    <td className="whitespace-nowrap px-2 py-2.5 text-slate-600">{refundStatusLabel(refund.status)}</td>
                                    <td className="whitespace-nowrap px-2 py-2.5 text-slate-500">
                                      {refund.requestedAt
                                        ? new Date(refund.requestedAt).toLocaleString(localizedText("vi-VN", "en-US"))
                                        : "—"}
                                    </td>
                                    <td className="whitespace-nowrap px-2 py-2.5 text-slate-500">
                                      {refund.refundedAt
                                        ? new Date(refund.refundedAt).toLocaleString(localizedText("vi-VN", "en-US"))
                                        : localizedText("Chưa hoàn", "Not refunded")}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              </table>
                            </div>
                            <ListPagination
                              totalItems={refunds.length}
                              page={page}
                              pageSize={pageSize}
                              mode="table"
                              onPageChange={(nextPage) => setRefundPages((current) => ({ ...current, [key]: nextPage }))}
                              onPageSizeChange={(nextPageSize) => {
                                setRefundPageSizes((current) => ({ ...current, [key]: nextPageSize }));
                                setRefundPages((current) => ({ ...current, [key]: 1 }));
                              }}
                            />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {cancelledBookings.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">{localizedText("Không có booking bị hủy trong khoảng ngày này.", "No bookings were cancelled during this date range.")}</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs text-slate-500">
                      <th className="px-3 py-2 font-semibold">{localizedText("Mã booking", "Booking ID")}</th>
                      <th className="px-3 py-2 font-semibold">{localizedText("Kênh đặt", "Booking channel")}</th>
                      <th className="px-3 py-2 font-semibold">{localizedText("Lý do hủy", "Cancellation reason")}</th>
                      <th className="px-3 py-2 font-semibold">{localizedText("Thời điểm hủy", "Cancelled at")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCancelledBookings.map((booking) => (
                      <tr key={booking.bookingId} className="border-b border-slate-50 last:border-0">
                        <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-800">{booking.bookingId}</td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            booking.bookingChannel === "ONLINE"
                              ? "bg-blue-50 text-blue-700"
                              : booking.bookingChannel === "OFFLINE"
                                ? "bg-violet-50 text-violet-700"
                                : "bg-slate-100 text-slate-600"
                          }`}>
                            {booking.bookingChannel === "ONLINE"
                              ? "Online"
                              : booking.bookingChannel === "OFFLINE"
                                ? "Offline"
                                : localizedText("Không xác định", "Unknown")}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-600">{booking.reason}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-500">
                          {booking.cancelledAt
                            ? new Date(booking.cancelledAt).toLocaleString(localizedText("vi-VN", "en-US"))
                            : localizedText("Không lưu thời điểm hủy", "Cancellation time not recorded")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
                <ListPagination totalItems={cancelledBookings.length} page={safeCancelledPage} pageSize={cancelledPageSize} mode="table" onPageChange={setCancelledPage} onPageSizeChange={setCancelledPageSize} />
              </>
            )}
          </section>
          </div>
        </div>
      )}
    </div>
  );
}
