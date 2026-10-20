import { toast } from "@/components/ui/use-toast";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import BatchActionDialog from "../components/BatchActionDialog";
import BatchStayCard from "../components/BatchStayCard";
import CheckoutSummary, { getCheckoutOutstandingAmount, getCheckoutSurplusAmount, type CheckoutSummaryRoom } from "../components/CheckoutSummary";
import CheckoutSurplusRefundChoice, { type CheckoutSurplusRefundMethod } from "../components/CheckoutSurplusRefundChoice";
import CheckInOutBookingDetailModal, { type BookingServiceQuantityEdit } from "../components/CheckInOutBookingDetailModal";
import LateCheckoutPreview, { type LateCheckoutRecord } from "../components/LateCheckoutPreview";
import DatePickerPopover from "../components/DatePickerPopover";
import BookingServiceSelector, { type ServiceSelection } from "../components/BookingServiceSelector";
import EarlyLateStayNotice from "../components/EarlyLateStayNotice";
import CheckInOutRecordList, { type DailyRecord, type ServiceCharge } from "../components/CheckInOutRecordList";
import CheckoutInvoice from "../components/CheckoutInvoice";
import { useGetAllServicesQuery } from "../services/serviceApi";
import {
  useBulkCheckInMutation,
  useBulkCheckOutMutation,
  useGetCheckInOutSummaryQuery,
  useGetTodayCheckInsQuery,
  useGetTodayCheckOutsQuery,
  usePrepareBulkCheckOutMutation,
  type CheckoutSurplusRefundMethod as ApiCheckoutSurplusRefundMethod,
  type CheckInOutBookingDetail,
} from "../services/checkInOutApi";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { localizedText } from "../i18n";
import { useGetBookingsByHotelQuery, useGetRoomMatrixQuery, type BookingListItem } from "../services/bookingApi";
import { useModifyBookingMutation, type ManagementBookingModificationRequest } from "../services/managementBookingApi";
import { useGetRoomsByCurrentHotelQuery } from "../services/roomApi";
import { bindHotelSocketEvents } from "../lib/socket";
import { baseApi } from "../services/baseApi";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CreditCard,
  FileText,
  LogIn,
  LogOut,
  Search,
} from "lucide-react";

const toDateParam = (value?: Date) => value
  ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
  : undefined;

const toFiniteAmount = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : undefined;
};

const getCheckInErrorMessage = (error: unknown) => {
  if (error && typeof error === "object" && "data" in error) {
    const data = error.data;
    if (data && typeof data === "object" && "message" in data && typeof data.message === "string") {
      return data.message;
    }
  }
  return "Không thể hoàn tất check-in. Vui lòng thử lại.";
};

const getCheckoutPreparationErrorMessage = (error: unknown) => {
  if (error && typeof error === "object") {
    const data = "data" in error ? error.data : undefined;
    if (data && typeof data === "object" && "message" in data && typeof data.message === "string") {
      return data.message;
    }
    if ("error" in error && typeof error.error === "string") return error.error;
  }
  return "Không thể cập nhật phụ thu check-out trễ. Vui lòng thử lại.";
};

const shiftDay = (dateStr: string, delta: number) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
};

const formatOverdueDuration = (scheduledValue: string, currentValue: string, language: string) => {
  const scheduledTime = new Date(scheduledValue).getTime();
  const currentTime = new Date(currentValue).getTime();
  if (!Number.isFinite(scheduledTime) || !Number.isFinite(currentTime)) return "-";

  const overdueMinutes = Math.max(0, Math.floor((currentTime - scheduledTime) / 60_000));
  const totalHours = Math.floor(overdueMinutes / 60);
  const overdueDays = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = overdueMinutes % 60;
  if (language.startsWith("en")) {
    if (overdueDays > 0) return `${overdueDays} days ${hours} hours ${minutes} minutes`;
    if (totalHours > 0) return `${totalHours} hours ${minutes} minutes`;
    return `${minutes} minutes`;
  }
  if (overdueDays > 0) return `${overdueDays} ngày ${hours} giờ ${minutes} phút`;
  if (totalHours > 0) return `${totalHours} giờ ${minutes} phút`;
  return `${minutes} phút`;
};

const matrixValue = (item: Record<string, unknown>, keys: string[]) => {
  const key = keys.find((candidate) => item[candidate] !== undefined && item[candidate] !== null && item[candidate] !== "");
  return key ? item[key] : undefined;
};

const matrixRoomKey = (item: Record<string, unknown>) => {
  const value = matrixValue(item, ["roomId", "roomID", "room_id", "roomNumber", "roomNo", "roomCode"]);
  return value === undefined ? undefined : String(value);
};

const collectServiceEntries = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) return value.flatMap(collectServiceEntries);
  if (!value || typeof value !== "object") return [];

  const service = value as Record<string, unknown>;
  const nestedService = service.service && typeof service.service === "object"
    ? service.service as Record<string, unknown>
    : undefined;
  const hasServiceId = [service.serviceId, service.serviceID, service.service_id, service.bookingServiceId, service.id, nestedService?.id, nestedService?.serviceId]
    .some((id) => id !== undefined && id !== null && id !== "");
  const hasServiceName = [service.name, service.serviceName, service.nameService, nestedService?.name, nestedService?.serviceName]
    .some((name) => typeof name === "string" && name.trim() !== "");
  const hasServiceQuantity = [service.quantity, service.serviceQuantity, service.quantityService, service.amount, service.count]
    .some((quantity) => quantity !== undefined && quantity !== null);

  if (hasServiceId || (hasServiceName && (nestedService || hasServiceQuantity))) return [service];
  return Object.values(service).flatMap(collectServiceEntries);
};

const filterCheckInOutRecords = (
  records: DailyRecord[],
  query: string,
  flow: DailyRecord["flow"],
) => records
  .filter((record) => {
    const matchesQuery = `${record.guest} ${record.room}`
      .toLowerCase()
      .includes(query.toLowerCase());
    return matchesQuery && record.flow === flow;
  })
  .sort((a, b) => a.time.localeCompare(b.time));

type MatrixBusyItem = {
  roomKey: string;
  bookingId?: string;
  startDate: Date;
  endDate: Date;
  status?: string;
};

const extractMatrixBusyRanges = (matrix: unknown[]): MatrixBusyItem[] => {
  const items: MatrixBusyItem[] = [];

  const walk = (value: unknown, inheritedRoomKey?: string) => {
    if (Array.isArray(value)) {
      value.forEach((item) => walk(item, inheritedRoomKey));
      return;
    }
    if (!value || typeof value !== "object") return;

    const obj = value as Record<string, unknown>;
    const roomKey = matrixRoomKey(obj) ?? inheritedRoomKey;
    const bookingStatus = String(obj.bookingStatus ?? obj.status ?? "").toUpperCase();

    if (bookingStatus === "CANCELLED" || bookingStatus === "CANCELED") return;

    const startVal = matrixValue(obj, ["startDate", "start", "checkInDate", "checkIn", "checkInTime", "checkinTime", "bookingStartDate"]);
    const endVal = matrixValue(obj, ["endDate", "end", "checkOutDate", "checkOut", "checkOutTime", "checkoutTime", "bookingEndDate"]);
    const bId = matrixValue(obj, ["bookingId", "bookingID", "id"]);

    if (roomKey && startVal && endVal) {
      const startDate = new Date(String(startVal));
      const endDate = new Date(String(endVal));
      if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()) && startDate < endDate) {
        items.push({
          roomKey: String(roomKey),
          bookingId: bId ? String(bId) : undefined,
          startDate,
          endDate,
          status: bookingStatus,
        });
      }
    }

    Object.values(obj).forEach((child) => walk(child, roomKey));
  };

  walk(matrix);
  return items;
};

const mapCheckInOutRecord = (detail: CheckInOutBookingDetail, flow: DailyRecord["flow"]): DailyRecord => {
  const roomNumber = String(detail.roomNumber ?? detail.roomId ?? "-");
  const customerName = String(detail.nameCustomer ?? detail.customerName ?? "Chưa cập nhật");
  const identityNumber = [
    detail.cccd,
    detail.customerCccd,
    detail.identityNumber,
    detail.customerIdentityNumber,
    detail.identityCardNumber,
  ].find((value): value is string => typeof value === "string" && value.trim() !== "")?.trim() ?? "";
  const timestamp = flow === "check-in" ? detail.checkInTime : detail.checkOutTime;
  const time = timestamp ? new Date(timestamp).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "-";
  const serviceValues = Object.entries(detail)
    .filter(([key]) => key.toLowerCase().includes("service"))
    .map(([, value]) => value);
  const rawServices = serviceValues
    .map(collectServiceEntries)
    .find((entries) => entries.length > 0) ?? [];
  const services = collectServiceEntries(rawServices).flatMap((service) => {
    if (service.cancelled === true || String(service.cancelled).toLowerCase() === "true" || service.cancelledAt) return [];
    const nestedService = service.service && typeof service.service === "object"
      ? service.service as Record<string, unknown>
      : {};
    const rawServiceId = service.serviceId ?? service.serviceID ?? service.service_id ?? service.bookingServiceId ?? nestedService.serviceId ?? nestedService.serviceID ?? nestedService.id ?? service.id;
    const serviceId = rawServiceId === undefined || rawServiceId === null ? undefined : String(rawServiceId);
    const name = String(service.name ?? service.serviceName ?? service.nameService ?? service.service_name ?? nestedService.name ?? nestedService.serviceName ?? (serviceId ? `Dịch vụ #${serviceId}` : "Dịch vụ"));
    const rawQuantity = service.quantity ?? service.serviceQuantity ?? service.quantityService ?? service.amount ?? service.count ?? 1;
    const parsedQuantity = Number(rawQuantity);
    const quantity = Number.isFinite(parsedQuantity) ? parsedQuantity : 1;
    const rawPrice = service.price ?? service.unitPrice ?? service.servicePrice ?? nestedService.price ?? 0;
    const parsedPrice = Number(rawPrice);
    const price = Number.isFinite(parsedPrice) ? parsedPrice : 0;
    return [{
      serviceId,
      serviceDetailId: String(service.bookingServiceDetailId ?? service.bookingServiceDetailID ?? service.serviceDetailId ?? service.serviceDetailID ?? service.id ?? ""),
      name,
      quantity,
      amount: price * quantity,
      usedAt: typeof service.usedAt === "string" ? service.usedAt : undefined,
      used: service.used === true,
    }];
  });
  const rawPaymentStatus = detail.paymentStatus ?? detail.bookingPaymentStatus ?? detail.paymentStatusType;
  const paymentStatus = String(rawPaymentStatus ?? "").toUpperCase();
  const rawRemainingAmount = detail.remainingAmount ?? detail.remainAmount ?? detail.remain;
  const parsedRemainingAmount = rawRemainingAmount === undefined || rawRemainingAmount === null || rawRemainingAmount === ""
    ? undefined
    : Number(rawRemainingAmount);
  const remainingAmount = parsedRemainingAmount !== undefined && Number.isFinite(parsedRemainingAmount)
    ? parsedRemainingAmount
    : undefined;
  const rawPaidAmount = detail.paidAmount ?? detail.amountPaid ?? detail.totalPaidAmount;
  const parsedPaidAmount = rawPaidAmount === undefined || rawPaidAmount === null || rawPaidAmount === ""
    ? undefined
    : Number(rawPaidAmount);
  const paidAmount = parsedPaidAmount !== undefined && Number.isFinite(parsedPaidAmount)
    ? parsedPaidAmount
    : undefined;
  const surplusAmount = detail.surplusAmount === null ? 0 : toFiniteAmount(detail.surplusAmount);
  const parsedEarlyCheckInFee = Number(detail.earlyCheckInFee ?? detail.earlyCheckinFee ?? 0);
  const earlyCheckInFee = flow === "check-out" && Number.isFinite(parsedEarlyCheckInFee) ? parsedEarlyCheckInFee : 0;
  const parsedEstimatedEarlyCheckInFee = Number(detail.estimatedEarlyCheckInFee ?? 0);
  const estimatedEarlyCheckInFee = Number.isFinite(parsedEstimatedEarlyCheckInFee) ? parsedEstimatedEarlyCheckInFee : 0;
  const rawLateFee = detail.lateCheckOutFee ?? detail.lateCheckoutFee ?? detail.lateFee;
  const parsedLateFee = rawLateFee === undefined || rawLateFee === null || rawLateFee === ""
    ? undefined
    : Number(rawLateFee);
  const lateFee = parsedLateFee !== undefined && Number.isFinite(parsedLateFee) ? parsedLateFee : undefined;
  const lateFeeIncludedInRemainingAmount = lateFee !== undefined && remainingAmount !== undefined;
  const roomAmount = Number(detail.roomSubTotal ?? detail.roomSubtotal ?? detail.roomAmount ?? detail.roomTotal ?? detail.baseRoomPricePerNight ?? detail.roomPrice ?? detail.totalPrice ?? 0);
  const serviceTotal = services.reduce((total, service) => total + service.amount, 0);
  const totalAmount = Number(detail.totalPrice ?? roomAmount + serviceTotal) + earlyCheckInFee;
  const paidValue = detail.roomPaid ?? detail.isPaid ?? detail.paid;
  const roomPaid = remainingAmount !== undefined
    ? remainingAmount <= 0
    : paidAmount !== undefined
      ? paidAmount >= totalAmount
    : typeof paidValue === "boolean"
      ? paidValue
      : ["PAID", "PAYMENT_COMPLETED", "COMPLETED", "DA_THANH_TOAN"].includes(paymentStatus);
  return {
    id: String(detail.bookingDetailId ?? `${detail.bookingId ?? "booking"}-${roomNumber}`),
    bookingId: detail.bookingId,
    guest: customerName,
    phone: String(detail.phone ?? detail.phoneNumber ?? detail.customerPhone ?? ""),
    room: `${roomNumber} · ${detail.roomName ?? detail.roomTypeName ?? "Phòng"}`,
    time,
    checkInAt: detail.checkInTime,
    checkOutAt: detail.checkOutTime,
    status: flow === "check-in" ? "Chờ check-in" : "Đang ở",
    flow,
    guests: Number(detail.numAdults ?? 0) + Number(detail.numChildren ?? 0) + Number(detail.numInfants ?? 0),
    roomAmount,
    totalAmount,
    earlyCheckInFee,
    estimatedEarlyCheckInFee,
    lateFee,
    lateFeeIncludedInRemainingAmount,
    roomPaid,
    paidAmount,
    remainingAmount,
    surplusAmount,
    paymentStatus: paymentStatus || undefined,
    services,
    identityNumber,
  };
};

