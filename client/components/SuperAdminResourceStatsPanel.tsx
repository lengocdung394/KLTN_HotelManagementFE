import { useEffect, useMemo, useState } from "react";
import { BarChart3, Building2, CalendarDays, ConciergeBell, PanelLeftClose, PanelLeftOpen, Search, Tag, Wallet, XCircle } from "lucide-react";
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
import type { SuperAdminBranch } from "../services/superAdminApi";
import { useAppDispatch } from "../store/hooks";

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
  const [search, setSearch] = useState("");
  const today = localDateString(new Date());
  const [startDate, setStartDate] = useState(() => `${today.slice(0, 7)}-01`);
  const [endDate, setEndDate] = useState(today);
  const [branchReports, setBranchReports] = useState<Record<number, BranchReportState>>({});
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isReportTocVisible, setIsReportTocVisible] = useState(true);
  const dispatch = useAppDispatch();
  const normalizedSearch = search.trim().toLocaleLowerCase("vi-VN");
  const hasValidDateRange = Boolean(startDate && endDate && startDate <= endDate);
  const reportSections = [
    { id: "super-admin-stats-overview", label: "Tổng quan" },
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
    () => branches.filter((branch) =>
      `${branch.name} ${branch.address} ${branch.provinceName ?? ""}`.toLocaleLowerCase("vi-VN").includes(normalizedSearch),
    ),
    [branches, normalizedSearch],
  );
  const reports = Object.values(branchReports).flatMap(({ report }) => report ? [report] : []);
  const hasReportErrors = Object.values(branchReports).some(({ hasError }) => hasError);
  const isStatsLoading = isLoading || isLoadingReports || (hasValidDateRange && branches.length > 0 && reports.length === 0 && !hasReportErrors);
  const allReportsLoaded = branches.length > 0 && reports.length === branches.length && !hasReportErrors;

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
    return [...values.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, revenue]) => ({
        date,
        day: date.slice(8, 10),
        revenue,
        fullDate: new Date(`${date}T00:00:00`).toLocaleDateString("vi-VN"),
      }));
  }, [reports]);
  const promotionBreakdown = useMemo(() => {
    const values = new Map<string, { name: string; code: string; usageCount: number; userCount: number; savings: number }>();
    reports.forEach((report) => report.promotions.forEach((promotion) => {
      const key = `${promotion.promotionId}:${promotion.promotionCode}`;
      const current = values.get(key) ?? {
        name: promotion.promotionName,
        code: promotion.promotionCode,
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
  }, [reports]);
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
  const formatCount = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
  const formatMoney = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)}đ`;
  const displayCount = (value: number) => isStatsLoading || hasReportErrors || !allReportsLoaded ? "—" : formatCount(value);

  return (
    <section className="mt-2 space-y-5" aria-labelledby="resource-stats-title">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <BarChart3 size={21} />
          </span>
          <div>
            <h2 id="resource-stats-title" className="text-lg font-bold text-slate-900">Thống kê toàn hệ thống</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Tổng hợp booking, doanh thu, dịch vụ và khuyến mãi tại các chi nhánh trong khoảng ngày đã chọn.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-xs font-semibold text-slate-500">
            Từ ngày
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => setStartDate(event.target.value)}
              className="mt-1 h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-blue-400"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-500">
            Đến ngày
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              max={today}
              onChange={(event) => setEndDate(event.target.value)}
              className="mt-1 h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-blue-400"
            />
          </label>
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

      <div id="super-admin-stats-overview" data-super-admin-report-section className="scroll-mt-24 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Chi nhánh"
          value={isLoading || isError ? "—" : branches.length}
          detail="Trong hệ thống"
          icon={Building2}
          color="bg-blue-50 text-blue-700"
        />
        <StatCard
          label="Số lượt đặt phòng"
          value={displayCount(totalBookings)}
          detail="Trong khoảng ngày đã chọn"
          icon={CalendarDays}
          color="bg-cyan-50 text-cyan-700"
        />
        <StatCard
          label="Tiền booking đã thu"
          value={isStatsLoading || hasReportErrors || !allReportsLoaded ? "—" : formatMoney(totalRevenue)}
          detail={isStatsLoading || hasReportErrors || !allReportsLoaded
            ? "Tiền mặt và chuyển khoản tại các chi nhánh"
            : `Tiền mặt ${formatMoney(totalCashReceived)} · Chuyển khoản ${formatMoney(totalBankReceived)}`}
          icon={Wallet}
          color="bg-amber-50 text-amber-700"
        />
        <StatCard
          label="Tổng tiền hoàn lại"
          value={isStatsLoading || hasReportErrors || !allReportsLoaded ? "—" : formatMoney(totalRefunded)}
          detail="Giao dịch hoàn tiền trong kỳ"
          icon={Wallet}
          color="bg-rose-50 text-rose-700"
        />
        <StatCard
          label="Tiền thừa trả khách"
          value={isStatsLoading || hasReportErrors || !allReportsLoaded ? "—" : formatMoney(totalChangeReturned)}
          detail="Tiền thừa từ giao dịch tiền mặt"
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
        <StatCard
          label="Booking đã hủy"
          value={displayCount(totalCancelledBookings)}
          detail="Trong khoảng ngày đã chọn"
          icon={XCircle}
          color="bg-rose-50 text-rose-700"
        />
        <StatCard
          label="Lượt sử dụng dịch vụ"
          value={displayCount(totalServiceUsage)}
          detail="Tổng lượt dùng tại các chi nhánh"
          icon={ConciergeBell}
          color="bg-violet-50 text-violet-700"
        />
        <StatCard
          label="Lượt dùng khuyến mãi"
          value={displayCount(totalPromotionUsage)}
          detail="Tổng lượt áp dụng tại các chi nhánh"
          icon={Tag}
          color="bg-emerald-50 text-emerald-700"
        />
      </div>

      {allReportsLoaded && (
        <>
          <div className="grid gap-5 xl:grid-cols-2">
            <section id="super-admin-stats-services" data-super-admin-report-section className="scroll-mt-24 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900">Doanh thu dịch vụ theo ngày</h3>
                  <p className="mt-1 text-xs text-slate-400">Tổng hợp toàn bộ chi nhánh · VNĐ</p>
                </div>
                <ConciergeBell size={18} className="text-violet-600" />
              </div>
              {dailyServiceRevenue.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-400">Không có dữ liệu doanh thu dịch vụ trong kỳ.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={dailyServiceRevenue}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f5" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(value) => `${Math.round(Number(value) / 1000000)}tr`} />
                    <Tooltip
                      labelFormatter={(_label, entries) => entries[0]?.payload.fullDate ?? ""}
                      formatter={(value) => [formatMoney(Number(value)), "Doanh thu dịch vụ"]}
                    />
                    <Bar dataKey="revenue" fill="#7c3aed" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>

            <section id="super-admin-stats-promotions" data-super-admin-report-section className="scroll-mt-24 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="font-bold text-slate-900">Hiệu quả khuyến mãi</h3>
                <p className="mt-1 text-xs text-slate-400">Lượt áp dụng, khách hàng và tổng tiền giảm theo chương trình</p>
              </div>
              {promotionBreakdown.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-400">Không có khuyến mãi được áp dụng trong kỳ.</p>
              ) : (
                <div className="max-h-[300px] space-y-2 overflow-y-auto">
                  {promotionBreakdown.map((promotion) => (
                    <article key={`${promotion.code}-${promotion.name}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{promotion.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{promotion.code}</p>
                        <p className="mt-1 text-xs font-medium text-slate-600">{promotion.userCount} khách · {promotion.usageCount} lượt dùng</p>
                      </div>
                      <p className="shrink-0 text-sm font-bold text-emerald-700">{formatMoney(promotion.savings)}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div id="super-admin-stats-rooms" data-super-admin-report-section className="scroll-mt-24 grid gap-5 xl:grid-cols-2">
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="font-bold text-slate-900">Tình trạng phòng hiện tại</h3>
                <p className="mt-1 text-xs text-slate-400">Tổng số phòng theo trạng thái tại các chi nhánh</p>
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
                <p className="mt-1 text-xs text-slate-400">Số lượt đặt theo loại phòng, tổng hợp từ các chi nhánh</p>
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
              <p className="mt-1 text-xs text-slate-400">Phân loại theo chi nhánh, kênh đặt và lý do hủy trong kỳ</p>
            </div>
            {cancelledBookingDetails.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">Không có booking bị hủy trong khoảng ngày này.</p>
            ) : (
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
                    {cancelledBookingDetails.map((booking) => (
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
          <label className="relative block w-full sm:w-72">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm chi nhánh..."
              aria-label="Tìm chi nhánh trong thống kê"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>
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
          <p className="p-10 text-center text-sm text-slate-500">Không tìm thấy chi nhánh phù hợp.</p>
        ) : (
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
                {visibleBranches.map((branch) => {
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
        )}
        {!isLoading && !isError && branches.length > 0 && (
          <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
            Hiển thị {visibleBranches.length} / {branches.length} chi nhánh
          </div>
        )}
      </section>
      <div aria-hidden="true" className="h-64" />
        </div>
      </div>
    </section>
  );
}
