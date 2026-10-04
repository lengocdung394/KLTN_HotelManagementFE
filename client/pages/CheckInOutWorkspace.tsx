import { toast } from "@/components/ui/use-toast";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import BatchActionDialog from "../components/BatchActionDialog";
import BatchStayCard from "../components/BatchStayCard";
import CheckoutSummary, { type CheckoutSummaryRoom } from "../components/CheckoutSummary";
import CheckInOutBookingDetailModal from "../components/CheckInOutBookingDetailModal";
import LateCheckoutPreview, { type LateCheckoutRecord } from "../components/LateCheckoutPreview";
import DatePickerPopover from "../components/DatePickerPopover";
import BookingServiceSelector, { type ServiceSelection } from "../components/BookingServiceSelector";
import EarlyLateStayNotice from "../components/EarlyLateStayNotice";
import CheckInOutRecordList, { type DailyRecord, type ServiceCharge } from "../components/CheckInOutRecordList";
import { useGetAllServicesQuery } from "../services/serviceApi";
import {
  useBulkCheckInMutation,
  useBulkCheckOutMutation,
  useGetTodayCheckInsQuery,
  useGetTodayCheckOutsQuery,
  type CheckInOutBookingDetail,
} from "../services/checkInOutApi";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { useGetBookingsByHotelQuery, useGetRoomMatrixQuery } from "../services/bookingApi";
import { useModifyBookingMutation, type ManagementBookingModificationRequest } from "../services/managementBookingApi";
import { bindHotelSocketEvents } from "../lib/socket";
import { baseApi } from "../services/baseApi";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CreditCard,
  LogIn,
  LogOut,
  Search,
} from "lucide-react";

const toDateParam = (value?: Date) => value
  ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
  : undefined;

const shiftDay = (dateStr: string, delta: number) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
};

