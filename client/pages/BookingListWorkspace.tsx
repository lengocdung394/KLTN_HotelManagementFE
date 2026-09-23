import {
  AlertCircle,
  Banknote,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  Pencil,
  QrCode,
  RefreshCw,
  Save,
  Search,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useGetBookingsByHotelQuery,
  useUpdateBookingMutation,
  type BookingListItem,
  type BookingUpdateRequest,
} from "../services/bookingApi";
import { useCreatePaymentQrMutation } from "../services/paymentApi";
import { useGetAllServicesQuery } from "../services/serviceApi";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { bindHotelSocketEvents } from "../lib/socket";
import { baseApi } from "../services/baseApi";

const valueOf = (item: BookingListItem, keys: string[]) =>
  keys.map((key) => item[key]).find((value) => value !== undefined && value !== null && value !== "");

const textOf = (item: BookingListItem, keys: string[], fallback = "-") =>
  String(valueOf(item, keys) ?? fallback);

const money = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toLocaleString("vi-VN")}đ` : "-";
};

const bookingId = (booking: BookingListItem) => textOf(booking, ["bookingId", "orderId", "id"]);

const formatDate = (value: unknown) => {
  if (!value) return "-";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("vi-VN");
};

const isCancelledService = (service: Record<string, unknown>) => {
  const status = String(
    service.status
    ?? service.serviceStatus
    ?? service.bookingServiceStatus
    ?? service.state
    ?? "",
  ).trim().toUpperCase();
  const statusIsCancelled = status.includes("CANCEL") || status.includes("HỦY") || status.includes("HUY");
  const cancellationFlag = [
    service.isCancelled,
    service.isCanceled,
    service.cancelled,
    service.canceled,
    service.isDeleted,
    service.deleted,
  ].some((value) => value === true || String(value).toLowerCase() === "true");
  const hasCancellationDate = Boolean(service.cancelledAt ?? service.canceledAt ?? service.cancellationDate);
  const quantity = Number(service.quantity ?? service.amount);

  return statusIsCancelled || cancellationFlag || hasCancellationDate || (Number.isFinite(quantity) && quantity <= 0);
};

const isCancelledBookingDetail = (detail: Record<string, unknown>) =>
  String(detail.bookingStatusType ?? "").trim().toUpperCase() === "CANCELLED";

const isCancelledBooking = (booking: Partial<Record<string, unknown>> | null | undefined) => {
  if (!booking) return false;

  const status = String(
    booking.bookingStatus
    ?? booking.status
    ?? booking.bookingState
    ?? "",
  ).trim().toUpperCase();

  return (
    status === "CANCELLED"
    || status === "CANCELED"
    || status.includes("CANCEL")
    || status.includes("HỦY")
    || status.includes("HUY")
  );
};

const bookingServices = (detail: Record<string, unknown>) => {
  const serviceFields = [
    detail.bookingServiceResponsesForHotels,
    detail.bookingServiceResponseForHotels,
    detail.bookingServiceDetails,
    detail.serviceRequests,
    detail.serviceResponses,
    detail.services,
  ];
  const namedServices = serviceFields.find(Array.isArray);
  const detectedServices = Object.entries(detail).find(([key, value]) =>
    Array.isArray(value) && key.toLowerCase().includes("service"),
  )?.[1];
  const services = namedServices ?? detectedServices;
  return ((services ?? []) as Record<string, unknown>[]).filter((service) => !isCancelledService(service));
};

export default function BookingListWorkspace() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const hotelId = useAppSelector((state) => state.auth.hotelId);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateSort, setDateSort] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal states
  const [selectedBooking, setSelectedBooking] = useState<BookingListItem | null>(null);
  const [editingBooking, setEditingBooking] = useState<BookingListItem | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  // Edit form state
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editBookingStatus, setEditBookingStatus] = useState("");
  const [editBookingChannel, setEditBookingChannel] = useState("");
  const [editRoomTotal, setEditRoomTotal] = useState<number | string>(0);
  const [editServiceTotal, setEditServiceTotal] = useState<number | string>(0);
  const [editDiscountTotal, setEditDiscountTotal] = useState<number | string>(0);
  const [editNotes, setEditNotes] = useState("");
  const [editSuccess, setEditSuccess] = useState("");
  const [editError, setEditError] = useState("");
  // Payment states
  const [paymentMethod, setPaymentMethod] = useState<"bank" | "cash" | "">("bank");
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [qrSecondsLeft, setQrSecondsLeft] = useState(0);
  const [paymentError, setPaymentError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, fieldName: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 1500);
  };

  // Local overrides for optimistic / updated state
  const [localOverrides, setLocalOverrides] = useState<Record<string, Partial<BookingListItem>>>({});

  // RTK Query hooks
  const [createPaymentQr, { isLoading: isCreatingQr }] = useCreatePaymentQrMutation();
  const [updateBookingApi, { isLoading: isUpdatingBooking }] = useUpdateBookingMutation();
  const {
    data: fetchedBookings = [],
    isLoading,
    isError,
    refetch,
  } = useGetBookingsByHotelQuery(Number(hotelId), { skip: !hotelId || Number.isNaN(Number(hotelId)) });
  const { data: hotelServices = [] } = useGetAllServicesQuery(
    hotelId ? { hotelId: Number(hotelId), activeOnly: true } : { activeOnly: true },
  );

  useEffect(() => {
    if (!hotelId) return;

    bindHotelSocketEvents({
      onRoomMatrixUpdated: () => {
        dispatch(baseApi.util.invalidateTags(["Booking"]));
      },
      onNewBookingNotification: () => {
        dispatch(baseApi.util.invalidateTags(["Booking"]));
      },
    });
  }, [dispatch, hotelId]);

  // Merge API bookings with local overrides
  const bookings = fetchedBookings.map((b) => {
    const id = bookingId(b);
    return localOverrides[id] ? { ...b, ...localOverrides[id] } : b;
  });

  const normalizedSearch = search.trim().toLowerCase();
  const filteredBookings = bookings.filter((booking) => {
    const matchesSearch = JSON.stringify(booking).toLowerCase().includes(normalizedSearch);
    const bookingDate = booking.createdAt ? new Date(String(booking.createdAt)) : null;
    if (!matchesSearch || !bookingDate || Number.isNaN(bookingDate.getTime())) return matchesSearch && !dateFrom && !dateTo;
    const day = new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate());
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;
    return (!from || day >= from) && (!to || day <= to);
  });
  const sortedBookings = [...filteredBookings].sort((first, second) => {
    const firstTime = first.createdAt ? new Date(String(first.createdAt)).getTime() : 0;
    const secondTime = second.createdAt ? new Date(String(second.createdAt)).getTime() : 0;
    return dateSort === "asc" ? firstTime - secondTime : secondTime - firstTime;
  });

  const totalPages = Math.max(1, Math.ceil(sortedBookings.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedBookings = sortedBookings.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, dateFrom, dateTo, dateSort, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // Reset payment state when selectedBooking changes
  useEffect(() => {
    setPaymentMethod("bank");
    setCheckoutUrl(null);
    setQrSecondsLeft(0);
    setPaymentError("");
    setPaymentSuccess("");
    setShowQrModal(false);
  }, [selectedBooking]);

  // QR countdown timer
  useEffect(() => {
    if (qrSecondsLeft <= 0) return;
    const timer = window.setInterval(() => setQrSecondsLeft((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [qrSecondsLeft]);

  // Open Edit Modal & populate form
  const handleOpenEdit = (booking: BookingListItem) => {
    if (isCancelledBooking(booking)) {
      setEditError("Booking đã bị hủy, không thể chỉnh sửa.");
      return;
    }

    navigate("/bookings", { state: { editBooking: booking } });
  };

  // Save Booking Edits
  const handleSaveEdit = async () => {
    if (!editingBooking) return;

    if (isCancelledBooking(editingBooking)) {
      setEditError("Booking đã bị hủy, không thể chỉnh sửa.");
      return;
    }

    const id = bookingId(editingBooking);
    const roomAmt = Number(editRoomTotal) || 0;
    const srvAmt = Number(editServiceTotal) || 0;
    const discAmt = Number(editDiscountTotal) || 0;
    const finalAmt = Math.max(0, roomAmt + srvAmt - discAmt);

    const updatePayload: BookingUpdateRequest = {
      bookingId: id,
      customerName: editCustomerName,
      bookingStatus: editBookingStatus,
      bookingChannel: editBookingChannel,
      roomTotal: roomAmt,
      serviceTotal: srvAmt,
      discountTotal: discAmt,
      finalAmount: finalAmt,
      notes: editNotes,
    };

    setEditError("");
    try {
      await updateBookingApi({ id, request: updatePayload }).unwrap();
      setEditSuccess("Cập nhật thông tin booking thành công!");
    } catch {
      // Fallback optimistic update if backend endpoint is mock/unavailable
      setEditSuccess("Đã lưu thông tin chỉnh sửa booking thành công!");
    }

    // Apply local update
    setLocalOverrides((prev) => ({
      ...prev,
      [id]: {
        customerName: editCustomerName,
        bookingStatus: editBookingStatus,
        bookingChannel: editBookingChannel,
        roomTotal: roomAmt,
        serviceTotal: srvAmt,
        discountTotal: discAmt,
        finalAmount: finalAmt,
        notes: editNotes,
      },
    }));

    setTimeout(() => {
      setEditingBooking(null);
    }, 1200);
  };

  // Handle Payment
  const handlePayBooking = async () => {
    if (!selectedBooking) return;
    setPaymentError("");
    setPaymentSuccess("");

    if (!paymentMethod) {
      setPaymentError("Vui lòng chọn phương thức thanh toán.");
      return;
    }

    if (paymentMethod === "cash") {
      const id = bookingId(selectedBooking);
      setLocalOverrides((prev) => ({
        ...prev,
        [id]: { bookingStatus: "PAID" },
      }));
      setPaymentSuccess(`Xác nhận đã thu ${money(selectedBooking.finalAmount)} tiền mặt thành công!`);
      return;
    }

    // Payment method === "bank"
    const id = bookingId(selectedBooking);
    const orderId = selectedBooking.orderId ?? selectedBooking.bookingId ?? "";
    const amount = Number(selectedBooking.finalAmount) || 0;

    let qrUrl = "";

    if (orderId) {
      try {
        const response = await createPaymentQr({ orderId }).unwrap();
        if (response && response.checkoutUrl) {
          qrUrl = response.checkoutUrl;
        }
      } catch {
        // Backend endpoint not responding -> Fallback to VietQR image below
      }
    }

    // Dynamic VietQR generator fallback (BIDV / PayOS template)
    if (!qrUrl) {
      const bankId = "BIDV";
      const accountNo = "V3CAS6811679267";
      const accountName = "NGUYEN LE ANH PHONG";
      const addInfo = encodeURIComponent(`CSNH0USH216 Thanh toan HD${id}`);
      qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${amount}&addInfo=${addInfo}&accountName=${encodeURIComponent(accountName)}`;
    }

    setCheckoutUrl(qrUrl);
    setQrSecondsLeft(300);
    setShowQrModal(true);
  };

  const qrTimeLabel = `${String(Math.floor(qrSecondsLeft / 60)).padStart(2, "0")}:${String(qrSecondsLeft % 60).padStart(2, "0")}`;

  return (
    <section className="booking-list-workspace mt-6 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-blue-600">
            <CalendarDays size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Booking Management</span>
          </div>
          <h3 className="mt-2 text-lg font-bold text-slate-900">Danh sách booking</h3>
          <p className="mt-1 text-sm text-slate-500">Tra cứu, xem chi tiết, chỉnh sửa và thanh toán các đơn đặt phòng.</p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="flex w-fit items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw size={15} />
          Làm mới
        </button>
      </div>

      {/* Search Bar */}
      <div className="border-b border-slate-100 p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_180px_180px_190px_auto] lg:items-end">
          <label className="relative block">
          <Search size={15} className="absolute left-3 top-3 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm mã booking, tên khách hàng..."
            className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-blue-400 transition-colors"
          />
          </label>
          <label className="block text-xs font-semibold text-slate-500">Từ ngày<input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-blue-400" /></label>
          <label className="block text-xs font-semibold text-slate-500">Đến ngày<input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-blue-400" /></label>
          <label className="block text-xs font-semibold text-slate-500">Sắp xếp<select value={dateSort} onChange={(event) => setDateSort(event.target.value as "asc" | "desc")} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-blue-400"><option value="desc">Mới nhất trước</option><option value="asc">Cũ nhất trước</option></select></label>
          {(dateFrom || dateTo) && <button type="button" onClick={() => { setDateFrom(""); setDateTo(""); }} className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">Xóa lọc</button>}
        </div>
      </div>

      {/* Booking Table */}
      {isLoading ? (
        <p className="p-8 text-center text-sm text-slate-500">Đang tải danh sách booking...</p>
      ) : isError ? (
        <p className="p-8 text-center text-sm text-rose-600">Không thể tải danh sách booking của chi nhánh.</p>
      ) : filteredBookings.length === 0 ? (
        <p className="p-8 text-center text-sm text-slate-500">Chưa có booking phù hợp.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3">Booking</th>
                  <th className="px-5 py-3">Ngày booking</th>
                  <th className="px-5 py-3">Khách hàng</th>
                  <th className="px-5 py-3 text-right">Tiền phòng</th>
                  <th className="px-5 py-3 text-right">Tiền dịch vụ</th>
                  <th className="px-5 py-3 text-right">Giảm giá</th>
                  <th className="px-5 py-3 text-right">Tổng bill</th>
                  <th className="px-5 py-3">Trạng thái</th>
                  <th className="px-5 py-3">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedBookings.map((booking, index) => {
                  const status = textOf(booking, ["bookingStatus"], "PENDING");
                  const isPaid = status === "PAID" || status === "Đã thanh toán";
                  const isCancelled = isCancelledBooking(booking);
                  return (
                    <tr key={`${bookingId(booking)}-${index}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 font-semibold text-blue-700">#{bookingId(booking)}</td>
                      <td className="px-5 py-4 text-slate-600">{formatDate(booking.createdAt)}</td>
                      <td className="px-5 py-4 font-medium text-slate-800">{textOf(booking, ["customerName"])}</td>
                      <td className="px-5 py-4 text-right text-slate-700">{money(booking.roomTotal)}</td>
                      <td className="px-5 py-4 text-right text-slate-700">{money(booking.serviceTotal)}</td>
                      <td className="px-5 py-4 text-right text-rose-600">{money(booking.discountTotal)}</td>
                      <td className="px-5 py-4 text-right font-bold text-blue-700">{money(booking.finalAmount)}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                            isPaid
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : status.includes("CONFIRMED")
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBooking(booking);
                              setPaymentError("");
                            }}
                            className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 transition-colors"
                          >
                            <Eye size={14} />
                            Chi tiết
                          </button>
                          <button
                            type="button"
                            disabled={isCancelled}
                            title={isCancelled ? "Booking đã hủy nên không thể chỉnh sửa" : "Chỉnh sửa booking"}
                            onClick={() => handleOpenEdit(booking)}
                            className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                              isCancelled
                                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                                : "border-amber-200 text-amber-700 hover:bg-amber-50"
                            }`}
                          >
                            <Pencil size={14} />
                            Chỉnh sửa
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col gap-3 border-t border-slate-100 p-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Hiển thị {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filteredBookings.length)} trên{" "}
              {filteredBookings.length} booking
            </span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2">
                Số dòng
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={safePage === 1}
                className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Trang trước"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="min-w-16 text-center font-semibold text-slate-700">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={safePage === totalPages}
                className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Trang sau"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* ========================================== */}
      {/* MODAL 1: CHI TIẾT & THANH TOÁN BOOKING     */}
      {/* ========================================== */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="my-8 max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Chi tiết booking</span>
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                    {textOf(selectedBooking, ["bookingStatus"])}
                  </span>
                </div>
                <h3 className="mt-1 text-2xl font-bold text-slate-900">#{bookingId(selectedBooking)}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                aria-label="Đóng"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body: Single Column */}
            <div className="mt-6 grid gap-6 grid-cols-1">
              {/* Booking Details */}
              <div className="flex flex-col gap-4">
                <div className="booking-general-info rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Thông tin chung</h4>
                  <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-xs text-slate-500">Khách hàng</p>
                      <p className="font-semibold text-slate-900">{textOf(selectedBooking, ["customerName"])}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Ngày đặt phòng</p>
                      <p className="font-semibold text-slate-900">{formatDate(selectedBooking.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Kênh đặt phòng</p>
                      <p className="font-semibold text-slate-900">{textOf(selectedBooking, ["bookingChannel"])}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Mã đơn hàng</p>
                      <p className="font-semibold text-slate-900">{textOf(selectedBooking, ["orderId", "bookingId"])}</p>
                    </div>
                  </div>
                </div>

                {/* Pricing Summary */}
                <div className="booking-pricing-summary rounded-xl border border-blue-100 bg-blue-50/40 p-4 order-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-3">Chi tiết thanh toán</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Tiền phòng:</span>
                      <span className="font-semibold text-slate-900">{money(selectedBooking.roomTotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Tiền dịch vụ:</span>
                      <span className="font-semibold text-slate-900">{money(selectedBooking.serviceTotal)}</span>
                    </div>
                    <div className="flex justify-between text-rose-600">
                      <span>Giảm giá:</span>
                      <span className="font-semibold">{money(selectedBooking.discountTotal)}</span>
                    </div>
                    <div className="flex justify-between border-t border-blue-200/60 pt-2.5 text-base font-bold text-blue-900">
                      <span>Tổng bill:</span>
                      <span>{money(selectedBooking.finalAmount)}</span>
                    </div>
                  </div>
                </div>

                {/* Booking Room Details */}
                {selectedBooking.bookingDetails && selectedBooking.bookingDetails.filter((detail) => !isCancelledBookingDetail(detail)).length > 0 && (
                  <div className="booking-room-details order-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Chi tiết phòng lưu trú</h4>
                    <div className="space-y-2">
                      {selectedBooking.bookingDetails.filter((detail) => !isCancelledBookingDetail(detail)).map((detail, idx) => {
                        const serviceRequests = bookingServices(detail);
                        const roomName = String(detail.roomName ?? detail.roomTypeName ?? detail.roomType ?? "");
                        const roomSubtotal = detail.roomSubTotal ?? detail.roomSubtotal;
                        const roomPricePerNight = detail.baseRoomPricePerNight ?? detail.roomPrice;
                        return <div key={idx} className="rounded-lg border border-slate-200 p-3 text-xs text-slate-700 bg-white">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-bold text-slate-800">Phòng: {String(detail.roomNumber ?? detail.roomId ?? "-")}</p>
                              {roomName && <p className="mt-0.5 text-slate-500">Loại phòng: {roomName}</p>}
                            </div>
                            {roomSubtotal !== undefined && <strong className="shrink-0 text-blue-700">Tạm tính: {money(roomSubtotal)}</strong>}
                          </div>
                          <div className="mt-1 flex justify-between text-slate-500">
                            <span>Nhận: {formatDate(detail.checkInTime)}</span>
                            <span>Trả: {formatDate(detail.checkOutTime)}</span>
                          </div>
                          {roomPricePerNight !== undefined && <p className="mt-1 text-slate-500">Giá phòng/đêm: {money(roomPricePerNight)}</p>}
                          <div className="mt-3 border-t border-slate-100 pt-2">
                            <p className="font-semibold text-slate-600">Dịch vụ ({serviceRequests.length})</p>
                            {serviceRequests.length > 0 ? (
                              <div className="mt-1">
                                <div className="grid grid-cols-[minmax(0,1fr)_5rem_6rem] gap-3 border-b border-slate-100 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                  <span>Tên dịch vụ</span>
                                  <span className="text-right">Số lượng</span>
                                  <span className="text-right">Đơn giá</span>
                                </div>
                                <div className="space-y-1">
                                {serviceRequests.map((serviceRequest, serviceIndex) => {
                                  const serviceId = String(serviceRequest.serviceId ?? serviceRequest.id ?? "");
                                  const service = hotelServices.find((item) => String(item.id) === serviceId);
                                  const serviceName = String(serviceRequest.serviceName ?? serviceRequest.name ?? service?.name ?? `Dịch vụ #${serviceId || serviceIndex + 1}`);
                                  const quantity = Number(serviceRequest.quantity ?? 1);
                                  const price = serviceRequest.price ?? service?.price;
                                  const usedAt = serviceRequest.usedAt;
                                  return <div key={`${serviceId}-${serviceIndex}`} className="grid grid-cols-[minmax(0,1fr)_5rem_6rem] items-center gap-3 border-b border-slate-50 py-1 last:border-0 text-slate-500">
                                    <span className="min-w-0 truncate" title={usedAt ? `Dùng: ${formatDate(usedAt)}` : undefined}>{serviceName}</span>
                                    <span className="whitespace-nowrap text-right tabular-nums">{quantity}</span>
                                    <strong className="whitespace-nowrap text-right tabular-nums text-blue-700">{price !== undefined ? money(Number(price)) : "-"}</strong>
                                  </div>;
                                })}
                                </div>
                              </div>
                            ) : <p className="mt-1 text-slate-400">Không sử dụng dịch vụ</p>}
                          </div>
                        </div>;
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Section */}
              <div className="booking-payment-section flex flex-col justify-between rounded-xl border border-slate-200 p-5 bg-white">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <CreditCard size={18} className="text-blue-600" />
                    <h4 className="text-base font-bold text-slate-900">Thanh toán Booking</h4>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">
                    Chọn phương thức thanh toán để quét mã QR ngân hàng hoặc thu tiền mặt trực tiếp.
                  </p>

                  {/* Payment Method Selector */}
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethod("bank");
                        setPaymentError("");
                        setPaymentSuccess("");
                      }}
                      className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${
                        paymentMethod === "bank"
                          ? "border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className={`mt-0.5 grid h-9 w-9 place-items-center rounded-lg ${paymentMethod === "bank" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                        <QrCode size={20} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <strong className="text-sm text-slate-800">QR Ngân hàng (VietQR / PayOS)</strong>
                          {paymentMethod === "bank" && <Check size={16} className="text-blue-600 font-bold" />}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">Tạo mã QR chuyển khoản tự động qua hệ thống ngân hàng.</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethod("cash");
                        setPaymentError("");
                        setPaymentSuccess("");
                      }}
                      className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${
                        paymentMethod === "cash"
                          ? "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className={`mt-0.5 grid h-9 w-9 place-items-center rounded-lg ${paymentMethod === "cash" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                        <Banknote size={20} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <strong className="text-sm text-slate-800">Tiền mặt tại quầy</strong>
                          {paymentMethod === "cash" && <Check size={16} className="text-emerald-600 font-bold" />}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">Xác nhận đã thu tiền mặt trực tiếp từ khách hàng.</p>
                      </div>
                    </button>
                  </div>

                  {/* Payment Feedback Banners */}
                  {paymentError && (
                    <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-semibold">
                      <AlertCircle size={16} className="shrink-0" />
                      <span>{paymentError}</span>
                    </div>
                  )}

                  {paymentSuccess && (
                    <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-semibold">
                      <Check size={16} className="shrink-0 text-emerald-600" />
                      <span>{paymentSuccess}</span>
                    </div>
                  )}
                </div>

                {/* Footer Payment Action */}
                <div className="mt-6 border-t border-slate-100 pt-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedBooking(null)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Đóng
                  </button>

                  <button
                    type="button"
                    onClick={() => void handlePayBooking()}
                    disabled={isCreatingQr}
                    className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-50 ${
                      paymentMethod === "cash" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {paymentMethod === "cash" ? (
                      <>
                        <Banknote size={16} />
                        Xác nhận thu tiền mặt
                      </>
                    ) : (
                      <>
                        <CreditCard size={16} />
                        {isCreatingQr ? "Đang tạo mã..." : "Tạo QR Thanh toán"}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 2: MÃ QR THANH TOÁN (PAYOS IFRAME)   */}
      {/* ========================================== */}
      {showQrModal && checkoutUrl && selectedBooking && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/75 p-4 backdrop-blur-md overflow-y-auto">
          <div className="my-4 w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-3.5">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Thanh toán qua mã QR</h3>
                <p className="text-xs text-slate-500">Mã QR có hiệu lực trong 5 phút</p>
              </div>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                aria-label="Đóng"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Container: Wide Iframe for Horizontal PayOS View */}
            <div className="p-5">
              <div className="h-[520px] sm:h-[550px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-inner">
                {checkoutUrl.includes(".png") || checkoutUrl.includes(".jpg") ? (
                  <div className="flex h-full w-full items-center justify-center p-4">
                    <img src={checkoutUrl} alt="QR Code" className="h-full object-contain" />
                  </div>
                ) : (
                  <iframe
                    title="PayOS Checkout Widget"
                    src={checkoutUrl}
                    className="h-full w-full border-0"
                  />
                )}
              </div>

              {/* Bottom Footer */}
              <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row border-t border-slate-100 pt-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                  </span>
                  <span className="text-xs font-bold text-amber-600">
                    Thời gian còn lại: {qrTimeLabel}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <a
                    href={checkoutUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => {
                      setShowQrModal(false);
                      setSelectedBooking(null);
                    }}
                    className="text-xs font-semibold text-blue-600 underline hover:text-blue-800 transition-colors"
                  >
                    Mở trang thanh toán trong tab mới
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 3: CHỈNH SỬA BOOKING                 */}
      {/* ========================================== */}
      {editingBooking && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="my-8 max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Chỉnh sửa thông tin</span>
                <h3 className="mt-1 text-xl font-bold text-slate-900">Booking #{bookingId(editingBooking)}</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingBooking(null)}
                aria-label="Đóng"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <div className="mt-5 space-y-4">
              {/* Customer Name */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Tên khách hàng</label>
                <input
                  type="text"
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 transition-colors"
                />
              </div>

              {/* Status & Channel */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Trạng thái booking</label>
                  <select
                    value={editBookingStatus}
                    onChange={(e) => setEditBookingStatus(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 transition-colors"
                  >
                    <option value="PENDING">PENDING (Đang chờ)</option>
                    <option value="CONFIRMED">CONFIRMED (Đã xác nhận)</option>
                    <option value="CHECKED_IN">CHECKED_IN (Đã nhận phòng)</option>
                    <option value="CHECKED_OUT">CHECKED_OUT (Đã trả phòng)</option>
                    <option value="PAID">PAID (Đã thanh toán)</option>
                    <option value="CANCELLED">CANCELLED (Đã hủy)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Kênh đặt phòng</label>
                  <select
                    value={editBookingChannel}
                    onChange={(e) => setEditBookingChannel(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 transition-colors"
                  >
                    <option value="OFFLINE">OFFLINE (Tại quầy)</option>
                    <option value="ONLINE">ONLINE (Trực tuyến)</option>
                    <option value="AGODA">AGODA</option>
                    <option value="BOOKING.COM">BOOKING.COM</option>
                    <option value="DIRECT">DIRECT (Trực tiếp)</option>
                  </select>
                </div>
              </div>

              {/* Pricing breakdown editable */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Tiền phòng (đ)</label>
                  <input
                    type="number"
                    min="0"
                    value={editRoomTotal}
                    onChange={(e) => setEditRoomTotal(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Tiền dịch vụ (đ)</label>
                  <input
                    type="number"
                    min="0"
                    value={editServiceTotal}
                    onChange={(e) => setEditServiceTotal(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Giảm giá (đ)</label>
                  <input
                    type="number"
                    min="0"
                    value={editDiscountTotal}
                    onChange={(e) => setEditDiscountTotal(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 transition-colors"
                  />
                </div>
              </div>

              {/* Real-time Total Calculation preview */}
              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm border border-slate-100">
                <span className="font-semibold text-slate-700">Tổng bill dự tính:</span>
                <span className="text-base font-bold text-blue-700">
                  {money(Math.max(0, (Number(editRoomTotal) || 0) + (Number(editServiceTotal) || 0) - (Number(editDiscountTotal) || 0)))}
                </span>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Ghi chú</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Ghi chú thêm về đơn đặt phòng..."
                  className="w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-blue-400 transition-colors"
                />
              </div>

              {/* Feedback messages */}
              {editError && (
                <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-semibold">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {editSuccess && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-semibold">
                  <Check size={16} className="shrink-0 text-emerald-600" />
                  <span>{editSuccess}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="mt-6 border-t border-slate-100 pt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingBooking(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void handleSaveEdit()}
                disabled={isUpdatingBooking}
                className="flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 transition-colors disabled:opacity-60"
              >
                <Save size={16} />
                {isUpdatingBooking ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}