import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart3, CalendarDays, Tag, TrendingUp, XCircle } from "lucide-react";
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
import { useGetSuperAdminBranchesQuery } from "../services/superAdminApi";
import { useAppSelector } from "../store/hooks";
import { localizedText } from "../i18n";

const localDateString = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const formatMoney = (amount: number) =>
  localizedText(
    `${Number(amount ?? 0).toLocaleString("vi-VN")}đ`,
    new Intl.NumberFormat("en-US", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(amount ?? 0)),
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

export default function ReportWorkspace() {
  const { t } = useTranslation();
  const { hotelId, roles } = useAppSelector((state) => state.auth);
  const isSystemAdmin = roles.includes("ROLE_SUPER_ADMIN");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const today = localDateString(new Date());
  const [startDate, setStartDate] = useState(() => `${today.slice(0, 7)}-01`);
  const [endDate, setEndDate] = useState(today);
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

  const dailyRevenue = (report?.dailyServiceRevenue ?? []).map((item) => ({
    day: item.date.slice(8, 10),
    revenue: item.revenue,
    fullDate: new Date(`${item.date}T00:00:00`).toLocaleDateString(localizedText("vi-VN", "en-US")),
  }));
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
  const totalBookingCount = report?.totalBookingCount ?? 0;
  const cashReceived = report?.cashReceived ?? 0;
  const cashRefunded = report?.cashRefunded ?? 0;
  const cashChangeReturned = report?.cashChangeReturned ?? 0;
  const netCashReceived = report?.netCashReceived
    ?? cashReceived - cashRefunded - cashChangeReturned;

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
          {isSystemAdmin && (
            <label className="block text-xs font-semibold text-slate-500">
              {localizedText("Chi nhánh", "Branch")}
              <select
                value={selectedBranchId}
                onChange={(event) => setSelectedBranchId(event.target.value)}
                aria-label={localizedText("Chọn chi nhánh xem báo cáo", "Select a branch for the report")}
                className="mt-1 h-9 min-w-48 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-blue-400"
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
              onChange={(event) => setStartDate(event.target.value)}
              className="mt-1 h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-blue-400"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-500">
            {localizedText("Đến ngày", "To")}
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              max={today}
              onChange={(event) => setEndDate(event.target.value)}
              className="mt-1 h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-blue-400"
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
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <article className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-blue-600">
                <BarChart3 size={16} />
                <p className="text-xs font-semibold">{localizedText("Tổng lượt đặt phòng", "Total bookings")}</p>
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900">{totalBookingCount.toLocaleString(localizedText("vi-VN", "en-US"))}</p>
              <p className="mt-1 text-xs text-slate-500">{localizedText("Số booking được tạo trong kỳ, gồm cả booking hủy", "Bookings created during this period, including cancellations")}</p>
            </article>
            <article className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-emerald-600">
                <TrendingUp size={16} />
                <p className="text-xs font-semibold">{localizedText("Tổng tiền thu vào", "Total cash received")}</p>
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900">{formatMoney(cashReceived)}</p>
              <p className="mt-1 text-xs text-slate-500">{localizedText("Các giao dịch thu tiền thành công trong kỳ", "Successful payment transactions during this period")}</p>
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

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <article className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-blue-600">
                <TrendingUp size={16} />
                <p className="text-xs font-semibold">{localizedText("Doanh thu dịch vụ", "Service revenue")}</p>
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900">{formatMoney(report.serviceRevenue)}</p>
              <p className="mt-1 text-xs text-slate-500">{localizedText(`Từ ${report.serviceUsageCount} dịch vụ đã sử dụng`, `From ${report.serviceUsageCount} services used`)}</p>
            </article>
            <article className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-emerald-600">
                <Tag size={16} />
                <p className="text-xs font-semibold">{localizedText("Lượt sử dụng khuyến mãi", "Promotion uses")}</p>
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900">{report.promotionUsageCount.toLocaleString(localizedText("vi-VN", "en-US"))}</p>
              <p className="mt-1 text-xs text-slate-500">{localizedText("Trong khoảng ngày đã chọn", "During the selected date range")}</p>
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
              <div className="flex items-center gap-2 text-violet-600">
                <BarChart3 size={16} />
                <p className="text-xs font-semibold">{localizedText("Tổng số phòng", "Total rooms")}</p>
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900">{report.totalRoomCount.toLocaleString(localizedText("vi-VN", "en-US"))}</p>
              <p className="mt-1 text-xs text-slate-500">{localizedText("Theo trạng thái hiện tại", "By current status")}</p>
            </article>
            <article className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-rose-600">
                <XCircle size={16} />
                <p className="text-xs font-semibold">{localizedText("Booking đã hủy", "Cancelled bookings")}</p>
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900">{cancelledBookingCount.toLocaleString(localizedText("vi-VN", "en-US"))}</p>
              <p className="mt-1 text-xs text-slate-500">{localizedText("Trong khoảng ngày đã chọn", "During the selected date range")}</p>
            </article>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-900">{localizedText("Doanh thu dịch vụ theo ngày", "Daily service revenue")}</h3>
                  <p className="mt-1 text-xs text-slate-400">{localizedText("Tính theo ngày xác nhận sử dụng hoặc checkout · VNĐ", "Based on service confirmation or checkout date · VND")}</p>
                </div>
                <TrendingUp size={18} className="text-emerald-500" />
              </div>
              {dailyRevenue.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-400">{localizedText("Không có dữ liệu doanh thu trong khoảng ngày này.", "No revenue data for this date range.")}</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={dailyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f5" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(value) => localizedText(`${Math.round(Number(value) / 1000000)}tr`, `${Math.round(Number(value) / 1000000)}M`)} />
                    <Tooltip labelFormatter={(_label, entries) => entries[0]?.payload.fullDate ?? ""} formatter={(value) => [formatMoney(Number(value)), localizedText("Doanh thu dịch vụ", "Service revenue")]} />
                    <Bar dataKey="revenue" fill="#2563eb" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="font-bold text-slate-900">{localizedText("Hiệu quả khuyến mãi", "Promotion performance")}</h3>
                <p className="mt-1 text-xs text-slate-400">{localizedText("Số khách hàng, lượt áp dụng và số tiền giảm theo chương trình", "Customers, uses, and discount amounts by promotion")}</p>
              </div>
              {report.promotions.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-400">{localizedText("Không có khuyến mãi được áp dụng trong khoảng ngày này.", "No promotions were used during this date range.")}</p>
              ) : (
                <div className="max-h-[290px] space-y-2 overflow-y-auto">
                  {report.promotions.map((promotion) => (
                    <article key={promotion.promotionId} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{promotion.promotionName}</p>
                        <p className="mt-1 text-xs text-slate-500">{promotion.promotionCode}</p>
                        <p className="mt-1 text-xs font-medium text-slate-600">
                          {localizedText(`${promotion.userCount} khách · ${promotion.usageCount} lượt dùng`, `${promotion.userCount} guests · ${promotion.usageCount} uses`)}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-bold text-emerald-700">{formatMoney(promotion.savings)}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
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

          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
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

          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
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
            {cancelledBookings.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">{localizedText("Không có booking bị hủy trong khoảng ngày này.", "No bookings were cancelled during this date range.")}</p>
            ) : (
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
                    {cancelledBookings.map((booking) => (
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
            )}
          </section>
        </>
      )}
    </div>
  );
}
