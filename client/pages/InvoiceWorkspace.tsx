import { useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, FileText, LoaderCircle, Search } from "lucide-react";
import CheckoutInvoice from "../components/CheckoutInvoice";
import { useGetBookingsByHotelQuery, type BookingListItem } from "../services/bookingApi";
import { useAppSelector } from "../store/hooks";

const formatMoney = (value: unknown) => {
  const amount = Number(value);
  return `${(Number.isFinite(amount) ? amount : 0).toLocaleString("vi-VN")}đ`;
};

const getTodayDateInputValue = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatCreatedDate = (createdAt: unknown) => {
  const date = getCreatedDate(createdAt);
  if (!date) return "—";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
};

const getBookingDetails = (booking: BookingListItem) =>
  Array.isArray(booking.bookingDetails) ? booking.bookingDetails : [];

const isCheckedOut = (detail: Record<string, unknown>) => {
  const status = String(
    detail.bookingStatusType ?? detail.bookingDetailStatus ?? detail.status ?? "",
  ).trim().toUpperCase();
  const checkoutTime = detail.actualCheckOutTime;
  return ["CHECKED_OUT", "CHECKED-OUT", "CHECKEDOUT", "ĐÃ TRẢ PHÒNG"].includes(status)
    || (typeof checkoutTime === "string" && checkoutTime.trim() !== "");
};

const getRoomLabel = (detail: Record<string, unknown>) => {
  const room = detail.roomNumber ?? detail.roomName ?? detail.roomId;
  return room === undefined || room === null || room === "" ? "Phòng" : String(room);
};

const getCreatedDate = (createdAt: unknown) => {
  if (typeof createdAt !== "string" || !createdAt.trim()) return "";
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDateRange = (booking: BookingListItem) => {
  const details = getBookingDetails(booking);
  const checkIns = details
    .map((detail) => String(detail.actualCheckInTime ?? detail.checkInTime ?? ""))
    .filter(Boolean)
    .sort();
  const checkOuts = details
    .map((detail) => String(detail.actualCheckOutTime ?? detail.checkOutTime ?? ""))
    .filter(Boolean)
    .sort();
  const formatDate = (value?: string) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("vi-VN");
  };
  return `${formatDate(checkIns[0])} – ${formatDate(checkOuts[checkOuts.length - 1])}`;
};