type RoomDetail = {
  id: string;
  type: string;
  floor: string;
  beds: string;
  size: string;
  view: string;
  rate: string;
  status: string;
  note: string;
  amenities: string[];
};

export default function CheckInOutWorkspace() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryDate = searchParams.get("date");
  const queryFlow = searchParams.get("flow");
  const hotelId = useAppSelector((state) => state.auth.hotelId);
  const employeeId = useAppSelector((state) => state.auth.employeeId);
  const dispatch = useAppDispatch();
  const { data: services = [], isLoading: isServicesLoading, isError: isServicesError } = useGetAllServicesQuery(hotelId ? { hotelId: Number(hotelId), activeOnly: true } : { activeOnly: true });
  const [modifyBooking, { isLoading: isSavingService }] = useModifyBookingMutation();
  const serviceSaveInFlight = useRef(false);
  const { t, i18n } = useTranslation();
  const [activeFlow, setActiveFlow] = useState<DailyRecord["flow"]>(
    queryFlow === "check-out" ? "check-out" : "check-in",
  );
  const [query, setQuery] = useState("");
  const [invoiceBooking, setInvoiceBooking] = useState<BookingListItem | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => {
    if (queryDate && /^\d{4}-\d{2}-\d{2}$/.test(queryDate)) {
      const parsed = new Date(`${queryDate}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  });
  useEffect(() => {
    if (queryDate && /^\d{4}-\d{2}-\d{2}$/.test(queryDate)) {
      const parsed = new Date(`${queryDate}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) setSelectedDate(parsed);
    }
    if (queryFlow === "check-in" || queryFlow === "check-out") setActiveFlow(queryFlow);
  }, [queryDate, queryFlow]);
  const date = toDateParam(selectedDate);
  const {
    data: checkInOutSummary,
    isLoading: isCheckInOutSummaryLoading,
    isError: isCheckInOutSummaryError,
  } = useGetCheckInOutSummaryQuery({ date });
  const checkInQuery = useGetTodayCheckInsQuery(
    { date, status: "PENDING", bookingStatus: "CONFIRMED" },
  );
  const checkOutQuery = useGetTodayCheckOutsQuery(
    { date, status: "CHECKED_IN", bookingStatus: "CONFIRMED" },
  );
  const { data: hotelBookings = [] } = useGetBookingsByHotelQuery(Number(hotelId), {
    skip: !hotelId || Number.isNaN(Number(hotelId)),
  });
  const completedInvoiceBookings = useMemo(() => hotelBookings.filter((booking) => {
    const details = booking.bookingDetails ?? [];
    if (!date || details.length === 0) return false;

    const checkoutDates = details.map((detail) => {
      const status = String(detail.bookingStatusType ?? detail.bookingDetailStatus ?? detail.status ?? "").toUpperCase();
      return ["CHECKED_OUT", "CHECKED-OUT", "CHECKEDOUT", "ĐÃ TRẢ PHÒNG"].includes(status)
        ? String(detail.actualCheckOutTime ?? "").slice(0, 10)
        : "";
    });
    if (checkoutDates.some((checkoutDate) => !checkoutDate)) return false;
    const completedOn = checkoutDates.reduce((latest, checkoutDate) => checkoutDate > latest ? checkoutDate : latest, "");
    const bookingCode = String(booking.bookingId ?? booking.id ?? "");
    const guestName = String(booking.customerName ?? "");
    return completedOn === date && `${bookingCode} ${guestName}`.toLowerCase().includes(query.toLowerCase());
  }), [date, hotelBookings, query]);
  const { data: hotelRooms = [] } = useGetRoomsByCurrentHotelQuery(undefined, {
    skip: !hotelId || Number.isNaN(Number(hotelId)),
  });
  const checkoutFeesByDetailId = useMemo(() => {
    const fees = new Map<string, { earlyCheckInFee?: number; lateFee?: number; lateFeeIncludedInRemainingAmount?: boolean; remainingAmount?: number; paidAmount?: number; surplusAmount?: number }>();
    hotelBookings.forEach((booking) => {
      const rawRemainingAmount = booking.remainingAmount as unknown;
      const parsedRemainingAmount = rawRemainingAmount === undefined || rawRemainingAmount === null || rawRemainingAmount === ""
        ? undefined
        : Number(rawRemainingAmount);
      const remainingAmount = parsedRemainingAmount !== undefined && Number.isFinite(parsedRemainingAmount)
        ? parsedRemainingAmount
        : undefined;
      const paidAmount = toFiniteAmount(booking.paidAmount);
      const finalAmount = toFiniteAmount(booking.finalAmount);
      const surplusAmount = paidAmount !== undefined && finalAmount !== undefined
        ? Math.max(0, paidAmount - finalAmount)
        : undefined;
      (booking.bookingDetails ?? []).forEach((detail) => {
        const detailId = String(detail.bookingDetailId ?? detail.bookingDetailID ?? detail.bookingDetailsId ?? "");
        const rawEarlyFee = detail.earlyCheckInFee ?? detail.earlyCheckinFee;
        const rawLateFee = detail.lateCheckOutFee ?? detail.lateCheckoutFee ?? detail.lateFee;
        const earlyFee = Number(rawEarlyFee);
        const lateFee = Number(rawLateFee);
        const hasLateFee = rawLateFee !== undefined && rawLateFee !== null && rawLateFee !== "";
        if (detailId) {
          fees.set(detailId, {
            earlyCheckInFee: Number.isFinite(earlyFee) ? earlyFee : undefined,
            lateFee: Number.isFinite(lateFee) ? lateFee : undefined,
            lateFeeIncludedInRemainingAmount: hasLateFee && remainingAmount !== undefined,
            remainingAmount,
            paidAmount,
            surplusAmount,
          });
        }
      });
    });
    return fees;
  }, [hotelBookings]);
  const fetchedDepartureRecords = useMemo(() => checkOutQuery.data?.map((detail) => {
    const record = mapCheckInOutRecord(detail, "check-out");
    const fees = checkoutFeesByDetailId.get(record.id);
    const remainingAmount = record.remainingAmount ?? fees?.remainingAmount;
    return {
      ...record,
      earlyCheckInFee: fees?.earlyCheckInFee ?? record.earlyCheckInFee,
      lateFee: fees?.lateFee ?? record.lateFee,
      lateFeeIncludedInRemainingAmount: fees?.lateFeeIncludedInRemainingAmount ?? record.lateFeeIncludedInRemainingAmount,
      remainingAmount,
      paidAmount: record.paidAmount ?? fees?.paidAmount,
      surplusAmount: record.surplusAmount ?? fees?.surplusAmount,
      roomPaid: remainingAmount !== undefined ? remainingAmount <= 0 : record.roomPaid,
    };
  }) ?? [], [checkOutQuery.data, checkoutFeesByDetailId]);

  const todayStr = date ?? toDateParam(new Date()) ?? new Date().toISOString().slice(0, 10);
  const matrixStart = shiftDay(todayStr, -3);
  const matrixEnd = shiftDay(todayStr, 3);
  const { data: matrixData = [] } = useGetRoomMatrixQuery({ startDate: matrixStart, endDate: matrixEnd });

  const [matrixBlockedNotice, setMatrixBlockedNotice] = useState<{
    roomNumbers: string[];
    message: string;
    hasExactRoomList: boolean;
  } | null>(null);

  const checkMatrixCheckInConflict = (record: DailyRecord) => {
    const now = new Date();
    const [hours, minutes] = record.time.split(":").map(Number);
    const scheduled = new Date(now);
    if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
      scheduled.setHours(hours, minutes, 0, 0);
    } else {
      scheduled.setHours(14, 0, 0, 0);
    }

    if (now >= scheduled) return null;

    const recordRoomNumber = record.room.split(" · ")[0].trim();
    const currentBookingId = String(record.bookingId ?? record.id ?? "").trim();
    const busyItems = extractMatrixBusyRanges(matrixData);

    for (const item of busyItems) {
      const isSameRoom = item.roomKey === recordRoomNumber || record.room.includes(item.roomKey);
      if (!isSameRoom) continue;

      if (item.bookingId && currentBookingId && (item.bookingId === currentBookingId || currentBookingId.includes(item.bookingId))) {
        continue;
      }

      if (now < item.endDate && scheduled > item.startDate) {
        const formattedEnd = `${String(item.endDate.getHours()).padStart(2, "0")}:${String(item.endDate.getMinutes()).padStart(2, "0")} ${item.endDate.toLocaleDateString(i18n.language.startsWith("en") ? "en-US" : "vi-VN")}`;
        return {
          roomNumber: recordRoomNumber,
          conflictBookingId: item.bookingId,
          busyStart: item.startDate,
          busyEnd: item.endDate,
          message: localizedText(`Phòng ${recordRoomNumber} đang bận trong ma trận phòng (khách trước lưu trú đến ${formattedEnd}). Hệ thống đã chặn làm thủ tục check-in sớm!`, `Room ${recordRoomNumber} is occupied in the room schedule until ${formattedEnd}. Early check-in has been blocked.`),
        };
      }
    }

    return null;
  };
  const [arrivalState, setArrivalState] = useState<DailyRecord[]>([]);
  const [groupArrivalState, setGroupArrivalState] = useState({
    id: "",
    guest: "",
    phone: "",
    rooms: [] as string[],
    time: "",
    guests: 0,
    status: "Đã check-in",
  });
  const [checkedInGroupRooms, setCheckedInGroupRooms] = useState<string[]>([]);
  const [departureState, setDepartureState] = useState<DailyRecord[]>([]);
  const [lateCheckoutEventRecords, setLateCheckoutEventRecords] = useState<Record<string, LateCheckoutRecord[]>>({});
  const [bookingDetailRecords, setBookingDetailRecords] = useState<DailyRecord[] | null>(null);
  const [roomPreview, setRoomPreview] = useState<{
    record: DailyRecord;
    detail: RoomDetail;
  } | null>(null);
  const [checkoutRecord, setCheckoutRecord] = useState<DailyRecord | null>(
    null,
  );
  const [checkoutPreparation, setCheckoutPreparation] = useState<{ recordId: string; error?: string } | null>(null);
  const checkoutResumeRequested = useRef<string | null>(null);
  const [selectingGroupRoom, setSelectingGroupRoom] = useState(false);
  const [selectedGroupRooms, setSelectedGroupRooms] = useState<string[]>([]);
  const [selectedDepartureIds, setSelectedDepartureIds] = useState<string[]>(
    [],
  );
  const [batchCheckoutOpen, setBatchCheckoutOpen] = useState(false);
  const [batchCheckoutRefundMethods, setBatchCheckoutRefundMethods] = useState<Record<string, CheckoutSurplusRefundMethod>>({});
  const [groupCheckoutOpen, setGroupCheckoutOpen] = useState(false);
  const [groupCheckoutRecords, setGroupCheckoutRecords] = useState<DailyRecord[]>([]);
  const [groupCheckoutRefundMethod, setGroupCheckoutRefundMethod] = useState<CheckoutSurplusRefundMethod | null>(null);
  const [singleCheckoutRefundMethod, setSingleCheckoutRefundMethod] = useState<CheckoutSurplusRefundMethod | null>(null);
  const [warningAction, setWarningAction] = useState<{
    id: string;
    flow: "check-in" | "check-out";
    message: string;
    fee: number;
    records: DailyRecord[];
    roomFees: Array<{ room: string; fee: number }>;
  } | null>(null);
  const [bulkCheckIn, { isLoading: isBulkCheckInLoading }] = useBulkCheckInMutation();
  const [prepareBulkCheckOut] = usePrepareBulkCheckOutMutation();
  const [bulkCheckOut, { isLoading: isBulkCheckOutLoading }] = useBulkCheckOutMutation();
  const [serviceRecord, setServiceRecord] = useState<DailyRecord | null>(null);
  const [serviceSelections, setServiceSelections] = useState<ServiceSelection[]>([]);
  const [serviceRoomSelections, setServiceRoomSelections] = useState<Record<string, ServiceSelection[]>>({});
  const [serviceSelectorRooms, setServiceSelectorRooms] = useState<Array<{ id: string; type: string; guests: number; price: number }>>([]);
  const [serviceModalMode, setServiceModalMode] = useState<"all" | "per-room">("per-room");
  const [serviceAllSelections, setServiceAllSelections] = useState<ServiceSelection[]>([]);
  const [serviceRecordIdsByRoom, setServiceRecordIdsByRoom] = useState<Record<string, string> | null>(null);
  const [recordServices, setRecordServices] = useState<Record<string, ServiceCharge[]>>({});
  const [checkoutClock, setCheckoutClock] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setCheckoutClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (checkInQuery.data) {
      setArrivalState(checkInQuery.data.map((detail) => {
        const record = mapCheckInOutRecord(detail, "check-in");
        const fees = checkoutFeesByDetailId.get(record.id);
        const remainingAmount = record.remainingAmount ?? fees?.remainingAmount;
        return {
          ...record,
          lateFee: fees?.lateFee ?? record.lateFee,
          remainingAmount,
          roomPaid: remainingAmount !== undefined ? remainingAmount <= 0 : record.roomPaid,
        };
      }));
    }
  }, [checkInQuery.data, checkoutFeesByDetailId]);

  useEffect(() => {
    if (checkOutQuery.data) setDepartureState(fetchedDepartureRecords);
  }, [checkOutQuery.data, fetchedDepartureRecords]);
  useEffect(() => {
    const resumeState = location.state && typeof location.state === "object"
      ? (location.state as { resumeCheckout?: unknown }).resumeCheckout
      : undefined;
    if (!resumeState || typeof resumeState !== "object") return;

    const resume = resumeState as { bookingId?: unknown; detailIds?: unknown; mode?: unknown };
    if (typeof resume.bookingId !== "string" || !resume.bookingId) return;
    const detailIds = Array.isArray(resume.detailIds)
      ? resume.detailIds.filter((id): id is string => typeof id === "string")
      : [];
    const mode = resume.mode === "group" ? "group" : "single";
    const resumeKey = `${resume.bookingId}:${mode}:${detailIds.join(",")}`;

    if (checkoutResumeRequested.current !== resumeKey) {
      checkoutResumeRequested.current = resumeKey;
      void checkOutQuery.refetch();
      return;
    }
    if (checkOutQuery.isFetching) return;
    if (checkOutQuery.isError) {
      toast({
        variant: "destructive",
        title: "Không thể làm mới danh sách checkout",
        description: "Vui lòng thử tải lại trang checkout trước khi tiếp tục.",
      });
      navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
      checkoutResumeRequested.current = null;
      return;
    }

    const bookingRecords = fetchedDepartureRecords.filter((record) => record.bookingId === resume.bookingId);
    const records = detailIds.length > 0
      ? bookingRecords.filter((record) => detailIds.includes(record.id))
      : bookingRecords;
    if (records.length > 0) {
      setActiveFlow("check-out");
      if (mode === "group") {
        setGroupCheckoutRecords(records);
        setGroupCheckoutOpen(true);
      } else {
        setCheckoutRecord(records[0]);
      }
    } else {
      toast({
        variant: "destructive",
        title: "Không tìm thấy booking checkout",
        description: "Danh sách phòng có thể đã được cập nhật. Vui lòng chọn booking lại.",
      });
    }
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    checkoutResumeRequested.current = null;
  }, [
    checkOutQuery.data,
    checkOutQuery.isError,
    checkOutQuery.isFetching,
    checkOutQuery.refetch,
    fetchedDepartureRecords,
    location.pathname,
    location.search,
    location.state,
    navigate,
  ]);
  const completedRecordsByDate = useMemo(() => {
    if (!date) return { checkIns: [] as DailyRecord[], checkOuts: [] as DailyRecord[] };

    const checkIns: DailyRecord[] = [];
    const checkOuts: DailyRecord[] = [];
    hotelBookings.forEach((booking) => {
      (booking.bookingDetails ?? []).forEach((detail) => {
        const detailStatus = String(detail.bookingStatusType ?? detail.bookingDetailStatus ?? detail.status ?? "").toUpperCase();
        const bookingId = String(booking.bookingId ?? booking.id ?? "");
        const commonDetail = {
          ...booking,
          ...detail,
          bookingId,
          customerName: booking.customerName,
        } as CheckInOutBookingDetail;

        const actualCheckInTime = String(detail.actualCheckInTime ?? "");
        if (
          actualCheckInTime.slice(0, 10) === date
          && ["CHECKED_IN", "CHECKED_OUT"].includes(detailStatus)
        ) {
          const record = mapCheckInOutRecord(commonDetail, "check-in");
          checkIns.push({
            ...record,
            time: new Date(actualCheckInTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
            status: detailStatus === "CHECKED_OUT" ? "Đã trả phòng" : "Đã check-in",
            checkInAt: actualCheckInTime,
            remainingAmount: booking.remainingAmount,
            roomPaid: booking.remainingAmount !== undefined ? Number(booking.remainingAmount) <= 0 : record.roomPaid,
            historical: true,
          });
        }

        const actualCheckOutTime = String(detail.actualCheckOutTime ?? "");
        if (actualCheckOutTime.slice(0, 10) === date && detailStatus === "CHECKED_OUT") {
          const record = mapCheckInOutRecord(commonDetail, "check-out");
          const remainingAmount = booking.remainingAmount === undefined ? undefined : Number(booking.remainingAmount);
          checkOuts.push({
            ...record,
            time: new Date(actualCheckOutTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
            status: "Đã trả phòng",
            checkOutAt: actualCheckOutTime,
            earlyCheckInFee: Number(detail.earlyCheckInFee ?? 0),
            lateFee: Number(detail.lateCheckOutFee ?? 0),
            remainingAmount,
            paidAmount: booking.paidAmount,
            surplusAmount: commonDetail.surplusAmount === null
              ? 0
              : toFiniteAmount(commonDetail.surplusAmount) ?? (toFiniteAmount(booking.paidAmount) !== undefined && toFiniteAmount(booking.finalAmount) !== undefined
                ? Math.max(0, (toFiniteAmount(booking.paidAmount) ?? 0) - (toFiniteAmount(booking.finalAmount) ?? 0))
                : undefined),
            roomPaid: remainingAmount !== undefined ? remainingAmount <= 0 : record.roomPaid,
            historical: true,
          });
        }
      });
    });

    return { checkIns, checkOuts };
  }, [date, hotelBookings]);
  useEffect(() => {
    if (!hotelId) return;
    bindHotelSocketEvents({
      onLateCheckOutCalendar: (data) => {
        const notification = data && typeof data === "object" ? data as Record<string, unknown> : {};
        const bookingId = String(notification.bookingId ?? "");
        const customerName = String(notification.customerName ?? "Chưa cập nhật");
        const lateRoomDetails = Array.isArray(notification.lateRoomDetails) ? notification.lateRoomDetails : [];
        if (bookingId) {
          const records = lateRoomDetails.flatMap((value): LateCheckoutRecord[] => {
            if (!value || typeof value !== "object") return [];
            const detail = value as Record<string, unknown>;
            const recordId = String(detail.bookingDetailId ?? "");
            if (!recordId) return [];
            const scheduledCheckout = String(detail.scheduledCheckOut ?? "");
            const currentTime = String(detail.currentTime ?? "");
            const surcharge = Number(detail.currentSurcharge);
            return [{
              recordId,
              room: String(detail.roomNumber ?? "-"),
              guest: customerName,
              bookingId,
              scheduledCheckout,
              currentTime,
              overdueDuration: formatOverdueDuration(scheduledCheckout, currentTime, i18n.language),
              level: String(detail.surchargeLevel ?? "Chưa phân loại"),
              currentSurcharge: Number.isFinite(surcharge) ? surcharge : undefined,
            }];
          });
          setLateCheckoutEventRecords((current) => ({ ...current, [bookingId]: records }));
        }
        dispatch(baseApi.util.invalidateTags(["Booking"]));
      },
    });
  }, [dispatch, hotelId, i18n.language]);
  useEffect(() => {
    setLateCheckoutEventRecords({});
  }, [date]);
  const dailyRecords = useMemo<DailyRecord[]>(() => {
    const checkInRecords = arrivalState.map((record) => ({
      ...record,
      flow: "check-in" as const,
    }));
    const completedCheckInRecords = completedRecordsByDate.checkIns.map((record) => ({
      ...record,
      flow: "check-in" as const,
    }));
    const checkOutRecords = departureState.map((record) => ({
      ...record,
      flow: "check-out" as const,
    }));
    const completedCheckOutRecords = completedRecordsByDate.checkOuts.map((record) => ({
      ...record,
      flow: "check-out" as const,
    }));
    return [...checkInRecords, ...completedCheckInRecords, ...checkOutRecords, ...completedCheckOutRecords].sort((a, b) =>
      a.time.localeCompare(b.time),
    );
  }, [arrivalState, departureState, completedRecordsByDate]);
  const lateCheckoutRecords = useMemo<LateCheckoutRecord[]>(() => {
    const now = new Date(checkoutClock);
    const notificationRecords = new Map(
      Object.values(lateCheckoutEventRecords).flat().map((record) => [record.recordId, record]),
    );
    return departureState.flatMap((record) => {
      if (record.status !== "Đang ở") return [];
      const notificationRecord = notificationRecords.get(record.id);
      if (notificationRecord) {
        return [{
          ...notificationRecord,
          currentSurcharge: notificationRecord.currentSurcharge ?? record.lateFee,
        }];
      }
      if (!record.checkOutAt) return [];
      const scheduledCheckout = new Date(record.checkOutAt);
      if (Number.isNaN(scheduledCheckout.getTime()) || scheduledCheckout.getTime() >= checkoutClock) return [];

      const currentTime = new Date(checkoutClock).toISOString();
      const passedDays = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
        - new Date(scheduledCheckout.getFullYear(), scheduledCheckout.getMonth(), scheduledCheckout.getDate()).getTime();
      const level = passedDays > 0 || now.getHours() >= 18
        ? "Sau 18:00"
        : now.getHours() >= 15
          ? "15:00–trước 18:00"
          : "12:30–15:00";

      return [{
        recordId: record.id,
        room: record.room,
        guest: record.guest,
        bookingId: String(record.bookingId ?? record.id),
        scheduledCheckout: record.checkOutAt,
        currentTime,
        overdueDuration: formatOverdueDuration(record.checkOutAt, currentTime, i18n.language),
        level,
        currentSurcharge: record.lateFee,
      }];
    });
  }, [departureState, checkoutClock, lateCheckoutEventRecords, i18n.language]);
  const filtered = filterCheckInOutRecords(dailyRecords, query, activeFlow);
  const isEarlyCheckIn = (record: DailyRecord, now: Date) => {
    const scheduled = record.checkInAt ? new Date(record.checkInAt) : new Date(now);
    if (!record.checkInAt) {
      const [hours, minutes] = record.time.split(":").map(Number);
      if (Number.isFinite(hours) && Number.isFinite(minutes)) scheduled.setHours(hours, minutes, 0, 0);
    }
    return !Number.isNaN(scheduled.getTime()) && now < scheduled;
  };
  const requestCheckIn = async (records: DailyRecord[]) => {
    if (records.length === 0) return;
    const now = new Date();
    const earlyRecords = records.filter((record) => isEarlyCheckIn(record, now));
    for (const record of earlyRecords) {
      const conflict = checkMatrixCheckInConflict(record);
      if (!conflict) continue;
      toast({
        variant: "destructive",
        title: localizedText("Chặn check-in sớm (Trùng ma trận phòng)", "Early check-in blocked (room schedule conflict)"),
        description: conflict.message,
      });
      setMatrixBlockedNotice({ roomNumbers: [conflict.roomNumber], message: conflict.message, hasExactRoomList: true });
      return;
    }
    if (earlyRecords.length === 0) {
      await handleBulkCheckIn(records);
      return;
    }

    const roomFees = records.map((record) => ({
      room: record.room.split(" · ")[0],
      fee: Number.isFinite(Number(record.estimatedEarlyCheckInFee))
        ? Number(record.estimatedEarlyCheckInFee)
        : 0,
    }));
    setWarningAction({
      id: records[0].id,
      flow: "check-in",
      records,
      roomFees,
      fee: roomFees.reduce((total, room) => total + (Number.isFinite(room.fee) ? room.fee : 0), 0),
      message: records.length > 1
        ? localizedText("Các phòng trong đoàn sẽ được check-in cùng lúc. Phụ thu check-in sớm được tính riêng theo từng phòng.", "The group rooms will be checked in together. The early check-in surcharge is calculated separately for each room.")
        : localizedText(`Nếu check-in ngay trước giờ dự kiến ${records[0].time}, khách sẽ cần phụ thu thêm.`, `An additional surcharge applies if the guest checks in before the scheduled time of ${records[0].time}.`),
    });
  };

  const groupedArrivalRecords = Object.values(
    arrivalState.reduce<Record<string, DailyRecord[]>>((groups, record) => {
      const key = String(record.bookingId ?? record.id);
      groups[key] = [...(groups[key] ?? []), record];
      return groups;
    }, {}),
  ).filter((records) => records.length > 1);
  const groupedDepartureRecords = Object.values(
    departureState.reduce<Record<string, DailyRecord[]>>((groups, record) => {
      const key = String(record.bookingId ?? record.id);
      groups[key] = [...(groups[key] ?? []), record];
      return groups;
    }, {}),
  ).map((records) => records.filter((record) => record.status === "Đang ở"))
    .filter((records) => records.length > 1);
  const groupedRecordIds = new Set([
    ...groupedArrivalRecords.flatMap((records) => records.map((record) => record.id)),
    ...groupedDepartureRecords.flatMap((records) => records.map((record) => record.id)),
  ]);

  const handleRecordAction = (record: DailyRecord) => {
    if (record.flow === "check-out") {
      void openCheckout(record);
      return;
    }

    void requestCheckIn([record]);
  };

  const undoRecordAction = (record: DailyRecord) => {
    if (record.flow === "check-in") {
      setArrivalState((current) => current.map((item) => item.id === record.id ? { ...item, status: "Chờ check-in" } : item));
    } else {
      setDepartureState((current) => current.map((item) => item.id === record.id ? { ...item, status: "Đang ở" } : item));
    }
  };

  const normalizeDetailId = (value: string | number | undefined) => {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    return normalized || null;
  };

  const completeRecord = (id: string, flow: "check-in" | "check-out") => {
    if (flow === "check-in") {
      setArrivalState((current) =>
        current.map((item) =>
          item.id === id ? { ...item, status: "Đã check-in" } : item,
        ),
      );
    } else {
      setDepartureState((current) =>
        current.map((item) =>
          item.id === id ? { ...item, status: "Đã trả phòng" } : item,
        ),
      );
    }
  };

  const handleBulkCheckIn = async (records: DailyRecord[]) => {
    const conflicts = records
      .map((record) => checkMatrixCheckInConflict(record))
      .filter((conflict): conflict is NonNullable<ReturnType<typeof checkMatrixCheckInConflict>> => conflict !== null);
    if (conflicts.length > 0) {
      const roomNumbers = [...new Set(conflicts.map((conflict) => conflict.roomNumber))];
      const details = conflicts.map((conflict) => conflict.message);
      const message = details.join("\n");
      toast({
        variant: "destructive",
        title: localizedText(`Không thể check-in sớm ${roomNumbers.length} phòng`, `Cannot check in ${roomNumbers.length} rooms early`),
        description: localizedText(`Phòng bị trùng lịch: ${roomNumbers.join(", ")}`, `Rooms with schedule conflicts: ${roomNumbers.join(", ")}`),
      });
      setMatrixBlockedNotice({ roomNumbers, message, hasExactRoomList: true });
      return;
    }

    const grouped = records.reduce<Record<string, string[]>>((result, record) => {
      const detailId = normalizeDetailId(record.id);
      if (!record.bookingId || detailId === null) return result;
      result[record.bookingId] = [...(result[record.bookingId] ?? []), detailId];
      return result;
    }, {});

    try {
      await Promise.all(
        Object.entries(grouped).map(([bookingId, bookingDetailIds]) =>
          bulkCheckIn({ bookingId, bookingDetailIds }).unwrap(),
        ),
      );
      records.forEach((record) => completeRecord(record.id, "check-in"));
      const first = records[0];
      const bookingLine = `${localizedText("Mã booking", "Booking ID")}: ${first?.bookingId ?? first?.id ?? "-"}`;
      const guestLine = `${localizedText("Khách hàng", "Guest")}: ${first?.guest ?? "-"}`;

      toast({
        variant: "checkin",
        title: localizedText("Check-in thành công", "Check-in successful"),
        description: (
          <div className="space-y-1 text-sm">
            <div className="font-semibold text-slate-800">{bookingLine}</div>
            <div className="text-slate-700">{guestLine}</div>
          </div>
        ),
      });
    } catch (error) {
      console.error("Bulk check-in failed", error);
      const message = getCheckInErrorMessage(error);
      const roomList = message.match(/các phòng\s+(.+?)\s+vì/i)?.[1];
      const requestedRoomNumbers = [...new Set(
        records.map((record) => record.room.split(" · ")[0].trim()).filter(Boolean),
      )];
      const hasExactRoomList = Boolean(roomList);
      setMatrixBlockedNotice({
        roomNumbers: roomList
          ? roomList.split(",").map((room) => room.trim()).filter(Boolean)
          : requestedRoomNumbers,
        message: hasExactRoomList
          ? message
          : `${message}\n\nMáy chủ chưa trả về số phòng bị trùng. Danh sách bên dưới là các phòng trong lượt check-in này, chưa thể xác nhận phòng nào bị trùng.`,
        hasExactRoomList,
      });
      toast({ variant: "destructive", title: localizedText("Check-in thất bại", "Check-in failed"), description: message });
    }
  };

  const handleBulkCheckOut = async (
    records: DailyRecord[],
    refundMethodsByBooking: Record<string, ApiCheckoutSurplusRefundMethod> = {},
  ): Promise<boolean> => {
    if (records.length === 0) return false;
    const outstandingAmount = getCheckoutOutstandingAmount(checkoutRoomsFromRecords(records));
    if (outstandingAmount > 0) {
      toast({
        variant: "destructive",
        title: localizedText("Chưa thể check-out", "Cannot check out yet"),
        description: localizedText(`Khách cần thanh toán đủ ${outstandingAmount.toLocaleString("vi-VN")}đ còn nợ trước khi check-out.`, `The guest must pay the outstanding ${outstandingAmount.toLocaleString("en-US")} VND before check-out.`),
      });
      return false;
    }
    const invalidRecord = records.find((record) => !record.bookingId || normalizeDetailId(record.id) === null);
    if (invalidRecord) {
      toast({
        variant: "destructive",
        title: localizedText("Không thể check-out", "Could not check out"),
        description: localizedText("Thiếu mã booking hoặc mã chi tiết phòng nên chưa gửi được yêu cầu.", "The booking ID or room detail ID is missing, so the request could not be submitted."),
      });
      return false;
    }

    const grouped = records.reduce<Record<string, string[]>>((result, record) => {
      const detailId = normalizeDetailId(record.id);
      if (!record.bookingId || detailId === null) return result;
      result[record.bookingId] = [...(result[record.bookingId] ?? []), detailId];
      return result;
    }, {});

    try {
      await Promise.all(
        Object.entries(grouped).map(([bookingId, bookingDetailIds]) =>
          bulkCheckOut({
            bookingId,
            bookingDetailIds,
            surplusRefundMethod: refundMethodsByBooking[bookingId],
          }).unwrap(),
        ),
      );
      records.forEach((record) => completeRecord(record.id, "check-out"));
      toast({
        variant: "checkout",
        title: localizedText("Check-out thành công", "Check-out successful"),
        description: localizedText(`Đã hoàn tất check-out cho ${records.length} phòng.`, `Check-out completed for ${records.length} rooms.`),
      });
      if (Object.values(refundMethodsByBooking).includes("CASH")) {
        navigate("/refund-approvals");
      }
      return true;
    } catch (error) {
      console.error("Bulk check-out failed", error);
      const responseError = error as { data?: { message?: string; error?: string }; error?: string };
      toast({
        variant: "destructive",
        title: localizedText("Check-out thất bại", "Check-out failed"),
        description: responseError.data?.message ?? responseError.data?.error ?? responseError.error ?? localizedText("Không thể hoàn tất check-out. Vui lòng thử lại.", "Could not complete check-out. Please try again."),
      });
      return false;
    }
  };

  const checkInGroup = (rooms: string[]) => {
    const nextRooms = [...new Set([...checkedInGroupRooms, ...rooms])];
    setCheckedInGroupRooms(nextRooms);
  };

  const toggleGroupRoom = (room: string) => {
    setSelectedGroupRooms((current) =>
      current.includes(room)
        ? current.filter((item) => item !== room)
        : [...current, room],
    );
  };

  const undoGroupRoomCheckIn = (room: string) => {
    setCheckedInGroupRooms((current) =>
      current.filter((item) => item !== room),
    );
    setSelectedGroupRooms((current) => current.filter((item) => item !== room));
    setGroupArrivalState((current) => ({ ...current, status: "Chờ check-in" }));
  };

  const toggleGroupRoomImmediately = (room: string) => {
    if (checkedInGroupRooms.includes(room)) {
      undoGroupRoomCheckIn(room);
    } else {
      checkInGroup([room]);
    }
  };

  const toggleDepartureSelection = (id: string) => {
    setSelectedDepartureIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const confirmBatchCheckout = async () => {
    const selectedRecords = departureState.filter((record) => selectedDepartureIds.includes(record.id));
    const selectedBookingIds = [...new Set(selectedRecords.map((record) => record.bookingId).filter((id): id is string => Boolean(id)))];
    const finalBookingIds = selectedBookingIds.filter((bookingId) =>
      departureState.filter((record) => record.bookingId === bookingId)
        .every((record) => selectedDepartureIds.includes(record.id)),
    );
    const refundBookingIds = finalBookingIds.filter((bookingId) =>
      getCheckoutSurplusAmount(checkoutRoomsFromRecords(selectedRecords.filter((record) => record.bookingId === bookingId))) > 0,
    );
    const completed = selectedRecords.length > 0
      && getCheckoutOutstandingAmount(checkoutRoomsFromRecords(selectedRecords)) === 0
      && refundBookingIds.every((id) => batchCheckoutRefundMethods[id])
      ? await handleBulkCheckOut(selectedRecords, batchCheckoutRefundMethods)
      : false;
    if (completed) {
      setSelectedDepartureIds([]);
      setBatchCheckoutOpen(false);
      setBatchCheckoutRefundMethods({});
    }
  };

  const groupArrivalComplete = groupArrivalState.rooms.every((room) => checkedInGroupRooms.includes(room));

  const groupDialogRooms = groupArrivalState.rooms.map((room) => ({
    id: room,
    label: "Phòng",
    meta: room,
    status: checkedInGroupRooms.includes(room) ? "complete" as const : "pending" as const,
  }));
  const batchDialogRooms = departureState.filter((record) => record.status === "Đang ở").map((record) => ({
    id: record.id,
    bookingId: record.bookingId,
    badge: record.room.split(" · ")[0].slice(-2),
    label: record.guest,
    meta: `Phòng ${record.room.split(" · ")[0]}`,
    status: "pending" as const,
    amount: (record.services || []).reduce((total, service) => total + service.amount, 0) + (record.lateFee || 0),
  }));
  const checkoutRoomsFromRecords = (records: Array<Pick<DailyRecord, "id" | "bookingId" | "guest" | "room" | "roomAmount" | "roomPaid" | "remainingAmount" | "surplusAmount" | "services" | "earlyCheckInFee" | "lateFee" | "lateFeeIncludedInRemainingAmount">>): CheckoutSummaryRoom[] => records.map((record) => ({
    id: record.id,
    bookingId: record.bookingId,
    label: `Phòng ${record.room.split(" · ")[0]} · ${record.guest}`,
    roomAmount: record.roomAmount,
    roomPaid: record.roomPaid,
    remainingAmount: record.remainingAmount,
    surplusAmount: record.surplusAmount,
    services: record.services,
    earlyCheckInFee: record.earlyCheckInFee,
    lateFee: record.lateFee,
    lateFeeIncludedInRemainingAmount: record.lateFeeIncludedInRemainingAmount,
  }));

  const isFinalSingleCheckout = (record: DailyRecord) =>
    departureState.filter((item) => item.bookingId === record.bookingId).length <= 1;
  const singleCheckoutRooms = checkoutRecord ? checkoutRoomsFromRecords([checkoutRecord]) : [];
  const singleCheckoutOutstandingAmount = getCheckoutOutstandingAmount(singleCheckoutRooms);
  const singleCheckoutSurplusAmount = getCheckoutSurplusAmount(singleCheckoutRooms);
  const groupCheckoutSummaryRooms = checkoutRoomsFromRecords(groupCheckoutRecords);
  const groupCheckoutOutstandingAmount = getCheckoutOutstandingAmount(groupCheckoutSummaryRooms);
  const groupCheckoutSurplusAmount = getCheckoutSurplusAmount(groupCheckoutSummaryRooms);
  const groupCheckoutBookingId = groupCheckoutRecords[0]?.bookingId;
  const groupBookingDepartures = departureState.filter((record) => record.bookingId === groupCheckoutBookingId);
  const isFinalGroupCheckout = Boolean(groupCheckoutBookingId)
    && groupBookingDepartures.length > 0
    && groupBookingDepartures.every((record) => groupCheckoutRecords.some((selected) => selected.id === record.id));
  const needsGroupRefundChoice = isFinalGroupCheckout
    && groupCheckoutOutstandingAmount === 0
    && groupCheckoutSurplusAmount > 0;

  const closeSingleCheckout = () => {
    setCheckoutRecord(null);
    setSingleCheckoutRefundMethod(null);
    setCheckoutPreparation(null);
  };

  const openCheckout = async (record: DailyRecord, lateCheckout?: LateCheckoutRecord) => {
    const feeFromPreview = lateCheckout?.currentSurcharge;
    const selectedRecord = feeFromPreview !== undefined && Number.isFinite(feeFromPreview)
      ? { ...record, lateFee: feeFromPreview, lateFeeIncludedInRemainingAmount: false }
      : record;
    setCheckoutRecord(selectedRecord);
    setSingleCheckoutRefundMethod(null);
    setCheckoutPreparation(null);

    const scheduledCheckout = selectedRecord.checkOutAt ? new Date(selectedRecord.checkOutAt).getTime() : Number.NaN;
    if (!selectedRecord.bookingId || !Number.isFinite(scheduledCheckout) || scheduledCheckout >= Date.now()) return;

    setCheckoutPreparation({ recordId: selectedRecord.id });
    try {
      await prepareBulkCheckOut({
        bookingId: selectedRecord.bookingId,
        bookingDetailIds: [selectedRecord.id],
      }).unwrap();
      const refreshedRecords = await checkOutQuery.refetch().unwrap();
      const detail = refreshedRecords.find((item) => String(item.bookingDetailId ?? "") === selectedRecord.id);
      if (!detail) throw new Error("Không tìm thấy phòng sau khi cập nhật phụ thu.");
      const refreshedRecord = mapCheckInOutRecord(detail, "check-out");
      setCheckoutRecord((current) => current?.id === selectedRecord.id
        ? {
          ...current,
          ...refreshedRecord,
          surplusAmount: refreshedRecord.surplusAmount ?? current.surplusAmount,
          lateFeeIncludedInRemainingAmount: true,
        }
        : current);
      setCheckoutPreparation(null);
    } catch (error) {
      const message = getCheckoutPreparationErrorMessage(error);
      setCheckoutPreparation({ recordId: selectedRecord.id, error: message });
      toast({
        variant: "destructive",
        title: "Chưa cập nhật được phụ thu",
        description: message,
      });
    }
  };

  const goToBookingPayment = (
    bookingId?: string,
    records: DailyRecord[] = [],
    mode: "single" | "group" = "single",
  ) => {
    if (!bookingId) {
      toast({
        variant: "destructive",
        title: "Không thể mở thanh toán",
        description: "Booking này chưa có mã booking để chuyển đến trang thanh toán.",
      });
      return;
    }
    const overdueRecords = records.filter((record) => {
      const checkoutTime = record.checkOutAt ? new Date(record.checkOutAt).getTime() : Number.NaN;
      return (Number.isFinite(checkoutTime) && checkoutTime < Date.now()) || (record.lateFee ?? 0) > 0;
    });
    const detailIds = overdueRecords
      .map((record) => normalizeDetailId(record.id))
      .filter((id): id is string => id !== null);
    if (overdueRecords.length > 0 && detailIds.length !== overdueRecords.length) {
      toast({
        variant: "destructive",
        title: "Không thể cập nhật phụ thu",
        description: "Thiếu mã chi tiết phòng nên chưa thể tính phí check-out trễ.",
      });
      return;
    }
    const continueToPayment = () => {
      closeSingleCheckout();
      setGroupCheckoutOpen(false);
      setGroupCheckoutRecords([]);
      navigate("/booking-list", {
        state: {
          checkoutPaymentBookingId: bookingId,
          checkoutReturn: {
            path: `/check-in-out?date=${encodeURIComponent(date)}&flow=check-out`,
            bookingId,
            detailIds: records.map((record) => record.id),
            mode,
          },
        },
      });
    };
    if (detailIds.length > 0) {
      setCheckoutPreparation({ recordId: records[0]?.id ?? "" });
      void prepareBulkCheckOut({ bookingId, bookingDetailIds: detailIds })
        .unwrap()
        .then(() => {
          setCheckoutPreparation(null);
          continueToPayment();
        })
        .catch((error: unknown) => {
          const message = getCheckoutPreparationErrorMessage(error);
          setCheckoutPreparation({ recordId: records[0]?.id ?? "", error: message });
          toast({ variant: "destructive", title: "Không thể cập nhật phụ thu", description: message });
        });
      return;
    }
    continueToPayment();
  };

  const confirmCheckout = async () => {
    if (!checkoutRecord) return;
    if (singleCheckoutOutstandingAmount > 0) return;
    const needsRefundChoice = isFinalSingleCheckout(checkoutRecord) && singleCheckoutSurplusAmount > 0;
    if (needsRefundChoice && !singleCheckoutRefundMethod) return;
    const completed = await handleBulkCheckOut(
      [checkoutRecord],
      needsRefundChoice && checkoutRecord.bookingId && singleCheckoutRefundMethod
        ? { [checkoutRecord.bookingId]: singleCheckoutRefundMethod }
        : {},
    );
    if (completed) {
      setCheckoutRecord(null);
      setSingleCheckoutRefundMethod(null);
    }
  };

  const handleLateCheckout = (lateCheckout: LateCheckoutRecord) => {
    const record = departureState.find((item) => item.id === lateCheckout.recordId);
    if (record) {
      void openCheckout(record, lateCheckout);
      return;
    }
    toast({
      variant: "destructive",
      title: "Không tìm thấy booking",
      description: "Danh sách check-out vừa được cập nhật. Vui lòng thử lại.",
    });
  };

  const pendingArrivals =
    arrivalState.filter((item) => item.status === "Chờ check-in").length +
    (groupArrivalState.status === "Chờ check-in" ? 1 : 0);
  const pendingDepartures = departureState.filter(
    (item) => item.status === "Đang ở",
  ).length;
  const summaryCards = [
    { label: localizedText("Chờ check-in", "Awaiting check-in"), value: checkInOutSummary?.waitingCheckIn },
    { label: localizedText("Đang lưu trú", "In-house"), value: checkInOutSummary?.inHouse },
    { label: localizedText("Chờ check-out", "Awaiting check-out"), value: checkInOutSummary?.waitingCheckOut },
    { label: localizedText("Đã hoàn tất", "Completed"), value: checkInOutSummary?.completed },
  ];

  const serviceSelectionsForRecord = (record: DailyRecord) => {
    const currentServices = recordServices[record.id] ?? record.services ?? [];
    const selectionsByServiceId = new Map<string, ServiceSelection>();
    currentServices.forEach((service) => {
      const serviceName = service.name.trim().toLocaleLowerCase();
      const catalogService = services.find((item) => item.name.trim().toLocaleLowerCase() === serviceName);
      const serviceId = String(service.serviceId ?? catalogService?.id ?? "");
      if (!serviceId) return;
      const price = service.quantity > 0 ? service.amount / service.quantity : 0;
      const existing = selectionsByServiceId.get(serviceId);
      if (existing) {
        existing.quantity += service.quantity;
        existing.originalQuantity = (existing.originalQuantity ?? 0) + service.quantity;
      } else {
        selectionsByServiceId.set(serviceId, {
          serviceId,
          quantity: service.quantity,
          originalQuantity: service.quantity,
          isExisting: true,
          name: service.name,
          price,
        });
      }
    });
    return [...selectionsByServiceId.values()];
  };

  const openServiceSelector = (record: DailyRecord) => {
    const roomSelections = serviceSelectionsForRecord(record);
    setServiceSelections(roomSelections);
    const roomId = record.room.split(" · ")[0];
    setServiceSelectorRooms([{ id: roomId, type: record.room.split(" · ")[1] ?? "Phòng", guests: record.guests ?? 1, price: record.roomAmount ?? 0 }]);
    setServiceRoomSelections({ [roomId]: roomSelections.map((selection) => ({ ...selection, applyToRoom: false })) });
    setServiceRecordIdsByRoom({ [roomId]: record.id });
    setServiceAllSelections([]);
    setServiceModalMode("per-room");
    setServiceRecord(record);
  };

  const openGroupedRecordsServiceSelector = (records: DailyRecord[]) => {
    const firstRecord = records[0];
    if (!firstRecord) return;
    const selectorRooms = records.map((record) => ({
      id: record.room.split(" · ")[0],
      type: record.room.split(" · ")[1] ?? "Phòng",
      guests: record.guests ?? 1,
      price: record.roomAmount ?? 0,
    }));
    const roomSelections = Object.fromEntries(records.map((record) => {
      const roomId = record.room.split(" · ")[0];
      return [roomId, serviceSelectionsForRecord(record).map((selection) => ({ ...selection, applyToRoom: false }))];
    }));
    setServiceRecord({
      ...firstRecord,
      id: String(firstRecord.bookingId ?? firstRecord.id),
      room: `${selectorRooms.map((room) => room.id).join(", ")} · Đoàn`,
      guests: records.reduce((total, record) => total + (record.guests ?? 0), 0),
    });
    setServiceSelectorRooms(selectorRooms);
    setServiceRoomSelections(roomSelections);
    setServiceRecordIdsByRoom(Object.fromEntries(records.map((record) => [record.room.split(" · ")[0], record.id])));
    setServiceSelections(Object.values(roomSelections).flat());
    setServiceAllSelections([]);
    setServiceModalMode("per-room");
  };

  const openGroupServiceSelector = (id: string, guest: string, rooms: string[], guests: number) => {
    setServiceRecord({ id, guest, room: `${rooms.join(", ")} · Đoàn`, guests, time: "", status: "Đang ở", flow: "check-out" });
    const guestsPerRoom = Math.max(1, Math.ceil(guests / rooms.length));
    setServiceSelectorRooms(rooms.map((room) => ({ id: room, type: "Phòng đoàn", guests: guestsPerRoom, price: 0 })));
    setServiceRoomSelections({});
    setServiceRecordIdsByRoom(null);
    setServiceAllSelections([]);
    setServiceModalMode("per-room");
  };

  const serviceModeSelections = () => {
    const selections = serviceModalMode === "all"
      ? serviceSelectorRooms.flatMap((room) => serviceRoomSelections[room.id] ?? serviceAllSelections.map((selection) => ({ ...selection, quantity: room.guests })))
      : Object.values(serviceRoomSelections).flat().length > 0 ? Object.values(serviceRoomSelections).flat() : serviceSelections;
    return selections.reduce<ServiceSelection[]>((current, selection) => {
      const existing = current.find((item) => item.serviceId === selection.serviceId);
      return existing
        ? current.map((item) => item.serviceId === selection.serviceId ? { ...item, quantity: item.quantity + selection.quantity } : item)
        : [...current, selection];
    }, []);
  };

  const saveRecordServices = async () => {
    if (serviceSaveInFlight.current) return;
    if (!serviceRecord) return;
    const toServiceCharges = (roomSelections: ServiceSelection[]) => roomSelections.map((selection) => {
      const catalogService = services.find((service) => String(service.id) === String(selection.serviceId));
      return {
        serviceId: selection.serviceId,
        name: catalogService?.name ?? selection.name ?? "Dịch vụ",
        quantity: selection.quantity,
        amount: (selection.price ?? catalogService?.price ?? 0) * selection.quantity,
      };
    });

    if (!serviceRecordIdsByRoom) {
      const localSelections = serviceModeSelections();
      setRecordServices((current) => ({ ...current, [serviceRecord.id]: toServiceCharges(localSelections) }));
      setServiceRecord(null);
      return;
    }

    const linkedRecords = Object.values(serviceRecordIdsByRoom).map((recordId) =>
      dailyRecords.find((record) => record.id === recordId),
    );
    if (linkedRecords.some((record) => !record)) {
      toast({
        variant: "destructive",
        title: "Không tìm thấy phòng trong booking",
        description: "Danh sách check-in/check-out vừa thay đổi. Vui lòng tải lại trang và thử lại.",
      });
      return;
    }
    const bookingId = String(linkedRecords.find((record) => record?.bookingId)?.bookingId ?? serviceRecord.bookingId ?? "");
    const requestEmployeeId = String(employeeId ?? localStorage.getItem("id") ?? localStorage.getItem("employeeId") ?? "");
    if (!bookingId || !requestEmployeeId) {
      toast({
        variant: "destructive",
        title: "Không thể cập nhật dịch vụ",
        description: !bookingId ? "Không tìm thấy mã booking." : "Không tìm thấy mã nhân viên đăng nhập.",
      });
      return;
    }

    const additionsByDetail = new Map<string, ManagementBookingModificationRequest["servicesToAddForExistingRooms"][number]["services"]>();
    const quantityUpdatesByDetail = new Map<string, ManagementBookingModificationRequest["serviceQuantityUpdates"][number]["services"]>();
    const updatedServicesByRecordId: Record<string, ServiceCharge[]> = {};

    serviceSelectorRooms.forEach((room) => {
      const bookingDetailId = serviceRecordIdsByRoom[room.id];
      const originalRecord = linkedRecords.find((record) => record?.id === bookingDetailId);
      if (!bookingDetailId || !originalRecord) return;

      const originalSelections = serviceSelectionsForRecord(originalRecord);
      const selectedForRoom = serviceModalMode === "all"
        ? serviceRoomSelections[room.id] ?? serviceAllSelections.map((selection) => ({ ...selection, quantity: room.guests }))
        : serviceRoomSelections[room.id] ?? [];
      const currentByServiceId = new Map<string, ServiceSelection>();
      selectedForRoom.forEach((selection) => {
        const serviceId = String(selection.serviceId ?? "").trim();
        if (!serviceId || selection.quantity <= 0) return;
        const existing = currentByServiceId.get(serviceId);
        if (existing) existing.quantity += selection.quantity;
        else currentByServiceId.set(serviceId, { ...selection, serviceId });
      });
      const originalByServiceId = new Map(originalSelections.map((selection) => [selection.serviceId, selection]));

      currentByServiceId.forEach((selection, serviceId) => {
        const originalQuantity = originalByServiceId.get(serviceId)?.quantity ?? 0;
        const addedQuantity = selection.quantity - originalQuantity;
        if (addedQuantity <= 0) return;
        const catalogService = services.find((service) => String(service.id) === serviceId);
        const additions = additionsByDetail.get(bookingDetailId) ?? [];
        additions.push({
          serviceId,
          quantity: addedQuantity,
          name: selection.name ?? catalogService?.name,
          price: selection.price ?? catalogService?.price,
        });
        additionsByDetail.set(bookingDetailId, additions);
      });

      originalByServiceId.forEach((original, serviceId) => {
        const currentQuantity = currentByServiceId.get(serviceId)?.quantity ?? 0;
        if (currentQuantity >= original.quantity) return;
        const updates = quantityUpdatesByDetail.get(bookingDetailId) ?? [];
        updates.push({ serviceId, quantity: currentQuantity });
        quantityUpdatesByDetail.set(bookingDetailId, updates);
      });

      updatedServicesByRecordId[bookingDetailId] = toServiceCharges([...currentByServiceId.values()]);
    });

    const servicesToAddForExistingRooms = [...additionsByDetail].map(([bookingDetailId, roomServices]) => ({ bookingDetailId, services: roomServices }));
    const serviceQuantityUpdates = [...quantityUpdatesByDetail].map(([bookingDetailId, roomServices]) => ({ bookingDetailId, services: roomServices }));
    if (servicesToAddForExistingRooms.length === 0 && serviceQuantityUpdates.length === 0) {
      setServiceRecordIdsByRoom(null);
      setServiceRecord(null);
      return;
    }

    const request: ManagementBookingModificationRequest = {
      employeeId: requestEmployeeId,
      bookingDetailIdsToCancel: [],
      servicesToCancel: [],
      roomsToAdd: [],
      roomsToChange: [],
      servicesToAddForExistingRooms,
      serviceQuantityUpdates,
      promotionRequest: null,
      customerPromotionRequest: null,
    };

    serviceSaveInFlight.current = true;
    try {
      await modifyBooking({ bookingId, request }).unwrap();
      setRecordServices((current) => ({ ...current, ...updatedServicesByRecordId }));
      toast({ variant: "default", title: "Cập nhật dịch vụ thành công", description: `Dịch vụ đã được cập nhật cho booking ${bookingId}.` });
    } catch (error) {
      const responseError = error as { data?: { message?: string; error?: string }; error?: string };
      toast({
        variant: "destructive",
        title: "Cập nhật dịch vụ thất bại",
        description: responseError.data?.message ?? responseError.data?.error ?? responseError.error ?? "Không thể cập nhật dịch vụ.",
      });
      return;
    } finally {
      serviceSaveInFlight.current = false;
    }

    setServiceRecordIdsByRoom(null);
    setServiceRecord(null);
  };

  const saveBookingDetailServiceEdits = async (updates: BookingServiceQuantityEdit[]) => {
    const bookingId = String(bookingDetailRecords?.[0]?.bookingId ?? "");
    const requestEmployeeId = String(employeeId ?? localStorage.getItem("id") ?? localStorage.getItem("employeeId") ?? "");
    if (!bookingId || !requestEmployeeId) {
      toast({
        variant: "destructive",
        title: "Không thể cập nhật dịch vụ",
        description: !bookingId ? "Không tìm thấy mã booking." : "Không tìm thấy mã nhân viên đăng nhập.",
      });
      return false;
    }

    const request: ManagementBookingModificationRequest = {
      employeeId: requestEmployeeId,
      bookingDetailIdsToCancel: [],
      servicesToCancel: [],
      roomsToAdd: [],
      roomsToChange: [],
      servicesToAddForExistingRooms: [],
      serviceQuantityUpdates: updates,
      promotionRequest: null,
      customerPromotionRequest: null,
    };

    try {
      await modifyBooking({ bookingId, request }).unwrap();
      const applyUpdates = (record: DailyRecord, sourceServices: ServiceCharge[] = record.services ?? []) => {
        const recordUpdates = updates.find((update) => update.bookingDetailId === record.id)?.services ?? [];
        return sourceServices.flatMap((service) => {
          const edit = recordUpdates.find((item) => item.bookingServiceDetailId === service.serviceDetailId);
          if (!edit) return [service];
          if (edit.quantity === 0) return [];
          const unitPrice = service.quantity > 0 ? service.amount / service.quantity : 0;
          return [{ ...service, quantity: edit.quantity, amount: unitPrice * edit.quantity }];
        });
      };
      setRecordServices((current) => {
        const next = { ...current };
        updates.forEach(({ bookingDetailId }) => {
          const record = dailyRecords.find((item) => item.id === bookingDetailId);
          if (!record) return;
          next[bookingDetailId] = applyUpdates(record, current[bookingDetailId] ?? record.services ?? []);
        });
        return next;
      });
      setBookingDetailRecords((current) => current?.map((record) => ({
        ...record,
        services: applyUpdates(record),
      })) ?? null);
      toast({ variant: "default", title: "Cập nhật dịch vụ thành công", description: `Dịch vụ của booking ${bookingId} đã được cập nhật.` });
      return true;
    } catch (error) {
      const responseError = error as { data?: { message?: string; error?: string }; error?: string };
      toast({
        variant: "destructive",
        title: "Cập nhật dịch vụ thất bại",
        description: responseError.data?.message ?? responseError.data?.error ?? responseError.error ?? "Không thể cập nhật dịch vụ.",
      });
      return false;
    }
  };

  const openRoomModal = (record: DailyRecord) => {
    const [roomId, roomType] = record.room.split(" · ");
    const roomData = hotelRooms.find((room) => {
      const value = room as Record<string, unknown>;
      return String(value.roomNumber ?? value.roomNo ?? value.roomCode ?? "") === roomId;
    }) as Record<string, unknown> | undefined;
    const rawBeds = roomData?.beds;
    const bedList = Array.isArray(rawBeds) ? rawBeds : [];
    const beds = bedList.map((item) => {
      if (!item || typeof item !== "object") return "";
      const bed = item as Record<string, unknown>;
      const name = String(bed.bedTypeName ?? bed.name ?? "").trim();
      const quantity = Number(bed.quantity ?? 1);
      return name ? `${name} × ${Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 1}` : "";
    }).filter(Boolean).join(" · ");
    const area = Number(roomData?.area);
    const floorNumber = roomData?.floorNumber;
    const fallback: RoomDetail = {
      id: roomId,
      type: roomType || t("frontDesk.unknownRoomType", "Unknown room type"),
      floor: floorNumber == null ? t("frontDesk.notUpdated", "Not updated") : String(floorNumber),
      beds: beds || t("frontDesk.notUpdated", "Not updated"),
      size: Number.isFinite(area) && area > 0 ? `${area} m²` : t("frontDesk.notUpdated", "Not updated"),
      view: t("frontDesk.notUpdated", "Not updated"),
      rate: t("frontDesk.notUpdated", "Not updated"),
      status: t("frontDesk.updating", "Updating"),
      note: t(
        "frontDesk.syncNote",
        "Room details will be synced from the room system.",
      ),
      amenities: [t("frontDesk.notUpdated", "Not updated")],
    };
    setRoomPreview({
      record,
      detail: roomData
        ? {
          ...fallback,
          type: String(roomData.roomType ?? roomData.name ?? fallback.type),
          status: String(roomData.roomStatus ?? fallback.status),
        }
        : fallback,
    });
  };

  return (
    <>
    <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={localizedText("Thống kê check-in/check-out", "Check-in/check-out statistics")}>
      {summaryCards.map((card, index) => (
        <article key={card.label} className={`rounded-xl border border-slate-200/80 p-4 shadow-sm ${index === 0 ? "bg-[#28233f] text-white" : "bg-white"}`}>
          <p className={`text-xs font-medium ${index === 0 ? "text-blue-200" : "text-slate-500"}`}>{card.label}</p>
          <p className="mt-2 text-xl font-bold tracking-tight">
            {isCheckInOutSummaryLoading ? "—" : isCheckInOutSummaryError ? "!" : String(card.value ?? 0).padStart(2, "0")}
          </p>
          <p className={`mt-1 text-[11px] ${index === 0 ? "text-blue-200" : "text-slate-400"}`}>
            {isCheckInOutSummaryError ? localizedText("Không tải được dữ liệu", "Could not load data") : localizedText("Theo ngày đã chọn", "For selected date")}
          </p>
        </article>
      ))}
    </section>
    <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label={localizedText("Loại thủ tục", "Operation type")} className="flex w-fit shrink-0 gap-5 border-b border-slate-200">
          <button
            type="button"
            role="tab"
            aria-selected={activeFlow === "check-in"}
            onClick={() => setActiveFlow("check-in")}
            className={`flex items-center gap-2 border-b-2 px-2 py-3 text-sm font-semibold transition ${activeFlow === "check-in" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            <LogIn size={15} />
            {t("frontDesk.onlyCheckIn")}
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{pendingArrivals}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeFlow === "check-out"}
            onClick={() => setActiveFlow("check-out")}
            className={`flex items-center gap-2 border-b-2 px-2 py-3 text-sm font-semibold transition ${activeFlow === "check-out" ? "border-amber-600 text-amber-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            <LogOut size={15} />
            {t("frontDesk.onlyCheckOut")}
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">{pendingDepartures}</span>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <div className="hidden items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-500 xl:flex">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />{localizedText("Đã thanh toán đủ", "Paid in full")}</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />{localizedText("Chưa thanh toán đủ", "Payment incomplete")}</span>
          </div>
          <DatePickerPopover
            value={selectedDate}
            onChange={setSelectedDate}
            placeholder={localizedText("Chọn ngày", "Select date")}
            buttonClassName="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:text-blue-600"
          />
        </div>
      </div>
      {activeFlow === "check-out" && <LateCheckoutPreview records={lateCheckoutRecords} isLoading={checkOutQuery.isLoading} isError={checkOutQuery.isError} onCheckout={handleLateCheckout} />}
      <div className="border-b border-slate-100 bg-slate-50/60 p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("frontDesk.searchPlaceholder")}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {groupedArrivalRecords.map((records) => {
          const pendingGroup = records.filter((record) => record.status === "Chờ check-in");
          if (pendingGroup.length === 0) return null;
          const firstRecord = records[0];
          const groupLabel = `${firstRecord.guest} ${firstRecord.bookingId ?? firstRecord.id} ${records.map((record) => record.room).join(" ")}`;
          if (activeFlow !== "check-in" || !groupLabel.toLowerCase().includes(query.toLowerCase())) return null;
          const completedIds = records.filter((record) => record.status === "Đã check-in").map((record) => record.id);
          return (
            <BatchStayCard
              key={`group-${firstRecord.bookingId ?? firstRecord.id}`}
              mode="check-in"
              title={firstRecord.guest}
              bookingCode={firstRecord.bookingId}
              identityNumber={firstRecord.identityNumber}
              description={localizedText(`${records.length} phòng · ${records.reduce((total, record) => total + (record.guests ?? 0), 0)} khách · Nhận lúc ${firstRecord.time}`, `${records.length} rooms · ${records.reduce((total, record) => total + (record.guests ?? 0), 0)} guests · Arrival at ${firstRecord.time}`)}
              items={records.map((record) => ({
                id: record.id,
                title: record.room,
                subtitle: "",
                status: record.status === "Đã check-in" ? "complete" as const : "pending" as const,
                roomPaid: record.roomPaid,
              }))}
              selectedIds={completedIds}
              draftSelectedIds={completedIds}
              actionLabel={localizedText("Check-in các phòng", "Check in rooms")}
              actionCount={pendingGroup.length}
              actionDisabled={false}
              onViewBooking={() => setBookingDetailRecords(records.map((record) => ({
                ...record,
                services: recordServices[record.id] ?? record.services,
              })))}
              onAddService={() => openGroupedRecordsServiceSelector(records)}
              onAction={async (nextSelected) => {
                const nextRecords = records.filter((record) => nextSelected.includes(record.id));
                if (nextRecords.length > 0) {
                  await requestCheckIn(nextRecords);
                }
              }}
            />
          );
        })}
        {!groupArrivalComplete && groupArrivalState.status === "Chờ check-in" &&
          activeFlow === "check-in" &&
          `${groupArrivalState.guest} ${groupArrivalState.id} ${groupArrivalState.rooms.join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase()) && (
            <BatchStayCard
              mode="check-in"
              title={groupArrivalState.guest}
              description={localizedText(`${groupArrivalState.rooms.length} phòng · ${groupArrivalState.guests} khách · Nhận lúc ${groupArrivalState.time}`, `${groupArrivalState.rooms.length} rooms · ${groupArrivalState.guests} guests · Arrival at ${groupArrivalState.time}`)}
              items={groupArrivalState.rooms.map((room) => ({ id: room, title: `${localizedText("Phòng", "Room")} ${room}`, subtitle: groupArrivalState.id, status: checkedInGroupRooms.includes(room) ? "complete" as const : "pending" as const }))}
              selectedIds={checkedInGroupRooms}
              draftSelectedIds={selectedGroupRooms}
              actionLabel={localizedText("Check-in cả đoàn", "Check in group")}
              actionCount={groupArrivalState.rooms.length}
              actionDisabled={false}
              onAddService={() => openGroupServiceSelector(groupArrivalState.id, groupArrivalState.guest, groupArrivalState.rooms, groupArrivalState.guests)}
              onAction={(nextSelected) => {
                if (nextSelected.length > 0) {
                  const merged = Array.from(new Set([...checkedInGroupRooms, ...nextSelected]));
                  setCheckedInGroupRooms(merged);
                  setSelectedGroupRooms([]);
                  if (merged.length === groupArrivalState.rooms.length) {
                    setGroupArrivalState((current) => ({ ...current, status: "Đã check-in" }));
                  }
                }
              }}
            />
          )}
        {groupedDepartureRecords.map((records) => {
          const firstRecord = records[0];
          const groupLabel = `${firstRecord.guest} ${firstRecord.bookingId ?? firstRecord.id} ${records.map((record) => record.room).join(" ")}`;
          if (activeFlow !== "check-out" || !groupLabel.toLowerCase().includes(query.toLowerCase())) return null;
          return (
            <BatchStayCard
              key={`checkout-group-${firstRecord.bookingId ?? firstRecord.id}`}
              mode="check-out"
              title={firstRecord.guest}
              bookingCode={firstRecord.bookingId}
              identityNumber={firstRecord.identityNumber}
              description={localizedText(`${records.length} phòng · ${records.reduce((total, record) => total + (record.guests ?? 0), 0)} khách · Trả lúc ${firstRecord.time}`, `${records.length} rooms · ${records.reduce((total, record) => total + (record.guests ?? 0), 0)} guests · Departure at ${firstRecord.time}`)}
              items={records.map((record) => ({
                id: record.id,
                title: record.room,
                subtitle: record.bookingId ?? "",
                status: "pending" as const,
                roomPaid: record.roomPaid,
              }))}
              selectedIds={[]}
              draftSelectedIds={[]}
              actionLabel={localizedText("Check-out các phòng", "Check out rooms")}
              actionCount={records.length}
              actionDisabled={false}
              onViewBooking={() => setBookingDetailRecords(records.map((record) => ({
                ...record,
                services: recordServices[record.id] ?? record.services,
              })))}
              onAddService={() => openGroupedRecordsServiceSelector(records)}
              checkoutSummaryRooms={checkoutRoomsFromRecords(records)}
              onAction={(nextSelected) => {
                if (nextSelected.length === 0) return;
                setGroupCheckoutRecords(records.filter((record) => nextSelected.includes(record.id)));
                setGroupCheckoutRefundMethod(null);
                setGroupCheckoutOpen(true);
              }}
            />
          );
        })}
          {activeFlow === "check-out" && (
            <section className="mx-4 my-4 rounded-xl border border-blue-200 bg-blue-50/60 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 font-bold text-slate-900">
                    <FileText size={18} className="text-blue-700" />
                    {localizedText("Hóa đơn thanh toán", "Payment invoice")}
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    {localizedText("Hóa đơn chỉ sẵn sàng khi tất cả phòng trong booking đã check-out.", "The invoice is available once every room in the booking has checked out.")}
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-800">
                  {completedInvoiceBookings.length} {localizedText("booking hoàn tất", "completed bookings")}
                </span>
              </div>
              {completedInvoiceBookings.length > 0 ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {completedInvoiceBookings.map((booking) => (
                    <div key={String(booking.bookingId ?? booking.id)} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-100 bg-white p-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{booking.customerName ?? localizedText("Khách hàng", "Guest")}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {localizedText("Booking", "Booking")} {booking.bookingId ?? booking.id} · {booking.bookingDetails?.length ?? 0} {localizedText("phòng", "rooms")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInvoiceBooking(booking)}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-800"
                      >
                        <FileText size={15} /> {localizedText("Xem / In hóa đơn", "View / Print invoice")}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-lg border border-dashed border-blue-200 bg-white/70 px-4 py-3 text-sm text-slate-500">
                  {localizedText("Chưa có booking nào hoàn tất toàn bộ phòng trong ngày này.", "No bookings have all rooms checked out on this date.")}
                </p>
              )}
            </section>
          )}
          <CheckInOutRecordList
            records={filtered}
          groupedRecordIds={groupedRecordIds}
          recordServices={recordServices}
          checkMatrixCheckInConflict={checkMatrixCheckInConflict}
          onRecordAction={handleRecordAction}
          onAddService={openServiceSelector}
          onUndo={undoRecordAction}
          onViewBooking={(record) => setBookingDetailRecords([{ ...record, services: recordServices[record.id] ?? record.services }])}
        />
      </div>
      {invoiceBooking && (
        <CheckoutInvoice booking={invoiceBooking} onClose={() => setInvoiceBooking(null)} />
      )}
      {filtered.length === 0 && (
        <div className="p-8 text-center">
          <p className="text-sm font-semibold text-slate-700">
            {localizedText("Không có lượt phù hợp trong hôm nay", "No matching arrivals or departures for this day")}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {localizedText("Thử đổi từ khoá tìm kiếm hoặc chuyển sang tab còn lại.", "Try another search term or switch to the other tab.")}
          </p>
        </div>
      )}
      {bookingDetailRecords && (
        <CheckInOutBookingDetailModal
          records={bookingDetailRecords}
          onClose={() => setBookingDetailRecords(null)}
          onSaveServices={saveBookingDetailServiceEdits}
          isSavingServices={isSavingService}
        />
      )}
      {warningAction && (
        <EarlyLateStayNotice
          action={warningAction.flow}
          message={warningAction.message}
          fee={warningAction.fee}
          roomFees={warningAction.roomFees}
          onCancel={() => setWarningAction(null)}
          onConfirm={() => {
            const action = warningAction;
            setWarningAction(null);
            if (action.flow === "check-in" && action.records.length > 0) {
              for (const record of action.records.filter((item) => isEarlyCheckIn(item, new Date()))) {
                const conflict = checkMatrixCheckInConflict(record);
                if (!conflict) continue;
                toast({
                  variant: "destructive",
                  title: "Chặn check-in sớm (Trùng ma trận phòng)",
                  description: conflict.message,
                });
                setMatrixBlockedNotice({
                  roomNumbers: [conflict.roomNumber],
                  message: conflict.message,
                  hasExactRoomList: true,
                });
                return;
              }
              void handleBulkCheckIn(action.records);
            } else if (action.records[0]) {
              setCheckoutRecord(action.records[0]);
            }
          }}
        />
      )}
      {matrixBlockedNotice && (
        <div
          className="fixed inset-0 z-60 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-xs"
          onMouseDown={() => setMatrixBlockedNotice(null)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in duration-150"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3.5 text-rose-600">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-700">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {matrixBlockedNotice.hasExactRoomList ? localizedText("Chặn thủ tục Check-in sớm", "Early check-in blocked") : localizedText("Không thể hoàn tất Check-in", "Could not complete check-in")}
                </h3>
                <p className="mt-0.5 text-xs text-rose-600 font-semibold">
                  {matrixBlockedNotice.hasExactRoomList
                    ? localizedText("Đã xác định phòng trùng lịch trên ma trận phòng", "Room schedule conflicts were identified in the room matrix")
                    : localizedText("Chưa nhận được danh sách phòng trùng chính xác từ máy chủ", "The server did not return the exact list of conflicting rooms")}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3 rounded-xl border border-rose-200 bg-rose-50/70 p-4">
              {matrixBlockedNotice.roomNumbers.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-rose-800">
                    {matrixBlockedNotice.hasExactRoomList ? localizedText("Phòng bị trùng lịch", "Rooms with schedule conflicts") : localizedText("Các phòng trong lượt check-in", "Rooms in this check-in")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {matrixBlockedNotice.roomNumbers.map((roomNumber) => (
                      <span
                        key={roomNumber}
                        className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${
                          matrixBlockedNotice.hasExactRoomList
                            ? "border-rose-300 bg-white text-rose-700"
                            : "border-amber-300 bg-amber-50 text-amber-800"
                        }`}
                      >
                        {localizedText("Phòng", "Room")} {roomNumber}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <p className="whitespace-pre-line text-xs font-medium leading-relaxed text-slate-700">
                {matrixBlockedNotice.message}
              </p>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setMatrixBlockedNotice(null)}
                className="rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 transition-colors shadow-sm"
              >
                {localizedText("Đã hiểu & Đóng", "Understood & close")}
              </button>
            </div>
          </div>
        </div>
      )}
      {serviceRecord && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onMouseDown={() => setServiceRecord(null)}>
          <div className="booking-service-modal-scroll max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">{localizedText("Dịch vụ cho khách", "Guest services")}</p><h3 className="mt-1 text-lg font-bold text-slate-900">{serviceRecord.guest} · {serviceRecord.room.split(" · ")[0]}</h3></div><button type="button" onClick={() => setServiceRecord(null)} className="text-2xl leading-none text-slate-400">×</button></div>
            <BookingServiceSelector rooms={serviceSelectorRooms} services={services} servicesLoading={isServicesLoading} servicesError={isServicesError} serviceMode={serviceModalMode} setServiceMode={setServiceModalMode} allRoomServices={serviceAllSelections} setAllRoomServices={setServiceAllSelections} roomServices={serviceRoomSelections} setRoomServices={setServiceRoomSelections} roomRanges={{}} fallbackRange={{ checkIn: "2026-01-01", checkOut: "2026-01-02" }} language={i18n.language.startsWith("en") ? "en" : "vi"} nightsForRoom={() => 1} onContinue={saveRecordServices} onSkip={() => setServiceRecord(null)} isSubmitting={isSavingService} continueLabel={localizedText("Xác nhận", "Confirm")} skipLabel={localizedText("Đóng", "Close")} />
          </div>
        </div>
      )}
      {selectingGroupRoom && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
          onMouseDown={() => setSelectingGroupRoom(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  {localizedText("Check-in từng phòng", "Check in rooms individually")}
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">
                  {localizedText("Chọn phòng khách nhận hôm nay", "Select the rooms the guest is checking into today")}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {localizedText("Có thể chọn hoặc bỏ chọn trước khi xác nhận.", "Select or deselect rooms before confirming.")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedGroupRooms([]);
                  setSelectingGroupRoom(false);
                }}
                className="text-2xl leading-none text-slate-400"
              >
                ×
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {groupArrivalState.rooms
                .filter((room) => !checkedInGroupRooms.includes(room))
                .map((room) => {
                  const selected = selectedGroupRooms.includes(room);
                  return (
                    <button
                      type="button"
                      key={room}
                      onClick={() => toggleGroupRoom(room)}
                      className={`rounded-xl border p-4 text-left transition ${selected ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50"}`}
                    >
                      <span className="flex items-center justify-between text-xs font-semibold text-slate-500">
                        <span>{localizedText("Phòng", "Room")}</span>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleGroupRoom(room)}
                          onClick={(event) => event.stopPropagation()}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </span>
                      <span className="mt-1 block text-lg font-bold text-slate-900">
                        {room}
                      </span>
                      <span className="mt-1 block text-xs text-blue-700">
                        {selected ? localizedText("Đã chọn · Bấm để bỏ", "Selected · Click to deselect") : localizedText("Bấm để chọn", "Click to select")}
                      </span>
                    </button>
                  );
                })}
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedGroupRooms([]);
                  setSelectingGroupRoom(false);
                }}
                className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                {localizedText("Hủy", "Cancel")}
              </button>
              <button
                type="button"
                disabled={selectedGroupRooms.length === 0}
                onClick={() => {
                  checkInGroup(selectedGroupRooms);
                  setSelectedGroupRooms([]);
                  setSelectingGroupRoom(false);
                }}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {localizedText("Xác nhận check-in", "Confirm check-in")} ({selectedGroupRooms.length})
              </button>
            </div>
          </div>
        </div>
      )}
      {checkoutRecord &&
        (() => {
          const services = recordServices[checkoutRecord.id] ?? checkoutRecord.services ?? [];
          const earlyCheckInFee = checkoutRecord.earlyCheckInFee || 0;
          const lateFee = checkoutRecord.lateFee || 0;
          const isPreparingCheckout = checkoutPreparation?.recordId === checkoutRecord.id && !checkoutPreparation.error;
          const checkoutPreparationError = checkoutPreparation?.recordId === checkoutRecord.id ? checkoutPreparation.error : undefined;
          const overdueDuration = checkoutRecord.checkOutAt && new Date(checkoutRecord.checkOutAt).getTime() < checkoutClock
            ? formatOverdueDuration(checkoutRecord.checkOutAt, new Date(checkoutClock).toISOString(), i18n.language)
            : null;
          const totalDue = singleCheckoutOutstandingAmount;
          const formatMoney = (amount: number) =>
            `${amount.toLocaleString(i18n.language.startsWith("en") ? "en-US" : "vi-VN")}${i18n.language.startsWith("en") ? " VND" : "đ"}`;
          return (
            <div
              className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
              onMouseDown={closeSingleCheckout}
            >
              <div
                className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                      {localizedText("Đối soát check-out", "Check-out summary")}
                    </p>
                    <h3 className="mt-1 text-xl font-bold text-slate-900">
                      {checkoutRecord.guest} ·{" "}
                      {checkoutRecord.room.split(" · ")[0]}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {localizedText("Booking", "Booking")} {checkoutRecord.id}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeSingleCheckout}
                    className="text-2xl leading-none text-slate-400"
                  >
                    ×
                  </button>
                </div>
                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-3">
                    <span>
                      <span className="block font-semibold text-slate-700">
                        {localizedText("Tiền phòng", "Room charge")}
                      </span>
                      <span className="text-xs text-emerald-700">
                        {localizedText(`Đã thanh toán 100% lúc đặt · Mã GD: ${checkoutRecord.id}`, `Paid in full at booking · Transaction ID: ${checkoutRecord.id}`)}
                      </span>
                    </span>
                    <strong className="text-emerald-700">
                      {formatMoney(Number(checkoutRecord.roomAmount ?? 0))}
                    </strong>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="font-semibold text-slate-700">
                      {localizedText("Dịch vụ phát sinh", "Additional services")}
                    </p>
                    {services.length === 0 && (
                      <p className="mt-2 text-xs text-slate-400">
                        {localizedText("Không có dịch vụ phát sinh.", "No additional services.")}
                      </p>
                    )}
                    {services.map((service) => (
                      <div
                        key={service.name}
                        className="mt-2 flex justify-between text-slate-600"
                      >
                        <span>
                          {service.name} x{service.quantity}
                        </span>
                        <span className="font-semibold">
                          {formatMoney(service.amount)}
                        </span>
                      </div>
                    ))}
                    {earlyCheckInFee > 0 && (
                      <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-slate-600">
                        <span>{localizedText("Phụ thu check-in sớm", "Early check-in surcharge")}</span>
                        <span className="font-semibold">
                          {formatMoney(earlyCheckInFee)}
                        </span>
                      </div>
                    )}
                    {overdueDuration && (
                      <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-slate-600">
                        <span>{localizedText("Thời gian check-out trễ", "Late check-out duration")}</span>
                        <span className="font-semibold">{overdueDuration}</span>
                      </div>
                    )}
                    {lateFee > 0 && (
                      <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-slate-600">
                        <span>{localizedText("Phụ thu check-out trễ", "Late check-out surcharge")}</span>
                        <span className="font-semibold">
                          {formatMoney(lateFee)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                    <span className="font-bold text-slate-900">
                      {localizedText("Còn phải thanh toán", "Balance due")}
                    </span>
                    <strong className="text-lg text-blue-700">
                      {formatMoney(totalDue)}
                    </strong>
                  </div>
                  {singleCheckoutSurplusAmount > 0 && <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-amber-800">{localizedText("Khách sạn cần hoàn", "Refund due to guest")}</span>
                    <strong className="text-amber-800">{formatMoney(singleCheckoutSurplusAmount)}</strong>
                  </div>}
                  {isPreparingCheckout && (
                    <p role="status" className="rounded-lg bg-blue-50 p-3 text-xs font-medium text-blue-700">
                      {localizedText("Đang cập nhật phụ thu check-out trễ và số tiền cần thanh toán...", "Updating the late check-out surcharge and balance due...")}
                    </p>
                  )}
                  {checkoutPreparationError && (
                    <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700">
                      {checkoutPreparationError}
                    </p>
                  )}
                </div>
                {(totalDue > 0 || checkoutPreparationError) && (
                  <div className="mt-3 rounded-lg bg-rose-50 p-3">
                    <p className="text-xs font-medium text-rose-700">
                      {totalDue > 0
                        ? localizedText(`Khách còn phải thanh toán đủ ${formatMoney(totalDue)} trước khi được check-out.`, `The guest must pay the outstanding ${formatMoney(totalDue)} before check-out.`)
                        : localizedText("Chưa thể xác nhận phụ thu check-out trễ. Vui lòng thử cập nhật lại.", "Could not confirm the late check-out surcharge. Please try updating it again.")}
                    </p>
                    <button
                      type="button"
                      onClick={() => totalDue > 0
                        ? goToBookingPayment(checkoutRecord.bookingId, [checkoutRecord])
                        : void openCheckout(checkoutRecord)}
                      disabled={isPreparingCheckout}
                      className="mt-2 rounded-lg bg-rose-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-800 disabled:cursor-wait disabled:opacity-60"
                    >
                      {isPreparingCheckout ? localizedText("Đang cập nhật phụ thu...", "Updating surcharge...") : totalDue > 0 ? localizedText("Đi đến booking để thanh toán", "Go to booking payment") : localizedText("Thử cập nhật lại phụ thu", "Retry surcharge update")}
                    </button>
                  </div>
                )}
                {isFinalSingleCheckout(checkoutRecord) && totalDue === 0 && singleCheckoutSurplusAmount > 0 && (
                  <div className="mt-4">
                    <CheckoutSurplusRefundChoice
                      name={`checkout-refund-${checkoutRecord.bookingId ?? checkoutRecord.id}`}
                      value={singleCheckoutRefundMethod}
                      onChange={setSingleCheckoutRefundMethod}
                    />
                  </div>
                )}
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeSingleCheckout}
                    className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600"
                  >
                    {localizedText("Hủy", "Cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={confirmCheckout}
                    disabled={totalDue > 0 || isPreparingCheckout || Boolean(checkoutPreparationError) || (singleCheckoutSurplusAmount > 0 && isFinalSingleCheckout(checkoutRecord) && !singleCheckoutRefundMethod) || isBulkCheckOutLoading}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
                  >
                    <CreditCard size={16} />
                    {localizedText("Xác nhận Check-out", "Confirm check-out")}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      {groupCheckoutOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onMouseDown={() => setGroupCheckoutOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">{localizedText("Đối soát check-out cả đoàn", "Group check-out summary")}</p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">{groupCheckoutRecords[0]?.guest ?? localizedText("Khách hàng", "Guest")}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {groupCheckoutRecords.length} {localizedText("phòng", "rooms")} · {localizedText("Booking", "Booking")} {groupCheckoutRecords[0]?.bookingId ?? "-"}
                </p>
              </div>
              <button type="button" onClick={() => setGroupCheckoutOpen(false)} className="text-2xl leading-none text-slate-400">×</button>
            </div>
            <div className="mt-5">
              <CheckoutSummary rooms={groupCheckoutSummaryRooms} />
            </div>
            {groupCheckoutOutstandingAmount > 0 && (
              <div className="mt-3 rounded-lg bg-rose-50 p-3">
                <p className="text-xs font-medium text-rose-700">
                  {localizedText(`Khách còn phải thanh toán đủ ${groupCheckoutOutstandingAmount.toLocaleString("vi-VN")}đ trước khi được check-out.`, `The guest must pay the outstanding ${groupCheckoutOutstandingAmount.toLocaleString("en-US")} VND before check-out.`)}
                </p>
                <button
                  type="button"
                  onClick={() => goToBookingPayment(groupCheckoutBookingId, groupCheckoutRecords, "group")}
                  className="mt-2 rounded-lg bg-rose-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-800"
                >
                  {localizedText("Đi đến booking để thanh toán", "Go to booking payment")}
                </button>
              </div>
            )}
            {needsGroupRefundChoice && <div className="mt-4">
              <CheckoutSurplusRefundChoice
                name={`checkout-refund-${groupCheckoutRecords[0]?.bookingId ?? "group"}`}
                value={groupCheckoutRefundMethod}
                onChange={setGroupCheckoutRefundMethod}
              />
            </div>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setGroupCheckoutOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600">{localizedText("Hủy", "Cancel")}</button>
              <button
                type="button"
                onClick={async () => {
                  const bookingId = groupCheckoutRecords[0]?.bookingId;
                  const completed = await handleBulkCheckOut(
                    groupCheckoutRecords,
                    needsGroupRefundChoice && bookingId && groupCheckoutRefundMethod ? { [bookingId]: groupCheckoutRefundMethod } : {},
                  );
                  if (completed) {
                    setGroupCheckoutOpen(false);
                    setGroupCheckoutRecords([]);
                    setGroupCheckoutRefundMethod(null);
                  }
                }}
                disabled={isBulkCheckOutLoading || groupCheckoutRecords.length === 0 || groupCheckoutOutstandingAmount > 0 || (needsGroupRefundChoice && !groupCheckoutRefundMethod)}
                className="flex w-56 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
              >
                <CreditCard size={16} />{localizedText("Xác nhận Check-out", "Confirm check-out")}
              </button>
            </div>
          </div>
        </div>
      )}
      {roomPreview && (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-slate-950/35 p-4"
          onMouseDown={() => setRoomPreview(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  {localizedText("Chi tiết phòng", "Room details")}
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">
                  {localizedText("Phòng", "Room")} {roomPreview.detail.id} · {roomPreview.detail.type}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {localizedText("Booking", "Booking")} {roomPreview.record.id} · {localizedText("Khách", "Guest")}{" "}
                  {roomPreview.record.guest}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRoomPreview(null)}
                className="text-2xl leading-none text-slate-400"
              >
                ×
              </button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500">
                  {localizedText("Thông tin cơ bản", "Basic information")}
                </p>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p>
                    <span className="font-semibold">{localizedText("Tầng:", "Floor:")}</span>{" "}
                    {roomPreview.detail.floor}
                  </p>
                  <p>
                    <span className="font-semibold">{localizedText("Giường:", "Beds:")}</span>{" "}
                    {roomPreview.detail.beds}
                  </p>
                  <p>
                    <span className="font-semibold">{localizedText("Diện tích:", "Area:")}</span>{" "}
                    {roomPreview.detail.size}
                  </p>
                  <p>
                    <span className="font-semibold">{localizedText("Hướng:", "View:")}</span>{" "}
                    {roomPreview.detail.view}
                  </p>
                  <p>
                    <span className="font-semibold">{localizedText("Giá:", "Rate:")}</span>{" "}
                    {roomPreview.detail.rate}
                  </p>
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500">
                  {localizedText("Trạng thái vận hành", "Operational status")}
                </p>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p>
                    <span className="font-semibold">{localizedText("Tình trạng phòng:", "Room status:")}</span>{" "}
                    {roomPreview.detail.status}
                  </p>
                  <p>
                    <span className="font-semibold">{localizedText("Lượt hiện tại:", "Current operation:")}</span>{" "}
                    {roomPreview.record.flow === "check-in"
                      ? "Check-in"
                      : "Check-out"}{" "}
                    {localizedText("lúc", "at")} {roomPreview.record.time}
                  </p>
                  <p>
                    <span className="font-semibold">{localizedText("Trạng thái lượt:", "Operation status:")}</span>{" "}
                    {roomPreview.record.status}
                  </p>
                  <p>
                    <span className="font-semibold">{localizedText("Ghi chú:", "Note:")}</span>{" "}
                    {roomPreview.detail.note}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-500">
                {localizedText("Tiện ích phòng", "Room amenities")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {roomPreview.detail.amenities.map((amenity) => (
                  <span
                    key={amenity}
                    className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"
                  >
                    {amenity}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setRoomPreview(null)}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                {localizedText("Xác nhận", "Confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
      {checkedInGroupRooms.length > 0 && activeFlow === "check-in" && (
        <div className="border-t border-slate-100 bg-blue-50/40 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold text-slate-900">
                {localizedText("Phòng đoàn đã check-in", "Group rooms checked in")}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {localizedText("Bấm “Bỏ check-in” nếu nhận nhầm phòng để chọn lại.", "Click “Undo check-in” if a room was checked in by mistake.")}
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-blue-700">
              {checkedInGroupRooms.length}/{groupArrivalState.rooms.length}{" "}
              {localizedText("phòng", "rooms")}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {checkedInGroupRooms.map((room) => (
              <button
                type="button"
                key={room}
                onClick={() => undoGroupRoomCheckIn(room)}
                className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
              >
                {localizedText("Phòng", "Room")} {room} · {localizedText("Bỏ check-in", "Undo check-in")}
              </button>
            ))}
          </div>
        </div>
      )}
      {selectingGroupRoom && (
        <div
          className="fixed inset-0 z-60 grid place-items-center bg-slate-950/40 p-4"
          onMouseDown={() => {
            setSelectedGroupRooms([]);
            setSelectingGroupRoom(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  {localizedText("Check-in từng phòng", "Check in rooms individually")}
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">
                  {localizedText("Cập nhật trạng thái phòng", "Update room status")}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {localizedText("Bấm vào phòng để đổi trạng thái. Phòng vẫn giữ trong danh sách để chỉnh lại.", "Select a room to change its status. It will remain in the list so you can update it.")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedGroupRooms([]);
                  setSelectingGroupRoom(false);
                }}
                className="text-2xl leading-none text-slate-400"
              >
                ×
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {groupArrivalState.rooms.map((room) => {
                const checkedIn = checkedInGroupRooms.includes(room);
                return (
                  <button
                    type="button"
                    key={room}
                    onClick={() => toggleGroupRoomImmediately(room)}
                    className={`rounded-xl border p-4 text-left transition ${checkedIn ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50"}`}
                  >
                    <span className="flex items-center justify-between text-xs font-semibold text-slate-500">
                      <span>{localizedText("Phòng", "Room")}</span>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] ${checkedIn ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                      >
                        {checkedIn ? localizedText("Đã check-in", "Checked in") : localizedText("Chờ check-in", "Awaiting check-in")}
                      </span>
                    </span>
                    <span className="mt-2 block text-lg font-bold text-slate-900">
                      {room}
                    </span>
                    <span
                      className={`mt-1 block text-xs ${checkedIn ? "text-rose-600" : "text-blue-700"}`}
                    >
                      {checkedIn ? localizedText("Bấm để hoàn tác", "Click to undo") : localizedText("Bấm để check-in", "Click to check in")}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedGroupRooms([]);
                setSelectingGroupRoom(false);
              }}
              className="mt-5 w-full rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              {localizedText("Đóng", "Close")}
            </button>
          </div>
        </div>
      )}
      <BatchActionDialog
        open={selectingGroupRoom}
        mode="check-in"
        rooms={groupDialogRooms}
        selectedIds={checkedInGroupRooms}
        onToggle={toggleGroupRoomImmediately}
        onClose={() => setSelectingGroupRoom(false)}
        onConfirm={() => setSelectingGroupRoom(false)}
      />
      <BatchActionDialog
        open={batchCheckoutOpen}
        mode="check-out"
        rooms={batchDialogRooms}
        selectedIds={selectedDepartureIds}
        checkoutSummaryRooms={checkoutRoomsFromRecords(departureState.filter((record) => selectedDepartureIds.includes(record.id)))}
        checkoutRefundMethods={batchCheckoutRefundMethods}
        onCheckoutRefundMethodChange={(bookingId, method) =>
          setBatchCheckoutRefundMethods((current) => ({ ...current, [bookingId]: method }))
        }
        onToggle={toggleDepartureSelection}
        onClose={() => setBatchCheckoutOpen(false)}
        onConfirm={confirmBatchCheckout}
      />
    </section>
    </>
  );
}