const formatOverdueDuration = (scheduledValue: string, currentValue: string) => {
  const scheduledTime = new Date(scheduledValue).getTime();
  const currentTime = new Date(currentValue).getTime();
  if (!Number.isFinite(scheduledTime) || !Number.isFinite(currentTime)) return "-";

  const overdueMinutes = Math.max(0, Math.floor((currentTime - scheduledTime) / 60_000));
  const totalHours = Math.floor(overdueMinutes / 60);
  const overdueDays = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = overdueMinutes % 60;
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
  const identityNumber = String(detail.cccd ?? detail.identityNumber ?? "");
  const timestamp = flow === "check-in" ? detail.checkInTime : detail.checkOutTime;
  const time = timestamp ? new Date(timestamp).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "-";
  const serviceValues = Object.entries(detail)
    .filter(([key]) => key.toLowerCase().includes("service"))
    .map(([, value]) => value);
  const rawServices = serviceValues
    .map(collectServiceEntries)
    .find((entries) => entries.length > 0) ?? [];
  const groupedServices = new Map<string, ServiceCharge>();
  collectServiceEntries(rawServices).forEach((service) => {
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
    const key = serviceId ?? name.toLocaleLowerCase();
    const existing = groupedServices.get(key);
    if (existing) {
      existing.quantity += quantity;
      existing.amount += price * quantity;
    } else {
      groupedServices.set(key, { serviceId, name, quantity, amount: price * quantity, usedAt: typeof service.usedAt === "string" ? service.usedAt : undefined });
    }
  });
  const services = [...groupedServices.values()];
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
  const parsedEarlyCheckInFee = Number(detail.earlyCheckInFee ?? detail.earlyCheckinFee ?? 0);
  const earlyCheckInFee = Number.isFinite(parsedEarlyCheckInFee) ? parsedEarlyCheckInFee : 0;
  const rawLateFee = detail.lateCheckOutFee ?? detail.lateCheckoutFee ?? detail.lateFee;
  const parsedLateFee = rawLateFee === undefined || rawLateFee === null || rawLateFee === ""
    ? undefined
    : Number(rawLateFee);
  const lateFee = parsedLateFee !== undefined && Number.isFinite(parsedLateFee) ? parsedLateFee : undefined;
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
    lateFee,
    roomPaid,
    paidAmount,
    remainingAmount,
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
  const hotelId = useAppSelector((state) => state.auth.hotelId);
  const employeeId = useAppSelector((state) => state.auth.employeeId);
  const dispatch = useAppDispatch();
  const { data: services = [], isLoading: isServicesLoading, isError: isServicesError } = useGetAllServicesQuery(hotelId ? { hotelId: Number(hotelId), activeOnly: true } : { activeOnly: true });
  const [modifyBooking] = useModifyBookingMutation();
  const { t } = useTranslation();
  const [activeFlow, setActiveFlow] = useState<DailyRecord["flow"]>("check-in");
  const [query, setQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => new Date());
  const date = toDateParam(selectedDate);
  const checkInQuery = useGetTodayCheckInsQuery(
    { date, status: "PENDING", bookingStatus: "CONFIRMED" },
  );
  const checkOutQuery = useGetTodayCheckOutsQuery(
    { date, status: "CHECKED_IN", bookingStatus: "CONFIRMED" },
  );
  const { data: hotelBookings = [] } = useGetBookingsByHotelQuery(Number(hotelId), {
    skip: !hotelId || Number.isNaN(Number(hotelId)),
  });
  const checkoutFeesByDetailId = useMemo(() => {
    const fees = new Map<string, { earlyCheckInFee?: number; lateFee?: number; remainingAmount?: number }>();
    hotelBookings.forEach((booking) => {
      const rawRemainingAmount = booking.remainingAmount as unknown;
      const parsedRemainingAmount = rawRemainingAmount === undefined || rawRemainingAmount === null || rawRemainingAmount === ""
        ? undefined
        : Number(rawRemainingAmount);
      const remainingAmount = parsedRemainingAmount !== undefined && Number.isFinite(parsedRemainingAmount)
        ? parsedRemainingAmount
        : undefined;
      (booking.bookingDetails ?? []).forEach((detail) => {
        const detailId = String(detail.bookingDetailId ?? detail.bookingDetailID ?? detail.bookingDetailsId ?? "");
        const rawEarlyFee = detail.earlyCheckInFee ?? detail.earlyCheckinFee;
        const rawLateFee = detail.lateCheckOutFee ?? detail.lateCheckoutFee ?? detail.lateFee;
        const earlyFee = Number(rawEarlyFee);
        const lateFee = Number(rawLateFee);
        if (detailId) {
          fees.set(detailId, {
            earlyCheckInFee: Number.isFinite(earlyFee) ? earlyFee : undefined,
            lateFee: Number.isFinite(lateFee) ? lateFee : undefined,
            remainingAmount,
          });
        }
      });
    });
    return fees;
  }, [hotelBookings]);

  const todayStr = date ?? toDateParam(new Date()) ?? new Date().toISOString().slice(0, 10);
  const matrixStart = shiftDay(todayStr, -3);
  const matrixEnd = shiftDay(todayStr, 3);
  const { data: matrixData = [] } = useGetRoomMatrixQuery({ startDate: matrixStart, endDate: matrixEnd });

  const [matrixBlockedNotice, setMatrixBlockedNotice] = useState<{
    roomNumber: string;
    message: string;
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
        const formattedEnd = `${String(item.endDate.getHours()).padStart(2, "0")}:${String(item.endDate.getMinutes()).padStart(2, "0")} ${item.endDate.toLocaleDateString("vi-VN")}`;
        return {
          roomNumber: recordRoomNumber,
          conflictBookingId: item.bookingId,
          busyStart: item.startDate,
          busyEnd: item.endDate,
          message: `Phòng ${recordRoomNumber} đang bận trong ma trận phòng (khách trước lưu trú đến ${formattedEnd}). Hệ thống đã chặn làm thủ tục check-in sớm!`,
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
  const [selectingGroupRoom, setSelectingGroupRoom] = useState(false);
  const [selectedGroupRooms, setSelectedGroupRooms] = useState<string[]>([]);
  const [selectedDepartureIds, setSelectedDepartureIds] = useState<string[]>(
    [],
  );
  const [batchCheckoutOpen, setBatchCheckoutOpen] = useState(false);
  const [groupDepartureState, setGroupDepartureState] = useState({
    id: "",
    guest: "",
    rooms: [] as string[],
    time: "",
    guests: 0,
    status: "Đã trả phòng",
    roomAmounts: [] as number[],
    services: [] as number[],
  });
  const [selectedGroupDepartureRooms, setSelectedGroupDepartureRooms] = useState<string[]>([]);
  const [confirmedGroupDepartureRooms, setConfirmedGroupDepartureRooms] = useState<string[]>([]);
  const [groupCheckoutOpen, setGroupCheckoutOpen] = useState(false);
  const [warningAction, setWarningAction] = useState<{ id: string; flow: "check-in" | "check-out"; message: string; fee: number } | null>(null);
  const [bulkCheckIn, { isLoading: isBulkCheckInLoading }] = useBulkCheckInMutation();
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
          earlyCheckInFee: fees?.earlyCheckInFee ?? record.earlyCheckInFee,
          lateFee: fees?.lateFee ?? record.lateFee,
          remainingAmount,
          roomPaid: remainingAmount !== undefined ? remainingAmount <= 0 : record.roomPaid,
        };
      }));
    }
  }, [checkInQuery.data, checkoutFeesByDetailId]);

  useEffect(() => {
    if (checkOutQuery.data) {
      setDepartureState(checkOutQuery.data.map((detail) => {
        const record = mapCheckInOutRecord(detail, "check-out");
        const fees = checkoutFeesByDetailId.get(record.id);
        const remainingAmount = record.remainingAmount ?? fees?.remainingAmount;
        return {
          ...record,
          earlyCheckInFee: fees?.earlyCheckInFee ?? record.earlyCheckInFee,
          lateFee: fees?.lateFee ?? record.lateFee,
          remainingAmount,
          roomPaid: remainingAmount !== undefined ? remainingAmount <= 0 : record.roomPaid,
        };
      }));
    }
  }, [checkOutQuery.data, checkoutFeesByDetailId]);
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
              overdueDuration: formatOverdueDuration(scheduledCheckout, currentTime),
              level: String(detail.surchargeLevel ?? "Chưa phân loại"),
              currentSurcharge: Number.isFinite(surcharge) ? surcharge : undefined,
            }];
          });
          setLateCheckoutEventRecords((current) => ({ ...current, [bookingId]: records }));
        }
        dispatch(baseApi.util.invalidateTags(["Booking"]));
      },
    });
  }, [dispatch, hotelId]);
  useEffect(() => {
    setLateCheckoutEventRecords({});
  }, [date]);
  const dailyRecords = useMemo<DailyRecord[]>(() => {
    const checkInRecords = arrivalState.map((record) => ({
      ...record,
      flow: "check-in" as const,
    }));
    const checkOutRecords = departureState.map((record) => ({
      ...record,
      flow: "check-out" as const,
    }));
    return [...checkInRecords, ...checkOutRecords].sort((a, b) =>
      a.time.localeCompare(b.time),
    );
  }, [arrivalState, departureState]);
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
        overdueDuration: formatOverdueDuration(record.checkOutAt, currentTime),
        level,
        currentSurcharge: record.lateFee,
      }];
    });
  }, [departureState, checkoutClock, lateCheckoutEventRecords]);
  const filtered = filterCheckInOutRecords(dailyRecords, query, activeFlow);

  const groupedArrivalRecords = Object.values(
    arrivalState.reduce<Record<string, DailyRecord[]>>((groups, record) => {
      const key = String(record.bookingId ?? record.id);
      groups[key] = [...(groups[key] ?? []), record];
      return groups;
    }, {}),
  ).filter((records) => records.length > 1);
  const groupedArrivalIds = new Set(groupedArrivalRecords.flatMap((records) => records.map((record) => record.id)));

  const handleRecordAction = (record: DailyRecord) => {
    if (record.flow === "check-out") {
      setCheckoutRecord(record);
      return;
    }

    const now = new Date();
    const [hours, minutes] = record.time.split(":").map(Number);
    const scheduled = new Date(now);
    scheduled.setHours(hours, minutes, 0, 0);
    const isEarly = now < scheduled;

    if (record.flow === "check-in" && isEarly) {
      const conflict = checkMatrixCheckInConflict(record);
      if (conflict) {
        toast({
          variant: "destructive",
          title: "Chặn check-in sớm (Trùng ma trận phòng)",
          description: conflict.message,
        });
        setMatrixBlockedNotice({ roomNumber: conflict.roomNumber, message: conflict.message });
        return;
      }
    }

    if (isEarly) {
      setWarningAction({
        id: record.id,
        flow: record.flow,
        fee: Number(record.earlyCheckInFee ?? 0),
        message: `Khách đang check-in sớm hơn giờ dự kiến ${record.time}.`,
      });
    } else if (record.flow === "check-in") {
      void handleBulkCheckIn([record]);
    }
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
    for (const record of records) {
      const conflict = checkMatrixCheckInConflict(record);
      if (conflict) {
        toast({
          variant: "destructive",
          title: "Chặn check-in sớm (Trùng ma trận phòng)",
          description: conflict.message,
        });
        setMatrixBlockedNotice({
          roomNumber: conflict.roomNumber,
          message: conflict.message,
        });
        return;
      }
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
      const bookingLine = `Mã booking: ${first?.bookingId ?? first?.id ?? "-"}`;
      const guestLine = `Khách hàng: ${first?.guest ?? "-"}`;

      toast({
        variant: "checkin",
        title: "Check-in thành công",
        description: (
          <div className="space-y-1 text-sm">
            <div className="font-semibold text-slate-800">{bookingLine}</div>
            <div className="text-slate-700">{guestLine}</div>
          </div>
        ),
      });
    } catch (error) {
      console.error("Bulk check-in failed", error);
      toast({
        variant: "destructive",
        title: "Check-in thất bại",
        description: "Không thể hoàn tất check-in. Vui lòng thử lại.",
      });
    }
  };

  const handleBulkCheckOut = async (records: DailyRecord[]) => {
    if (records.length === 0) return;
    const invalidRecord = records.find((record) => !record.bookingId || normalizeDetailId(record.id) === null);
    if (invalidRecord) {
      toast({
        variant: "destructive",
        title: "Không thể check-out",
        description: "Thiếu mã booking hoặc mã chi tiết phòng nên chưa gửi được yêu cầu.",
      });
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
          bulkCheckOut({ bookingId, bookingDetailIds }).unwrap(),
        ),
      );
      records.forEach((record) => completeRecord(record.id, "check-out"));
      toast({
        variant: "checkout",
        title: "Check-out thành công",
        description: `Đã hoàn tất check-out cho ${records.length} phòng.`,
      });
    } catch (error) {
      console.error("Bulk check-out failed", error);
      const responseError = error as { data?: { message?: string; error?: string }; error?: string };
      toast({
        variant: "destructive",
        title: "Check-out thất bại",
        description: responseError.data?.message ?? responseError.data?.error ?? responseError.error ?? "Không thể hoàn tất check-out. Vui lòng thử lại.",
      });
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

  const undoGroupRoomCheckOut = (room: string) => {
    setConfirmedGroupDepartureRooms((current) =>
      current.filter((item) => item !== room),
    );
    setSelectedGroupDepartureRooms((current) =>
      current.filter((item) => item !== room),
    );
    setGroupDepartureState((current) => ({ ...current, status: "Đang ở" }));
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
    if (selectedRecords.length > 0) {
      await handleBulkCheckOut(selectedRecords);
    }
    setSelectedDepartureIds([]);
    setBatchCheckoutOpen(false);
  };

  const toggleGroupDepartureRoom = (room: string) => {
    setSelectedGroupDepartureRooms((current) => current.includes(room) ? current.filter((item) => item !== room) : [...current, room]);
  };

  const completeGroupCheckout = () => {
    if (selectedGroupDepartureRooms.length === 0) return;
    const nextSelected = Array.from(new Set([...selectedGroupDepartureRooms]));
    setSelectedGroupDepartureRooms(nextSelected);
    if (nextSelected.length === groupDepartureState.rooms.length) {
      setGroupDepartureState((current) => ({ ...current, status: "Đã trả phòng" }));
    }
  };

  const groupArrivalComplete = groupArrivalState.rooms.every((room) => checkedInGroupRooms.includes(room));
  const groupDepartureComplete = groupDepartureState.rooms.every((room) => confirmedGroupDepartureRooms.includes(room));

  const groupDialogRooms = groupArrivalState.rooms.map((room) => ({
    id: room,
    label: "Phòng",
    meta: room,
    status: checkedInGroupRooms.includes(room) ? "complete" as const : "pending" as const,
  }));
  const batchDialogRooms = departureState.filter((record) => record.status === "Đang ở").map((record) => ({
    id: record.id,
    badge: record.room.split(" · ")[0].slice(-2),
    label: record.guest,
    meta: `Phòng ${record.room.split(" · ")[0]}`,
    status: "pending" as const,
    amount: (record.services || []).reduce((total, service) => total + service.amount, 0) + (record.lateFee || 0),
  }));
  const groupDepartureItems = groupDepartureState.rooms.map((room, index) => ({
    id: room,
    badge: room.slice(-2),
    title: `Phòng ${room}`,
    subtitle: `${groupDepartureState.id} · Dịch vụ/phụ thu: ${groupDepartureState.services[index].toLocaleString("vi-VN")}đ`,
    status: confirmedGroupDepartureRooms.includes(room) ? "complete" as const : selectedGroupDepartureRooms.includes(room) ? "pending" as const : "pending" as const,
  }));
  const groupCheckoutSummaryRooms: CheckoutSummaryRoom[] = groupDepartureState.rooms
    .filter((room) => selectedGroupDepartureRooms.includes(room))
    .map((room) => {
      const index = groupDepartureState.rooms.indexOf(room);
      return {
        id: room,
        label: `Phòng ${room}`,
        roomPaid: false,
        roomAmount: groupDepartureState.roomAmounts[index],
        services: groupDepartureState.services[index] > 0 ? [{ name: "Dịch vụ / phụ thu", quantity: 1, amount: groupDepartureState.services[index] }] : [],
      };
    });
  const confirmGroupCheckout = (roomsToConfirm = selectedGroupDepartureRooms) => {
    if (roomsToConfirm.length === 0) return;
    const merged = Array.from(new Set([...confirmedGroupDepartureRooms, ...roomsToConfirm]));
    setConfirmedGroupDepartureRooms(merged);
    setSelectedGroupDepartureRooms([]);
    setGroupCheckoutOpen(false);
    if (merged.length === groupDepartureState.rooms.length) setGroupDepartureState((current) => ({ ...current, status: "Đã trả phòng" }));
  };
  const checkoutRoomsFromRecords = (records: Array<Pick<DailyRecord, "id" | "bookingId" | "guest" | "room" | "roomAmount" | "roomPaid" | "remainingAmount" | "services" | "lateFee">>): CheckoutSummaryRoom[] => records.map((record) => ({
    id: record.id,
    bookingId: record.bookingId,
    label: `Phòng ${record.room.split(" · ")[0]} · ${record.guest}`,
    roomAmount: record.roomAmount,
    roomPaid: record.roomPaid,
    remainingAmount: record.remainingAmount,
    services: record.services,
    lateFee: record.lateFee,
  }));

  const confirmCheckout = async () => {
    if (!checkoutRecord) return;
    await handleBulkCheckOut([checkoutRecord]);
    setCheckoutRecord(null);
  };

  const handleLateCheckout = (lateCheckout: LateCheckoutRecord) => {
    const record = departureState.find((item) => item.id === lateCheckout.recordId);
    if (record) {
      setCheckoutRecord(record);
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

  const serviceSelectionsForRecord = (record: DailyRecord) => {
    const currentServices = recordServices[record.id] ?? record.services ?? [];
    const selectionsByServiceId = new Map<string, ServiceSelection>();
    currentServices.forEach((service) => {
      const serviceName = service.name.trim().toLocaleLowerCase();
      const catalogService = services.find((item) => item.name.trim().toLocaleLowerCase() === serviceName);
      const serviceId = String(catalogService?.id ?? service.serviceId ?? "");
      if (!serviceId) return;
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
          price: service.quantity > 0 ? service.amount / service.quantity : undefined,
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
    if (!serviceRecord) return;
    const toServiceCharges = (roomSelections: ServiceSelection[]) => roomSelections.map((selection) => ({
      serviceId: selection.serviceId,
      name: services.find((service) => service.id === selection.serviceId)?.name ?? "Dịch vụ",
      quantity: selection.quantity,
      amount: (selection.price ?? services.find((service) => service.id === selection.serviceId)?.price ?? 0) * selection.quantity,
    }));

    if (!serviceRecordIdsByRoom) {
      const localSelections = serviceModeSelections();
      setRecordServices((current) => ({ ...current, [serviceRecord.id]: toServiceCharges(localSelections) }));
      setServiceRecord(null);
      return;
    }

    const linkedRecords = Object.values(serviceRecordIdsByRoom).map((recordId) =>
      [...arrivalState, ...departureState].find((record) => record.id === recordId),
    );
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
          usedAt: selection.usedAt ?? new Date().toISOString().slice(0, 19),
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
    }

    setServiceRecordIdsByRoom(null);
    setServiceRecord(null);
  };

  const openRoomModal = (record: DailyRecord) => {
    const [roomId, roomType] = record.room.split(" · ");
    const fallback: RoomDetail = {
      id: roomId,
      type: roomType || t("frontDesk.unknownRoomType", "Unknown room type"),
      floor: t("frontDesk.notUpdated", "Not updated"),
      beds: t("frontDesk.notUpdated", "Not updated"),
      size: t("frontDesk.notUpdated", "Not updated"),
      view: t("frontDesk.notUpdated", "Not updated"),
      rate: t("frontDesk.notUpdated", "Not updated"),
      status: t("frontDesk.updating", "Updating"),
      note: t(
        "frontDesk.syncNote",
        "Room details will be synced from the room system.",
      ),
      amenities: [t("frontDesk.notUpdated", "Not updated")],
    };
    setRoomPreview({ record, detail: fallback });
  };

  return (
    <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label="Loại thủ tục" className="flex w-fit shrink-0 gap-5 border-b border-slate-200">
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
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Đã thanh toán đủ</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />Chưa thanh toán đủ</span>
          </div>
          <DatePickerPopover
            value={selectedDate}
            onChange={setSelectedDate}
            placeholder="Chọn ngày"
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
              description={`${records.length} phòng · ${records.reduce((total, record) => total + (record.guests ?? 0), 0)} khách · Nhận lúc ${firstRecord.time}`}
              items={records.map((record) => ({
                id: record.id,
                title: record.room,
                subtitle: "",
                status: record.status === "Đã check-in" ? "complete" as const : "pending" as const,
                roomPaid: record.roomPaid,
              }))}
              selectedIds={completedIds}
              draftSelectedIds={completedIds}
              actionLabel="Check-in các phòng"
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
                  await handleBulkCheckIn(nextRecords);
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
              description={`${groupArrivalState.rooms.length} phòng · ${groupArrivalState.guests} khách · Nhận lúc ${groupArrivalState.time}`}
              items={groupArrivalState.rooms.map((room) => ({ id: room, title: `Phòng ${room}`, subtitle: groupArrivalState.id, status: checkedInGroupRooms.includes(room) ? "complete" as const : "pending" as const }))}
              selectedIds={checkedInGroupRooms}
              draftSelectedIds={selectedGroupRooms}
              actionLabel={`Check-in cả đoàn`}
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
        {!groupDepartureComplete && groupDepartureState.status === "Đang ở" &&
          activeFlow === "check-out" &&
          `${groupDepartureState.guest} ${groupDepartureState.id} ${groupDepartureState.rooms.join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase()) && (
            <BatchStayCard
              mode="check-out"
              title={groupDepartureState.guest}
              description={`${groupDepartureState.rooms.length} phòng · ${groupDepartureState.guests} khách · Trả lúc ${groupDepartureState.time}`}
              items={groupDepartureItems}
              selectedIds={confirmedGroupDepartureRooms}
              draftSelectedIds={selectedGroupDepartureRooms}
              actionLabel="Check-out cả đoàn"
              actionCount={groupDepartureState.rooms.length}
              actionDisabled={false}
              onAddService={() => openGroupServiceSelector(groupDepartureState.id, groupDepartureState.guest, groupDepartureState.rooms, groupDepartureState.guests)}
              checkoutSummaryRooms={groupCheckoutSummaryRooms}
              onAction={(nextSelected) => {
                if (nextSelected.length === 0) return;
                setSelectedGroupDepartureRooms(nextSelected);
                const selectedTotal = groupDepartureState.rooms
                  .filter((room) => nextSelected.includes(room))
                  .reduce((total, room) => { const index = groupDepartureState.rooms.indexOf(room); return total + groupDepartureState.roomAmounts[index] + groupDepartureState.services[index]; }, 0);
                if (selectedTotal > 0) setGroupCheckoutOpen(true);
                else confirmGroupCheckout(nextSelected);
              }}
            />
          )}
        <CheckInOutRecordList
          records={filtered}
          groupedRecordIds={groupedArrivalIds}
          recordServices={recordServices}
          checkMatrixCheckInConflict={checkMatrixCheckInConflict}
          onRecordAction={handleRecordAction}
          onAddService={openServiceSelector}
          onUndo={undoRecordAction}
          onViewBooking={(record) => setBookingDetailRecords([{ ...record, services: recordServices[record.id] ?? record.services }])}
        />
      </div>
      {filtered.length === 0 && (
        <div className="p-8 text-center">
          <p className="text-sm font-semibold text-slate-700">
            Không có lượt phù hợp trong hôm nay
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Thử đổi từ khoá tìm kiếm hoặc chuyển sang tab còn lại.
          </p>
        </div>
      )}
      {bookingDetailRecords && (
        <CheckInOutBookingDetailModal
          records={bookingDetailRecords}
          onClose={() => setBookingDetailRecords(null)}
        />
      )}
      {warningAction && (
        <EarlyLateStayNotice
          action={warningAction.flow}
          message={warningAction.message}
          fee={warningAction.fee}
          onCancel={() => setWarningAction(null)}
          onConfirm={() => {
            const action = warningAction;
            setWarningAction(null);
            const record = filtered.find((item) => item.id === action.id) ?? null;
            if (action.flow === "check-in" && record) {
              const conflict = checkMatrixCheckInConflict(record);
              if (conflict) {
                toast({
                  variant: "destructive",
                  title: "Chặn check-in sớm (Trùng ma trận phòng)",
                  description: conflict.message,
                });
                setMatrixBlockedNotice({
                  roomNumber: conflict.roomNumber,
                  message: conflict.message,
                });
                return;
              }
              void handleBulkCheckIn([record]);
            } else if (record) {
              setCheckoutRecord(record);
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
                  Chặn thủ tục Check-in sớm
                </h3>
                <p className="mt-0.5 text-xs text-rose-600 font-semibold">
                  Trùng lịch bận trên Ma trận phòng (GetMatrix)
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-xs font-medium text-slate-700 leading-relaxed">
              {matrixBlockedNotice.message}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setMatrixBlockedNotice(null)}
                className="rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 transition-colors shadow-sm"
              >
                Đã hiểu & Đóng
              </button>
            </div>
          </div>
        </div>
      )}
      {serviceRecord && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onMouseDown={() => setServiceRecord(null)}>
          <div className="booking-service-modal-scroll max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Dịch vụ cho khách</p><h3 className="mt-1 text-lg font-bold text-slate-900">{serviceRecord.guest} · {serviceRecord.room.split(" · ")[0]}</h3></div><button type="button" onClick={() => setServiceRecord(null)} className="text-2xl leading-none text-slate-400">×</button></div>
            <BookingServiceSelector rooms={serviceSelectorRooms} services={services} servicesLoading={isServicesLoading} servicesError={isServicesError} serviceMode={serviceModalMode} setServiceMode={setServiceModalMode} allRoomServices={serviceAllSelections} setAllRoomServices={setServiceAllSelections} roomServices={serviceRoomSelections} setRoomServices={setServiceRoomSelections} roomRanges={{}} fallbackRange={{ checkIn: "2026-01-01", checkOut: "2026-01-02" }} language="vi" nightsForRoom={() => 1} onContinue={saveRecordServices} onSkip={() => setServiceRecord(null)} continueLabel="Xác nhận" skipLabel="Đóng" />
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
                  Check-in từng phòng
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">
                  Chọn phòng khách nhận hôm nay
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Có thể chọn hoặc bỏ chọn trước khi xác nhận.
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
                        <span>Phòng</span>
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
                        {selected ? "Đã chọn · Bấm để bỏ" : "Bấm để chọn"}
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
                Hủy
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
                Xác nhận check-in ({selectedGroupRooms.length})
              </button>
            </div>
          </div>
        </div>
      )}
      {checkoutRecord &&
        (() => {
          const services = recordServices[checkoutRecord.id] ?? checkoutRecord.services ?? [];
          const serviceTotal = services.reduce(
            (total, service) => total + service.amount,
            0,
          );
          const earlyCheckInFee = checkoutRecord.earlyCheckInFee || 0;
          const lateFee = checkoutRecord.lateFee || 0;
          const overdueDuration = checkoutRecord.checkOutAt && new Date(checkoutRecord.checkOutAt).getTime() < checkoutClock
            ? formatOverdueDuration(checkoutRecord.checkOutAt, new Date(checkoutClock).toISOString())
            : null;
          const totalDue = checkoutRecord.remainingAmount ?? serviceTotal + earlyCheckInFee + lateFee;
          const formatMoney = (amount: number) =>
            `${amount.toLocaleString("vi-VN")}đ`;
          return (
            <div
              className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
              onMouseDown={() => setCheckoutRecord(null)}
            >
              <div
                className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                      Đối soát check-out
                    </p>
                    <h3 className="mt-1 text-xl font-bold text-slate-900">
                      {checkoutRecord.guest} ·{" "}
                      {checkoutRecord.room.split(" · ")[0]}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Booking {checkoutRecord.id}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCheckoutRecord(null)}
                    className="text-2xl leading-none text-slate-400"
                  >
                    ×
                  </button>
                </div>
                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-3">
                    <span>
                      <span className="block font-semibold text-slate-700">
                        Tiền phòng
                      </span>
                      <span className="text-xs text-emerald-700">
                        Đã thanh toán 100% lúc đặt · Mã GD: {checkoutRecord.id}
                      </span>
                    </span>
                    <strong className="text-emerald-700">
                      {formatMoney(Number(checkoutRecord.roomAmount ?? 0))}
                    </strong>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="font-semibold text-slate-700">
                      Dịch vụ phát sinh
                    </p>
                    {services.length === 0 && (
                      <p className="mt-2 text-xs text-slate-400">
                        Không có dịch vụ phát sinh.
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
                        <span>Phụ thu check-in sớm</span>
                        <span className="font-semibold">
                          {formatMoney(earlyCheckInFee)}
                        </span>
                      </div>
                    )}
                    {overdueDuration && (
                      <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-slate-600">
                        <span>Thời gian check-out trễ</span>
                        <span className="font-semibold">{overdueDuration}</span>
                      </div>
                    )}
                    {lateFee > 0 && (
                      <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-slate-600">
                        <span>Phụ thu check-out trễ</span>
                        <span className="font-semibold">
                          {formatMoney(lateFee)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                    <span className="font-bold text-slate-900">
                      Còn phải thanh toán
                    </span>
                    <strong className="text-lg text-blue-700">
                      {formatMoney(totalDue)}
                    </strong>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setCheckoutRecord(null)}
                    className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={confirmCheckout}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    <CreditCard size={16} />
                    Xác nhận Check-out
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
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Đối soát check-out cả đoàn</p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">{groupDepartureState.guest}</h3>
                <p className="mt-1 text-sm text-slate-500">{selectedGroupDepartureRooms.length} phòng · Booking {groupDepartureState.id}</p>
              </div>
              <button type="button" onClick={() => setGroupCheckoutOpen(false)} className="text-2xl leading-none text-slate-400">×</button>
            </div>
            <div className="mt-5">
              <CheckoutSummary rooms={groupCheckoutSummaryRooms} />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setGroupCheckoutOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600">Hủy</button>
              <button type="button" onClick={() => confirmGroupCheckout()} className="flex w-56 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><CreditCard size={16} />Thanh toán & Check-out</button>
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
                  Chi tiết phòng
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">
                  Phòng {roomPreview.detail.id} · {roomPreview.detail.type}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Booking {roomPreview.record.id} · Khách{" "}
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
                  Thông tin cơ bản
                </p>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p>
                    <span className="font-semibold">Tầng:</span>{" "}
                    {roomPreview.detail.floor}
                  </p>
                  <p>
                    <span className="font-semibold">Giường:</span>{" "}
                    {roomPreview.detail.beds}
                  </p>
                  <p>
                    <span className="font-semibold">Diện tích:</span>{" "}
                    {roomPreview.detail.size}
                  </p>
                  <p>
                    <span className="font-semibold">Hướng:</span>{" "}
                    {roomPreview.detail.view}
                  </p>
                  <p>
                    <span className="font-semibold">Giá:</span>{" "}
                    {roomPreview.detail.rate}
                  </p>
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500">
                  Trạng thái vận hành
                </p>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p>
                    <span className="font-semibold">Tình trạng phòng:</span>{" "}
                    {roomPreview.detail.status}
                  </p>
                  <p>
                    <span className="font-semibold">Lượt hiện tại:</span>{" "}
                    {roomPreview.record.flow === "check-in"
                      ? "Check-in"
                      : "Check-out"}{" "}
                    lúc {roomPreview.record.time}
                  </p>
                  <p>
                    <span className="font-semibold">Trạng thái lượt:</span>{" "}
                    {roomPreview.record.status}
                  </p>
                  <p>
                    <span className="font-semibold">Ghi chú:</span>{" "}
                    {roomPreview.detail.note}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-500">
                Tiện ích phòng
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
                Xác nhận
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
                Phòng đoàn đã check-in
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Bấm “Bỏ check-in” nếu nhận nhầm phòng để chọn lại.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-blue-700">
              {checkedInGroupRooms.length}/{groupArrivalState.rooms.length}{" "}
              phòng
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
                Phòng {room} · Bỏ check-in
              </button>
            ))}
          </div>
        </div>
      )}
      {selectedGroupDepartureRooms.length > 0 && activeFlow === "check-out" && (
        <div className="border-t border-slate-100 bg-amber-50/40 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold text-slate-900">
                Phòng đoàn đã check-out
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Bấm “Bỏ check-out” nếu chọn nhầm phòng để chọn lại.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-amber-700">
              {selectedGroupDepartureRooms.length}/{groupDepartureState.rooms.length}{" "}
              phòng
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedGroupDepartureRooms.map((room) => (
              <button
                type="button"
                key={room}
                onClick={() => undoGroupRoomCheckOut(room)}
                className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
              >
                Phòng {room} · Bỏ check-out
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
                  Check-in từng phòng
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">
                  Cập nhật trạng thái phòng
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Bấm vào phòng để đổi trạng thái. Phòng vẫn giữ trong danh sách
                  để chỉnh lại.
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
                      <span>Phòng</span>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] ${checkedIn ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                      >
                        {checkedIn ? "Đã check-in" : "Chờ check-in"}
                      </span>
                    </span>
                    <span className="mt-2 block text-lg font-bold text-slate-900">
                      {room}
                    </span>
                    <span
                      className={`mt-1 block text-xs ${checkedIn ? "text-rose-600" : "text-blue-700"}`}
                    >
                      {checkedIn ? "Bấm để hoàn tác" : "Bấm để check-in"}
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
              Đóng
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
        onToggle={toggleDepartureSelection}
        onClose={() => setBatchCheckoutOpen(false)}
        onConfirm={confirmBatchCheckout}
      />
    </section>
  );
}