export default function InvoiceWorkspace() {
  const hotelId = useAppSelector((state) => state.auth.hotelId);
  const [query, setQuery] = useState("");
  const [createdDate, setCreatedDate] = useState(getTodayDateInputValue);
  const [selectedBooking, setSelectedBooking] = useState<BookingListItem | null>(null);
  const {
    data: bookings = [],
    isLoading,
    isError,
    refetch,
  } = useGetBookingsByHotelQuery(Number(hotelId), {
    skip: !hotelId || Number.isNaN(Number(hotelId)),
  });

  const completedBookings = useMemo(() => bookings
    .filter((booking) => {
      const details = getBookingDetails(booking);
      return details.length > 0 && details.every(isCheckedOut);
    })
    .filter((booking) => !createdDate || getCreatedDate(booking.createdAt) === createdDate)
    .filter((booking) => {
      const searchableText = [
        booking.bookingId,
        booking.id,
        booking.orderId,
        booking.customerName,
        ...getBookingDetails(booking).map(getRoomLabel),
      ].join(" ").toLocaleLowerCase();
      return searchableText.includes(query.trim().toLocaleLowerCase());
    })
    .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))),
  [bookings, createdDate, query]);

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <header className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-bold text-slate-900">Hóa đơn từ booking đã check-out</h3>
          <p className="mt-1 text-sm text-slate-500">
            Hiển thị dữ liệu booking hiện có khi tất cả phòng trong booking đã check-out.
          </p>
        </div>
        <span className="w-fit rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800">
          {completedBookings.length} booking hoàn tất
        </span>
      </header>

      <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/60 p-4 sm:flex-row sm:items-center">
        <label className="relative block w-full sm:max-w-sm sm:flex-1">
          <Search size={15} className="absolute left-3 top-3 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm mã booking, mã đơn, tên khách hoặc số phòng"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <label className="relative flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
            <CalendarDays size={15} className="text-slate-400" />
            <span>Ngày tạo</span>
            <input
              type="date"
              value={createdDate}
              onChange={(event) => setCreatedDate(event.target.value)}
              aria-label="Lọc hóa đơn theo ngày tạo booking"
              className="min-w-0 bg-transparent text-xs text-slate-700 outline-none"
            />
          </label>
          {createdDate && (
            <button
              type="button"
              onClick={() => setCreatedDate("")}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              Xóa lọc ngày
            </button>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500">
          <LoaderCircle size={18} className="animate-spin" /> Đang tải booking…
        </div>
      )}

      {isError && !isLoading && (
        <div className="p-10 text-center">
          <AlertTriangle size={24} className="mx-auto text-rose-500" />
          <p className="mt-3 text-sm font-semibold text-slate-800">Không tải được dữ liệu booking</p>
          <p className="mt-1 text-xs text-slate-500">Vui lòng kiểm tra kết nối rồi thử lại.</p>
          <button type="button" onClick={() => void refetch()} className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
            Thử tải lại
          </button>
        </div>
      )}

      {!isLoading && !isError && completedBookings.length === 0 && (
        <div className="p-10 text-center">
          <FileText size={26} className="mx-auto text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-700">
            {bookings.length === 0
              ? "Chưa có booking"
              : createdDate || query
                ? "Không tìm thấy booking phù hợp với bộ lọc"
                : "Chưa có booking nào đã check-out hết tất cả phòng"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Booking còn phòng đang lưu trú sẽ chưa được hiển thị thành hóa đơn.
          </p>
        </div>
      )}

      {!isLoading && !isError && completedBookings.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] table-fixed text-left">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="w-[17%] px-5 py-3">Khách hàng</th>
                <th className="w-[20%] px-4 py-3">Booking / Đơn hàng</th>
                <th className="w-[16%] px-4 py-3">Phòng</th>
                <th className="w-[14%] px-4 py-3">Ngày tạo</th>
                <th className="w-[14%] px-4 py-3">Ngày lưu trú</th>
                <th className="w-[11%] px-4 py-3 text-right">Tổng thanh toán</th>
                <th className="w-[8%] px-5 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {completedBookings.map((booking) => {
                const bookingId = String(booking.bookingId ?? booking.id ?? "—");
                const details = getBookingDetails(booking);
                const total = booking.finalAmount ?? (
                  Number(booking.roomTotal ?? 0)
                  + Number(booking.serviceTotal ?? 0)
                  + Number(booking.surchargeTotalAmount ?? 0)
                  - Number(booking.discountAmountTotal ?? booking.discountTotal ?? 0)
                );

                return (
                  <tr key={bookingId} className="align-middle transition hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <p className="text-sm font-bold text-slate-900">{booking.customerName ?? "Khách hàng"}</p>
                      <span className="mt-1.5 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        Đã check-out đủ
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-xs font-semibold text-slate-700">Booking: {bookingId}</p>
                      <p className="mt-1 text-xs text-slate-500">Đơn hàng: {booking.orderId ?? "—"}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-xs font-semibold text-slate-700">
                        {details.length} phòng
                      </p>
                      <p className="mt-1 break-words text-xs text-slate-500">
                        {details.map(getRoomLabel).join(", ")}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-600">{formatCreatedDate(booking.createdAt)}</td>
                    <td className="px-4 py-4 text-xs text-slate-600">{getDateRange(booking)}</td>
                    <td className="px-4 py-4 text-right text-sm font-bold text-slate-900">{formatMoney(total)}</td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedBooking(booking)}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-800"
                      >
                        <FileText size={14} /> Xem / In
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedBooking && (
        <CheckoutInvoice booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
      )}
    </section>
  );
}
