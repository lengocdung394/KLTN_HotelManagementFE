import { toast } from "@/components/ui/use-toast";
import DatePickerPopover from "../components/DatePickerPopover";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Banknote, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CreditCard, Eye, QrCode, RefreshCw, Search, UserRound, UsersRound, Wallet } from "lucide-react";
import GuestRoomForms, { bookingCache, clearRoomGuestCache, isBookingGuestValid, setBookingRoomTotalCache, setRoomGuestCache, type BookingGuest, type RoomGuestCounts } from "./GuestRoomForms.tsx";
import BookingServiceSelector, { type ServiceSelection } from "../components/BookingServiceSelector";
import PromotionSelector, { type SelectedPromotion } from "../components/PromotionSelector";
import RoomDetailModal, { type RoomDetailsData } from "../components/RoomDetailModal";
import { useGetBranchRoomDailyPricesQuery, useGetRoomSeasonalRatesByMonthQuery, useGetRoomTypesQuery, useGetRoomsByCurrentHotelQuery, type RoomDailyPricesResponse, type RoomSeasonalRate } from "../services/roomApi";
import { useGetBuildingsByCurrentHotelQuery } from "../services/buildingApi";
import { useGetFloorsByBuildingIdQuery } from "../services/floorApi";
import { useGetAllServicesQuery } from "../services/serviceApi";
import { useCreateCounterBookingMutation, type BookingListItem, useGetRoomMatrixQuery, type RoomMatrixResponse } from "../services/bookingApi";
import { useGetCustomerByIdQuery } from "../services/customerApi";
import { useModifyBookingMutation, type ManagementBookingModificationRequest } from "../services/managementBookingApi";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { sumRoomPriceForRange } from "../lib/bookingPricing";
import { promotionEligibilityMessage } from "../lib/promotionPricing";
import { calculatePromotionDiscount } from "../lib/promotionPricing";
import { bindHotelSocketEvents } from "../lib/socket";
import { baseApi } from "../services/baseApi";

type BookingRoom = { id: string; databaseId?: string; roomNumber?: string; type: string; beds: string; size: string; guests: number; price: number; standardAdults: number; maxAdults: number; maxChildren: number; maxInfants: number; maxExtraGuests: number; extraAdultFee: number; extraChildFee: number; buildingId?: string; buildingName?: string; floor?: string; images?: string[]; services?: string[]; status?: string; description?: string };

const roomTypes = {
  1: { type: "Standard Room", beds: "1 giường đơn", size: "25 m²", guests: 1, price: 1000000, amenity: "Điều hòa · TV · Phòng tắm riêng" },
  2: { type: "Superior Room", beds: "2 giường đơn", size: "30 m²", guests: 2, price: 1500000, amenity: "Điều hòa · TV · Bồn tắm" },
  3: { type: "Deluxe Room", beds: "1 giường King Size", size: "45 m²", guests: 2, price: 2000000, amenity: "Minibar · TV màn hình lớn · Vòi sen massage" },
  4: { type: "Suite Room", beds: "1 giường King Size + 1 giường đơn", size: "60 m²", guests: 3, price: 2500000, amenity: "Phòng khách riêng · Bồn tắm · Baby Cot" },
} as const;

const booked: Record<string, { start: string; end: string; guest: string }[]> = {};


const timeline = ["06/09", "07/09", "08/09", "09/09", "10/09", "11/09", "12/09"];
const money = (value: number) => value.toLocaleString("vi-VN") + "đ";
const serviceDetailIdOf = (service: Record<string, unknown>) => String(service.bookingServiceDetailId ?? service.serviceDetailId ?? service.bookingServiceDetailID ?? service.serviceDetailID ?? service.id ?? service.serviceId ?? "");
const isCancelledBookingDetail = (detail: Record<string, unknown>) => String(detail.bookingStatusType ?? "").toUpperCase() === "CANCELLED";
const bookingDetailIdOf = (detail: Record<string, unknown>) => String(detail.bookingDetailId ?? detail.bookingDetailsId ?? detail.bookingDetailID ?? detail.detailId ?? detail.detailID ?? detail.id ?? "");
const bookingDetailStatusOf = (detail: Record<string, unknown>) => {
  const rawStatus = detail.bookingDetailStatusType
    ?? detail.bookingDetailsStatusType
    ?? detail.bookingDetailStatus
    ?? detail.bookingDetailsStatus
    ?? detail.bookingStatusType
    ?? detail.detailStatus
    ?? detail.status
    ?? detail.bookingStatus;
  if (rawStatus && typeof rawStatus === "object") {
    const statusObject = rawStatus as Record<string, unknown>;
    return String(statusObject.code ?? statusObject.name ?? statusObject.status ?? "").trim().toUpperCase();
  }
  return String(rawStatus ?? "").trim().toUpperCase();
};
const hasActualCheckIn = (detail: Record<string, unknown>) => {
  const checkInStatus = String(detail.checkInStatus ?? detail.checkinStatus ?? detail.arrivalStatus ?? "").trim().toUpperCase();
  const checkedInStatuses = ["CHECKED_IN", "CHECKEDIN", "CHECKED-IN", "CHECK_IN", "IN_HOUSE", "INHOUSE", "ARRIVED", "IN_PROGRESS"];
  const checkedInStatus = checkedInStatuses.includes(bookingDetailStatusOf(detail))
    || checkedInStatuses.includes(checkInStatus);
  const checkedInFlag = [detail.isCheckedIn, detail.checkedIn, detail.checkInCompleted, detail.hasCheckedIn]
    .some((value) => value === true || String(value).toLowerCase() === "true");
  const hasCheckInTime = [detail.actualCheckInTime, detail.actualCheckIn, detail.realCheckInTime, detail.checkInActualTime, detail.checkedInAt]
    .some((value) => value !== undefined && value !== null && value !== false && value !== 0 && String(value).trim() !== "" && String(value).toLowerCase() !== "false");
  return checkedInStatus || checkedInFlag || hasCheckInTime;
};
const isCancelledService = (service: Record<string, unknown>) => {
  const status = String(service.status ?? service.serviceStatus ?? service.bookingServiceStatus ?? service.state ?? "").trim().toUpperCase();
  const cancelled = [service.isCancelled, service.isCanceled, service.cancelled, service.canceled, service.isDeleted, service.deleted]
    .some((value) => value === true || String(value).toLowerCase() === "true");
  const hasCancellationDate = Boolean(service.cancelledAt ?? service.canceledAt ?? service.cancellationDate);
  const quantity = Number(service.quantity ?? service.serviceQuantity ?? service.quantityService ?? service.amount);
  return status.includes("CANCEL") || status.includes("HỦY") || status.includes("HUY") || cancelled || hasCancellationDate || (Number.isFinite(quantity) && quantity <= 0);
};
const servicesOf = (detail: Record<string, unknown>) => {
  const serviceValues = Object.entries(detail)
    .filter(([key]) => key.toLowerCase().includes("service"))
    .map(([, value]) => value);
  const collect = (value: unknown): Record<string, unknown>[] => {
    if (Array.isArray(value)) return value.flatMap(collect);
    if (!value || typeof value !== "object") return [];
    const item = value as Record<string, unknown>;
    if (item.serviceId !== undefined || item.serviceID !== undefined || item.service_id !== undefined) return [item];
    return Object.values(item).flatMap(collect);
  };
  return serviceValues.flatMap(collect).filter((service) => !isCancelledService(service));
};

const allFloorsLabel = "Tất cả các tầng";
const allBuildingsLabel = "Tất cả các tòa";
const allRoomTypesLabel = "Tất cả loại phòng";
const roomTypeLabel = (value: string) => ({ STANDARD: "Standard Room", SUPERIOR: "Superior Room", DELUXE: "Deluxe Room", SUITE: "Suite Room", FAMILY: "Family Room" }[value] ?? value);
const roomFloor = (room: BookingRoom) => room.floor ?? `Tầng ${room.id.split("-")[1] ?? ""}`;
const todayLocal = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const matrixDate = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0];
};

const getSeasonalEventDates = (events: RoomSeasonalRate[]) => {
  const dates = new Set<string>();
  events.forEach((event) => {
    const startDate = matrixDate(event.startDate);
    const endDate = matrixDate(event.endDate);
    if (!startDate || !endDate || startDate > endDate) return;
    for (let date = startDate; date <= endDate; date = shiftDay(date, 1)) dates.add(date);
  });
  return [...dates];
};

const matrixValue = (item: Record<string, unknown>, keys: string[]) => {
  const key = keys.find((candidate) => item[candidate] !== undefined && item[candidate] !== null && item[candidate] !== "");
  return key ? item[key] : undefined;
};

const matrixRoomKey = (item: Record<string, unknown>) => {
  const value = matrixValue(item, ["roomId", "roomID", "room_id", "roomNumber", "roomNo", "roomCode", "roomCode"]);
  return value === undefined ? undefined : String(value);
};

const addMatrixRange = (busy: Map<string, Set<string>>, roomKey: string | undefined, startValue: unknown, endValue: unknown) => {
  const start = matrixDate(startValue);
  const end = matrixDate(endValue);
  if (!roomKey || !start || !end || start >= end) return;
  const dates = busy.get(roomKey) ?? new Set<string>();
  for (let date = start; date < end; date = shiftDay(date, 1)) dates.add(date);
  busy.set(roomKey, dates);
};

type BookingRoomRange = { start: string; end: string };

const roomKeysOf = (room: BookingRoom) => [room.databaseId, room.id, room.roomNumber].filter(Boolean).map(String);

const buildBookingRoomRanges = (booking?: BookingListItem) => {
  const ranges = new Map<string, BookingRoomRange[]>();
  const details = Array.isArray(booking?.bookingDetails) ? booking.bookingDetails.filter((detail) => !isCancelledBookingDetail(detail)) : [];

  details.forEach((detail) => {
    const keys = [
      matrixValue(detail, ["roomId", "roomID", "room_id"]),
      matrixValue(detail, ["roomNumber", "roomNo", "roomCode"]),
    ].filter((value): value is string | number => typeof value === "string" || typeof value === "number").map(String);
    const start = matrixDate(matrixValue(detail, ["checkInTime", "checkInDate", "startDate"]));
    const end = matrixDate(matrixValue(detail, ["checkOutTime", "checkOutDate", "endDate"]));
    if (!start || !end || start >= end) return;

    keys.forEach((key) => {
      const roomRanges = ranges.get(key) ?? [];
      roomRanges.push({ start, end });
      ranges.set(key, roomRanges);
    });
  });

  return ranges;
};

const isBookingRoomDate = (ranges: Map<string, BookingRoomRange[]>, roomKeys: string[], date: string) =>
  roomKeys.some((key) => ranges.get(key)?.some((range) => date >= range.start && date < range.end));

const buildMatrixBusyMap = (matrix: RoomMatrixResponse[], excludedBookingId?: string) => {
  const busy = new Map<string, Set<string>>();
  const walk = (value: unknown, inheritedRoomKey?: string) => {
    if (Array.isArray(value)) {
      value.forEach((item) => walk(item, inheritedRoomKey));
      return;
    }
    if (!value || typeof value !== "object") return;
    const item = value as Record<string, unknown>;
    const bookingId = matrixValue(item, ["bookingId", "bookingID", "booking_id", "orderId", "orderID"]);
    if (excludedBookingId && bookingId !== undefined && String(bookingId) === excludedBookingId) return;
    const roomKey = matrixRoomKey(item) ?? inheritedRoomKey;
    const bookingStatus = String(item.bookingStatus ?? item.status ?? "").toUpperCase();
    if (bookingStatus === "CANCELLED" || bookingStatus === "CANCELED") return;
    addMatrixRange(busy, roomKey, matrixValue(item, ["startDate", "start", "checkInDate", "checkIn", "checkInTime", "checkinTime", "bookingStartDate"]), matrixValue(item, ["endDate", "end", "checkOutDate", "checkOut", "checkOutTime", "checkoutTime", "bookingEndDate"]));
    const dates = item.dates ?? item.bookedDates ?? item.occupiedDates;
    if (Array.isArray(dates) && roomKey) {
      const occupied = busy.get(roomKey) ?? new Set<string>();
      dates.forEach((date) => { const normalized = matrixDate(date); if (normalized) occupied.add(normalized); });
      busy.set(roomKey, occupied);
    }
    Object.values(item).forEach((child) => walk(child, roomKey));
  };
  walk(matrix);
  return busy;
};

// Dịch 1 chuỗi ngày "YYYY-MM-DD" đi +/- delta ngày
const shiftDay = (dateStr: string, delta: number) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
};

type RoomDateRange = { checkIn: string; checkOut: string };

