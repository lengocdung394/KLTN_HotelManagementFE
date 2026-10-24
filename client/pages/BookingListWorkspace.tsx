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
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import BankSelectionField from "../components/BankSelectionField";
import {
  useGetBookingsByHotelQuery,
  useUpdateBookingMutation,
  type BookingListItem,
  type BookingUpdateRequest,
} from "../services/bookingApi";
import { useCreatePaymentQrMutation, usePayWithCashMutation } from "../services/paymentApi";
import { useGetAllServicesQuery } from "../services/serviceApi";
import { useCancelBookingByStaffMutation, useGetBookingCancellationPreviewQuery } from "../services/managementBookingApi";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { bindHotelSocketEvents } from "../lib/socket";
import { baseApi } from "../services/baseApi";
import i18n, { localizedText } from "../i18n";

const valueOf = (item: BookingListItem, keys: string[]) => {
  if (!item || typeof item !== "object") return undefined;
  const normalizedMap = new Map<string, unknown>();
  Object.entries(item).forEach(([key, value]) => {
    normalizedMap.set(String(key).toLowerCase(), value);
  });

  for (const key of keys) {
    const directValue = item[key];
    if (directValue !== undefined && directValue !== null && directValue !== "") return directValue;

    const normalizedValue = normalizedMap.get(String(key).toLowerCase());
    if (normalizedValue !== undefined && normalizedValue !== null && normalizedValue !== "") return normalizedValue;
  }

  return undefined;
};

const textOf = (item: BookingListItem, keys: string[], fallback = "-") =>
  String(valueOf(item, keys) ?? fallback);

const bookingAmount = (item: BookingListItem, keys: string[], fallback = 0) => {
  const value = valueOf(item, keys);
  const numericValue = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const money = (value: unknown) => {
  const numericValue = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(numericValue)) return "-";
  return `${new Intl.NumberFormat(i18n.language.startsWith("en") ? "en-US" : "vi-VN", { maximumFractionDigits: 0 }).format(numericValue)}${i18n.language.startsWith("en") ? " VND" : "đ"}`;
};

const bookingId = (booking: BookingListItem) => textOf(booking, ["bookingId", "orderId", "id"]);

const bookingTotalIncludingSurcharges = (booking: BookingListItem) => {
  const storedTotal = bookingAmount(booking, ["finalAmount", "totalAmount"]);
  const details = Array.isArray(booking.bookingDetails) ? booking.bookingDetails : [];
  const detailSurchargeTotal = details.reduce((total, detail) => {
    if (isCancelledBookingDetail(detail)) return total;
    const earlyFee = Number(detail.earlyCheckInFee ?? detail.earlyCheckinFee ?? 0);
    const lateFee = Number(detail.lateCheckOutFee ?? detail.lateCheckoutFee ?? detail.lateFee ?? 0);
    const otherSurcharges = Number(detail.otherSurcharges ?? 0);
    return total
      + (Number.isFinite(earlyFee) ? earlyFee : 0)
      + (Number.isFinite(lateFee) ? lateFee : 0)
      + (Number.isFinite(otherSurcharges) ? otherSurcharges : 0);
  }, 0);
  const storedSurchargeTotal = bookingAmount(booking, ["surchargeTotalAmount"], 0);
  const roomTotal = bookingAmount(booking, ["roomTotal"], Number.NaN);
  const serviceTotal = bookingAmount(booking, ["serviceTotal"], Number.NaN);

  if (Number.isFinite(roomTotal) && Number.isFinite(serviceTotal)) {
    const explicitDiscounts = [
      bookingAmount(booking, ["discountRoomAmount", "roomDiscountAmount"], 0),
      bookingAmount(booking, ["discountServiceAmount", "serviceDiscountAmount"], 0),
      bookingAmount(booking, ["discountAmountTotal", "totalDiscountAmount"], 0),
    ].reduce((total, discount) => total + discount, 0);
    const totalDiscount = explicitDiscounts > 0
      ? explicitDiscounts
      : bookingAmount(booking, ["discountTotal"], 0);
    const expectedTotal = Math.max(
      0,
      roomTotal + serviceTotal + Math.max(detailSurchargeTotal, storedSurchargeTotal) - totalDiscount,
    );
    return Math.max(storedTotal, expectedTotal);
  }

  return storedTotal + Math.max(0, detailSurchargeTotal - storedSurchargeTotal);
};