const formatDateLabel = (value: string, fallback: string, language: string) => value ? new Date(`${value}T00:00:00`).toLocaleDateString(language === "en" ? "en-US" : "vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : fallback;

const getApiValue = (item: Record<string, unknown>, keys: string[]) => keys.map((key) => item[key]).find((value) => value !== undefined && value !== null && value !== "");

const mapApiRoom = (item: Record<string, unknown>, index: number): BookingRoom => {
  const rawType = roomTypeLabel(String(getApiValue(item, ["roomType", "roomName", "type", "name"]) ?? "Standard Room"));
  const fallback = Object.values(roomTypes).find((room) => room.type.toLowerCase() === rawType.toLowerCase()) ?? roomTypes[1];
  const roomId = String(getApiValue(item, ["roomNumber", "roomCode", "code", "id"]) ?? `room-${index + 1}`);
  const databaseId = getApiValue(item, ["id", "roomId", "roomID"]);
  const buildingId = getApiValue(item, ["buildingId", "buildingID"]);
  const buildingName = String(getApiValue(item, ["nameBuilding", "buildingName", "buildingCode"]) ?? "").trim();
  const floorValue = String(getApiValue(item, ["floorNumber", "floorLevel", "floorName", "floorId", "floorID"]) ?? "");
  const rawSize = getApiValue(item, ["roomSize", "size", "area", "roomArea", "acreage"]);
  const size = rawSize === undefined ? fallback.size : `${rawSize}`.includes("m²") ? String(rawSize) : `${rawSize} m²`;
  const rawImages = getApiValue(item, ["avatarUrl", "imageUrls", "images"]);
  const imageEntries = Array.isArray(rawImages) ? rawImages : rawImages ? [rawImages] : [];
  const defaultImage = getApiValue(item, ["defaultImageUrl", "imageUrl"]);
  const images = [
    ...(typeof defaultImage === "string" ? [defaultImage] : []),
    ...imageEntries.map((image) => typeof image === "string" ? image : String((image as Record<string, unknown>).url ?? "")),
  ].filter((image, imageIndex, values) => image && values.indexOf(image) === imageIndex);
  const rawServices = getApiValue(item, ["amenities", "roomAmenities", "amenityList", "amenityResponses", "roomAmenityResponses", "services", "amenityNames"]);
  const serviceEntries = Array.isArray(rawServices) ? rawServices : typeof rawServices === "string" ? rawServices.split(/[;,|]/) : [];
  const services = serviceEntries.map((service) => {
    if (typeof service === "string") return service.trim();
    if (!service || typeof service !== "object") return "";
    const amenity = service as Record<string, unknown>;
    const nestedAmenity = amenity.amenity && typeof amenity.amenity === "object" ? amenity.amenity as Record<string, unknown> : amenity;
    return String(nestedAmenity.name ?? nestedAmenity.amenityName ?? nestedAmenity.serviceName ?? nestedAmenity.title ?? "").trim();
  }).filter(Boolean);
  const rawStatus = String(getApiValue(item, ["roomStatus", "status"]) ?? "");
  const status = ({ READY: "Sẵn sàng", MAINTENANCE: "Bảo trì", IN_USE: "Đang ở", CLEANING: "Đang dọn" } as Record<string, string>)[rawStatus.toUpperCase()] ?? (rawStatus || undefined);
  const description = getApiValue(item, ["description", "roomDescription"]);
  const price = Number(getApiValue(item, ["totalPrice", "basePrice", "price"]) ?? fallback.price);
  const guests = Number(getApiValue(item, ["standardCapacity", "capacity", "maxGuests", "guestCapacity"]) ?? fallback.guests);
  const maxExtraGuests = Number(getApiValue(item, ["maxExtraGuests"]) ?? 0);
  const maxAdults = Number(getApiValue(item, ["maxAdults", "standardAdults", "adults", "adultCapacity"]) ?? guests + maxExtraGuests);
  const standardAdults = Number(getApiValue(item, ["standardAdults", "defaultAdults", "adults", "standardCapacity"]) ?? Math.min(guests, maxAdults));
  const maxChildren = Number(getApiValue(item, ["maxChildren", "children", "childCapacity"]) ?? 0);
  const maxInfants = Number(getApiValue(item, ["maxInfants", "infants", "infantCapacity"]) ?? 0);
  const extraAdultFee = Number(getApiValue(item, ["extraAdultFee"]) ?? 0);
  const extraChildFee = Number(getApiValue(item, ["extraChildFee"]) ?? 0);

  return {
    id: roomId,
    databaseId: databaseId == null ? undefined : String(databaseId),
    roomNumber: String(getApiValue(item, ["roomNumber", "roomNo", "number"]) ?? roomId),
    type: rawType,
    beds: String(getApiValue(item, ["bedType", "bedTypeName"]) ?? fallback.beds),
    size,
    guests: Number.isFinite(guests) ? guests : fallback.guests,
    price: Number.isFinite(price) ? price : fallback.price,
    standardAdults: Number.isFinite(standardAdults) ? standardAdults : Math.min(fallback.guests, maxAdults),
    maxAdults: Number.isFinite(maxAdults) ? maxAdults : fallback.guests,
    maxChildren: Number.isFinite(maxChildren) ? maxChildren : 0,
    maxInfants: Number.isFinite(maxInfants) ? maxInfants : 0,
    maxExtraGuests: Number.isFinite(maxExtraGuests) ? maxExtraGuests : 0,
    extraAdultFee: Number.isFinite(extraAdultFee) ? extraAdultFee : 0,
    extraChildFee: Number.isFinite(extraChildFee) ? extraChildFee : 0,
    buildingId: buildingId === undefined ? undefined : String(buildingId),
    buildingName: buildingName || undefined,
    floor: floorValue.toLowerCase().startsWith("tầng") ? floorValue : floorValue ? `Tầng ${floorValue}` : undefined,
    images,
    services,
    status,
    description: description == null ? undefined : String(description),
  };
};

function DatePicker({ label, value, min, onChange, hotelId }: { label: string; value: string; min?: string; onChange: (value: string) => void; hotelId?: string | number | null }) {
  const { t, i18n } = useTranslation();
  const [pickerMonth, setPickerMonth] = useState(() => value ? new Date(`${value}T00:00:00`) : new Date());
  const { data: monthlyRates } = useGetRoomSeasonalRatesByMonthQuery(
    { hotelId: Number(hotelId), month: pickerMonth.getMonth() + 1, year: pickerMonth.getFullYear() },
    { skip: !hotelId || Number.isNaN(Number(hotelId)) },
  );
  const eventDates = useMemo(() => getSeasonalEventDates(monthlyRates?.content ?? []), [monthlyRates?.content]);

  useEffect(() => {
    if (value) setPickerMonth(new Date(`${value}T00:00:00`));
  }, [value]);

  const formatDateForInput = (date: Date | undefined) => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  return (
    <div className="relative z-50">
      <p className="text-xs font-bold text-slate-700">{label}</p>
      <div className="mt-1.5">
        <DatePickerPopover
          value={value ? new Date(`${value}T00:00:00`) : undefined}
          onMonthChange={setPickerMonth}
          highlightDates={eventDates}
          onChange={(nextDate) => {
            if (!nextDate) return;
            const nextValue = formatDateForInput(nextDate);
            if (!min || nextValue >= min) {
              onChange(nextValue);
            }
          }}
          placeholder={t("booking.noDateSelected", "Chọn ngày")}
          buttonClassName="flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 text-left text-xs font-semibold text-slate-800 outline-none transition duration-150 hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
      </div>
    </div>
  );
}

function DesktopCalendar({
  visibleRooms,
  selected,
  setSelected,
  checkIn,
  checkOut,
  setCheckIn,
  setCheckOut,
  selectedRanges,
  setSelectedRanges,
  isAddingRoom,
  isAvailableForRange,
  hotelId,
  onDailyPricesChange,
  editingBookingId,
  editingBookingRanges,
  isChangingRoom,
  roomChangeTargetRoomId,
  roomChangeTargetRange,
  onReplaceRoom,
  onReplaceRoomUnavailable,
  showRoomChangeAction,
  canChangeRoom,
  onStartRoomChange,
}: {
  visibleRooms: BookingRoom[];
  selected: string[];
  setSelected: React.Dispatch<React.SetStateAction<string[]>>;
  checkIn: string;
  checkOut: string;
  setCheckIn: (value: string) => void;
  setCheckOut: (value: string) => void;
  selectedRanges: Record<string, RoomDateRange>;
  setSelectedRanges: React.Dispatch<React.SetStateAction<Record<string, RoomDateRange>>>;
  isAddingRoom: boolean;
  isAvailableForRange: (room: BookingRoom, start: string, end: string) => boolean;
  hotelId: number;
  onDailyPricesChange?: (prices: RoomDailyPricesResponse) => void;
  editingBookingId?: string;
  editingBookingRanges: Map<string, BookingRoomRange[]>;
  isChangingRoom?: boolean;
  roomChangeTargetRoomId?: string | null;
  roomChangeTargetRange?: RoomDateRange;
  onReplaceRoom?: (room: BookingRoom, range?: RoomDateRange) => void;
  onReplaceRoomUnavailable?: () => void;
  showRoomChangeAction?: boolean;
  canChangeRoom?: (room: BookingRoom) => boolean;
  onStartRoomChange?: (room: BookingRoom) => void;
}) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalDays = 14;
  const todayValue = todayLocal();
  const [timelineStart, setTimelineStart] = useState(todayValue);
  const [timelinePickerOpen, setTimelinePickerOpen] = useState(false);
  const [timelinePickerMonth, setTimelinePickerMonth] = useState(() => new Date(`${todayValue}T00:00:00`));
  useEffect(() => {
    setTimelinePickerMonth(new Date(`${timelineStart}T00:00:00`));
  }, [timelineStart]);
  const stableTimeline = useMemo(() => {
    const start = new Date(`${timelineStart}T00:00:00`);

    return Array.from({ length: totalDays }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return {
        label: `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`,
        day: ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][date.getDay()],
        value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
      };
    });
  }, [timelineStart]);
  const timelineEnd = stableTimeline[stableTimeline.length - 1]?.value ?? timelineStart;
  const timelineStartDate = new Date(`${timelineStart}T00:00:00`);
  const timelineEndDate = new Date(`${timelineEnd}T00:00:00`);
  const { data: startMonthEvents } = useGetRoomSeasonalRatesByMonthQuery(
    { hotelId, month: timelineStartDate.getMonth() + 1, year: timelineStartDate.getFullYear() },
    { skip: !hotelId || Number.isNaN(Number(hotelId)) },
  );
  const { data: endMonthEvents } = useGetRoomSeasonalRatesByMonthQuery(
    { hotelId, month: timelineEndDate.getMonth() + 1, year: timelineEndDate.getFullYear() },
    { skip: !hotelId || Number.isNaN(Number(hotelId)) },
  );
  const seasonalEventDates = useMemo(
    () => new Set(getSeasonalEventDates([...(startMonthEvents?.content ?? []), ...(endMonthEvents?.content ?? [])])),
    [startMonthEvents?.content, endMonthEvents?.content],
  );
  const { data: dailyRoomPrices = {} } = useGetBranchRoomDailyPricesQuery(
    { hotelId, startDate: timelineStart, endDate: timelineEnd },
    { skip: !hotelId || Number.isNaN(Number(hotelId)) },
  );
  const { data: roomMatrix = [] } = useGetRoomMatrixQuery(
    { startDate: timelineStart, endDate: timelineEnd },
    { skip: !hotelId || Number.isNaN(Number(hotelId)) },
  );

  useEffect(() => {
    if (!hotelId || Number.isNaN(Number(hotelId))) return;

    bindHotelSocketEvents({
      onRoomMatrixUpdated: () => {
        dispatch(baseApi.util.invalidateTags(["Booking", "Room", "BranchRoomPolicy"]));
      },
      onRoomPolicyUpdated: () => {
        dispatch(baseApi.util.invalidateTags(["Room", "Booking", "BranchRoomPolicy"]));
      },
      onNewBookingNotification: () => {
        dispatch(baseApi.util.invalidateTags(["Booking", "Room"]));
      },
      onSeasonalRateAnnouncementUpdate: () => {
        dispatch(baseApi.util.invalidateTags(["Room", "Booking", "BranchRoomPolicy"]));
      },
    });
  }, [dispatch, hotelId]);

  const matrixBusyDays = useMemo(() => buildMatrixBusyMap(roomMatrix, editingBookingId), [roomMatrix, editingBookingId]);
  useEffect(() => {
    onDailyPricesChange?.(dailyRoomPrices);
  }, [dailyRoomPrices, onDailyPricesChange]);
  const roomPriceForDay = (room: BookingRoom, day: string) => {
    const prices = dailyRoomPrices[room.id] ?? (room.databaseId ? dailyRoomPrices[room.databaseId] : undefined);
    const value = prices?.[day];
    return typeof value === "number" ? value : room.price;
  };
  const isMatrixReserved = (room: BookingRoom, day: string) => {
    return roomKeysOf(room).some((key) => matrixBusyDays.get(key)?.has(day));
  };
  const isAvailableWithMatrix = (room: BookingRoom, start: string, end: string) => {
    if (!isAvailableForRange(room, start, end)) return false;
    for (let day = start; day < end; day = shiftDay(day, 1)) {
      const dateIsPast = new Date(`${day}T00:00:00`) < today;
      const isOwnBookingDate = isBookingRoomDate(editingBookingRanges, roomKeysOf(room), day);
      if (dateIsPast && !isOwnBookingDate) return false;
      if (isMatrixReserved(room, day)) return false;
    }
    return true;
  };
  const rangeForRoom = (room: BookingRoom) =>
    selectedRanges[room.id]
    ?? (room.databaseId ? selectedRanges[room.databaseId] : undefined)
    ?? (room.roomNumber ? selectedRanges[room.roomNumber] : undefined);
  const firstSelectedRoomRange = selected
    .map((roomId) => {
      const selectedRoom = visibleRooms.find((room) => room.id === roomId);
      return selectedRoom ? rangeForRoom(selectedRoom) : selectedRanges[roomId];
    })
    .find((range): range is RoomDateRange => Boolean(range));
  const rangeForRoomSelection = (room: BookingRoom) => selected.includes(room.id)
    ? rangeForRoom(room) ?? firstSelectedRoomRange ?? (checkIn && checkOut ? { checkIn, checkOut } : undefined)
    : firstSelectedRoomRange ?? (checkIn && checkOut ? { checkIn, checkOut } : undefined);

  const [dragSelection, setDragSelection] = useState<{ roomId: string; startDayIndex: number; currentDayIndex: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [roomDetails, setRoomDetails] = useState<RoomDetailsData | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  }, [timelineStart]);

  const scrollByDays = (days: number) => {
    setTimelineStart((current) => {
      const next = shiftDay(current, days);
      return next < todayValue ? todayValue : next;
    });
  };

  const scrollToToday = () => {
    setTimelinePickerOpen((current) => !current);
  };

  const formatRange = (start: string) => `${start.slice(8, 10)}/${start.slice(5, 7)} - ${shiftDay(start, 6).slice(8, 10)}/${shiftDay(start, 6).slice(5, 7)}`;
  const previousStart = shiftDay(timelineStart, -7) < todayValue ? todayValue : shiftDay(timelineStart, -7);
  const canGoPrevious = previousStart !== timelineStart;

  const isReservedCell = (room: BookingRoom, dayValue: string) => {
    const roomKeys = roomKeysOf(room);
    if (isBookingRoomDate(editingBookingRanges, roomKeys, dayValue)) return false;
    return roomKeys.some((roomKey) => (booked[roomKey] || []).some((item) => dayValue >= item.start && dayValue < item.end));
  };

  const isPastDate = (dayValue: string) => {
    return new Date(`${dayValue}T00:00:00`) < today;
  };

  const handlePointerDown = (roomId: string, dayIndex: number) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const dayValue = stableTimeline[dayIndex].value;
    const room = visibleRooms.find((item) => item.id === roomId);
    if (isChangingRoom && roomId === roomChangeTargetRoomId) return;
    if (room && showRoomChangeAction && selected.includes(roomId) && !canChangeRoom?.(room)) return;
    const isOwnBookingDate = room && isBookingRoomDate(editingBookingRanges, roomKeysOf(room), dayValue);
    if ((isPastDate(dayValue) && !isOwnBookingDate) || (room && isReservedCell(room, dayValue)) || (room && isMatrixReserved(room, dayValue))) return;
    
    setDragSelection({ roomId, startDayIndex: dayIndex, currentDayIndex: dayIndex });
  };

  const handlePointerEnter = (roomId: string, dayIndex: number) => (e: React.PointerEvent) => {
    if (!dragSelection || dragSelection.roomId !== roomId) return;
    
    // Check if moving over edges to auto-scroll
    if (scrollRef.current) {
      const rect = scrollRef.current.getBoundingClientRect();
      const edgeThreshold = 80;
      if (e.clientX - rect.left < 260 + edgeThreshold) { // 260px is the sticky column width
        scrollRef.current.scrollBy({ left: -20, behavior: "auto" });
      } else if (rect.right - e.clientX < edgeThreshold) {
        scrollRef.current.scrollBy({ left: 20, behavior: "auto" });
      }
    }

    setDragSelection(prev => prev ? { ...prev, currentDayIndex: dayIndex } : null);
  };

  const handlePointerUpContainer = () => {
    if (!dragSelection) return;
    
    const { roomId, startDayIndex, currentDayIndex } = dragSelection;
    const minDay = Math.min(startDayIndex, currentDayIndex);
    const maxDay = Math.max(startDayIndex, currentDayIndex);
    const isSingleClick = startDayIndex === currentDayIndex;
    const clickedDate = stableTimeline[startDayIndex].value;
    const currentRange = selectedRanges[roomId];
    const clickedRoom = visibleRooms.find((item) => item.id === roomId);

    if (isChangingRoom && clickedRoom && clickedRoom.id !== roomChangeTargetRoomId && isSingleClick) {
      const originalRange = roomChangeTargetRange ?? { checkIn, checkOut };
      const originalNights = Math.max(1, Math.round((new Date(originalRange.checkOut).getTime() - new Date(originalRange.checkIn).getTime()) / 86400000));
      const nextRange = { checkIn: clickedDate, checkOut: shiftDay(clickedDate, originalNights) };
      if (isAvailableWithMatrix(clickedRoom, nextRange.checkIn, nextRange.checkOut)) {
        onReplaceRoom?.(clickedRoom, nextRange);
      } else {
        onReplaceRoomUnavailable?.();
      }
      setDragSelection(null);
      return;
    }
    
    if (isSingleClick && currentRange) {
      const checkInDate = currentRange.checkIn;
      const lastNightDate = shiftDay(currentRange.checkOut, -1);

      if (clickedDate === shiftDay(checkInDate, -1) || clickedDate === currentRange.checkOut) {
        const newCheckIn = clickedDate < checkInDate ? clickedDate : checkInDate;
        const newCheckOut = clickedDate > lastNightDate
          ? shiftDay(clickedDate, 1)
          : currentRange.checkOut;

        const room = visibleRooms.find((item) => item.id === roomId);
        if (room && isAvailableWithMatrix(room, newCheckIn, newCheckOut)) {
          setSelected((prev) => prev.includes(roomId) ? prev : [...prev, roomId]);
          setSelectedRanges((prev) => ({ ...prev, [roomId]: { checkIn: newCheckIn, checkOut: newCheckOut } }));
          setDragSelection(null);
          return;
        }
      }
      
      if (clickedDate === checkInDate || clickedDate === lastNightDate) {
        const isSingleNight = checkInDate === lastNightDate;
        
        if (isSingleNight) {
          const remainingRooms = selected.filter((id) => id !== roomId);
          setSelected(remainingRooms);
          setSelectedRanges((prev) => {
            const next = { ...prev };
            delete next[roomId];

            return next;
          });
          setDragSelection(null);
          return;
        } else {
          let newCheckIn = currentRange.checkIn;
          let newCheckOut = currentRange.checkOut;
          
          if (clickedDate === checkInDate) {
            newCheckIn = shiftDay(checkInDate, 1);
          } else if (clickedDate === lastNightDate) {
            newCheckOut = lastNightDate; // Which is checkout minus 1
          }
          
          setSelectedRanges(prev => ({ ...prev, [roomId]: { checkIn: newCheckIn, checkOut: newCheckOut } }));
          setDragSelection(null);
          return;
        }
      }
    }

    const newCheckIn = stableTimeline[minDay].value;
    const newCheckOut = stableTimeline[maxDay + 1]?.value || shiftDay(stableTimeline[maxDay].value, 1);
    
    let isValid = true;
    for (let i = minDay; i <= maxDay; i++) {
      const room = visibleRooms.find((item) => item.id === roomId);
      const date = stableTimeline[i].value;
      const isOwnBookingDate = room && isBookingRoomDate(editingBookingRanges, roomKeysOf(room), date);
      if ((isPastDate(date) && !isOwnBookingDate) || (room && isReservedCell(room, date)) || (room && isMatrixReserved(room, date))) {
         isValid = false;
         break;
       }
    }
    
    const room = visibleRooms.find((item) => item.id === roomId);
    if (isValid && room && isAvailableWithMatrix(room, newCheckIn, newCheckOut)) {
      if (isChangingRoom) {
        if (room.id !== roomChangeTargetRoomId) {
          onReplaceRoom?.(room, { checkIn: newCheckIn, checkOut: newCheckOut });
        } else {
          onReplaceRoomUnavailable?.();
        }
        setDragSelection(null);
        return;
      }
      setSelected(prev => prev.includes(roomId) ? prev : [...prev, roomId]);
      setSelectedRanges(prev => ({ ...prev, [roomId]: { checkIn: newCheckIn, checkOut: newCheckOut } }));
    }
    
    setDragSelection(null);
  };

  useEffect(() => {
    const handleGlobalUp = () => {
       if (dragSelection) handlePointerUpContainer();
    };
    window.addEventListener("pointerup", handleGlobalUp);
    return () => window.removeEventListener("pointerup", handleGlobalUp);
  }, [dragSelection]);

  return (
    <div className="relative z-0 mt-5 flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
      {/* Matrix Header Toolbar */}
      <div className="relative z-20 flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 p-3.5 sm:flex-row sm:items-center sm:justify-between">
        {/* Status Legend Pills */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
          <span className="flex items-center gap-1.5 text-slate-700">
            <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 shadow-2xs" />
            Đang chọn đặt
          </span>
          <span className="flex items-center gap-1.5 text-slate-700">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-2xs" />
            Đã đặt / Giữ chỗ
          </span>
          <span className="flex items-center gap-1.5 text-slate-700">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-200 border border-sky-400 shadow-2xs" />
            Phòng trống
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            Đã qua
          </span>
        </div>

        {/* Date Navigation Controls */}
        <div className="relative flex items-center gap-2">
          <button
            type="button"
            disabled={!canGoPrevious}
            onClick={() => scrollByDays(-7)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-100 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={15} /> {formatRange(timelineStart)}
          </button>

          <button
            type="button"
            onClick={scrollToToday}
            aria-label={t("booking.today", "Hôm nay")}
            title={t("booking.today", "Hôm nay")}
            className="grid h-8.5 w-8.5 place-items-center rounded-xl border border-slate-200 bg-white text-blue-600 shadow-2xs transition hover:bg-blue-50"
          >
            <CalendarDays size={17} />
          </button>

          <button
            type="button"
            onClick={() => scrollByDays(7)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-100 hover:text-blue-700"
          >
            {formatRange(shiftDay(timelineStart, 7))} <ChevronRight size={15} />
          </button>

          {timelinePickerOpen && (() => {
            const pickerYear = timelinePickerMonth.getFullYear();
            const pickerMonth = timelinePickerMonth.getMonth();
            const firstDayOfMonth = new Date(pickerYear, pickerMonth, 1).getDay();
            const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
            const monthLabel = timelinePickerMonth.toLocaleDateString("vi-VN", { month: "long", year: "numeric" });
            const selectedDate = new Date(`${timelineStart}T00:00:00`);
            const todayDate = new Date();
            todayDate.setHours(0, 0, 0, 0);

            return (
              <div className="absolute right-0 top-12 z-50 w-[min(19rem,calc(100vw-2rem))] rounded-[1.25rem] border border-slate-200 bg-white p-3.5 shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
                <div className="flex items-center justify-between pb-3">
                  <button
                    type="button"
                    onClick={() => setTimelinePickerMonth(new Date(pickerYear, pickerMonth - 1, 1))}
                    className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Tháng trước"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <p className="text-sm font-bold capitalize text-slate-800">{monthLabel}</p>

                  <button
                    type="button"
                    onClick={() => setTimelinePickerMonth(new Date(pickerYear, pickerMonth + 1, 1))}
                    className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Tháng sau"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                  {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((day) => (
                    <span key={day} className="py-1">{day}</span>
                  ))}
                </div>

                <div className="mt-1 grid grid-cols-7 gap-1">
                  {Array.from({ length: firstDayOfMonth }, (_, index) => (
                    <span key={`empty-${index}`} className="h-9 w-9" />
                  ))}

                  {Array.from({ length: daysInMonth }, (_, index) => {
                    const day = index + 1;
                    const date = new Date(pickerYear, pickerMonth, day);
                    const isSelected = date.toDateString() === selectedDate.toDateString();
                    const isToday = date.toDateString() === todayDate.toDateString();
                    const isDisabled = date < todayDate;

                    return (
                      <button
                        key={day}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          const nextDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                          setTimelineStart(nextDate);
                          setTimelinePickerOpen(false);
                        }}
                        className={`grid h-9 w-9 place-items-center rounded-lg text-xs font-medium transition ${
                          isSelected
                            ? "bg-blue-600 text-white shadow-sm"
                            : isDisabled
                              ? "cursor-not-allowed text-slate-300"
                              : isToday
                                ? "border border-blue-200 bg-blue-50 font-bold text-blue-700"
                                : "text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const current = new Date();
                    const nextDate = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
                    setTimelineStart(nextDate);
                    setTimelinePickerOpen(false);
                  }}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-50 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  <Check size={14} />
                  Hôm nay
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Interactive Matrix Grid Area */}
      <div 
        ref={scrollRef}
        className="relative z-10 w-full touch-pan-x overflow-x-auto overflow-y-hidden overscroll-x-contain scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent"
        onPointerLeave={handlePointerUpContainer}
      >
        <div className="min-w-fit" style={{ width: `${260 + totalDays * 96}px` }}>
          {/* Days Header Row */}
          <div className="grid border-b border-slate-200 bg-slate-50/90 relative" style={{ gridTemplateColumns: `260px repeat(${totalDays}, minmax(96px, 1fr))` }}>
            <div className="sticky left-0 top-0 z-30 flex items-center border-r border-slate-200 bg-slate-50 px-4 py-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
              {t("booking.roomTypeLabel", "Phòng & Loại phòng")}
            </div>
            {stableTimeline.map((date) => {
              const isWeekend = date.day === "T7" || date.day === "CN";
              const isToday = date.value === todayValue;
              const hasEvent = seasonalEventDates.has(date.value);

              return (
                <div
                  key={date.value}
                  className={`border-l border-slate-200/80 px-2 py-2.5 text-center transition ${
                    isToday
                      ? "bg-blue-50/80 text-blue-900 border-b-2 border-b-blue-600 font-bold"
                      : isWeekend
                      ? "bg-amber-50/60 text-amber-900 font-semibold"
                      : ""
                  }`}
                >
                  <p className={`text-[10px] font-extrabold uppercase ${isWeekend ? "text-amber-700" : isToday ? "text-blue-700" : "text-slate-400"}`}>
                    {date.day}
                  </p>
                  <p className={`mt-0.5 text-xs font-extrabold ${isPastDate(date.value) ? "text-slate-400" : isToday ? "text-blue-900" : "text-slate-800"}`}>
                    {date.label}
                  </p>
                  {hasEvent && <span title="Ngày có sự kiện giá" className="mt-0.5 inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] font-bold leading-none text-amber-800">Sự kiện</span>}
                </div>
              );
            })}
          </div>

          {/* Room Matrix Rows */}
          {visibleRooms.map((room) => (
            <div key={room.id} className="grid min-h-[100px] border-b border-slate-100 last:border-0 relative hover:bg-slate-50/40 transition-colors" style={{ gridTemplateColumns: `260px repeat(${totalDays}, minmax(96px, 1fr))` }}>
              {/* Left Room Title Column */}
              <div className="sticky left-0 top-0 z-20 flex items-stretch gap-1 border-r border-slate-100 bg-white p-0 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                <button
                  type="button"
                  disabled={!isChangingRoom && Boolean(rangeForRoomSelection(room)) && !isAvailableWithMatrix(
                    room,
                    rangeForRoomSelection(room)?.checkIn ?? checkIn,
                    rangeForRoomSelection(room)?.checkOut ?? checkOut,
                  )}
                  onClick={() => {
                    if (isChangingRoom) {
                      const range = roomChangeTargetRange ?? { checkIn, checkOut };
                      if (range.checkIn && range.checkOut && isAvailableWithMatrix(room, range.checkIn, range.checkOut)) {
                        onReplaceRoom?.(room, range);
                      } else {
                        onReplaceRoomUnavailable?.();
                      }
                      return;
                    }
                    if (selected.includes(room.id)) {
                      if (showRoomChangeAction && !canChangeRoom?.(room)) return;
                      const remainingRooms = selected.filter((id) => id !== room.id);
                      setSelected(remainingRooms);
                      setSelectedRanges((prev) => {
                        const next = { ...prev };
                        delete next[room.id];
                        return next;
                      });
                      return;
                    }

                    const defaultRange = rangeForRoomSelection(room);
                    setSelected((current) => [...current, room.id]);
                    if (defaultRange) {
                      setSelectedRanges((prev) => ({
                        ...prev,
                        [room.id]: defaultRange,
                        ...(room.databaseId ? { [room.databaseId]: defaultRange } : {}),
                      }));
                    }
                  }}
                  className={`flex h-full min-w-0 flex-1 items-center gap-3 p-3.5 text-left transition-all duration-200 ${
                    selected.includes(room.id) ? "bg-blue-50/70" : "bg-white hover:bg-slate-50"
                  } ${!isChangingRoom && Boolean(rangeForRoomSelection(room)) && !isAvailableWithMatrix(
                    room,
                    rangeForRoomSelection(room)?.checkIn ?? checkIn,
                    rangeForRoomSelection(room)?.checkOut ?? checkOut,
                  ) ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  <span
                    className={`grid h-10 min-w-[54px] shrink-0 place-items-center rounded-xl px-2 text-[11px] font-extrabold whitespace-nowrap transition-all ${
                      selected.includes(room.id)
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs shadow-blue-300"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {room.id}
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <strong className="block truncate text-xs font-bold text-slate-800">{room.type}</strong>
                    <small className="mt-0.5 block truncate text-[10px] text-slate-500">{room.beds} · {room.size}</small>
                  </span>
                </button>
                <div className="my-auto mr-2 flex shrink-0 items-center gap-1">
                  {showRoomChangeAction && selected.includes(room.id) && (
                    <button
                      type="button"
                      disabled={!canChangeRoom?.(room)}
                      title={!canChangeRoom?.(room) ? "Chỉ được đổi phòng khi booking-detail còn PENDING và chưa check-in." : isChangingRoom && room.id === roomChangeTargetRoomId ? "Hủy đổi phòng" : "Đổi phòng"}
                      aria-label={`${isChangingRoom && room.id === roomChangeTargetRoomId ? "Hủy đổi phòng" : "Đổi phòng"} ${room.roomNumber ?? room.id}`}
                      onClick={() => onStartRoomChange?.(room)}
                      aria-pressed={isChangingRoom && room.id === roomChangeTargetRoomId}
                      className={`flex h-8 shrink-0 items-center gap-1 rounded-md px-1.5 text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent ${isChangingRoom && room.id === roomChangeTargetRoomId ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300 shadow-sm" : "text-blue-600 hover:bg-blue-50"}`}
                    >
                      <RefreshCw size={13} />
                      <span>{isChangingRoom && room.id === roomChangeTargetRoomId ? "Hủy" : "Đổi"}</span>
                    </button>
                  )}
                  <button type="button" title={`Xem chi tiết phòng ${room.roomNumber ?? room.id}`} aria-label={`Xem chi tiết phòng ${room.roomNumber ?? room.id}`} onClick={() => setRoomDetails({
                  id: room.id,
                  name: room.type,
                  images: room.images ?? [],
                  floor: room.floor ?? roomFloor(room),
                  size: room.size,
                  beds: room.beds,
                  capacity: room.guests,
                  standardCapacity: room.guests,
                  maxExtraGuests: room.maxExtraGuests,
                  extraAdultFee: room.extraAdultFee,
                  extraChildFee: room.extraChildFee,
                  guestPolicy: `Tiêu chuẩn ${room.guests} người · Ghép thêm tối đa ${room.maxExtraGuests} người`,
                  price: room.price,
                  status: room.status ?? "Chưa cập nhật",
                  cleaner: "",
                  services: room.services ?? [],
                  description: room.description,
                  buildingId: room.buildingId,
                  buildingName: room.buildingName,
                  })} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                    <Eye size={16} />
                  </button>
                </div>
              </div>

              {/* Day Cell Slots */}
              {stableTimeline.map((date, dayIndex) => {
                const day = date.value;
                const reservation = isReservedCell(room, day)
                  ? roomKeysOf(room).flatMap((key) => booked[key] ?? []).find((item) => day >= item.start && day < item.end)
                  : undefined;
                const matrixReserved = isMatrixReserved(room, day);
                const roomRange = selectedRanges[room.id];
                const inRange = Boolean(roomRange) && day >= roomRange.checkIn && day < roomRange.checkOut;
                const isOwnBookingDate = isBookingRoomDate(editingBookingRanges, roomKeysOf(room), day);
                const pastDay = isPastDate(day) && !isOwnBookingDate;
                
                let isDraggingCell = false;
                if (dragSelection && dragSelection.roomId === room.id) {
                  const minD = Math.min(dragSelection.startDayIndex, dragSelection.currentDayIndex);
                  const maxD = Math.max(dragSelection.startDayIndex, dragSelection.currentDayIndex);
                  isDraggingCell = dayIndex >= minD && dayIndex <= maxD;
                }

                return (
                  <div
                    key={`${room.id}-${day}`}
                    onPointerDown={handlePointerDown(room.id, dayIndex)}
                    onPointerEnter={handlePointerEnter(room.id, dayIndex)}
                    title={reservation ? `${reservation.guest} · đã đặt` : undefined}
                    className="p-1"
                  >
                    <div className={`flex h-full min-h-[72px] flex-col justify-center rounded-xl border px-2 py-1.5 shadow-2xs transition-all duration-150 ${
                      pastDay
                        ? "border-slate-200 bg-slate-100/70 text-slate-400 opacity-60 cursor-not-allowed"
                        : reservation || matrixReserved
                        ? "border-emerald-300/80 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-xs shadow-emerald-200/50 font-bold"
                        : isDraggingCell
                        ? "border-blue-400 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-300/50 animate-pulse font-extrabold"
                        : inRange && selected.includes(room.id)
                        ? "border-blue-400 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-300/50 font-extrabold"
                        : inRange
                        ? "border-blue-200 bg-blue-100/80 text-blue-900 font-bold"
                        : "border-slate-200/90 bg-white text-slate-700 hover:border-blue-400 hover:bg-blue-50/80 hover:text-blue-900 shadow-2xs"
                    }`}>
                      <span className="truncate text-center text-[10px] font-extrabold">
                        {reservation || matrixReserved ? "Đã đặt" : `${money(roomPriceForDay(room, day))}/đêm`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {roomDetails && <RoomDetailModal room={roomDetails} onClose={() => setRoomDetails(null)} />}
    </div>
  );
}

export default function BookingWorkspace() {
  const location = useLocation();
  const initialBooking = (location.state as { editBooking?: BookingListItem } | null)?.editBooking;
  const initialBookingDetails = useMemo(
    () => (Array.isArray(initialBooking?.bookingDetails) ? initialBooking.bookingDetails : []).filter((detail) => !isCancelledBookingDetail(detail)),
    [initialBooking],
  );
  const editingBookingId = initialBooking ? String(initialBooking.bookingId ?? initialBooking.orderId ?? "") : undefined;
  const editingBookingRanges = useMemo(() => buildBookingRoomRanges(initialBooking), [initialBooking]);
  const initialCustomerId = String(initialBooking?.customerId ?? initialBooking?.customerID ?? "");
  const { data: customerById } = useGetCustomerByIdQuery(initialCustomerId, { skip: !initialCustomerId });
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const hotelId = useAppSelector((state) => state.auth.hotelId);
  const employeeId = useAppSelector((state) => state.auth.employeeId);
  const [createCounterBooking, { isLoading: isCreatingBooking, error: bookingError }] = useCreateCounterBookingMutation();
  const [modifyBooking, { isLoading: isModifyingBooking }] = useModifyBookingMutation();
  const { data: services = [], isLoading: isServicesLoading, isError: isServicesError } = useGetAllServicesQuery(hotelId ? { hotelId: Number(hotelId), activeOnly: true } : { activeOnly: true });
  const { data: apiBuildings } = useGetBuildingsByCurrentHotelQuery(undefined, { skip: !hotelId || Number.isNaN(Number(hotelId)) });
  const { data: apiRoomTypes } = useGetRoomTypesQuery();
  const { data: apiRooms, isLoading: isRoomsLoading, isError: isRoomsError } = useGetRoomsByCurrentHotelQuery();
  const [step, setStep] = useState<"rooms" | "guest" | "services" | "promotion" | "success">("rooms");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank" | "wallet" | "">("");
  const [paymentError, setPaymentError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedRanges, setSelectedRanges] = useState<Record<string, RoomDateRange>>({});
  const [checkIn, setCheckIn] = useState(todayLocal);
  const [checkOut, setCheckOut] = useState(() => shiftDay(todayLocal(), 1));
  const [query, setQuery] = useState("");
  const [roomType, setRoomType] = useState(allRoomTypesLabel);
  const [building, setBuilding] = useState("Tất cả các tòa");
  const [floor, setFloor] = useState("Tất cả các tầng");
  const [showFull, setShowFull] = useState(false);
  const [showSelectedRoomsOnly, setShowSelectedRoomsOnly] = useState(false);
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  const [roomChangeTargetBookingDetailId, setRoomChangeTargetBookingDetailId] = useState<string | null>(null);
  const [roomChangeTargetRoomId, setRoomChangeTargetRoomId] = useState<string | null>(null);
  const [roomChangeOriginalRange, setRoomChangeOriginalRange] = useState<RoomDateRange | null>(null);
  const [roomChangeTargets, setRoomChangeTargets] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [bookingGuest, setBookingGuest] = useState<BookingGuest>({ name: "", phone: "", identityNumber: "" });
  const createCustomerFromGuest = () => undefined;
  const isCreatingCustomer = false;
  const attemptedCustomerKey = useRef("");
  const [serviceMode, setServiceMode] = useState<"all" | "per-room">("all");
  const [allRoomServices, setAllRoomServices] = useState<ServiceSelection[]>([]);
  const [roomServices, setRoomServices] = useState<Record<string, ServiceSelection[]>>({});
  const [roomGuestSurcharges, setRoomGuestSurcharges] = useState<Record<string, number>>({});
  const [roomGuestSurchargeDetails, setRoomGuestSurchargeDetails] = useState<Record<string, { adult: number; child: number }>>({});
  const [roomGuestCounts, setRoomGuestCounts] = useState<Record<string, RoomGuestCounts>>({});
  useEffect(() => {
    const handleRoomGuestSurcharge = (event: Event) => {
      const detail = (event as CustomEvent<{ roomId?: string; counts?: RoomGuestCounts; surcharge?: number; adultSurcharge?: number; childSurcharge?: number }>).detail;
      if (detail.roomId) {
        if (detail.counts) setRoomGuestCounts((current) => ({ ...current, [detail.roomId as string]: detail.counts as RoomGuestCounts }));
        if (detail.counts) {
          const selectedGuestCount = detail.counts.adults + detail.counts.children + detail.counts.infants;
          setRoomServices((current) => ({ ...current, [detail.roomId as string]: (current[detail.roomId as string] ?? []).map((selection) => selection.applyToRoom !== false ? { ...selection, quantity: selectedGuestCount } : selection) }));
        }
        setRoomGuestSurcharges((current) => ({ ...current, [detail.roomId as string]: detail.surcharge ?? 0 }));
        setRoomGuestSurchargeDetails((current) => ({ ...current, [detail.roomId as string]: { adult: detail.adultSurcharge ?? 0, child: detail.childSurcharge ?? 0 } }));
      }
    };
    window.addEventListener("room-guest-surcharge", handleRoomGuestSurcharge);
    return () => window.removeEventListener("room-guest-surcharge", handleRoomGuestSurcharge);
  }, []);
  const [collapsedSummaryRooms, setCollapsedSummaryRooms] = useState<string[]>([]);
  const [expandedServiceRoom, setExpandedServiceRoom] = useState<string | null>(null);
  const [appliedPromotion, setAppliedPromotion] = useState<SelectedPromotion | null>(null);
  const [promotionBlocked, setPromotionBlocked] = useState(false);
  const rooms = useMemo(() => (apiRooms ?? []).map(mapApiRoom), [apiRooms]);
  const [loadedBookingRooms, setLoadedBookingRooms] = useState<BookingRoom[]>([]);
  const [bookingRoomPrices, setBookingRoomPrices] = useState<Record<string, number>>({});
  const [dailyRoomPrices, setDailyRoomPrices] = useState<RoomDailyPricesResponse>({});
  useEffect(() => {
    if (!initialBooking) return;
    const details = initialBookingDetails;
    const roomKey = (detail: Record<string, unknown>) => String(detail.roomId ?? detail.roomID ?? "");
    const selectedRoomKeys = details.map(roomKey);
    const matchedRooms = rooms.filter((room) => selectedRoomKeys.includes(String(room.databaseId ?? room.id)) || selectedRoomKeys.includes(room.id));
    const fallbackRooms = details
      .filter((detail) => !matchedRooms.some((room) => String(room.databaseId ?? room.id) === roomKey(detail) || room.id === roomKey(detail)))
      .map((detail, index) => {
        const key = roomKey(detail) || `booking-room-${index + 1}`;
        return {
          id: key,
          databaseId: key || undefined,
          roomNumber: String(detail.roomNumber ?? key),
          type: String(detail.roomType ?? detail.roomName ?? "Phòng booking"),
          beds: String(detail.bedType ?? ""),
          size: "",
          guests: Number(detail.numAdults ?? detail.adults ?? 1),
          price: Number(detail.baseRoomPricePerNight ?? detail.roomPrice ?? detail.price ?? 0),
          standardAdults: Number(detail.numAdults ?? detail.adults ?? 1),
          maxAdults: Number(detail.numAdults ?? detail.adults ?? 1),
          maxChildren: Number(detail.numChildren ?? detail.children ?? 0),
          maxInfants: Number(detail.numInfants ?? detail.infants ?? 0),
          maxExtraGuests: Number(detail.maxExtraGuests ?? detail.maxExtraGuest ?? 0),
          extraAdultFee: Number(detail.extraAdultFee ?? detail.extraAdultPrice ?? 0),
          extraChildFee: Number(detail.extraChildFee ?? detail.extraChildPrice ?? 0),
        };
      });
    setLoadedBookingRooms(fallbackRooms);
    const nextRoomPrices = Object.fromEntries(details.flatMap((detail) => {
      const price = Number(detail.baseRoomPricePerNight ?? detail.roomPrice ?? detail.price);
      if (!Number.isFinite(price)) return [];
      const detailRoomKey = roomKey(detail);
      const matchedRoom = matchedRooms.find((room) => String(room.databaseId ?? room.id) === detailRoomKey || room.id === detailRoomKey);
      const keys = matchedRoom && matchedRoom.id !== detailRoomKey ? [detailRoomKey, matchedRoom.id] : [detailRoomKey];
      return keys.map((key) => [key, price]);
    }));
    const nextRanges = Object.fromEntries(details.flatMap((detail) => {
      const detailRoomKey = roomKey(detail);
      const checkInValue = String(detail.checkInTime ?? detail.checkInDate ?? "").slice(0, 10);
      const checkOutValue = String(detail.checkOutTime ?? detail.checkOutDate ?? "").slice(0, 10);
      const range = { checkIn: checkInValue || todayLocal(), checkOut: checkOutValue || shiftDay(todayLocal(), 1) };
      const matchedRoom = matchedRooms.find((room) => String(room.databaseId ?? room.id) === detailRoomKey || room.id === detailRoomKey);
      const keys = matchedRoom && matchedRoom.id !== detailRoomKey ? [detailRoomKey, matchedRoom.id] : [detailRoomKey];
      return keys.map((key) => [key, range]);
    }));
    const nextCounts = Object.fromEntries(details.flatMap((detail) => {
      const detailRoomKey = roomKey(detail);
      const matchedRoom = matchedRooms.find((room) => String(room.databaseId ?? room.id) === detailRoomKey || room.id === detailRoomKey);
      const counts = {
        adults: Number(detail.numAdults ?? detail.adults ?? 1),
        children: Number(detail.numChildren ?? detail.children ?? 0),
        infants: Number(detail.numInfants ?? detail.infants ?? 0),
      };
      const keys = matchedRoom && matchedRoom.id !== detailRoomKey ? [detailRoomKey, matchedRoom.id] : [detailRoomKey];
      return keys.map((key) => [key, counts]);
    }));
    const nextSurcharges: Record<string, number> = {};
    const nextSurchargeDetails: Record<string, { adult: number; child: number }> = {};
    details.forEach((detail) => {
      const detailRoomKey = roomKey(detail);
      const room = [...matchedRooms, ...fallbackRooms].find((item) => String(item.databaseId ?? item.id) === detailRoomKey || item.id === detailRoomKey);
      if (!room) return;
      const counts = nextCounts[room.id] ?? nextCounts[detailRoomKey];
      if (!counts) return;
      const extraGuests = Math.max(0, counts.adults + counts.children - room.guests);
      const extraAdults = Math.min(extraGuests, Math.max(0, counts.adults - room.guests));
      const extraChildren = extraGuests - extraAdults;
      const adultSurcharge = extraAdults * room.extraAdultFee;
      const childSurcharge = extraChildren * room.extraChildFee;
      const keys = room.id === detailRoomKey ? [room.id] : [detailRoomKey, room.id];
      keys.forEach((key) => {
        nextSurcharges[key] = adultSurcharge + childSurcharge;
        nextSurchargeDetails[key] = { adult: adultSurcharge, child: childSurcharge };
      });
    });
    const nextServices = Object.fromEntries(details.flatMap((detail) => {
      const serviceRequests = servicesOf(detail);
      const detailRoomKey = roomKey(detail);
      const matchedRoom = matchedRooms.find((room) => String(room.databaseId ?? room.id) === detailRoomKey || room.id === detailRoomKey);
      const groupedMap = new Map<string, ServiceSelection>();
      serviceRequests.forEach((service) => {
        const nestedService = service.service && typeof service.service === "object" ? service.service as Record<string, unknown> : undefined;
        const rawServiceName = String(service.name ?? service.serviceName ?? service.nameService ?? nestedService?.name ?? nestedService?.serviceName ?? "").trim().toLowerCase();
        const catalogService = services.find((item) => rawServiceName && item.name.trim().toLowerCase() === rawServiceName);
        const sId = String(catalogService?.id ?? service.serviceId ?? service.serviceID ?? service.service_id ?? nestedService?.serviceId ?? nestedService?.id ?? service.id ?? "");
        if (!sId) return;
          const qty = Number(service.quantity ?? service.serviceQuantity ?? service.quantityService ?? service.amount ?? 0);
        const price = service.price === undefined || service.price === null
          ? service.unitPrice === undefined || service.unitPrice === null ? undefined : Number(service.unitPrice)
          : Number(service.price);
        const dId = serviceDetailIdOf(service);

        const existing = groupedMap.get(sId);
        if (existing) {
          existing.quantity += qty;
          existing.originalQuantity = (existing.originalQuantity ?? 0) + qty;
        } else {
          groupedMap.set(sId, {
            serviceId: sId,
            name: String(service.name ?? service.serviceName ?? service.nameService ?? service.service_name ?? ""),
            quantity: qty,
            originalQuantity: qty,
            detailId: dId,
            price,
            usedAt: service.usedAt === undefined && service.usedAtTime === undefined ? undefined : String(service.usedAt ?? service.usedAtTime),
            isExisting: true,
            applyToRoom: false,
          });
        }
      });

      const selections = Array.from(groupedMap.values());
      const keys = matchedRoom && matchedRoom.id !== detailRoomKey ? [detailRoomKey, matchedRoom.id] : [detailRoomKey];
      return keys.map((key) => [key, selections]);
    }));
    const hasExistingServices = Object.values(nextServices).some((selections) => selections.length > 0);
    setSelected([...matchedRooms, ...fallbackRooms].map((room) => room.id));
    setSelectedRanges(nextRanges);
    setRoomGuestCounts(nextCounts);
    setRoomGuestCache(nextCounts);
    setRoomGuestSurcharges(nextSurcharges);
    setRoomGuestSurchargeDetails(nextSurchargeDetails);
    setBookingRoomPrices(nextRoomPrices);
    setRoomServices(nextServices);
    setAllRoomServices([]);
    setServiceMode(hasExistingServices ? "per-room" : "all");
    const customerValue = (initialBooking as Record<string, unknown>).customer;
    const customer = customerValue && typeof customerValue === "object" ? customerValue as Record<string, unknown> : {};
    setBookingGuest({
      name: String(customerById?.name ?? initialBooking.customerName ?? initialBooking.nameCustomer ?? customer.name ?? initialBooking.guestName ?? ""),
      phone: String(customerById?.phone ?? initialBooking.customerPhone ?? initialBooking.phone ?? initialBooking.phoneNumber ?? customer.phone ?? ""),
      identityNumber: String(customerById?.identityNumber ?? initialBooking.identityNumber ?? initialBooking.customerIdentityNumber ?? initialBooking.identityCard ?? customer.identityNumber ?? ""),
      customerId: (customerById?.id ?? initialBooking.customerId ?? initialBooking.customerID ?? customer.id) === undefined
        ? undefined
        : String(customerById?.id ?? initialBooking.customerId ?? initialBooking.customerID ?? customer.id),
    });
    const firstRange = Object.values(nextRanges)[0] as { checkIn: string; checkOut: string } | undefined;
    setCheckIn(firstRange?.checkIn ?? todayLocal());
    setCheckOut(firstRange?.checkOut ?? shiftDay(todayLocal(), 1));
    setStep("guest");
  }, [initialBooking, initialBookingDetails, rooms, customerById]);
  const buildings = useMemo(() => (apiBuildings ?? []).map((item) => {
    const id = getApiValue(item, ["id", "buildingId", "buildingID"]);
    const name = getApiValue(item, ["name", "buildingName", "buildingCode", "code"]);
    return { id: String(id ?? ""), name: String(name ?? id ?? "Tòa nhà") };
  }).filter((item) => item.id), [apiBuildings]);
  const selectedBuilding = buildings.find((item) => item.name === building || item.id === building);
  const { data: apiFloors } = useGetFloorsByBuildingIdQuery(Number(selectedBuilding?.id), { skip: !selectedBuilding?.id || Number.isNaN(Number(selectedBuilding.id)) });
  const apiFloorOptions = useMemo(() => (apiFloors ?? []).map((item) => {
    const id = getApiValue(item, ["id", "floorId", "floorID"]);
    const name = String(getApiValue(item, ["name", "floorName", "floorNumber", "floorLevel", "code", "number"]) ?? id ?? "");
    return { id: String(id ?? ""), name: name.toLowerCase().startsWith("tầng") ? name : `Tầng ${name}` };
  }).filter((item) => item.id && item.name), [apiFloors]);
  const floors = useMemo(() => {
    if (apiFloorOptions.length > 0) return apiFloorOptions;
    const roomFloorNames = rooms
      .filter((room) => building === allBuildingsLabel || room.buildingName === building || room.buildingId === selectedBuilding?.id || room.id.startsWith(`${building}-`))
      .map((room) => roomFloor(room))
      .filter(Boolean);
    return [...new Set(roomFloorNames)].map((name) => ({ id: name, name }));
  }, [apiFloorOptions, rooms, building, selectedBuilding?.id]);
  const buildingOptions = useMemo(() => [allBuildingsLabel, ...buildings.map((item) => item.name)], [buildings]);
  const floorOptions = useMemo(() => [allFloorsLabel, ...floors.map((item) => item.name)], [floors]);
  const roomTypeOptions = useMemo(() => [allRoomTypesLabel, ...(apiRoomTypes ?? []).map((item) => roomTypeLabel(String(item)))], [apiRoomTypes]);

  const hasDates = Boolean(checkIn && checkOut);
  const nights = hasDates ? Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)) : 0;

  const { data: bookingRoomMatrix = [] } = useGetRoomMatrixQuery(
    { startDate: checkIn || todayLocal(), endDate: checkOut || shiftDay(todayLocal(), 1) },
    { skip: !hasDates || !hotelId || Number.isNaN(Number(hotelId)) }
  );
  const matrixBusyDays = useMemo(() => buildMatrixBusyMap(bookingRoomMatrix, editingBookingId), [bookingRoomMatrix, editingBookingId]);

  // Phòng có trống trong khoảng [start, end) hay không
  const isAvailableForRange = (room: BookingRoom, start: string, end: string) => {
    const roomKeys = roomKeysOf(room);
    for (let date = start; date < end; date = shiftDay(date, 1)) {
      if (isBookingRoomDate(editingBookingRanges, roomKeys, date)) continue;
      if (matrixBusyDays?.size && roomKeys.some((key) => matrixBusyDays.get(key)?.has(date))) return false;
      if (roomKeys.some((key) => (booked[key] || []).some((item) => date >= item.start && date < item.end))) return false;
    }
    return true;
  };

  const isAvailable = (room: BookingRoom) => !hasDates || isAvailableForRange(room, checkIn, checkOut);

  const filteredRooms = useMemo(
    () =>
      rooms
        .filter((room) => `${room.id} ${room.type}`.toLowerCase().includes(query.trim().toLowerCase()))
        .filter((room) => roomType === allRoomTypesLabel || room.type === roomType)
        .filter((room) => building === allBuildingsLabel || room.buildingName === building || room.buildingId === selectedBuilding?.id || room.id.startsWith(`${building}-`))
        .filter((room) => floor === allFloorsLabel || roomFloor(room) === floor),
    [rooms, query, roomType, building, floor, selectedBuilding?.id]
  );

  const hasRoomFilter = Boolean(query.trim() || roomType !== allRoomTypesLabel || building !== allBuildingsLabel || floor !== allFloorsLabel);
  const visibleRooms = useMemo(
    () => filteredRooms.filter((room) =>
      (!showSelectedRoomsOnly || selected.includes(room.id))
      && (roomChangeTargetRoomId !== null || selected.includes(room.id) || showFull || !hasDates || isAvailable(room))
    ),
    [filteredRooms, showSelectedRoomsOnly, selected, roomChangeTargetRoomId, showFull, checkIn, checkOut, hasDates]
  );
  const totalPages = Math.max(1, Math.ceil(visibleRooms.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedVisibleRooms = visibleRooms.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, roomType, building, floor, showFull, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const selectedRooms = [...rooms, ...loadedBookingRooms].filter((room, index, allRooms) => selected.includes(room.id) && allRooms.findIndex((candidate) => candidate.id === room.id) === index);
  const detailRoomKeysOf = (detail: Record<string, unknown>) => [detail.roomId, detail.roomID, detail.roomNumber, detail.roomNo, detail.roomCode]
    .filter((value): value is string | number => typeof value === "string" || typeof value === "number")
    .map(String);
  const findBookingDetailForRoom = (room: BookingRoom) => {
    const roomKeys = roomKeysOf(room);
    const replacement = Object.entries(roomChangeTargets).find(([, targetRoomId]) => roomKeys.includes(targetRoomId));
    if (replacement) return initialBookingDetails.find((detail) => bookingDetailIdOf(detail) === replacement[0]);
    return initialBookingDetails.find((detail) => detailRoomKeysOf(detail).some((key) => roomKeys.includes(key)));
  };
  const findCurrentRoomForBookingDetail = (bookingDetailId: string) => {
    const detail = initialBookingDetails.find((item) => bookingDetailIdOf(item) === bookingDetailId);
    if (!detail) return undefined;
    const currentRoomId = roomChangeTargets[bookingDetailId];
    const roomKeys = currentRoomId ? [currentRoomId] : detailRoomKeysOf(detail);
    return selectedRooms.find((room) => roomKeys.some((key) => roomKeysOf(room).includes(key)));
  };
  const roomChangeTargetDetail = roomChangeTargetBookingDetailId
    ? initialBookingDetails.find((detail) => bookingDetailIdOf(detail) === roomChangeTargetBookingDetailId)
    : undefined;
  const roomChangeTargetRoom = roomChangeTargetRoomId
    ? selectedRooms.find((room) => room.id === roomChangeTargetRoomId)
    : undefined;
  const roomChangeTargetRange = roomChangeTargetRoom
    ? selectedRanges[roomChangeTargetRoom.id]
      ?? (roomChangeTargetRoom.databaseId ? selectedRanges[roomChangeTargetRoom.databaseId] : undefined)
      ?? {
        checkIn: String(roomChangeTargetDetail?.checkInTime ?? roomChangeTargetDetail?.checkInDate ?? "").slice(0, 10),
        checkOut: String(roomChangeTargetDetail?.checkOutTime ?? roomChangeTargetDetail?.checkOutDate ?? "").slice(0, 10),
      }
    : undefined;
  const canChangeBookingRoom = (detail: Record<string, unknown> | undefined) => Boolean(
    detail
    && bookingDetailStatusOf(detail) === "PENDING"
    && !hasActualCheckIn(detail)
  );
  const cancelRoomReplacement = () => {
    const sourceRoom = roomChangeTargetRoomId
      ? selectedRooms.find((room) => room.id === roomChangeTargetRoomId)
      : undefined;
    if (sourceRoom && roomChangeOriginalRange) {
      const roomKeys = [sourceRoom.id, sourceRoom.databaseId].filter((key): key is string => Boolean(key));
      setSelectedRanges((current) => roomKeys.reduce((next, key) => ({ ...next, [key]: roomChangeOriginalRange }), current));
    }
    setRoomChangeTargetBookingDetailId(null);
    setRoomChangeTargetRoomId(null);
    setRoomChangeOriginalRange(null);
    setIsAddingRoom(false);
  };
  const beginRoomReplacement = (room: BookingRoom) => {
    if (roomChangeTargetRoomId === room.id) {
      cancelRoomReplacement();
      return;
    }
    const detail = findBookingDetailForRoom(room);
    if (initialBooking && !canChangeBookingRoom(detail)) return;
    const originalRange = selectedRanges[room.id]
      ?? (room.databaseId ? selectedRanges[room.databaseId] : undefined)
      ?? (detail ? {
        checkIn: String(detail.checkInTime ?? detail.checkInDate ?? "").slice(0, 10),
        checkOut: String(detail.checkOutTime ?? detail.checkOutDate ?? "").slice(0, 10),
      } : undefined)
      ?? { checkIn, checkOut };
    setRoomChangeOriginalRange(originalRange);
    setRoomChangeTargetBookingDetailId(detail ? bookingDetailIdOf(detail) : null);
    setRoomChangeTargetRoomId(room.id);
    setIsAddingRoom(true);
    setShowFull(true);
    setQuery("");
    setRoomType(allRoomTypesLabel);
    setBuilding(allBuildingsLabel);
    setFloor(allFloorsLabel);
    setShowSelectedRoomsOnly(false);
    setPage(1);
    setPaymentError("");
    setStep("rooms");
  };
  const replaceBookingRoom = (newRoom: BookingRoom, replacementRange?: RoomDateRange) => {
    const bookingDetailId = roomChangeTargetBookingDetailId;
    const currentRoomId = roomChangeTargetRoomId;
    if (!currentRoomId || (bookingDetailId && !canChangeBookingRoom(roomChangeTargetDetail))) return;
    const oldRoom = selectedRooms.find((room) => room.id === currentRoomId);
    if (!oldRoom || oldRoom.id === newRoom.id) {
      setRoomChangeTargetBookingDetailId(null);
      setRoomChangeTargetRoomId(null);
      setRoomChangeOriginalRange(null);
      setIsAddingRoom(false);
      return;
    }
    if (selected.includes(newRoom.id)) {
      setPaymentError("Phòng này đang được chọn trong booking.");
      return;
    }

    const oldRoomKeys = [oldRoom.id, oldRoom.databaseId].filter((value): value is string => Boolean(value));
    const newRange = replacementRange
      ?? selectedRanges[oldRoom.id]
      ?? (oldRoom.databaseId ? selectedRanges[oldRoom.databaseId] : undefined)
      ?? roomChangeTargetRange
      ?? { checkIn, checkOut };
    setSelected((current) => [...current.filter((roomId) => roomId !== oldRoom.id), newRoom.id]);
    setSelectedRanges((current) => {
      const next = { ...current };
      oldRoomKeys.forEach((key) => { delete next[key]; });
      next[newRoom.id] = newRange;
      if (newRoom.databaseId) next[newRoom.databaseId] = newRange;
      return next;
    });
    setRoomServices((current) => {
      const previousServices = oldRoomKeys.map((key) => current[key]).find(Boolean) ?? [];
      const next = { ...current };
      oldRoomKeys.forEach((key) => { delete next[key]; });
      next[newRoom.id] = previousServices;
      if (newRoom.databaseId) next[newRoom.databaseId] = previousServices;
      return next;
    });
    setRoomGuestCounts((current) => {
      const previousCounts = oldRoomKeys.map((key) => current[key]).find(Boolean);
      if (!previousCounts) return current;
      const next = { ...current };
      oldRoomKeys.forEach((key) => { delete next[key]; });
      next[newRoom.id] = previousCounts;
      if (newRoom.databaseId) next[newRoom.databaseId] = previousCounts;
      return next;
    });
    setRoomGuestSurcharges((current) => {
      const previousSurcharge = oldRoomKeys.map((key) => current[key]).find((value) => value !== undefined);
      if (previousSurcharge === undefined) return current;
      const next = { ...current };
      oldRoomKeys.forEach((key) => { delete next[key]; });
      next[newRoom.id] = previousSurcharge;
      if (newRoom.databaseId) next[newRoom.databaseId] = previousSurcharge;
      return next;
    });
    setRoomGuestSurchargeDetails((current) => {
      const previousDetails = oldRoomKeys.map((key) => current[key]).find(Boolean);
      if (!previousDetails) return current;
      const next = { ...current };
      oldRoomKeys.forEach((key) => { delete next[key]; });
      next[newRoom.id] = previousDetails;
      if (newRoom.databaseId) next[newRoom.databaseId] = previousDetails;
      return next;
    });
    if (bookingDetailId) {
      setRoomChangeTargets((current) => ({ ...current, [bookingDetailId]: String(newRoom.databaseId ?? newRoom.id) }));
    }
    setRoomChangeTargetBookingDetailId(null);
    setRoomChangeTargetRoomId(null);
    setRoomChangeOriginalRange(null);
    setIsAddingRoom(false);
    setPaymentError("");
  };
  const removeSelectedRoom = (room: BookingRoom) => {
    if (initialBooking && !canChangeBookingRoom(findBookingDetailForRoom(room))) return;
    const roomKeys = roomKeysOf(room);
    setSelected((current) => current.filter((roomId) => roomId !== room.id));
    setSelectedRanges((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !roomKeys.includes(key))));
    setRoomServices((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !roomKeys.includes(key))));
    setRoomGuestCounts((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !roomKeys.includes(key))));
    setRoomGuestSurcharges((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !roomKeys.includes(key))));
    setRoomGuestSurchargeDetails((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !roomKeys.includes(key))));
    setCollapsedSummaryRooms((current) => current.filter((roomId) => roomId !== room.id));
    setExpandedServiceRoom((current) => current === room.id ? null : current);
  };
  const updateStayDate = (field: "checkIn" | "checkOut", value: string) => {
    if (!roomChangeTargetRoomId || !roomChangeTargetRoom) {
      if (field === "checkIn") setCheckIn(value);
      else setCheckOut(value);
      return;
    }
    const currentRange = roomChangeTargetRange ?? { checkIn, checkOut };
    if (field === "checkOut" && value <= currentRange.checkIn) return;
    const nextRange = field === "checkIn"
      ? { checkIn: value, checkOut: value >= currentRange.checkOut ? shiftDay(value, 1) : currentRange.checkOut }
      : { ...currentRange, checkOut: value };
    const keys = [roomChangeTargetRoom.id, roomChangeTargetRoom.databaseId].filter((key): key is string => Boolean(key));
    setSelectedRanges((current) => keys.reduce((next, key) => ({ ...next, [key]: nextRange }), current));
  };
  const displayedCheckIn = roomChangeTargetRoomId ? roomChangeTargetRange?.checkIn ?? checkIn : checkIn;
  const displayedCheckOut = roomChangeTargetRoomId ? roomChangeTargetRange?.checkOut ?? checkOut : checkOut;
  const displayedNights = displayedCheckIn && displayedCheckOut
    ? Math.max(1, Math.round((new Date(displayedCheckOut).getTime() - new Date(displayedCheckIn).getTime()) / 86400000))
    : 0;
  const getRoomPrice = (room: BookingRoom) => bookingRoomPrices[room.id] ?? (room.databaseId === undefined ? undefined : bookingRoomPrices[String(room.databaseId)]) ?? room.price;
  const getRoomPriceForDate = (room: BookingRoom, date: string) => {
    const prices = dailyRoomPrices[room.id] ?? (room.databaseId ? dailyRoomPrices[String(room.databaseId)] : undefined);
    return prices?.[date] ?? getRoomPrice(room);
  };
  const getRoomServiceSelections = (room: BookingRoom) => roomServices[room.id] ?? (room.databaseId === undefined ? undefined : roomServices[String(room.databaseId)]) ?? [];
  const nightsForRoom = (roomId: string) => {
    const range = selectedRanges[roomId];
    return range ? Math.max(1, Math.round((new Date(range.checkOut).getTime() - new Date(range.checkIn).getTime()) / 86400000)) : nights;
  };
  const persistedRoomTotal = Number(initialBooking?.roomTotal ?? initialBooking?.totalRoomAmount ?? initialBooking?.roomAmount);
  const getRoomBaseRangeTotal = (room: BookingRoom, range: RoomDateRange = selectedRanges[room.id] ?? { checkIn, checkOut }) =>
    sumRoomPriceForRange(room, range, getRoomPriceForDate);
  const getRoomRangeTotal = (room: BookingRoom, range: RoomDateRange = selectedRanges[room.id] ?? { checkIn, checkOut }) =>
    getRoomBaseRangeTotal(room, range) + (roomGuestSurcharges[room.id] ?? 0) * nightsForRoom(room.id);

  const calculatedRoomTotal = selectedRooms.reduce((sum, room) => sum + getRoomRangeTotal(room), 0);
  const roomTotal = initialBooking && selectedRooms.length === 0 && Number.isFinite(persistedRoomTotal) ? persistedRoomTotal : calculatedRoomTotal;
  const getServiceTotal = (selections: ServiceSelection[], room?: BookingRoom) => selections.reduce((sum, selection) => {
    const qty = selection.applyToRoom !== false && room ? selectedGuestsForRoom(room) : selection.quantity;
    return sum + (selection.price ?? services.find((service) => String(service.id) === selection.serviceId)?.price ?? 0) * qty;
  }, 0);
  const selectedGuestsForRoom = (room: BookingRoom) => roomGuestCounts[room.id] ? roomGuestCounts[room.id].adults + roomGuestCounts[room.id].children + roomGuestCounts[room.id].infants : room.guests;
  const getRoomServiceTotal = (room: BookingRoom, selections: ServiceSelection[]) => getServiceTotal(selections, room);
  const formatRoomServices = (room: BookingRoom, selections: ServiceSelection[]) => selections.map((selection) => {
    const qty = selection.applyToRoom !== false ? selectedGuestsForRoom(room) : selection.quantity;
    return `${services.find((service) => String(service.id) === selection.serviceId)?.name ?? "Dịch vụ"} x${qty}`;
  }).join(", ");
  const calculatedServiceTotal = selectedRooms.reduce((sum, room) => {
    const roomSelections = getRoomServiceSelections(room);
    const selections = roomSelections.length > 0 ? roomSelections : allRoomServices;
    return sum + getServiceTotal(selections, room);
  }, 0);
  const serviceTotal = calculatedServiceTotal;
  const subtotal = roomTotal + serviceTotal;
  const discountAmount = appliedPromotion
    ? calculatePromotionDiscount(appliedPromotion, roomTotal, serviceTotal, subtotal)
    : 0;
  const total = subtotal - discountAmount;
  const bookingEstimate = useMemo(() => ({ roomTotal, serviceTotal, subtotal, discountAmount, total }), [roomTotal, serviceTotal, subtotal, discountAmount, total]);
  useEffect(() => {
    setBookingRoomTotalCache(roomTotal);
  }, [roomTotal]);
  const submitBooking = async () => {
    setPaymentError("");
    const customerId = bookingGuest.customerId ?? "";
    const storedEmployeeId = localStorage.getItem("id");
    const counterEmployeeId = storedEmployeeId ?? employeeId ?? "";

    console.log("==========================================");
    console.log("===> [BOOKING WORKSPACE - submitBooking TRIGGERED]");
    console.log("===> Is Editing Initial Booking?:", Boolean(initialBooking));
    console.log("===> Customer ID:", customerId, "| Employee ID:", counterEmployeeId);

    const bookingDetails = selectedRooms.map((room) => {
      const range = selectedRanges[room.id] ?? { checkIn, checkOut };
      const selections = serviceMode === "all" ? getRoomServiceSelections(room).length > 0 ? getRoomServiceSelections(room) : allRoomServices : getRoomServiceSelections(room);
      const counts = roomGuestCounts[room.id] ?? { adults: room.guests, children: 0, infants: 0 };
      return {
        roomId: String(room.databaseId ?? room.id),
        roomNumber: String(room.roomNumber ?? room.id),
        checkInTime: `${range.checkIn}T14:00:00`,
        checkOutTime: `${range.checkOut}T12:00:00`,
        numAdults: counts.adults,
        numChildren: counts.children,
        numInfants: counts.infants,
        serviceRequests: selections
          .filter((selection) => selection.serviceId.trim() !== "" && selection.quantity > 0)
          .map((selection) => {
            const service = services.find((item) => String(item.id) === selection.serviceId);
            return {
              serviceId: selection.serviceId,
              quantity: selection.quantity,
              name: selection.name ?? service?.name,
              price: selection.price ?? service?.price,
              usedAt: selection.usedAt ?? new Date().toISOString().slice(0, 19),
            };
          }),
      };
    });

    const isPersistedPromotion = Boolean(appliedPromotion && initialBooking && (
      appliedPromotion.id === initialBooking.promotionId
      || appliedPromotion.id === initialBooking.customerPromotionId
      || (appliedPromotion as SelectedPromotion & { customerPromotionId?: string }).customerPromotionId === initialBooking.customerPromotionId
    ));
    const promotionEligible = Boolean(appliedPromotion)
      && !promotionEligibilityMessage(
        isPersistedPromotion ? { ...appliedPromotion, used: false } : appliedPromotion,
        subtotal,
        roomTotal,
        serviceTotal,
      );
    const isCustomerPromotion = Boolean((appliedPromotion as SelectedPromotion & { customerId?: string } | null)?.customerId);

    const request = {
      customerId: customerId || undefined,
      customerName: bookingGuest.name.trim(),
      customerPhone: bookingGuest.phone.trim(),
      customerIdentityNumber: bookingGuest.identityNumber.trim(),
      employeeId: counterEmployeeId,
      bookingChannel: "OFFLINE" as const,
      customerPromotionId: promotionEligible && isCustomerPromotion ? appliedPromotion?.id ?? null : null,
      promotionId: promotionEligible && !isCustomerPromotion ? appliedPromotion?.id ?? null : null,
      bookingDetails,
    };

    if (initialBooking) {
      const id = initialBooking.bookingId ?? initialBooking.orderId;
      if (id === undefined) {
        console.error("===> [BOOKING WORKSPACE] Không tìm thấy mã booking để cập nhật.");
        setPaymentError("Không tìm thấy mã booking để cập nhật.");
        return;
      }
      const initialDetails = (Array.isArray(initialBooking.bookingDetails) ? initialBooking.bookingDetails : [])
        .filter((detail) => !isCancelledBookingDetail(detail));
      const roomKey = (detail: Record<string, unknown>) => String(detail.roomId ?? detail.roomID ?? "");
      const detailIdOf = (detail: Record<string, unknown>) => String(
        detail.bookingDetailId
        ?? detail.bookingDetailsId
        ?? detail.bookingDetailID
        ?? detail.detailId
        ?? detail.detailID
        ?? detail.id
        ?? "",
      );
      const bookingDetailForRoom = (room: BookingRoom) => {
        const roomKeys = roomKeysOf(room);
        const mappedDetailId = Object.entries(roomChangeTargets).find(([, targetRoomId]) => roomKeys.includes(targetRoomId))?.[0];
        return mappedDetailId
          ? initialDetails.find((detail) => detailIdOf(detail) === mappedDetailId)
          : undefined;
      };
      const servicesToAddForExistingRooms: { bookingDetailId: string; services: any[] }[] = [];
      const serviceQuantityUpdates: { bookingDetailId: string; services: { serviceId: string; quantity: number }[] }[] = [];
      const roomsToChange: ManagementBookingModificationRequest["roomsToChange"] = [];
      const roomsToAdd: ManagementBookingModificationRequest["roomsToAdd"] = [];
      const servicesToCancelMap: Record<string, string[]> = {};
      const selectedRoomKeys = new Set(selectedRooms.flatMap((room) => [String(room.id), room.databaseId ? String(room.databaseId) : ""]));
      const bookingDetailIdsToCancel = initialDetails
        .filter((detail) => {
          const detailRoomId = String(detail.roomId ?? detail.roomID ?? "");
          const replacementRoomId = roomChangeTargets[detailIdOf(detail)];
          const replacementIsSelected = replacementRoomId && selectedRooms.some((room) => roomKeysOf(room).includes(replacementRoomId));
          return detailRoomId && !selectedRoomKeys.has(detailRoomId) && !replacementIsSelected;
        })
        .map((detail) => detailIdOf(detail))
        .filter(Boolean);
      selectedRooms.forEach((room) => {
        const roomKeyValue = String(room.databaseId ?? room.id);
        const isReplacementRoom = Boolean(bookingDetailForRoom(room));
        const isExistingRoom = isReplacementRoom || initialDetails.some((detail) => {
          const detailRoomId = String(detail.roomId ?? detail.roomID ?? "");
          return detailRoomId === roomKeyValue || detailRoomId === room.id;
        });
        if (isExistingRoom) return;

        const range = selectedRanges[room.id] ?? (room.databaseId ? selectedRanges[String(room.databaseId)] : undefined) ?? { checkIn, checkOut };
        const counts = roomGuestCounts[room.id] ?? { adults: room.guests, children: 0, infants: 0 };
        const selections = getRoomServiceSelections(room).filter((selection) => selection.serviceId.trim() && selection.quantity > 0);
        roomsToAdd.push({
          roomId: roomKeyValue,
          checkInTime: `${range.checkIn}T14:00:00`,
          checkOutTime: `${range.checkOut}T12:00:00`,
          numAdults: counts.adults,
          numChildren: counts.children,
          numInfants: counts.infants,
          serviceRequests: selections.map((selection) => ({
            serviceId: selection.serviceId,
            quantity: selection.quantity,
            name: selection.name ?? services.find((service) => String(service.id) === selection.serviceId)?.name,
            price: selection.price ?? services.find((service) => String(service.id) === selection.serviceId)?.price,
            usedAt: selection.usedAt ?? new Date().toISOString().slice(0, 19),
          })),
        });
      });

      selectedRooms.forEach((room, roomIdx) => {
        const roomKeyValue = String(room.databaseId ?? room.id);
        const mappedReplacementDetail = bookingDetailForRoom(room);
        const initialDetail = mappedReplacementDetail ?? initialDetails.find((detail, idx) => {
          const dId = detailIdOf(detail);
          const rId = roomKey(detail);
          const targetDbId = String(room.databaseId ?? room.id);
          const targetIdStr = String(room.id);
          return (
            rId === roomKeyValue ||
            rId === targetIdStr ||
            String(dId) === targetDbId ||
            (selectedRooms.length === initialDetails.length && idx === roomIdx)
          );
        });
        const bookingDetailId = initialDetail ? detailIdOf(initialDetail) : "";
        if (!bookingDetailId) return;

        const currentRange = selectedRanges[room.id] ?? (room.databaseId ? selectedRanges[String(room.databaseId)] : undefined) ?? { checkIn, checkOut };
        const originalCheckIn = String(initialDetail?.checkInTime ?? initialDetail?.checkInDate ?? "").slice(0, 10);
        const originalCheckOut = String(initialDetail?.checkOutTime ?? initialDetail?.checkOutDate ?? "").slice(0, 10);
        const currentCounts = roomGuestCounts[room.id] ?? { adults: room.guests, children: 0, infants: 0 };
        const originalCounts = {
          adults: Number(initialDetail?.numAdults ?? initialDetail?.adults ?? 1),
          children: Number(initialDetail?.numChildren ?? initialDetail?.children ?? 0),
          infants: Number(initialDetail?.numInfants ?? initialDetail?.infants ?? 0),
        };
        const originalRoomId = String(initialDetail.roomId ?? initialDetail.roomID ?? "");
        const requestedRoomId = roomChangeTargets[bookingDetailId] ?? null;
        const roomChanged = Boolean(requestedRoomId && requestedRoomId !== originalRoomId);
        const checkInChanged = currentRange.checkIn !== originalCheckIn;
        const checkOutChanged = currentRange.checkOut !== originalCheckOut;
        const adultsChanged = currentCounts.adults !== originalCounts.adults;
        const childrenChanged = currentCounts.children !== originalCounts.children;
        const infantsChanged = currentCounts.infants !== originalCounts.infants;
        if (roomChanged || checkInChanged || checkOutChanged || adultsChanged || childrenChanged || infantsChanged) {
          roomsToChange.push({
            bookingDetailId,
            newRoomId: roomChanged ? requestedRoomId : null,
            newCheckInTime: checkInChanged ? `${currentRange.checkIn}T14:00:00` : null,
            newCheckoutTime: checkOutChanged ? `${currentRange.checkOut}T12:00:00` : null,
            numAdults: adultsChanged ? currentCounts.adults : null,
            numChildren: childrenChanged ? currentCounts.children : null,
            numInfants: infantsChanged ? currentCounts.infants : null,
          });
        }

        if (import.meta.env.DEV) {
          const rawServiceFields = initialDetail ? Object.entries(initialDetail)
            .filter(([key, value]) => key.toLowerCase().includes("service") && Array.isArray(value))
            .map(([key, value]) => ({ key, count: (value as unknown[]).length, value })) : [];
          console.log("[booking-edit] raw initial service fields:", Object.keys(initialDetail ?? {}).filter((key) => key.toLowerCase().includes("service")));
          console.log("[booking-edit] raw initial service JSON:", JSON.stringify(rawServiceFields, null, 2));
          console.log("[booking-edit] raw service id/quantity candidates:", JSON.stringify(
            servicesOf(initialDetail ?? {}).map((service) => Object.fromEntries(
              Object.entries(service).filter(([key]) => /service|quantity|amount|number|people|guest/i.test(key)),
            )),
            null,
            2,
          ));
        }

        const currentSelections = getRoomServiceSelections(room);
        const origServicesMap = new Map<string, { serviceId: string; originalQuantity: number; quantity: number }>();
        (servicesOf(initialDetail) ?? []).forEach((srv) => {
          const nestedService = srv.service && typeof srv.service === "object" ? srv.service as Record<string, unknown> : undefined;
          const rawServiceName = String(srv.name ?? srv.serviceName ?? srv.nameService ?? nestedService?.name ?? nestedService?.serviceName ?? "").trim().toLowerCase();
          const catalogService = services.find((item) => rawServiceName && item.name.trim().toLowerCase() === rawServiceName);
          const sId = String(catalogService?.id ?? srv.serviceId ?? srv.serviceID ?? srv.service_id ?? nestedService?.serviceId ?? nestedService?.id ?? srv.id ?? "");
          if (!sId) return;
          const qty = Number(srv.quantity ?? srv.serviceQuantity ?? srv.quantityService ?? srv.amount ?? 0);
          const existing = origServicesMap.get(sId);
          if (existing) {
            existing.originalQuantity += qty;
            existing.quantity += qty;
          } else {
            origServicesMap.set(sId, { serviceId: sId, originalQuantity: qty, quantity: qty });
          }
        });
        const origSelections = Array.from(origServicesMap.values());

        const additionsForRoom: { serviceId: string; quantity: number; name?: string; price?: number; usedAt?: string }[] = [];
        const quantityUpdatesForRoom: { serviceId: string; quantity: number }[] = [];
        const serviceIds = new Set([
          ...origSelections.map((service) => service.serviceId),
          ...currentSelections.map((service) => service.serviceId.trim()).filter(Boolean),
        ]);

        serviceIds.forEach((serviceId) => {
          const original = origSelections.find((service) => service.serviceId === serviceId);
          const current = currentSelections.find((service) => service.serviceId === serviceId);
          const originalQuantity = Number(original?.originalQuantity ?? 0);
          const currentQuantity = Number(current?.quantity ?? 0);
          console.log("[booking-edit] service compare:", { bookingDetailId, serviceId, originalQuantity, currentQuantity });
          if (currentQuantity === originalQuantity) return;

          if (currentQuantity > originalQuantity) {
            const serviceObj = services.find((item) => String(item.id) === serviceId);
            additionsForRoom.push({
              serviceId,
              quantity: currentQuantity - originalQuantity,
              name: current?.name ?? serviceObj?.name,
              price: current?.price ?? serviceObj?.price,
              usedAt: current?.usedAt ?? new Date().toISOString().slice(0, 19),
            });
            return;
          }

          quantityUpdatesForRoom.push({ serviceId, quantity: currentQuantity });
        });

        if (additionsForRoom.length > 0) {
          servicesToAddForExistingRooms.push({ bookingDetailId, services: additionsForRoom });
        }
        if (quantityUpdatesForRoom.length > 0) {
          serviceQuantityUpdates.push({ bookingDetailId, services: quantityUpdatesForRoom });
        }
      });

      const servicesToCancel = Object.entries(servicesToCancelMap).map(([bId, sIds]) => ({
        bookingDetailId: bId,
        serviceDetailIds: sIds,
      }));
      const modificationRequest: ManagementBookingModificationRequest = {
        employeeId: counterEmployeeId,
        bookingDetailIdsToCancel,
        servicesToCancel,
        roomsToAdd,
        roomsToChange,
        servicesToAddForExistingRooms,
        serviceQuantityUpdates,
        promotionRequest: promotionEligible && !isCustomerPromotion && appliedPromotion?.id
          ? { promotionId: appliedPromotion.id }
          : null,
        customerPromotionRequest: promotionEligible && isCustomerPromotion && appliedPromotion?.id
          ? { customerPromotionId: (appliedPromotion as SelectedPromotion & { customerPromotionId?: string }).customerPromotionId ?? appliedPromotion.id }
          : null,
      };

      console.log("===> [BOOKING WORKSPACE MODIFY PAYLOAD SENT TO BE]:");
      console.log(JSON.stringify(modificationRequest, null, 2));
      console.log("==========================================");

      try {
        const res = await modifyBooking({ bookingId: id, request: modificationRequest }).unwrap();
        console.log("===> [BOOKING WORKSPACE MODIFY SUCCESS]:", res);
        toast({
          variant: "default",
          title: "Cập nhật booking thành công!",
          description: `Đã cập nhật các thay đổi cho booking #${id}.`,
        });
        dispatch(baseApi.util.invalidateTags(["Customer"]));
        clearRoomGuestCache();
        setStep("success");
      } catch (error) {
        console.error("===> [BOOKING WORKSPACE MODIFY ERROR]:", error);
        const responseError = error as { data?: { message?: string; error?: string }; error?: string };
        const errorMessage = responseError.data?.message ?? responseError.data?.error ?? responseError.error ?? (error instanceof Error ? error.message : "Không thể cập nhật booking. Vui lòng thử lại.");
        toast({
          variant: "destructive",
          title: "Cập nhật booking thất bại",
          description: errorMessage,
        });
        setPaymentError(errorMessage);
      }
      return;
    }
    const hasGuestDetails = isBookingGuestValid(bookingGuest);
    if (!hasGuestDetails || (!initialBooking && !customerId) || !counterEmployeeId.trim()) {
      console.warn("[booking] blocked: guest details, customer id, or employeeId are incomplete", { guest: bookingGuest, employeeId: counterEmployeeId });
      return;
    }
    if (bookingDetails.some((detail) => !String(detail.roomId).trim())) {
      console.warn("[booking] blocked: roomId is empty", request);
      return;
    }
    try {
      const res = await createCounterBooking({ employeeId: counterEmployeeId, request }).unwrap();
      const newBookingId = (res as any)?.bookingId ?? (res as any)?.id;
      toast({
        variant: "success",
        title: "Đặt phòng thành công!",
        description: newBookingId ? `Đã hoàn tất tạo đơn đặt phòng #${newBookingId}.` : "Đã hoàn tất tạo đơn đặt phòng cho khách hàng.",
      });
      dispatch(baseApi.util.invalidateTags(["Customer"]));
      clearRoomGuestCache();
      setStep("success");
    } catch (error) {
      console.error("[booking] create counter booking failed", error);
      const responseError = error as { data?: { message?: string; error?: string }; error?: string };
      const errorMessage = responseError.data?.message ?? responseError.data?.error ?? responseError.error ?? (error instanceof Error ? error.message : "Không thể tạo QR/thanh toán. Vui lòng thử lại.");
      toast({
        variant: "destructive",
        title: "Đặt phòng thất bại",
        description: errorMessage,
      });
      setPaymentError(errorMessage);
    }
  };
  const storedEmployeeId = localStorage.getItem("id");
  const bookingEmployeeId = storedEmployeeId ?? employeeId ?? "";
  const hasGuestDetails = isBookingGuestValid(bookingGuest);
  const goToServices = () => {
    if (!hasGuestDetails) {
      setPaymentError("Vui lòng nhập đủ họ tên, số điện thoại và CCCD của khách hàng.");
      return;
    }
    setPaymentError("");
    setStep("services");
  };
  const customerReady = Boolean(initialBooking || bookingGuest.customerId);
  const canSubmitBooking = !promotionBlocked && hasGuestDetails && customerReady && (Boolean(initialBooking) || Boolean(String(bookingEmployeeId).trim())) && !isCreatingBooking && !isModifyingBooking;
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [step]);
  useEffect(() => {
    if (step === "services" && !hasGuestDetails) {
      setStep("guest");
      setPaymentError("Vui lòng nhập đủ họ tên, số điện thoại và CCCD của khách hàng.");
    }
  }, [step, hasGuestDetails]);
  useEffect(() => () => clearRoomGuestCache(), []);
  const summaryRanges = selectedRooms.map((room) => ({ room, range: selectedRanges[room.id] ?? { checkIn, checkOut } }));
  const hasDifferentStayPeriods = summaryRanges.some(({ range }) => range.checkIn !== summaryRanges[0]?.range.checkIn || range.checkOut !== summaryRanges[0]?.range.checkOut);
  const canContinue = selected.length > 0 && selectedRooms.every((room) => {
    const range = selectedRanges[room.id] ?? (hasDates ? { checkIn, checkOut } : undefined);
    return Boolean(range?.checkIn && range?.checkOut && range.checkIn < range.checkOut);
  });

  if (step === "success")
    return (
      <section className="mt-6 rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600"><Check size={28} /></div>
        <h3 className="mt-4 text-xl font-bold text-slate-900">{t("booking.bookingSuccess")}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{t("booking.successDetail", { count: selected.length, checkIn, checkOut })}</p>
        <button onClick={() => { setStep("rooms"); setSelected([]); setSelectedRanges({}); setAllRoomServices([]); setRoomServices({}); }} className="mt-6 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white">{t("booking.createAnother")}</button>
      </section>
    );

  return (
    <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${step === "rooms" ? "bg-violet-600 text-white" : "bg-emerald-500 text-white"}`}>{step === "rooms" ? "1" : <Check size={14} />}</span>
          <span className="text-xs font-semibold text-slate-500">{t("booking.dateAndRooms")}</span>
          <span className="h-px w-8 bg-slate-200" />
          <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${step === "guest" ? "bg-violet-600 text-white" : step === "services" ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"}`}>{step === "services" ? <Check size={14} /> : "2"}</span>
          <span className="text-xs font-semibold text-slate-500">{t("booking.guestInformation")}</span>
          <span className="h-px w-8 bg-slate-200" />
          <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${step === "services" ? "bg-violet-600 text-white" : step === "promotion" ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"}`}>{step === "promotion" ? <Check size={14} /> : "3"}</span>
          <span className="text-xs font-semibold text-slate-500">Dịch vụ</span>
          <span className="h-px w-8 bg-slate-200" />
          <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${step === "promotion" ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-400"}`}>4</span>
          <span className="text-xs font-semibold text-slate-500">Khuyến mãi</span>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full bg-violet-600 transition-all ${step === "promotion" ? "w-full" : step === "services" ? "w-3/4" : step === "guest" ? "w-1/2" : "w-1/4"}`} /></div>
        <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{step === "rooms" ? t("booking.selectDateAndRoom") : step === "guest" ? t("booking.bookingInformation") : step === "services" ? "Chọn dịch vụ" : "Khuyến mãi"}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {step === "rooms"
                ? t("booking.calendarSelectionDescription")
                : `${selected.length} ${t("booking.rooms")} · ${nights} ${t("booking.nights")} · ${checkIn} → ${checkOut}`}
            </p>
          </div>
          {step === "guest" && <button onClick={() => { setShowSelectedRoomsOnly(false); setIsAddingRoom(true); setStep("rooms"); }} className="flex items-center gap-1 text-sm font-semibold text-violet-600"><ChevronLeft size={16} />{t("booking.addAnotherRoom")}</button>}
          {step === "services" && <button onClick={() => setStep("guest")} className="flex items-center gap-1 text-sm font-semibold text-violet-600"><ChevronLeft size={16} />{t("booking.guestInformation")}</button>}
          {step === "promotion" && <button onClick={() => setStep("services")} className="flex items-center gap-1 text-sm font-semibold text-violet-600"><ChevronLeft size={16} />Dịch vụ</button>}
        </div>
      </div>

      {step === "rooms" ? (
        <div className="p-5">
          {roomChangeTargetRoomId && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <span>Đang đổi phòng {roomChangeTargetRoom?.id ?? String(roomChangeTargetDetail?.roomNumber ?? "")} · dịch vụ sẽ được giữ lại.</span>
            <button type="button" onClick={cancelRoomReplacement} className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100">Hủy đổi phòng</button>
          </div>}
          <div className="relative z-50 grid gap-3 rounded-xl bg-violet-50/70 p-4 sm:grid-cols-[1fr_1fr_auto]">
            <DatePicker label={t("booking.checkInDate")} value={displayedCheckIn} onChange={(value) => updateStayDate("checkIn", value)} hotelId={hotelId} />
            <DatePicker label={t("booking.checkOutDate")} value={displayedCheckOut} min={displayedCheckIn || undefined} onChange={(value) => updateStayDate("checkOut", value)} hotelId={hotelId} />
            <div className="flex items-end pb-2 text-xs font-semibold text-violet-700">{displayedCheckIn && displayedCheckOut ? `${displayedNights} ${t("booking.nights")}` : t("booking.noDateSelected")}</div>
          </div>

          <div className="mt-5 flex flex-col gap-3">
            <div className="grid w-full gap-2 sm:grid-cols-[minmax(260px,1.5fr)_repeat(3,minmax(150px,1fr))]">
              <div className="relative w-full">
              <Search size={15} className="absolute left-3 top-3 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("booking.searchRooms")} className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-violet-400" />
              </div>
              <select value={roomType} onChange={(event) => setRoomType(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none focus:border-violet-400">
                {roomTypeOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={floor} onChange={(event) => setFloor(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none focus:border-violet-400">
                {floorOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={building} onChange={(event) => { setBuilding(event.target.value); setFloor(allFloorsLabel); }} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none focus:border-violet-400">
                {buildingOptions.map((item) => <option key={item} value={item}>{item === allBuildingsLabel ? item : item}</option>)}
              </select>
            </div>
            <div className="flex w-full flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-[11px] text-slate-600">
              <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full bg-slate-300 ring-1 ring-slate-200" />{t("booking.unavailable")}</span>
              <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full bg-sky-500" />{t("booking.available")}</span>
              <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full bg-violet-500" />{t("booking.selecting")}</span>
              <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />{t("booking.booked")}</span>
              
              <label className="flex items-center gap-1.5 text-slate-600"><input type="checkbox" checked={showFull} onChange={(event) => setShowFull(event.target.checked)} />{t("booking.showFullRooms")}</label>
            </div>
          </div>

          {isRoomsLoading ? <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">Đang tải danh sách phòng...</p> : isRoomsError ? <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-600">Không thể tải danh sách phòng.</p> : <>
            <DesktopCalendar
              visibleRooms={paginatedVisibleRooms}
              selected={selected}
              setSelected={setSelected}
              checkIn={checkIn}
              checkOut={checkOut}
              setCheckIn={setCheckIn}
              setCheckOut={setCheckOut}
              selectedRanges={selectedRanges}
              setSelectedRanges={setSelectedRanges}
              isAddingRoom={isAddingRoom}
              isAvailableForRange={isAvailableForRange}
              hotelId={Number(hotelId)}
              onDailyPricesChange={setDailyRoomPrices}
              editingBookingId={editingBookingId}
              editingBookingRanges={editingBookingRanges}
              isChangingRoom={Boolean(roomChangeTargetRoomId)}
              roomChangeTargetRoomId={roomChangeTargetRoomId}
              roomChangeTargetRange={roomChangeTargetRange}
              onReplaceRoom={replaceBookingRoom}
              onReplaceRoomUnavailable={() => toast({ variant: "destructive", title: "Phòng chưa trống", description: "Khoảng ngày hiện tại không khả dụng cho phòng này. Hãy chọn ngày hoặc khoảng ngày còn trống trên lịch." })}
              showRoomChangeAction
              canChangeRoom={(room) => !initialBooking || canChangeBookingRoom(findBookingDetailForRoom(room))}
              onStartRoomChange={beginRoomReplacement}
            />
            {visibleRooms.length > 0 && (
              <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Hiển thị {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, visibleRooms.length)} trên {visibleRooms.length} phòng
                </span>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2">
                    Số dòng
                    <select
                      value={pageSize}
                      onChange={(event) => setPageSize(Number(event.target.value))}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
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
                    className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Trang trước"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="min-w-12 text-center font-semibold text-slate-700">
                    {safePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={safePage === totalPages}
                    className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Trang sau"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>}

          <div className="mt-5 flex flex-col items-stretch justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm text-slate-500">
              {t("booking.selectedRooms")} <strong className="text-slate-900">{selected.length} {t("booking.rooms")}</strong>
              {selected.length > 0 && <span> · {t("booking.estimatedTotal")} <strong className="text-violet-700">{money(bookingEstimate.total)}</strong></span>}
              </p>
              {isAddingRoom && <p className="mt-1 text-xs text-blue-600">{roomChangeTargetRoomId ? "Chọn phòng trống để thay thế phòng hiện tại." : t("booking.selectDateToAddRoom")}</p>}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              {selected.length > 0 && <button type="button" onClick={() => {
                if (showSelectedRoomsOnly) {
                  setShowSelectedRoomsOnly(false);
                } else {
                  setSelectedRanges((current) => ({
                    ...current,
                    ...Object.fromEntries(selectedRooms.map((room) => [
                      room.id,
                      current[room.id] ?? (room.databaseId ? current[room.databaseId] : undefined) ?? { checkIn, checkOut },
                    ])),
                  }));
                  setShowSelectedRoomsOnly(true);
                  setIsAddingRoom(false);
                  setQuery("");
                  setRoomType(allRoomTypesLabel);
                  setBuilding(allBuildingsLabel);
                  setFloor(allFloorsLabel);
                }
                setPage(1);
              }} className="flex items-center justify-center gap-2 rounded-lg border border-violet-200 px-4 py-2.5 text-sm font-semibold text-violet-700 hover:bg-violet-50">{t(showSelectedRoomsOnly ? "booking.showAllRooms" : "booking.viewBookedRooms")}</button>}
              <button disabled={!canContinue} onClick={() => setStep("guest")} className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
              {t("booking.continue")} <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : step === "services" ? (<div className="space-y-5 p-5">
        <BookingServiceSelector
          rooms={selectedRooms.map((room) => ({ ...room, databaseId: room.databaseId, guests: roomGuestCounts[room.id] ? roomGuestCounts[room.id].adults + roomGuestCounts[room.id].children + roomGuestCounts[room.id].infants : room.guests, price: getRoomPrice(room) + (roomGuestSurcharges[room.id] ?? 0), dailyPrices: dailyRoomPrices[room.id] ?? (room.databaseId ? dailyRoomPrices[String(room.databaseId)] : undefined), nightlySurcharge: roomGuestSurcharges[room.id] ?? 0 }))}
          services={services}
          servicesLoading={isServicesLoading}
          servicesError={isServicesError}
          serviceMode={serviceMode}
          setServiceMode={setServiceMode}
          allRoomServices={allRoomServices}
          setAllRoomServices={setAllRoomServices}
          roomServices={roomServices}
          setRoomServices={setRoomServices}
          roomRanges={selectedRanges}
          fallbackRange={{ checkIn, checkOut }}
          language={i18n.language}
          nightsForRoom={nightsForRoom}
          continueLabel="Tiếp tục"
          skipLabel="Tiếp tục"
          onContinue={() => setStep("promotion")}
          onSkip={() => setStep("promotion")}
        />
      </div>) : false ? (
        <div className="p-5">
          <div className="relative z-50 grid gap-3 rounded-xl bg-violet-50/70 p-4 sm:grid-cols-[1fr_1fr_auto]">
            <button type="button" onClick={() => setServiceMode("all")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${serviceMode === "all" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-white"}`}>Chọn cho tất cả phòng</button>
            <button type="button" onClick={() => setServiceMode("per-room")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${serviceMode === "per-room" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-white"}`}>Chọn riêng từng phòng</button>
          </div>
          {serviceMode === "all" ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => {
              const selection = allRoomServices.find((item) => item.serviceId === service.id);
              return <div key={service.id} className={`rounded-xl border p-4 ${selection ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white"}`}>
                <label className="flex items-start gap-3"><input type="checkbox" checked={Boolean(selection)} onChange={(event) => setAllRoomServices((current) => event.target.checked ? [...current, { serviceId: service.id, quantity: 1 }] : current.filter((item) => item.serviceId !== service.id))} className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600" /><span><strong className="block text-sm text-slate-800">{service.name}</strong><small className="mt-1 block text-xs text-slate-500">{service.price.toLocaleString("vi-VN")}đ / người</small></span></label>
              </div>;
            })}
          </div> : <div className="mt-4 space-y-2">
            {selectedRooms.map((room) => {
              const isExpanded = expandedServiceRoom === room.id;
              const selections = getRoomServiceSelections(room);
              return <div key={room.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <button type="button" onClick={() => setExpandedServiceRoom(isExpanded ? null : room.id)} className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-slate-50">
                  <span className="min-w-0"><strong className="block text-sm text-slate-900">Phòng {room.id} · {room.type}</strong><span className="mt-1 block truncate text-xs text-slate-500">{selections.length > 0 ? formatRoomServices(room, selections) : "Chưa chọn dịch vụ"}</span></span>
                  <span className="flex shrink-0 items-center gap-3"><strong className="text-xs text-blue-700">{money(getServiceTotal(selections))}</strong><ChevronRight size={16} className={`text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} /></span>
                </button>
                {isExpanded && <div className="border-t border-slate-100 bg-slate-50 p-3"><p className="mb-2 text-xs font-semibold text-slate-500">Chọn dịch vụ và số lượng</p><div className="grid gap-2 sm:grid-cols-2">
                  {services.map((service) => { const selection = selections.find((item) => item.serviceId === String(service.id)); return <div key={service.id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2"><label className="flex min-w-0 items-center gap-2"><input type="checkbox" checked={Boolean(selection)} onChange={(event) => setRoomServices((current) => ({ ...current, [room.id]: event.target.checked ? [...(current[room.id] ?? []), { serviceId: String(service.id), quantity: room.guests }] : (current[room.id] ?? []).filter((item) => item.serviceId !== String(service.id)) }))} className="h-4 w-4 rounded border-slate-300 text-blue-600" /><span className="truncate text-xs font-semibold text-slate-700">{service.name} · {service.price.toLocaleString("vi-VN")}đ/người</span></label>{selection && <input type="number" min="1" value={selection.quantity} onChange={(event) => setRoomServices((current) => ({ ...current, [room.id]: (current[room.id] ?? []).map((item) => item.serviceId === String(service.id) ? { ...item, quantity: Math.max(1, Number(event.target.value) || 1) } : item) }))} className="h-8 w-16 rounded-md border border-slate-200 bg-white px-2 text-center text-xs" />}</div>; })}
                </div></div>}
              </div>;
            })}
          </div>}
          <div className="mt-5 rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Thông tin phòng</p>
            <div className="mt-3 space-y-2">
              {selectedRooms.map((room) => {
                const roomSelections = getRoomServiceSelections(room);
                const selections = roomSelections.length > 0 ? roomSelections : allRoomServices;
                return <div key={room.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-xs">
                  <span className="min-w-0"><strong className="block text-slate-800">Phòng {room.id} · {room.type}</strong><span className="mt-1 block text-slate-500">Check-in: {formatDateLabel((selectedRanges[room.id] ?? { checkIn, checkOut }).checkIn, "", i18n.language)}</span><span className="block text-slate-500">Check-out: {formatDateLabel((selectedRanges[room.id] ?? { checkIn, checkOut }).checkOut, "", i18n.language)}</span><span className="mt-1 block text-blue-700">{selections.length > 0 ? formatRoomServices(room, selections) : "Chưa chọn dịch vụ"}</span></span>
                  <span className="shrink-0 text-right font-bold text-slate-800">{money(getRoomRangeTotal(room, selectedRanges[room.id] ?? { checkIn, checkOut }) + getRoomServiceTotal(room, selections))}</span>
                </div>;
              })}
            </div>
          </div>
          <div className="mt-5 flex flex-col-reverse justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center"><button type="button" onClick={() => setStep("promotion")} className="text-sm font-semibold text-slate-500 hover:text-slate-800">Bỏ qua dịch vụ</button><button type="button" onClick={() => setStep("promotion")} className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">Tiếp tục <ChevronRight size={16} className="ml-1 inline" /></button></div>
        </div>
      ) : (
        <div className="grid gap-6 p-5 lg:grid-cols-[1fr_360px]">
          {step === "promotion" && <PromotionSelector customerId={bookingGuest.customerId} initialPromotionId={initialBooking?.promotionId} initialCustomerPromotionId={initialBooking?.customerPromotionId} orderTotal={subtotal} roomTotal={roomTotal} serviceTotal={serviceTotal} onApply={setAppliedPromotion} onEligibilityChange={setPromotionBlocked} />}
          <div className={step === "promotion" ? "hidden" : "payment-column"}>
            {false && <div className="payment-heading flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3"><CreditCard size={16} className="text-blue-600" /><div><p className="text-sm font-bold text-slate-900">{t("booking.paymentMethod")}</p><p className="mt-0.5 text-xs text-slate-500">{t("booking.paymentRequired")}</p></div></div>}
            {step === "guest" ? <><div className="mb-4 grid gap-2 sm:grid-cols-2">{selectedRooms.map((room) => <div key={room.id} className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-slate-600"><strong className="text-blue-700">Phòng {room.id}</strong><span className="ml-2">Tối đa {room.maxAdults} người lớn · {room.maxChildren} trẻ em · {room.maxInfants} em bé</span></div>)}</div><GuestRoomForms rooms={selectedRooms} guest={bookingGuest} onGuestChange={setBookingGuest} /></> : <div className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm font-bold text-slate-900">{t("booking.paymentMethod")}</p><p className="mt-1 text-xs text-slate-500">{t("booking.paymentRequired")}</p><div className="mt-4 grid gap-3"><button type="button" onClick={() => setPaymentMethod("cash")} className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${paymentMethod === "cash" ? "border-violet-500 bg-violet-50 ring-2 ring-violet-100" : "border-slate-200 hover:border-violet-300"}`}><Banknote size={20} className="text-emerald-600" /><span><strong className="block text-sm text-slate-800">{t("booking.cash")}</strong><small className="text-xs text-slate-500">{t("booking.cashDescription")}</small></span>{paymentMethod === "cash" && <Check size={17} className="ml-auto text-violet-600" />}</button><button type="button" onClick={() => setPaymentMethod("bank")} className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${paymentMethod === "bank" ? "border-violet-500 bg-violet-50 ring-2 ring-violet-100" : "border-slate-200 hover:border-violet-300"}`}><QrCode size={20} className="text-blue-600" /><span><strong className="block text-sm text-slate-800">{t("booking.bankQr")}</strong><small className="text-xs text-slate-500">{t("booking.bankQrDescription")}</small></span>{paymentMethod === "bank" && <Check size={17} className="ml-auto text-violet-600" />}</button><button type="button" onClick={() => setPaymentMethod("wallet")} className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${paymentMethod === "wallet" ? "border-violet-500 bg-violet-50 ring-2 ring-violet-100" : "border-slate-200 hover:border-violet-300"}`}><Wallet size={20} className="text-orange-500" /><span><strong className="block text-sm text-slate-800">{t("booking.wallet")}</strong><small className="text-xs text-slate-500">{t("booking.walletDescription")}</small></span>{paymentMethod === "wallet" && <Check size={17} className="ml-auto text-violet-600" />}</button></div></div>}
          </div>
          <div className="h-fit rounded-xl bg-slate-50 p-4">
            <p className="text-center text-xs font-bold uppercase tracking-wider text-blue-600">{t("booking.bookingSummary")}</p>
            <p className="mt-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600"><UserRound size={14} />Thông tin người đặt</p>
            {hasGuestDetails ? <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
              <p className="mt-1 text-sm font-bold text-slate-800">{bookingGuest.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">{bookingGuest.phone}</p>
            </div> : <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">Nhập đủ họ tên, số điện thoại và CCCD để hiển thị thông tin khách hàng.</div>}
            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600"><UsersRound size={14} />Thông tin phòng</p>
              </div>
              <span className="text-xs font-semibold text-slate-500">{hasDifferentStayPeriods ? "Nhiều lịch" : "Đã chọn"}</span>
            </div>
            <div className="mt-3 space-y-3">
              {summaryRanges.map(({ room, range }) => {
                const roomSelections = getRoomServiceSelections(room);
                const selections = roomSelections.length > 0 ? roomSelections : allRoomServices;
                const roomBookingDetail = findBookingDetailForRoom(room);
                const roomServiceTotal = getServiceTotal(selections) * (roomSelections.length > 0 || serviceMode !== "all" ? 1 : selectedGuestsForRoom(room));
                const roomRange = selectedRanges[room.id] ?? { checkIn, checkOut };
                const roomBaseTotal = getRoomBaseRangeTotal(room, roomRange);
                const roomSurchargeTotal = (roomGuestSurcharges[room.id] ?? 0) * (nightsForRoom(room.id) || 1);
                const roomSubtotal = roomBaseTotal + roomSurchargeTotal + roomServiceTotal;
                const selectedGuestCount = roomGuestCounts[room.id] ? roomGuestCounts[room.id].adults + roomGuestCounts[room.id].children + roomGuestCounts[room.id].infants : room.guests;
                const isSummaryRoomCollapsed = collapsedSummaryRooms.includes(room.id);
                return <div key={room.id} className="overflow-hidden rounded-xl border border-blue-100 bg-blue-50/40 text-xs">
                  <button type="button" onClick={() => setCollapsedSummaryRooms((current) => isSummaryRoomCollapsed ? current.filter((id) => id !== room.id) : [...current, room.id])} aria-expanded={!isSummaryRoomCollapsed} className="flex w-full items-start justify-between gap-3 border-b border-blue-100 bg-white/70 px-3 py-3 text-left transition hover:bg-white">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">{room.type}</p>
                      <strong className="mt-1 block text-base font-bold text-blue-700">{room.id}</strong>
                    </div>
                    <span className="flex shrink-0 items-center gap-2"><strong className="text-sm text-blue-700">{money(roomSubtotal)}</strong><ChevronDown size={16} className={`text-blue-500 transition-transform ${isSummaryRoomCollapsed ? "-rotate-90" : ""}`} /></span>
                  </button>
                  <button type="button" onClick={() => removeSelectedRoom(room)} disabled={Boolean(initialBooking) && !canChangeBookingRoom(roomBookingDetail)} title={initialBooking ? canChangeBookingRoom(roomBookingDetail) ? "Phòng sẽ được hủy khi lưu booking." : "Không thể bỏ phòng sau khi check-in hoặc khi booking-detail không còn PENDING." : undefined} className="mx-3 mt-2 rounded-md border border-rose-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 disabled:hover:bg-white">Bỏ chọn phòng</button>
                  {!isSummaryRoomCollapsed && <div className="space-y-2 px-3 py-3 text-slate-600">
                    <div className="flex items-center gap-2"><CalendarDays size={14} className="shrink-0 text-blue-600" /><span>{t("booking.checkInDate", "Nhận")}: {formatDateLabel(range.checkIn, "", i18n.language)}</span></div>
                    <div className="flex items-center gap-2"><CalendarDays size={14} className="shrink-0 text-blue-600" /><span>{t("booking.checkOutDate", "Trả")}: {formatDateLabel(range.checkOut, "", i18n.language)}</span></div>
                    <div className="flex items-center gap-2"><UsersRound size={14} className="shrink-0 text-blue-600" /><span>{selectedGuestCount} người · {nightsForRoom(room.id)} đêm</span></div>
                    <div className="my-2 border-t border-blue-100" />
                    <div className="flex justify-between gap-3"><span>Tiền phòng</span><span className="font-medium text-slate-800">{money(roomBaseTotal)}</span></div>
                    {(roomGuestSurcharges[room.id] ?? 0) > 0 && <><div className="flex justify-between gap-3"><span>Phụ thu người lớn</span><span className="font-medium text-amber-700">{money((roomGuestSurchargeDetails[room.id]?.adult ?? 0) * (nightsForRoom(room.id) || 1))}</span></div><div className="flex justify-between gap-3"><span>Phụ thu trẻ em</span><span className="font-medium text-amber-700">{money((roomGuestSurchargeDetails[room.id]?.child ?? 0) * (nightsForRoom(room.id) || 1))}</span></div></>}
                    <div className="flex justify-between gap-3"><span>Dịch vụ</span><span className="text-right font-medium text-slate-800">{roomServiceTotal ? money(roomServiceTotal) : "Chưa chọn"}</span></div>
                    <div className="mt-2 flex items-center justify-between gap-3 border-t border-blue-100 pt-2 font-bold text-blue-700"><span>Tạm tính phòng</span><span>{money(roomSubtotal)}</span></div>
                    {(!initialBooking || canChangeBookingRoom(roomBookingDetail)) && <button
                      type="button"
                      onClick={() => beginRoomReplacement(room)}
                      className="mt-2 flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                    >
                      <RefreshCw size={13} />Đổi phòng
                    </button>}
                  </div>}
                </div>
              })}
            </div>
            <div className="my-4 border-t border-slate-200" />
            {appliedPromotion && <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs"><span className="font-semibold text-emerald-700">Khuyến mãi đã chọn: {appliedPromotion.code}</span><span className="font-bold text-emerald-700">-{money(discountAmount)}</span></div>}
            <div className="flex justify-between text-sm font-bold text-slate-900">
              <span>{t("booking.total")}</span>
              <span className="text-violet-700">{money(bookingEstimate.total)}</span>
            </div>
            {false && <>
              <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-violet-500">Thông tin thanh toán</p>
              <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-3">
              <p className="mt-1 text-sm font-bold text-violet-800">{paymentMethod === "cash" ? t("booking.cash") : paymentMethod === "bank" ? t("booking.bankQr") : paymentMethod === "wallet" ? t("booking.wallet") : "Chưa chọn phương thức"}</p>
              <p className="mt-0.5 text-xs text-violet-600">Số tiền cần thanh toán: {money(bookingEstimate.total)}</p>
              </div>
            </>}
            {step === "guest" ? <button disabled={!hasGuestDetails} onClick={goToServices} className="mt-5 w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">Tiếp tục chọn dịch vụ</button> : <>
              {step === "promotion" && !hasGuestDetails && <p className="mt-3 text-xs text-amber-600">Vui lòng nhập đủ tên, số điện thoại và CCCD của khách hàng.</p>}
              {step === "promotion" && hasGuestDetails && !customerReady && <p className="mt-3 text-xs text-amber-600">Đang tạo hồ sơ khách hàng, vui lòng chờ trong giây lát.</p>}
              {step === "promotion" && !String(bookingEmployeeId).trim() && <p className="mt-1 text-xs text-amber-600">Không tìm thấy mã admin/nhân viên trong phiên đăng nhập.</p>}
              {bookingError && <p className="mt-3 text-xs text-rose-600">Không thể tạo đặt phòng. Vui lòng kiểm tra dữ liệu và thử lại.</p>}
              {paymentError && <p className="mt-3 text-xs text-rose-600">{paymentError}</p>}
              <button disabled={!canSubmitBooking} onClick={submitBooking} className="mt-5 w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">{isCreatingBooking || isModifyingBooking ? (initialBooking ? "Đang cập nhật..." : "Đang tạo đặt phòng...") : initialBooking ? "Cập nhật" : "Xác nhận đặt phòng"}</button>
            </>}
          </div>
        </div>
      )}
    </section>
  );
}