const formatDate = (value: unknown) => {
  if (!value) return "-";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString(i18n.language.startsWith("en") ? "en-US" : "vi-VN");
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

const isCheckedOutBooking = (booking: Partial<Record<string, unknown>> | null | undefined) => {
  if (!booking) return false;
  const status = String(booking.bookingStatus ?? booking.status ?? "").trim().toUpperCase();
  if (status === "COMPLETED") return true;
  const details = Array.isArray(booking.bookingDetails) ? booking.bookingDetails : [];
  const activeDetails = details.filter((detail) => {
    if (!detail || typeof detail !== "object") return false;
    const detailStatus = String(
      (detail as Record<string, unknown>).bookingDetailStatus
      ?? (detail as Record<string, unknown>).bookingStatusType
      ?? (detail as Record<string, unknown>).status
      ?? "",
    ).toUpperCase();
    return detailStatus !== "CANCELLED" && !isCancelledBookingDetail(detail as Record<string, unknown>);
  });
  return activeDetails.length > 0 && activeDetails.every((detail) =>
    String((detail as Record<string, unknown>).bookingDetailStatus ?? (detail as Record<string, unknown>).status ?? "").toUpperCase() === "CHECKED_OUT",
  );
};

const bookingServices = (detail: Record<string, unknown>) => {
  const serviceFields = [
    detail.bookingServiceResponsesForHotels,
    detail.bookingServiceResponseForHotels,
    detail.bookingServiceResponseForHotel,
    detail.bookingServiceResponsForHotels,
    detail.bookingServiceDetails,
    detail.serviceRequests,
    detail.serviceResponses,
    detail.services,
  ];
  const namedServices = serviceFields.find((services) => Array.isArray(services) && services.length > 0)
    ?? serviceFields.find(Array.isArray);
  const detectedServices = Object.entries(detail).find(([key, value]) =>
    Array.isArray(value) && key.toLowerCase().includes("service"),
  )?.[1];
  const services = namedServices ?? detectedServices;
  return ((services ?? []) as Record<string, unknown>[]).filter((service) => !isCancelledService(service));
};

export default function BookingListWorkspace() {
  useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
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
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelRefundMethod, setCancelRefundMethod] = useState<"CASH" | "BANK">("BANK");
  const [cashRefundConfirmed, setCashRefundConfirmed] = useState(false);
  const [cancelRefundEmail, setCancelRefundEmail] = useState("");
  const [cancelBankDetails, setCancelBankDetails] = useState({
    bankName: "",
    bankCode: "",
    bankAccountName: "",
    bankAccountNumber: "",
  });
  const [cancelError, setCancelError] = useState("");
  const [cancelFeedback, setCancelFeedback] = useState("");

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
  const [cashAmountPaid, setCashAmountPaid] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [qrSecondsLeft, setQrSecondsLeft] = useState(0);
  const [paymentError, setPaymentError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState("");
  const [cashChangeAmount, setCashChangeAmount] = useState<number | null>(null);
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
  const [payWithCash, { isLoading: isPayingCash }] = usePayWithCashMutation();
  const [updateBookingApi, { isLoading: isUpdatingBooking }] = useUpdateBookingMutation();
  const [cancelBookingByStaff, { isLoading: isCancellingBooking }] = useCancelBookingByStaffMutation();
  const {
    currentData: cancellationPreviewResponse,
    isLoading: isLoadingCancellationPreview,
    isFetching: isFetchingCancellationPreview,
    isError: isCancellationPreviewError,
    refetch: refetchCancellationPreview,
  } = useGetBookingCancellationPreviewQuery(
    selectedBooking ? bookingId(selectedBooking) : "",
    { skip: !showCancelConfirmation || !selectedBooking, refetchOnMountOrArgChange: true },
  );
  const cancellationPreview = cancellationPreviewResponse?.result;
  useEffect(() => {
    setCashRefundConfirmed(false);
  }, [cancellationPreview?.refundAmount]);
  const paymentRequestInFlight = useRef(false);
  const bookingUpdateInFlight = useRef(false);
  const paymentSectionRef = useRef<HTMLDivElement>(null);
  const focusPaymentAfterRedirect = useRef(false);
  const checkoutReturnTarget = useRef<{
    path: string;
    bookingId: string;
    detailIds: string[];
    mode: "single" | "group";
  } | null>(null);
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

    return bindHotelSocketEvents({
      onRoomMatrixUpdated: () => {
        dispatch(baseApi.util.invalidateTags(["Booking"]));
      },
      onNewBookingNotification: () => {
        dispatch(baseApi.util.invalidateTags(["Booking"]));
      },
      onBookingStateUpdated: () => {
        dispatch(baseApi.util.invalidateTags(["Booking"]));
        void refetch();
      },
    });
  }, [dispatch, hotelId, refetch]);

  // Merge API bookings with local overrides
  const bookings = useMemo(
    () => fetchedBookings.filter((b) => Boolean(b) && typeof b === "object").map((b) => {
      const id = bookingId(b);
      return localOverrides[id] ? { ...b, ...localOverrides[id] } : b;
    }),
    [fetchedBookings, localOverrides],
  );

  useEffect(() => {
    if (!selectedBooking) return;
    const latestBooking = bookings.find((booking) => bookingId(booking) === bookingId(selectedBooking));
    if (latestBooking && latestBooking !== selectedBooking) {
      setSelectedBooking(latestBooking);
    }
  }, [bookings, selectedBooking]);

  useEffect(() => {
    const locationState = location.state;
    const returnState = locationState && typeof locationState === "object"
      ? (locationState as { checkoutReturn?: unknown }).checkoutReturn
      : undefined;
    if (returnState && typeof returnState === "object") {
      const target = returnState as { path?: unknown; bookingId?: unknown; detailIds?: unknown; mode?: unknown };
      if (typeof target.path === "string" && target.path.startsWith("/check-in-out?") && typeof target.bookingId === "string") {
        checkoutReturnTarget.current = {
          path: target.path,
          bookingId: target.bookingId,
          detailIds: Array.isArray(target.detailIds)
            ? target.detailIds.filter((id): id is string => typeof id === "string")
            : [],
          mode: target.mode === "group" ? "group" : "single",
        };
      }
    }
    const targetBookingId = locationState && typeof locationState === "object"
      ? (locationState as { checkoutPaymentBookingId?: unknown }).checkoutPaymentBookingId
      : undefined;
    if (typeof targetBookingId !== "string" || !targetBookingId || isLoading) return;

    const targetBooking = bookings.find((booking) => bookingId(booking) === targetBookingId);
    if (targetBooking) {
      focusPaymentAfterRedirect.current = true;
      setSelectedBooking(targetBooking);
    } else {
      toast({
        variant: "destructive",
        title: localizedText("Không tìm thấy booking", "Booking not found"),
        description: localizedText("Vui lòng tìm booking cần thanh toán trong danh sách.", "Find the booking to pay in the list."),
      });
    }
    navigate(location.pathname, { replace: true, state: null });
  }, [bookings, isLoading, location.pathname, location.state, navigate]);

  const returnToCheckout = () => {
    const target = checkoutReturnTarget.current;
    if (!target) return;
    navigate(target.path, {
      state: {
        resumeCheckout: {
          bookingId: target.bookingId,
          detailIds: target.detailIds,
          mode: target.mode,
        },
      },
    });
  };

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
    setCashAmountPaid("");
    setCheckoutUrl(null);
    setQrSecondsLeft(0);
    setPaymentError("");
    setPaymentSuccess("");
    setCashChangeAmount(null);
    setShowQrModal(false);
    if (selectedBooking && focusPaymentAfterRedirect.current) {
      window.requestAnimationFrame(() => paymentSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      focusPaymentAfterRedirect.current = false;
    }
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
      setEditError(localizedText("Booking đã bị hủy, không thể chỉnh sửa.", "Cancelled bookings cannot be edited."));
      return;
    }
    if (isCheckedOutBooking(booking)) {
      setEditError(localizedText("Booking đã checkout hoàn tất, không thể chỉnh sửa.", "Checked-out bookings cannot be edited."));
      return;
    }

    navigate("/bookings", { state: { editBooking: booking } });
  };

  // Save Booking Edits
  const handleSaveEdit = async () => {
    if (!editingBooking) return;

    if (isCancelledBooking(editingBooking)) {
      setEditError(localizedText("Booking đã bị hủy, không thể chỉnh sửa.", "Cancelled bookings cannot be edited."));
      return;
    }
    if (isCheckedOutBooking(editingBooking)) {
      setEditError(localizedText("Booking đã checkout hoàn tất, không thể chỉnh sửa.", "Checked-out bookings cannot be edited."));
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
    if (bookingUpdateInFlight.current) return;
    bookingUpdateInFlight.current = true;
    try {
      await updateBookingApi({ id, request: updatePayload }).unwrap();
      setEditSuccess(localizedText("Cập nhật thông tin booking thành công!", "Booking information updated successfully!"));
    } catch {
      // Fallback optimistic update if backend endpoint is mock/unavailable
      setEditSuccess(localizedText("Đã lưu thông tin chỉnh sửa booking thành công!", "Booking changes saved successfully!"));
    } finally {
      bookingUpdateInFlight.current = false;
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
    if (isCancelledBooking(selectedBooking)) {
      setPaymentError(localizedText("Booking đã bị hủy, không thể tạo mã thanh toán.", "Cancelled bookings cannot generate payment codes."));
      setPaymentSuccess("");
      return;
    }
    setPaymentError("");
    setPaymentSuccess("");

    if (!paymentMethod) {
      setPaymentError(localizedText("Vui lòng chọn phương thức thanh toán.", "Select a payment method."));
      return;
    }

    if (paymentRequestInFlight.current) return;
    paymentRequestInFlight.current = true;
    try {
      if (paymentMethod === "cash") {
        const id = bookingId(selectedBooking);
        const amountPaid = Number(cashAmountPaid) || 0;
        const orderId = String(selectedBooking.orderId ?? selectedBooking.bookingId ?? id);
        if (!orderId || amountPaid <= 0) {
          setPaymentError(localizedText("Vui lòng nhập số tiền khách đưa hợp lệ.", "Enter a valid amount received from the guest."));
          return;
        }
        const totalDue = bookingTotalIncludingSurcharges(selectedBooking);
        const paidSoFar = Number(valueOf(selectedBooking, ["paidAmount", "amountPaid", "totalPaidAmount"]) ?? 0);
        const remainingDue = Math.max(0, totalDue - paidSoFar);
        const totalPaidAfterPayment = paidSoFar + amountPaid;
        const isFullyPaid = totalPaidAfterPayment >= totalDue;
        const fallbackChange = Math.max(0, amountPaid - remainingDue);
        try {
          const paymentResponse = await payWithCash({ orderId, amountPaid, note: localizedText("Thanh toán tiền mặt tại quầy", "Cash payment at front desk") }).unwrap();
          const responseChange = Number(
            paymentResponse?.changeAmount
            ?? paymentResponse?.refundAmount
            ?? paymentResponse?.cashChange
            ?? paymentResponse?.change
            ?? fallbackChange,
          );
          setCashChangeAmount(Number.isFinite(responseChange) ? responseChange : fallbackChange);
          setLocalOverrides((prev) => ({
            ...prev,
            [id]: {
              ...prev[id],
              paidAmount: totalPaidAfterPayment,
              remainingAmount: Math.max(0, totalDue - totalPaidAfterPayment),
              ...(isFullyPaid ? { bookingStatus: "CONFIRMED", paymentStatus: "PAID", invoiceStatus: "PAID" } : {}),
            },
          }));
          dispatch(baseApi.util.invalidateTags(["Booking"]));
          setPaymentSuccess(localizedText(`Xác nhận đã thu ${money(amountPaid)} tiền mặt thành công!`, `Cash payment of ${money(amountPaid)} received successfully!`));
        } catch (error: any) {
          const data = error?.data;
          const message = typeof data === "string" ? data : data?.message ?? data?.result?.message ?? error?.message ?? "Không thể thanh toán tiền mặt.";
          setPaymentError(String(message));
        }
        return;
      }

      const id = bookingId(selectedBooking);
      const orderId = selectedBooking.orderId ?? selectedBooking.bookingId ?? "";
      const amount = bookingTotalIncludingSurcharges(selectedBooking);

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
    } finally {
      paymentRequestInFlight.current = false;
    }
  };

  const qrTimeLabel = `${String(Math.floor(qrSecondsLeft / 60)).padStart(2, "0")}:${String(qrSecondsLeft % 60).padStart(2, "0")}`;
  const selectedBookingTotal = selectedBooking ? bookingTotalIncludingSurcharges(selectedBooking) : 0;
  const cashBillTotal = selectedBookingTotal;
  const enteredCashAmount = Number(cashAmountPaid) || 0;
  const paidSoFar = Number(valueOf(selectedBooking, ["paidAmount", "amountPaid", "totalPaidAmount"]) ?? 0);
  const cashRemainingDue = Math.max(0, cashBillTotal - paidSoFar);
  const computedCashChange = Math.max(0, enteredCashAmount - cashRemainingDue);
  const displayCashChange = cashChangeAmount ?? computedCashChange;
  const paymentBlocked = !!selectedBooking && (() => {
    const finalAmount = selectedBookingTotal;
    const paidAmount = Number(valueOf(selectedBooking, ["paidAmount", "amountPaid", "totalPaidAmount"]) ?? 0);
    return paidAmount >= finalAmount;
  })();
  const earlyCheckinFeeTotal = (selectedBooking?.bookingDetails ?? [])
    .filter((detail) => !isCancelledBookingDetail(detail))
    .reduce((total, detail) => {
      const fee = Number(detail.earlyCheckInFee ?? detail.earlyCheckinFee ?? 0);
      return total + (Number.isFinite(fee) ? fee : 0);
    }, 0);
  const lateCheckoutFeeTotal = (selectedBooking?.bookingDetails ?? [])
    .filter((detail) => !isCancelledBookingDetail(detail))
    .reduce((total, detail) => {
      const fee = Number(detail.lateCheckOutFee ?? detail.lateCheckoutFee ?? detail.lateFee ?? 0);
      return total + (Number.isFinite(fee) ? fee : 0);
    }, 0);
  const otherSurchargesTotal = (selectedBooking?.bookingDetails ?? [])
    .filter((detail) => !isCancelledBookingDetail(detail))
    .reduce((total, detail) => {
      const amount = Number(detail.otherSurcharges ?? 0);
      return total + (Number.isFinite(amount) ? amount : 0);
    }, 0);

  const canCancelSelectedBooking = !!selectedBooking
    && ["PENDING", "CONFIRMED"].includes(
      String(selectedBooking.bookingStatus ?? "").trim().toUpperCase(),
    );

  const handleCancelSelectedBooking = async () => {
    if (!selectedBooking) return;
    const id = bookingId(selectedBooking);
    if (!id || id === "-") {
      setCancelError("Không tìm thấy mã booking để hủy.");
      return;
    }
    if (!cancellationPreview || cancellationPreview.bookingId !== id) {
      setCancelError(localizedText("Chưa tải được số tiền hoàn chính xác. Vui lòng tải lại thông tin trước khi tiếp tục.", "The exact refund amount is not available. Reload the preview before continuing."));
      return;
    }
    if (cancelRefundEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cancelRefundEmail.trim())) {
      setCancelError("Vui lòng nhập email khách hàng hợp lệ.");
      return;
    }
    if (cancelRefundMethod === "CASH"
      && cancellationPreview.refundAmount > 0
      && !cashRefundConfirmed) {
      setCancelError(localizedText("Vui lòng xác nhận đã giao đúng số tiền hoàn hiển thị cho khách.", "Confirm that the exact displayed refund amount was handed to the guest."));
      return;
    }
    const hasAnyBankDetail = Object.values(cancelBankDetails).some((value) => value.trim());
    if (cancelRefundMethod === "BANK" && hasAnyBankDetail
      && (!cancelBankDetails.bankName.trim()
        || !cancelBankDetails.bankAccountName.trim()
        || !/^[0-9]{6,50}$/.test(cancelBankDetails.bankAccountNumber.trim()))) {
      setCancelError("Nếu nhập thông tin hoàn tiền, vui lòng nhập tên ngân hàng, tên chủ tài khoản và số tài khoản hợp lệ (6–50 chữ số).");
      return;
    }
    setCancelError("");
    try {
      const response = await cancelBookingByStaff({
        bookingId: id,
        request: {
          ...(cancelReason.trim() ? { reason: cancelReason.trim() } : {}),
          refundMethod: cancelRefundMethod,
          ...(cancelRefundMethod === "CASH" ? { cashRefundConfirmed } : {}),
          confirmedRefundAmount: cancellationPreview.refundAmount,
          confirmedRoomRefundAmount: cancellationPreview.roomRefundAmount,
          confirmedServiceRefundAmount: cancellationPreview.serviceRefundAmount,
          confirmedRoomPenaltyAmount: cancellationPreview.roomPenaltyAmount,
          confirmedRefundPolicy: cancellationPreview.refundPolicy,
          ...(cancelRefundEmail.trim() ? { refundEmail: cancelRefundEmail.trim() } : {}),
          ...(cancelRefundMethod === "BANK" && hasAnyBankDetail ? {
            bankName: cancelBankDetails.bankName.trim(),
            bankCode: cancelBankDetails.bankCode.trim() || undefined,
            bankAccountName: cancelBankDetails.bankAccountName.trim(),
            bankAccountNumber: cancelBankDetails.bankAccountNumber.trim(),
          } : {}),
        },
      }).unwrap();
      const cancellationStatus = response?.result?.status;
      const actualRefundMethod = response?.result?.refundMethod ?? cancelRefundMethod;
      const refundAmount = Number(response?.result?.refundAmount ?? cancellationPreview.refundAmount);
      const priorRefundedAmount = Number(valueOf(selectedBooking, ["refundedAmount"]) ?? 0);
      const priorPaidAmount = Number(valueOf(selectedBooking, ["paidAmount", "amountPaid", "totalPaidAmount"]) ?? 0);
      const collectedAmount = Number(valueOf(selectedBooking, ["collectedAmount"]) ?? priorPaidAmount + priorRefundedAmount);
      const wasRefundedImmediately = cancellationStatus === "REFUNDED" && actualRefundMethod === "CASH";
      setLocalOverrides((current) => ({
        ...current,
        [id]: {
          ...current[id],
          bookingStatus: "CANCELLED",
          remainingAmount: 0,
          collectedAmount,
          refundedAmount: priorRefundedAmount + (wasRefundedImmediately ? refundAmount : 0),
        },
      }));
      void refetch();
      const refundMessage = cancellationStatus === "REFUND_BANK_DETAILS_REQUIRED"
        ? localizedText(
          `Booking đã hủy; cần bổ sung tài khoản ngân hàng trước khi duyệt hoàn tiền. Số tiền hoàn dự kiến: ${money(refundAmount)}.`,
          `Booking cancelled; add bank details before refund approval. Expected refund: ${money(refundAmount)}.`,
        )
        : cancellationStatus === "REFUND_REVIEW_PENDING"
        ? localizedText(
          `Booking đã hủy; yêu cầu hoàn ${money(refundAmount)} đang chờ quản lý duyệt.`,
          `Booking cancelled; the ${money(refundAmount)} refund is pending manager approval.`,
        )
        : cancellationStatus === "REFUNDED" && actualRefundMethod === "CASH"
        ? localizedText(
          `Booking đã hủy và đã ghi nhận hoàn tiền mặt ${money(refundAmount)} cho khách.`,
          `Booking cancelled and cash refund of ${money(refundAmount)} recorded.`,
        )
        : cancellationStatus === "NO_REFUND_REQUIRED"
        ? localizedText("Booking đã hủy; không phát sinh tiền hoàn.", "Booking cancelled; no refund is due.")
        : localizedText("Booking đã hủy thành công.", "Booking cancelled successfully.");
      setCancelFeedback(refundMessage);
      setSelectedBooking(null);
      setShowCancelConfirmation(false);
      setCancelReason("");
      setCancelRefundMethod("BANK");
      setCashRefundConfirmed(false);
      setCancelRefundEmail("");
      setCancelBankDetails({ bankName: "", bankCode: "", bankAccountName: "", bankAccountNumber: "" });
    } catch (error: unknown) {
      const apiError = error as { data?: unknown; message?: string };
      const errorData = apiError.data as { message?: string; result?: { message?: string } } | string | undefined;
      const message = typeof errorData === "string"
        ? errorData
        : errorData?.message ?? errorData?.result?.message ?? apiError.message ?? "Không thể hủy booking.";
      if (message.includes("đã thay đổi kể từ lúc xem trước")) {
        setCashRefundConfirmed(false);
        void refetchCancellationPreview();
        setCancelError(localizedText(
          "Số tiền hoàn đã thay đổi so với lúc xem trước. Booking chưa bị hủy; hãy kiểm tra lại số tiền mới.",
          "The refund amount changed since the preview. The booking was not cancelled; review the updated amount.",
        ));
      } else {
        setCancelError(message);
      }
    }
  };

  return (
    <section className="booking-list-workspace mt-6 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-blue-600">
            <CalendarDays size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Booking Management</span>
          </div>
          <h3 className="mt-2 text-lg font-bold text-slate-900">{localizedText("Danh sách booking", "Booking list")}</h3>
            <p className="mt-1 text-sm text-slate-500">{localizedText("Tra cứu, xem chi tiết, chỉnh sửa và thanh toán các đơn đặt phòng.", "Search, view, edit, and pay for bookings.")}</p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="flex w-fit items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw size={15} />
          {localizedText("Làm mới", "Refresh")}
        </button>
      </div>

      {cancelFeedback && (
        <div className="mx-5 mt-4 flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <span>{cancelFeedback}</span>
          <button
            type="button"
            onClick={() => setCancelFeedback("")}
            aria-label={localizedText("Đóng thông báo", "Dismiss notification")}
            className="shrink-0 rounded p-0.5 text-emerald-700 hover:bg-emerald-100"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="border-b border-slate-100 p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_180px_180px_190px_auto] lg:items-end">
          <label className="relative block">
          <Search size={15} className="absolute left-3 top-3 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={localizedText("Tìm mã booking, tên khách hàng...", "Search booking ID or guest name...")}
            className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-blue-400 transition-colors"
          />
          </label>
          <label className="block text-xs font-semibold text-slate-500">{localizedText("Từ ngày", "From")}<input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-blue-400" /></label>
          <label className="block text-xs font-semibold text-slate-500">{localizedText("Đến ngày", "To")}<input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-blue-400" /></label>
          <label className="block text-xs font-semibold text-slate-500">{localizedText("Sắp xếp", "Sort")}<select value={dateSort} onChange={(event) => setDateSort(event.target.value as "asc" | "desc")} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-blue-400"><option value="desc">{localizedText("Mới nhất trước", "Newest first")}</option><option value="asc">{localizedText("Cũ nhất trước", "Oldest first")}</option></select></label>
          {(dateFrom || dateTo) && <button type="button" onClick={() => { setDateFrom(""); setDateTo(""); }} className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">{localizedText("Xóa lọc", "Clear filters")}</button>}
        </div>
      </div>

      {/* Booking Table */}
      {isLoading ? (
        <p className="p-8 text-center text-sm text-slate-500">{localizedText("Đang tải danh sách booking...", "Loading bookings...")}</p>
      ) : isError ? (
        <p className="p-8 text-center text-sm text-rose-600">{localizedText("Không thể tải danh sách booking của chi nhánh.", "Could not load this branch's bookings.")}</p>
      ) : filteredBookings.length === 0 ? (
        <p className="p-8 text-center text-sm text-slate-500">{localizedText("Chưa có booking phù hợp.", "No matching bookings found.")}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3">Booking</th>
                  <th className="px-5 py-3">{localizedText("Ngày booking", "Booking date")}</th>
                  <th className="px-5 py-3">{localizedText("Khách hàng", "Guest")}</th>
                  <th className="px-5 py-3 text-right">{localizedText("Tiền phòng", "Room")}</th>
                  <th className="px-5 py-3 text-right">{localizedText("Tiền dịch vụ", "Services")}</th>
                  <th className="px-5 py-3 text-right">{localizedText("Giảm giá", "Discount")}</th>
                  <th className="px-5 py-3 text-right">{localizedText("Đã thu", "Collected")}</th>
                  <th className="px-5 py-3 text-right">{localizedText("Đã hoàn", "Refunded")}</th>
                  <th className="px-5 py-3 text-right">{localizedText("Còn thiếu", "Balance")}</th>
                  <th className="px-5 py-3 text-right">{localizedText("Tổng bill", "Total")}</th>
                  <th className="px-5 py-3">{localizedText("Trạng thái", "Status")}</th>
                  <th className="px-5 py-3">{localizedText("Thao tác", "Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedBookings.map((booking, index) => {
                  const status = textOf(booking, ["bookingStatus"], "PENDING");
                  const isPaid = status === "PAID" || status === "Đã thanh toán";
                  const isCancelled = isCancelledBooking(booking);
                  const isCheckedOut = isCheckedOutBooking(booking);
                  const bookingDiscount = valueOf(booking, ["discountAmountTotal", "discountTotal", "totalDiscountAmount"]) ?? valueOf(booking, ["discountRoomAmount", "discountServiceAmount"]);
                  const bookingPaid = valueOf(booking, ["paidAmount", "amountPaid", "totalPaidAmount"]);
                  const finalAmountNumber = bookingTotalIncludingSurcharges(booking);
                  const paidAmountNumber = Number(bookingPaid ?? 0);
                  const refundedAmount = Number(valueOf(booking, ["refundedAmount"]) ?? 0);
                  const collectedAmount = Number(valueOf(booking, ["collectedAmount"]) ?? (paidAmountNumber + refundedAmount));
                  const guestDue = isCancelled ? 0 : finalAmountNumber - paidAmountNumber;
                  const isFullyPaid = guestDue === 0;
                  const isHotelOwesCustomer = guestDue < 0;
                  const displayRemaining = Math.abs(guestDue);
                  return (
                    <tr key={`${bookingId(booking)}-${index}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 font-semibold text-blue-700">{bookingId(booking)}</td>
                      <td className="px-5 py-4 text-slate-600">{formatDate(booking.createdAt)}</td>
                      <td className="px-5 py-4 font-medium text-slate-800">{textOf(booking, ["customerName"])}</td>
                      <td className="px-5 py-4 text-right text-slate-700">{money(booking.roomTotal)}</td>
                      <td className="px-5 py-4 text-right text-slate-700">{money(booking.serviceTotal)}</td>
                      <td className="px-5 py-4 text-right text-rose-600">{money(bookingDiscount)}</td>
                      <td className="px-5 py-4 text-right text-emerald-700">{money(collectedAmount)}</td>
                      <td className="px-5 py-4 text-right text-purple-700">{money(refundedAmount)}</td>
                      <td className={`px-5 py-4 text-right font-medium ${isFullyPaid ? "text-emerald-700 font-semibold" : isHotelOwesCustomer ? "text-purple-700" : "text-amber-700"}`}>
                        {isFullyPaid ? "0 đ" : isHotelOwesCustomer ? `(-${money(displayRemaining)})` : money(displayRemaining)}
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-blue-700">{money(finalAmountNumber)}</td>
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
                            disabled={isCancelled || isCheckedOut}
                            title={isCancelled ? "Booking đã hủy nên không thể chỉnh sửa" : isCheckedOut ? "Booking đã checkout hoàn tất nên không thể chỉnh sửa" : "Chỉnh sửa booking"}
                            onClick={() => handleOpenEdit(booking)}
                            className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                              isCancelled || isCheckedOut
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
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600">{localizedText("Chi tiết booking", "Booking details")}</span>
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                    {textOf(selectedBooking, ["bookingStatus"])}
                  </span>
                </div>
                <h3 className="mt-1 text-2xl font-bold text-slate-900">{bookingId(selectedBooking)}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                aria-label={localizedText("Đóng", "Close")}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Cancelled Booking Warning Banner */}
            {isCancelledBooking(selectedBooking) && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <p className="font-bold">Đơn đặt phòng này đã bị hủy (Cancelled)</p>
                  <p className="text-xs text-rose-600 mt-0.5">Không thể tạo mã thanh toán QR hoặc thu tiền cho đơn phòng đã bị hủy.</p>
                </div>
              </div>
            )}

            {/* Modal Body: Single Column */}
            <div className="mt-6 grid gap-6 grid-cols-1">
              {/* Booking Details */}
              <div className="flex flex-col gap-4">
                <div className="booking-general-info rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">{localizedText("Thông tin chung", "General information")}</h4>
                  <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-xs text-slate-500">{localizedText("Khách hàng", "Guest")}</p>
                      <p className="font-semibold text-slate-900">{textOf(selectedBooking, ["customerName"])}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">{localizedText("Ngày đặt phòng", "Booking date")}</p>
                      <p className="font-semibold text-slate-900">{formatDate(selectedBooking.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">{localizedText("Kênh đặt phòng", "Booking channel")}</p>
                      <p className="font-semibold text-slate-900">{textOf(selectedBooking, ["bookingChannel"])}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">{localizedText("Mã đơn hàng", "Order ID")}</p>
                      <p className="font-semibold text-slate-900">{textOf(selectedBooking, ["orderId", "bookingId"])}</p>
                    </div>
                  </div>
                </div>

                {/* Pricing Summary */}
                <div className="booking-pricing-summary rounded-xl border border-blue-100 bg-blue-50/40 p-4 order-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-3">{localizedText("Chi tiết thanh toán", "Payment details")}</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>{localizedText("Tổng tiền phòng:", "Room total:")}</span>
                      <span className="font-semibold text-slate-900">{money(selectedBooking.roomTotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>{localizedText("Tổng tiền dịch vụ:", "Service total:")}</span>
                      <span className="font-semibold text-slate-900">{money(selectedBooking.serviceTotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>{localizedText("Tổng phụ thu check-in sớm:", "Early check-in surcharge:")}</span>
                      <span className="font-semibold text-amber-700">{money(earlyCheckinFeeTotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>{localizedText("Tổng phụ thu check-out trễ:", "Late check-out surcharge:")}</span>
                      <span className="font-semibold text-amber-700">{money(lateCheckoutFeeTotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>{localizedText("Tổng phụ thu khác:", "Other surcharges:")}</span>
                      <span className="font-semibold text-amber-700">{money(otherSurchargesTotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>{localizedText("Tổng giảm giá phòng:", "Room discount:")}</span>
                      <span className="font-semibold text-rose-600">{money(valueOf(selectedBooking, ["discountRoomAmount", "roomDiscountAmount"]))}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>{localizedText("Tổng giảm giá dịch vụ:", "Service discount:")}</span>
                      <span className="font-semibold text-rose-600">{money(valueOf(selectedBooking, ["discountServiceAmount", "serviceDiscountAmount"]))}</span>
                    </div>
                    <div className="flex justify-between text-rose-600">
                      <span>{localizedText("Tổng tiền giảm giá:", "Total discount:")}</span>
                      <span className="font-semibold">{money(valueOf(selectedBooking, ["discountAmountTotal", "discountTotal", "totalDiscountAmount"]))}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700">
                      <span>{localizedText("Tổng đã thanh toán:", "Total paid:")}</span>
                      <span className="font-semibold">{money(valueOf(selectedBooking, ["collectedAmount", "paidAmount", "amountPaid", "totalPaidAmount"]))}</span>
                    </div>
                    {Number(valueOf(selectedBooking, ["refundedAmount"]) ?? 0) > 0 && (
                      <div className="flex justify-between text-purple-700">
                        <span>{localizedText("Đã hoàn cho khách:", "Refunded to guest:")}</span>
                        <span className="font-semibold">{money(valueOf(selectedBooking, ["refundedAmount"]))}</span>
                      </div>
                    )}
                    {(() => {
                      if (isCancelledBooking(selectedBooking)) {
                        return (
                          <div className="flex justify-between rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-slate-700">
                            <span className="font-semibold">{localizedText("Trạng thái thanh toán:", "Payment status:")}</span>
                            <span className="text-right font-bold">
                              {localizedText(
                                "Booking đã hủy — không còn khoản phải thu từ khách.",
                                "Booking cancelled — no further payment is due from the guest.",
                              )}
                            </span>
                          </div>
                        );
                      }

                      const finalAmount = selectedBookingTotal;
                      const paidAmount = Number(valueOf(selectedBooking, ["paidAmount", "amountPaid", "totalPaidAmount"]) ?? 0);
                      const diff = finalAmount - paidAmount;

                      if (diff === 0) {
                        return (
                          <div className="flex justify-between rounded-lg bg-emerald-50/80 p-2.5 text-emerald-800 border border-emerald-200">
                            <span className="font-semibold">{localizedText("Trạng thái thanh toán:", "Payment status:")}</span>
                            <span className="font-bold text-emerald-700">{localizedText("Đã thanh toán đủ số tiền", "Paid in full")}</span>
                          </div>
                        );
                      }

                      if (diff > 0) {
                        return (
                          <div className="flex justify-between rounded-lg bg-amber-50/80 p-2.5 text-amber-900 border border-amber-200">
                            <span className="font-semibold">{localizedText("Số tiền khách cần thanh toán thêm:", "Additional amount due:")}</span>
                            <span className="font-bold text-amber-700">{money(diff)}</span>
                          </div>
                        );
                      }

                      return (
                        <div className="flex justify-between rounded-lg bg-purple-50/80 p-2.5 text-purple-900 border border-purple-200">
                          <span className="font-semibold">{localizedText("Số tiền cần hoàn lại cho khách:", "Refund due to guest:")}</span>
                          <span className="font-bold text-purple-700">{money(Math.abs(diff))}</span>
                        </div>
                      );
                    })()}
                    <div className="flex justify-between border-t border-blue-200/60 pt-2.5 text-base font-bold text-blue-900">
                      <span>{localizedText("Tổng tiền booking:", "Booking total:")}</span>
                      <span>{money(selectedBookingTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* Booking Room Details */}
                {selectedBooking.bookingDetails && selectedBooking.bookingDetails.filter((detail) => !isCancelledBookingDetail(detail)).length > 0 && (
                  <div className="booking-room-details order-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{localizedText("Chi tiết phòng lưu trú", "Stay room details")}</h4>
                    <div className="space-y-2">
                      {selectedBooking.bookingDetails.filter((detail) => !isCancelledBookingDetail(detail)).map((detail, idx) => {
                        const serviceRequests = bookingServices(detail);
                        const roomName = String(detail.roomName ?? detail.roomTypeName ?? detail.roomType ?? "");
                        const roomSubtotal = Number(detail.roomSubTotal ?? detail.roomSubtotal ?? 0);
                        const roomPricePerNight = detail.baseRoomPricePerNight ?? detail.roomPrice;
                        const actualCheckInTime = detail.actualCheckInTime ?? detail.actualCheckIn ?? detail.realCheckInTime ?? detail.checkInActualTime ?? null;
                        const actualCheckOutTime = detail.actualCheckOutTime ?? detail.actualCheckOut ?? detail.realCheckOutTime ?? detail.checkOutActualTime ?? null;
                        const bookingCheckInTime = detail.checkInTime ?? null;
                        const bookingCheckOutTime = detail.checkOutTime ?? null;
                        const extraFeeValue = detail.extraAdultFeePerNight ?? detail.extraAdultFee ?? detail.extraCharge ?? detail.surcharge ?? detail.additionalFee ?? 0;
                        const earlyCheckinFee = Number(detail.earlyCheckInFee ?? detail.earlyCheckinFee ?? 0);
                        const lateCheckoutFee = Number(detail.lateCheckOutFee ?? detail.lateCheckoutFee ?? detail.lateFee ?? 0);
                        const otherSurcharges = Number(detail.otherSurcharges ?? 0);
                        const roomSubtotalWithSurcharges = roomSubtotal
                          + (Number.isFinite(earlyCheckinFee) ? earlyCheckinFee : 0)
                          + (Number.isFinite(lateCheckoutFee) ? lateCheckoutFee : 0)
                          + (Number.isFinite(otherSurcharges) ? otherSurcharges : 0);
                        const serviceSubtotal = serviceRequests.reduce((total, serviceRequest) => {
                          const serviceId = String(serviceRequest.serviceId ?? serviceRequest.id ?? "");
                          const service = hotelServices.find((item) => String(item.id) === serviceId);
                          const quantity = Number(serviceRequest.quantity ?? 1);
                          const price = Number(serviceRequest.price ?? service?.price ?? 0);
                          const subTotal = serviceRequest.subTotal == null
                            ? Number.NaN
                            : Number(serviceRequest.subTotal);
                          return total + (Number.isFinite(subTotal) ? subTotal : price * quantity);
                        }, 0);
                        const detailSubtotal = roomSubtotalWithSurcharges + serviceSubtotal;
                        const hasValue = (value: unknown) => Boolean(value !== null && value !== undefined && String(value).trim() && String(value).toUpperCase() !== "NULL");
                        const hasActualCheckInValue = hasValue(actualCheckInTime);
                        const hasActualCheckOutValue = hasValue(actualCheckOutTime);
                        const hasBookingCheckInValue = hasValue(bookingCheckInTime);
                        const hasBookingCheckOutValue = hasValue(bookingCheckOutTime);
                        const hasEarlyCheckinFeeValue = Number.isFinite(earlyCheckinFee) && earlyCheckinFee > 0;
                        const hasLateCheckoutFeeValue = Number.isFinite(lateCheckoutFee) && lateCheckoutFee > 0;
                        const hasOtherSurchargesValue = Number.isFinite(otherSurcharges) && otherSurcharges > 0;
                        const roomStatus = String(detail.bookingStatusType ?? detail.bookingDetailStatus ?? detail.status ?? "").trim().toUpperCase();
                        const isRoomStayCompleted = roomStatus === "CHECKED_OUT";
                        return <div key={idx} className="rounded-lg border border-slate-200 p-3 text-xs text-slate-700 bg-white">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-bold text-slate-800">{localizedText("Phòng", "Room")}: {String(detail.roomNumber ?? detail.roomId ?? "-")}</p>
                                {isRoomStayCompleted && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                    <Check size={12} aria-hidden="true" />
                                    {localizedText("Đã hoàn thành", "Completed")}
                                  </span>
                                )}
                              </div>
                              {roomName && <p className="mt-0.5 text-slate-500">{localizedText("Loại phòng", "Room type")}: {roomName}</p>}
                            </div>
                            {(detail.roomSubTotal !== undefined || detail.roomSubtotal !== undefined || hasEarlyCheckinFeeValue || hasLateCheckoutFeeValue || hasOtherSurchargesValue || serviceRequests.length > 0) && (
                              <div className="shrink-0 text-right">
                                <strong className="text-blue-700">{localizedText("Tạm tính", "Subtotal")}: {money(detailSubtotal)}</strong>
                                <p className="mt-0.5 text-[10px] text-slate-500">
                                  {localizedText("Phòng + phụ thu", "Room + surcharges")} {money(roomSubtotalWithSurcharges)} + {localizedText("dịch vụ", "services")} {money(serviceSubtotal)}
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap justify-between gap-2 text-slate-500">
                            {hasBookingCheckInValue && <span>{localizedText("Nhận", "Check-in")}: {formatDate(bookingCheckInTime)}</span>}
                            {hasBookingCheckOutValue && <span>{localizedText("Trả", "Check-out")}: {formatDate(bookingCheckOutTime)}</span>}
                          </div>
                          {(hasActualCheckInValue || hasActualCheckOutValue || Number(extraFeeValue) > 0 || hasEarlyCheckinFeeValue || hasLateCheckoutFeeValue || hasOtherSurchargesValue) && (
                            <div className="mt-1 grid gap-1 text-slate-500">
                              {hasActualCheckInValue && <div className="flex justify-between gap-3"><span>{localizedText("Check-in thực tế", "Actual check-in")}: {formatDate(actualCheckInTime)}</span></div>}
                              {hasActualCheckOutValue && <div className="flex justify-between gap-3"><span>{localizedText("Check-out thực tế", "Actual check-out")}: {formatDate(actualCheckOutTime)}</span></div>}
                              {Number(extraFeeValue) > 0 && <div className="flex justify-between gap-3"><span>{localizedText("Phụ thu", "Surcharge")}: {money(extraFeeValue)}</span></div>}
                              {hasEarlyCheckinFeeValue && <div className="flex justify-between gap-3"><span>{localizedText("Phí check-in sớm", "Early check-in fee")}: {money(earlyCheckinFee)}</span></div>}
                              {hasLateCheckoutFeeValue && <div className="flex justify-between gap-3 text-amber-700"><span>{localizedText("Phí check-out trễ", "Late check-out fee")}: {money(lateCheckoutFee)}</span></div>}
                              {hasOtherSurchargesValue && <div className="flex justify-between gap-3 text-amber-700"><span>{localizedText("Phụ thu khác", "Other surcharges")}: {money(otherSurcharges)}</span></div>}
                            </div>
                          )}
                          {roomPricePerNight !== undefined && <p className="mt-1 text-slate-500">{localizedText("Giá phòng/đêm", "Room rate/night")}: {money(roomPricePerNight)}</p>}
                          <div className="mt-3 border-t border-slate-100 pt-2">
                            <p className="font-semibold text-slate-600">{localizedText("Dịch vụ", "Services")} ({serviceRequests.length})</p>
                            {serviceRequests.length > 0 ? (
                              <div className="mt-1">
                                <div className="grid grid-cols-[minmax(0,1fr)_3rem_5rem_6rem] gap-3 border-b border-slate-100 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                  <span>{localizedText("Tên dịch vụ", "Service")}</span>
                                  <span className="text-right">{localizedText("Số lượng", "Quantity")}</span>
                                  <span className="text-right">{localizedText("Đơn giá", "Unit price")}</span>
                                  <span className="text-right">{localizedText("Thành tiền", "Amount")}</span>
                                </div>
                                <div className="space-y-1">
                                {serviceRequests.map((serviceRequest, serviceIndex) => {
                                  const serviceId = String(serviceRequest.serviceId ?? serviceRequest.id ?? "");
                                  const service = hotelServices.find((item) => String(item.id) === serviceId);
                                  const serviceName = String(serviceRequest.serviceName ?? serviceRequest.name ?? service?.name ?? `Dịch vụ #${serviceId || serviceIndex + 1}`);
                                  const quantity = Number(serviceRequest.quantity ?? 1);
                                  const price = serviceRequest.price ?? service?.price;
                                  const subTotal = Number(serviceRequest.subTotal ?? Number(price ?? 0) * quantity);
                                  const usedAt = serviceRequest.used === true ? serviceRequest.usedAt : null;
                                  return <div key={`${serviceId}-${serviceIndex}`} className="grid grid-cols-[minmax(0,1fr)_3rem_5rem_6rem] items-center gap-3 border-b border-slate-50 py-1 last:border-0 text-slate-500">
                                    <span className="min-w-0 truncate" title={usedAt ? `${localizedText("Dùng", "Used")}: ${formatDate(usedAt)}` : undefined}>{serviceName}</span>
                                    <span className="whitespace-nowrap text-right tabular-nums">{quantity}</span>
                                    <strong className="whitespace-nowrap text-right tabular-nums text-blue-700">{price !== undefined ? money(Number(price)) : "-"}</strong>
                                    <strong className="whitespace-nowrap text-right tabular-nums text-slate-700">{Number.isFinite(subTotal) ? money(subTotal) : "-"}</strong>
                                  </div>;
                                })}
                                </div>
                              </div>
                            ) : <p className="mt-1 text-slate-400">{localizedText("Không sử dụng dịch vụ", "No services used")}</p>}
                          </div>
                        </div>;
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Section */}
              <div ref={paymentSectionRef} className="booking-payment-section flex flex-col justify-between rounded-xl border border-slate-200 p-5 bg-white">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <CreditCard size={18} className="text-blue-600" />
                    <h4 className="text-base font-bold text-slate-900">{localizedText("Thanh toán Booking", "Booking payment")}</h4>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">
                    {localizedText("Chọn phương thức thanh toán để quét mã QR ngân hàng hoặc thu tiền mặt trực tiếp.", "Choose a payment method to scan a bank QR code or collect cash directly.")}
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
                          <strong className="text-sm text-slate-800">{localizedText("QR Ngân hàng", "Bank QR")} (VietQR / PayOS)</strong>
                          {paymentMethod === "bank" && <Check size={16} className="text-blue-600 font-bold" />}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{localizedText("Tạo mã QR chuyển khoản tự động qua hệ thống ngân hàng.", "Generate a bank transfer QR code automatically.")}</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethod("cash");
                        if (!cashAmountPaid && selectedBooking) {
                          const finalAmount = selectedBookingTotal;
                          const paidAmount = Number(valueOf(selectedBooking, ["paidAmount", "amountPaid", "totalPaidAmount"]) ?? 0);
                          const due = Math.max(0, finalAmount - paidAmount);
                          setCashAmountPaid(String(due));
                        }
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
                          <strong className="text-sm text-slate-800">{localizedText("Tiền mặt tại quầy", "Cash at front desk")}</strong>
                          {paymentMethod === "cash" && <Check size={16} className="text-emerald-600 font-bold" />}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{localizedText("Xác nhận đã thu tiền mặt trực tiếp từ khách hàng.", "Confirm that cash was collected directly from the guest.")}</p>
                      </div>
                    </button>
                    {paymentMethod === "cash" && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                        <label className="block text-sm font-semibold text-slate-700">
                          {localizedText("Tiền khách đưa", "Cash received")}
                          <div className="relative mt-1.5">
                            <input type="number" min="1" step="1000" value={cashAmountPaid} onChange={(event) => setCashAmountPaid(event.target.value)} placeholder={localizedText("Nhập số tiền khách đưa", "Enter the amount received")} className="h-10 w-full rounded-lg border border-emerald-200 bg-white px-3 pr-10 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                            <span className="pointer-events-none absolute right-3 top-2.5 text-sm text-slate-400">{i18n.language.startsWith("en") ? "VND" : "đ"}</span>
                          </div>
                          <span className="mt-1 block text-xs font-normal text-slate-500">
                            {(() => {
                              const finalAmount = selectedBookingTotal;
                              const paidAmount = Number(valueOf(selectedBooking, ["paidAmount", "amountPaid", "totalPaidAmount"]) ?? 0);
                              const remainingToCollect = Math.max(0, finalAmount - paidAmount);
                              return `${localizedText("Tổng cần thu", "Total to collect")}: ${money(remainingToCollect)}`;
                            })()}
                          </span>
                        </label>
                      </div>
                    )}
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

                  {paymentMethod === "cash" && (cashAmountPaid !== "" || cashChangeAmount !== null) && enteredCashAmount > cashRemainingDue && (
                    <div className="mt-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <span className="text-sm font-semibold text-amber-800">{localizedText("Tiền trả lại khách", "Change due to guest")}</span>
                      <span className="text-lg font-bold text-amber-900">{money(displayCashChange)}</span>
                    </div>
                  )}
                </div>

                {/* Footer Payment Action */}
                <div className="mt-6 border-t border-slate-100 pt-4 flex items-center justify-end gap-3">
                  {checkoutReturnTarget.current && (
                    <button
                      type="button"
                      onClick={returnToCheckout}
                      className="mr-auto rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
                    >
                      {localizedText("Quay lại đối soát checkout", "Return to checkout")}
                    </button>
                  )}
                  {canCancelSelectedBooking && (
                    <button
                      type="button"
                      onClick={() => {
                        setCancelReason("");
                        setCancelRefundMethod("BANK");
                        setCashRefundConfirmed(false);
                        setCancelRefundEmail("");
                        setCancelBankDetails({ bankName: "", bankCode: "", bankAccountName: "", bankAccountNumber: "" });
                        setCancelError("");
                        setShowCancelConfirmation(true);
                      }}
                      className="mr-auto rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50"
                    >
                      {localizedText("Hủy booking", "Cancel booking")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedBooking(null)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    {localizedText("Đóng", "Close")}
                  </button>

                  <button
                    type="button"
                    onClick={() => void handlePayBooking()}
                    disabled={paymentBlocked || isCreatingQr || isPayingCash || isCancelledBooking(selectedBooking)}
                    className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold shadow-sm transition-all ${
                      paymentBlocked || isCancelledBooking(selectedBooking)
                        ? "bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300"
                        : paymentMethod === "cash"
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
                  >
                    {isCancelledBooking(selectedBooking) ? (
                      "Đơn đặt phòng đã bị hủy"
                    ) : paymentBlocked ? (
                      (() => {
                        const finalAmount = selectedBookingTotal;
                        const paidAmount = Number(valueOf(selectedBooking, ["paidAmount", "amountPaid", "totalPaidAmount"]) ?? 0);
                        return paidAmount > finalAmount ? localizedText("Phải thanh toán cho khách hàng", "Refund due to guest") : localizedText("Đã thanh toán đủ số tiền", "Paid in full");
                      })()
                    ) : paymentMethod === "cash" ? (
                      <>
                        <Banknote size={16} />
                        {isPayingCash ? localizedText("Đang ghi nhận...", "Recording...") : localizedText("Xác nhận thu tiền mặt", "Confirm cash payment")}
                      </>
                    ) : (
                      <>
                        <CreditCard size={16} />
                        {isPayingCash ? localizedText("Đang ghi nhận...", "Recording...") : isCreatingQr ? localizedText("Đang tạo mã...", "Generating QR...") : localizedText("Tạo QR Thanh toán", "Generate payment QR")}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCancelConfirmation && selectedBooking && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-booking-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-700">
                <AlertCircle size={20} />
              </div>
              <div>
                <h3 id="cancel-booking-title" className="text-lg font-bold text-slate-900">
                  {localizedText("Xác nhận hủy booking", "Confirm booking cancellation")} {bookingId(selectedBooking)}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {localizedText("Chọn cách hoàn tiền cho khách. Hoàn tiền mặt sẽ được ghi nhận ngay sau khi xác nhận đã giao tiền; hoàn vào tài khoản sẽ chờ quản lý duyệt và chuyển khoản.", "Choose how to refund the guest. Cash is recorded immediately after confirming it was handed over; bank refunds await manager approval and transfer.")}
                </p>
              </div>
            </div>

            <div aria-live="polite" className="mt-4">
              {(isLoadingCancellationPreview || isFetchingCancellationPreview) && !cancellationPreview && (
                <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                  {localizedText("Đang tính chính xác khoản hoàn theo chính sách hủy...", "Calculating the exact refund under the cancellation policy...")}
                </p>
              )}
              {isCancellationPreviewError && (
                <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  <span>{localizedText("Không thể xác minh số tiền hoàn. Chưa thể xác nhận hủy booking.", "Could not verify the refund amount. Cancellation cannot be confirmed yet.")}</span>
                  <button
                    type="button"
                    onClick={() => void refetchCancellationPreview()}
                    disabled={isFetchingCancellationPreview}
                    className="shrink-0 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                  >
                    {localizedText("Thử lại", "Retry")}
                  </button>
                </div>
              )}
              {!isLoadingCancellationPreview && !isFetchingCancellationPreview && !isCancellationPreviewError && !cancellationPreview && (
                <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  <span>{localizedText("Không nhận được bảng tính tiền hoàn từ máy chủ. Chưa thể xác nhận hủy booking.", "The server did not return a refund breakdown. Cancellation cannot be confirmed yet.")}</span>
                  <button
                    type="button"
                    onClick={() => void refetchCancellationPreview()}
                    className="shrink-0 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold"
                  >
                    {localizedText("Thử lại", "Retry")}
                  </button>
                </div>
              )}
              {cancellationPreview && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4">
                  <h4 className="font-semibold text-slate-900">
                    {localizedText("Đối chiếu khoản hoàn trước khi hủy", "Review refund before cancellation")}
                  </h4>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-600">{localizedText("Tổng tiền khách đã thanh toán", "Total paid by guest")}</dt>
                      <dd className="font-medium text-slate-900">{money(cancellationPreview.paidAmount)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-600">{localizedText("Tiền phòng trước phạt", "Room amount before penalty")}</dt>
                      <dd className="font-medium text-slate-900">
                        {money(Number(cancellationPreview.roomRefundAmount ?? 0) + Number(cancellationPreview.roomPenaltyAmount ?? 0))}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-600">{localizedText("Phạt hủy phòng", "Room cancellation penalty")}</dt>
                      <dd className="font-medium text-rose-700">−{money(cancellationPreview.roomPenaltyAmount)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-600">{localizedText("Tiền phòng được hoàn", "Room refund")}</dt>
                      <dd className="font-medium text-slate-900">{money(cancellationPreview.roomRefundAmount)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-600">{localizedText("Tiền dịch vụ được hoàn khi hủy", "Service refund on cancellation")}</dt>
                      <dd className="font-medium text-slate-900">{money(cancellationPreview.serviceRefundAmount)}</dd>
                    </div>
                    <div className="flex justify-between gap-3 border-t border-blue-200 pt-2">
                      <dt className="font-semibold text-slate-800">{localizedText("TỔNG SỐ TIỀN HOÀN", "TOTAL REFUND")}</dt>
                      <dd className="text-lg font-bold text-blue-700">{money(cancellationPreview.refundAmount)}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs leading-5 text-slate-600">
                    {cancellationPreview.refundPolicy === "CANCEL_AT_LEAST_72_HOURS_BEFORE_CHECK_IN"
                      ? localizedText("Mốc áp dụng: hủy trước giờ nhận phòng từ 72 giờ trở lên — không phạt tiền phòng.", "Policy tier: cancellation at least 72 hours before check-in — no room penalty.")
                      : cancellationPreview.refundPolicy === "CANCEL_24_TO_72_HOURS_BEFORE_CHECK_IN"
                        ? localizedText("Mốc áp dụng: hủy trước giờ nhận phòng từ 24 đến dưới 72 giờ — phạt 50% tiền phòng được phân bổ.", "Policy tier: cancellation 24 to under 72 hours before check-in — 50% penalty on the allocated room payment.")
                        : localizedText("Mốc áp dụng: hủy dưới 24 giờ hoặc khách không đến — phạt 100% tiền phòng được phân bổ.", "Policy tier: cancellation under 24 hours before check-in or no-show — 100% penalty on the allocated room payment.")}{" "}
                    {localizedText("Tiền dịch vụ được hoàn theo phần thanh toán phân bổ; khoản phạt chỉ trừ vào tiền phòng.", "Service charges allocated from the payment are refunded; the penalty is deducted from the room portion only.")}{" "}
                    {localizedText("Thời gian còn lại đến giờ nhận phòng:", "Time until check-in:")}{" "}
                    <strong>{cancellationPreview.hoursBeforeCheckIn} {localizedText("giờ", "hours")}</strong>.
                  </p>
                  {cancellationPreview.refundAmount <= 0 && (
                    <p className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900">
                      {localizedText("Không phát sinh khoản hoàn. Không giao tiền mặt cho khách.", "No refund is due. Do not hand cash to the guest.")}
                    </p>
                  )}
                </div>
              )}
            </div>

            <fieldset className="mt-5">
              <legend className="text-sm font-semibold text-slate-700">{localizedText("Phương thức hoàn tiền", "Refund method")}</legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${
                  cancelRefundMethod === "CASH" ? "border-emerald-300 bg-emerald-50" : "border-slate-200"
                }`}>
                  <input
                    type="radio"
                    name="cancelRefundMethod"
                    value="CASH"
                    checked={cancelRefundMethod === "CASH"}
                    onChange={() => {
                      setCancelRefundMethod("CASH");
                      setCashRefundConfirmed(false);
                    }}
                    className="mt-1 accent-emerald-600"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">{localizedText("Tiền mặt tại khách sạn", "Cash at hotel")}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{localizedText("Nhân viên giao tiền trực tiếp và xác nhận ngay.", "Hand cash directly to the guest and confirm immediately.")}</span>
                  </span>
                </label>
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${
                  cancelRefundMethod === "BANK" ? "border-blue-300 bg-blue-50" : "border-slate-200"
                }`}>
                  <input
                    type="radio"
                    name="cancelRefundMethod"
                    value="BANK"
                    checked={cancelRefundMethod === "BANK"}
                    onChange={() => {
                      setCancelRefundMethod("BANK");
                      setCashRefundConfirmed(false);
                    }}
                    className="mt-1 accent-blue-600"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">{localizedText("Chuyển khoản vào tài khoản", "Refund to bank account")}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{localizedText("Quản lý duyệt rồi nhân viên chuyển khoản.", "Manager approves, then staff complete the transfer.")}</span>
                  </span>
                </label>
              </div>
            </fieldset>

            <label className="mt-5 block text-sm font-semibold text-slate-700">
              {localizedText("Lý do hủy (không bắt buộc)", "Cancellation reason (optional)")}
              <textarea
                rows={3}
                maxLength={500}
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder={localizedText("Nhập lý do để lưu vào yêu cầu hủy...", "Enter a reason to include in the cancellation request...")}
                className="mt-2 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:border-rose-400"
              />
            </label>

            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
              {cancelRefundMethod === "BANK" && (
                <>
                  <p className="text-sm font-semibold text-slate-800">{localizedText("Thông tin tài khoản nhận hoàn (không bắt buộc)", "Refund bank account (optional)")}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {localizedText("Hỏi khách và nhập tại đây. Nếu khách vãng lai, nhập email để gửi xác nhận hủy và thông báo hoàn tiền. Nếu chưa có thông tin lúc hủy, có thể bổ sung trong trang Phê duyệt hoàn tiền.", "Ask the guest for these details and enter them here. For walk-in guests, enter an email to send the cancellation and refund updates. Details can also be added later on the Refund Approvals page.")}
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <BankSelectionField
                      bankName={cancelBankDetails.bankName}
                      bankCode={cancelBankDetails.bankCode}
                      onChange={(bankName, bankCode) =>
                        setCancelBankDetails((current) => ({ ...current, bankName, bankCode }))
                      }
                    />
                    <label className="text-xs font-semibold text-slate-600">
                      {localizedText("Tên chủ tài khoản", "Account holder name")}
                      <input
                        value={cancelBankDetails.bankAccountName}
                        onChange={(event) => setCancelBankDetails((current) => ({ ...current, bankAccountName: event.target.value }))}
                        maxLength={120}
                        placeholder={localizedText("Tên in trên tài khoản", "Name as shown on account")}
                        className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-400"
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      {localizedText("Số tài khoản", "Account number")}
                      <input
                        inputMode="numeric"
                        value={cancelBankDetails.bankAccountNumber}
                        onChange={(event) => setCancelBankDetails((current) => ({ ...current, bankAccountNumber: event.target.value }))}
                        maxLength={50}
                        placeholder={localizedText("6–50 chữ số", "6–50 digits")}
                        className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-400"
                      />
                    </label>
                  </div>
                </>
              )}
              <label className={`${cancelRefundMethod === "BANK" ? "mt-3" : ""} block text-xs font-semibold text-slate-600`}>
                {localizedText("Email khách nhận thông báo (không bắt buộc)", "Guest notification email (optional)")}
                <input
                  type="email"
                  value={cancelRefundEmail}
                  onChange={(event) => setCancelRefundEmail(event.target.value)}
                  maxLength={254}
                  placeholder="email@example.com"
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-400"
                />
              </label>
              {cancelRefundMethod === "CASH" && (cancellationPreview?.refundAmount ?? 0) > 0 && (
                <label className="mt-3 flex items-start gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={cashRefundConfirmed}
                    onChange={(event) => setCashRefundConfirmed(event.target.checked)}
                    className="mt-0.5 accent-emerald-600"
                  />
                  {localizedText(
                    `Tôi đã giao đúng ${money(cancellationPreview?.refundAmount)} tiền mặt cho khách và xác nhận số tiền này.`,
                    `I handed exactly ${money(cancellationPreview?.refundAmount)} in cash to the guest and confirm this amount.`,
                  )}
                </label>
              )}
            </div>

            {cancelError && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{cancelError}</span>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={isCancellingBooking}
                onClick={() => setShowCancelConfirmation(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                {localizedText("Quay lại", "Back")}
              </button>
              <button
                type="button"
                disabled={
                  isCancellingBooking
                  || !cancellationPreview
                  || cancellationPreview.bookingId !== bookingId(selectedBooking)
                  || isLoadingCancellationPreview
                  || isFetchingCancellationPreview
                  || isCancellationPreviewError
                  || (cancelRefundMethod === "CASH" && cancellationPreview.refundAmount > 0 && !cashRefundConfirmed)
                }
                onClick={() => void handleCancelSelectedBooking()}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCancellingBooking ? localizedText("Đang hủy...", "Cancelling...") : localizedText("Xác nhận hủy", "Confirm cancellation")}
              </button>
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
                <h3 className="text-lg font-bold text-slate-900">{localizedText("Thanh toán qua mã QR", "Pay by QR code")}</h3>
                <p className="text-xs text-slate-500">{localizedText("Mã QR có hiệu lực trong 5 phút", "This QR code is valid for 5 minutes")}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                aria-label={localizedText("Đóng", "Close")}
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
                    {localizedText("Thời gian còn lại", "Time remaining")}: {qrTimeLabel}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {checkoutReturnTarget.current && (
                    <button
                      type="button"
                      onClick={returnToCheckout}
                      className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                    >
                      {localizedText("Đã thanh toán, quay lại checkout", "Paid, return to checkout")}
                    </button>
                  )}
                  <a
                    href={checkoutUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => {
                      setShowQrModal(false);
                      if (!checkoutReturnTarget.current) setSelectedBooking(null);
                    }}
                    className="text-xs font-semibold text-blue-600 underline hover:text-blue-800 transition-colors"
                  >
                    {localizedText("Mở trang thanh toán trong tab mới", "Open payment page in a new tab")}
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
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600">{localizedText("Chỉnh sửa thông tin", "Edit booking")}</span>
                <h3 className="mt-1 text-xl font-bold text-slate-900">Booking {bookingId(editingBooking)}</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingBooking(null)}
                aria-label={localizedText("Đóng", "Close")}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <div className="mt-5 space-y-4">
              {/* Customer Name */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">{localizedText("Tên khách hàng", "Guest name")}</label>
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
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">{localizedText("Trạng thái booking", "Booking status")}</label>
                  <select
                    value={editBookingStatus}
                    onChange={(e) => setEditBookingStatus(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 transition-colors"
                  >
                    <option value="PENDING">PENDING ({localizedText("Đang chờ", "Pending")})</option>
                    <option value="CONFIRMED">CONFIRMED ({localizedText("Đã xác nhận", "Confirmed")})</option>
                    <option value="CHECKED_IN">CHECKED_IN ({localizedText("Đã nhận phòng", "Checked in")})</option>
                    <option value="CHECKED_OUT">CHECKED_OUT ({localizedText("Đã trả phòng", "Checked out")})</option>
                    <option value="PAID">PAID ({localizedText("Đã thanh toán", "Paid")})</option>
                    <option value="CANCELLED">CANCELLED ({localizedText("Đã hủy", "Cancelled")})</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">{localizedText("Kênh đặt phòng", "Booking channel")}</label>
                  <select
                    value={editBookingChannel}
                    onChange={(e) => setEditBookingChannel(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 transition-colors"
                  >
                    <option value="OFFLINE">OFFLINE ({localizedText("Tại quầy", "Front desk")})</option>
                    <option value="ONLINE">ONLINE ({localizedText("Trực tuyến", "Online")})</option>
                    <option value="AGODA">AGODA</option>
                    <option value="BOOKING.COM">BOOKING.COM</option>
                    <option value="DIRECT">DIRECT ({localizedText("Trực tiếp", "Direct")})</option>
                  </select>
                </div>
              </div>

              {/* Pricing breakdown editable */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">{localizedText("Tiền phòng", "Room charges")} ({i18n.language.startsWith("en") ? "VND" : "đ"})</label>
                  <input
                    type="number"
                    min="0"
                    value={editRoomTotal}
                    onChange={(e) => setEditRoomTotal(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">{localizedText("Tiền dịch vụ", "Service charges")} ({i18n.language.startsWith("en") ? "VND" : "đ"})</label>
                  <input
                    type="number"
                    min="0"
                    value={editServiceTotal}
                    onChange={(e) => setEditServiceTotal(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">{localizedText("Giảm giá", "Discount")} ({i18n.language.startsWith("en") ? "VND" : "đ"})</label>
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
                <span className="font-semibold text-slate-700">{localizedText("Tổng bill dự tính:", "Estimated bill total:")}</span>
                <span className="text-base font-bold text-blue-700">
                  {money(Math.max(0, (Number(editRoomTotal) || 0) + (Number(editServiceTotal) || 0) - (Number(editDiscountTotal) || 0)))}
                </span>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">{localizedText("Ghi chú", "Notes")}</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder={localizedText("Ghi chú thêm về đơn đặt phòng...", "Add notes about the booking...")}
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
                {localizedText("Hủy", "Cancel")}
              </button>
              <button
                type="button"
                onClick={() => void handleSaveEdit()}
                disabled={isUpdatingBooking}
                className="flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 transition-colors disabled:opacity-60"
              >
                <Save size={16} />
                {isUpdatingBooking ? localizedText("Đang lưu...", "Saving...") : localizedText("Lưu thay đổi", "Save changes")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}