import { toast } from "@/components/ui/use-toast";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Banknote, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CreditCard, QrCode, Search, UserRound, UsersRound, Wallet } from "lucide-react";
import GuestRoomForms, { bookingCache, clearRoomGuestCache, setBookingRoomTotalCache, setRoomGuestCache, type BookingGuest, type RoomGuestCounts } from "./GuestRoomForms.tsx";
import BookingServiceSelector, { type ServiceSelection } from "../components/BookingServiceSelector";
import PromotionSelector, { type SelectedPromotion } from "../components/PromotionSelector";
import { useGetRoomTypesQuery, useGetRoomsByCurrentHotelQuery } from "../services/roomApi";
import { useGetBuildingsByHotelIdQuery } from "../services/buildingApi";
import { useGetFloorsByBuildingIdQuery } from "../services/floorApi";
import { useGetAllServicesQuery } from "../services/serviceApi";
import { useCreateCounterBookingMutation, type BookingListItem } from "../services/bookingApi";
import { useModifyBookingMutation, type ManagementBookingModificationRequest } from "../services/managementBookingApi";
import { useAppSelector } from "../store/hooks";

type BookingRoom = { id: string; databaseId?: number; type: string; beds: string; size: string; guests: number; price: number; standardAdults: number; maxAdults: number; maxChildren: number; maxInfants: number; maxExtraGuests: number; extraAdultFee: number; extraChildFee: number; buildingId?: string; buildingName?: string; floor?: string };

const roomTypes = {
  1: { type: "Standard Room", beds: "1 giường đơn", size: "25 m²", guests: 1, price: 1000000, amenity: "Điều hòa · TV · Phòng tắm riêng" },
  2: { type: "Superior Room", beds: "2 giường đơn", size: "30 m²", guests: 2, price: 1500000, amenity: "Điều hòa · TV · Bồn tắm" },
  3: { type: "Deluxe Room", beds: "1 giường King Size", size: "45 m²", guests: 2, price: 2000000, amenity: "Minibar · TV màn hình lớn · Vòi sen massage" },
  4: { type: "Suite Room", beds: "1 giường King Size + 1 giường đơn", size: "60 m²", guests: 3, price: 2500000, amenity: "Phòng khách riêng · Bồn tắm · Baby Cot" },
} as const;

const booked: Record<string, { start: string; end: string; guest: string }[]> = {
  "A-1-1": [{ start: "2026-09-03", end: "2026-09-06", guest: "Nguyễn Minh Anh" }, { start: "2026-09-14", end: "2026-09-17", guest: "Lê Hoàng Nam" }],
  "A-1-2": [{ start: "2026-09-08", end: "2026-09-12", guest: "Trần Thùy Dương" }],
  "A-2-1": [{ start: "2026-09-05", end: "2026-09-07", guest: "Công ty VinaTech" }],
  "B-3-2": [{ start: "2026-09-08", end: "2026-09-10", guest: "Đỗ Khánh Linh" }],
  "C-4-1": [{ start: "2026-09-10", end: "2026-09-13", guest: "Phạm Gia đình" }],
};

const timeline = ["06/09", "07/09", "08/09", "09/09", "10/09", "11/09", "12/09"];
const money = (value: number) => value.toLocaleString("vi-VN") + "đ";
const serviceDetailIdOf = (service: Record<string, unknown>) => Number(service.bookingServiceDetailId ?? service.serviceDetailId ?? service.bookingServiceDetailID ?? service.serviceDetailID ?? service.id ?? service.serviceId);
const servicesOf = (detail: Record<string, unknown>) => ([
  detail.bookingServiceResponsesForHotels,
  detail.bookingServiceResponseForHotels,
  detail.bookingServiceDetails,
  detail.serviceRequests,
  detail.serviceResponses,
  detail.services,
].find(Array.isArray) ?? []) as Record<string, unknown>[];

const allFloorsLabel = "Tất cả các tầng";
const allBuildingsLabel = "Tất cả các tòa";
const allRoomTypesLabel = "Tất cả loại phòng";
const roomTypeLabel = (value: string) => ({ STANDARD: "Standard Room", SUPERIOR: "Superior Room", DELUXE: "Deluxe Room", SUITE: "Suite Room", FAMILY: "Family Room" }[value] ?? value);
const roomFloor = (room: BookingRoom) => room.floor ?? `Tầng ${room.id.split("-")[1] ?? ""}`;
const todayLocal = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
  const databaseId = Number(getApiValue(item, ["id", "roomId", "roomID"]));
  const buildingId = getApiValue(item, ["buildingId", "buildingID"]);
  const buildingName = String(getApiValue(item, ["nameBuilding", "buildingName", "buildingCode"]) ?? "").trim();
  const floorValue = String(getApiValue(item, ["floorNumber", "floorLevel", "floorName", "floorId", "floorID"]) ?? "");
  const rawSize = getApiValue(item, ["roomSize", "size", "area", "roomArea", "acreage"]);
  const size = rawSize === undefined ? fallback.size : `${rawSize}`.includes("m²") ? String(rawSize) : `${rawSize} m²`;
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
    databaseId: Number.isFinite(databaseId) ? databaseId : undefined,
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
  };
};

function DatePicker({ label, value, min, onChange }: { label: string; value: string; min?: string; onChange: (value: string) => void }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [viewDate, setViewDate] = useState(() => value ? new Date(`${value}T00:00:00`) : new Date(2026, 8, 1));
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = viewDate.toLocaleDateString(i18n.language === "en" ? "en-US" : "vi-VN", { month: "long", year: "numeric" });
  const pickerId = label === t("booking.checkInDate") ? "check-in" : "check-out";
  useEffect(() => { const openPicker = () => setOpen(true); window.addEventListener(`open-${pickerId}`, openPicker); return () => window.removeEventListener(`open-${pickerId}`, openPicker); }, [pickerId]);
  useEffect(() => {
    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (open && pickerRef.current && !pickerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", handleOutsidePointerDown);
  }, [open]);
  const today = todayLocal();
  const selectDay = (day: number) => {
    const next = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!min || next >= min) onChange(next);
  };
  const selectToday = () => { const current = new Date(); const date = current.toISOString().slice(0, 10); if (!min || date >= min) { onChange(date); setViewDate(new Date(current.getFullYear(), current.getMonth(), 1)); } };
  return <div className="relative z-50"><p className="text-xs font-bold text-slate-700">{label}</p><button type="button" onClick={() => setOpen((current) => !current)} className="mt-1.5 flex h-11 w-full items-center justify-between rounded-lg border border-violet-100 bg-white px-3 text-left text-sm font-normal text-slate-700 outline-none transition hover:border-violet-300 focus:border-violet-400"><span>{formatDateLabel(value, t("booking.noDateSelected"), i18n.language)}</span><CalendarDays size={16} className="text-violet-500" /></button>{open && <div className="absolute left-0 top-[4.5rem] z-50 w-[min(19rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"><div className="flex items-center justify-between"><button type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))} className="rounded-lg p-1.5 text-slate-500 hover:bg-violet-50"><ChevronLeft size={16} /></button><p className="text-sm font-bold capitalize text-slate-800">{monthLabel}</p><button type="button" onClick={() => setViewDate(new Date(year, month + 1, 1))} className="rounded-lg p-1.5 text-slate-500 hover:bg-violet-50"><ChevronRight size={16} /></button></div><div className="mt-3 grid grid-cols-7 text-center text-[10px] font-bold uppercase text-slate-400">{["sunShort", "monShort", "tueShort", "wedShort", "thuShort", "friShort", "satShort"].map((day) => <span key={day} className="py-1">{t(`calendar.${day}`)}</span>)}</div><div className="grid grid-cols-7 gap-1">{Array.from({ length: firstDay }, (_, index) => <span key={`empty-${index}`} />)}{Array.from({ length: daysInMonth }, (_, index) => { const day = index + 1; const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`; const disabled = Boolean(min && date < min); return <button type="button" key={date} disabled={disabled} onClick={() => selectDay(day)} className={`grid aspect-square place-items-center rounded-lg text-xs transition ${disabled ? "cursor-not-allowed text-slate-300" : date === value ? "bg-violet-600 font-bold text-white" : date === today ? "border border-violet-300 font-bold text-violet-700" : "text-slate-700 hover:bg-violet-50 hover:text-violet-700"}`}>{day}</button>; })}</div><button type="button" onClick={selectToday} className="mt-3 w-full rounded-lg bg-slate-50 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50">{t("booking.today")}</button></div>}</div>;
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
  isAvailableForRange: (roomId: string, start: string, end: string) => boolean;
}) {
  const { t } = useTranslation();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalDays = 14;
  const todayValue = todayLocal();
  const [timelineStart, setTimelineStart] = useState(todayValue);
  const [timelinePickerOpen, setTimelinePickerOpen] = useState(false);
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

  const [dragSelection, setDragSelection] = useState<{ roomId: string; startDayIndex: number; currentDayIndex: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const isReservedCell = (roomId: string, dayValue: string) => {
    return (booked[roomId] || []).some((item) => dayValue >= item.start && dayValue < item.end);
  };

  const isPastDate = (dayValue: string) => {
    return new Date(`${dayValue}T00:00:00`) < today;
  };

  const handlePointerDown = (roomId: string, dayIndex: number) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const dayValue = stableTimeline[dayIndex].value;
    if (isPastDate(dayValue) || isReservedCell(roomId, dayValue)) return;
    
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
    
    if (isSingleClick && currentRange) {
      const checkInDate = currentRange.checkIn;
      const lastNightDate = shiftDay(currentRange.checkOut, -1);

      if (clickedDate === shiftDay(checkInDate, -1) || clickedDate === currentRange.checkOut) {
        const newCheckIn = clickedDate < checkInDate ? clickedDate : checkInDate;
        const newCheckOut = clickedDate > lastNightDate
          ? shiftDay(clickedDate, 1)
          : currentRange.checkOut;

        if (isAvailableForRange(roomId, newCheckIn, newCheckOut)) {
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
       if (isReservedCell(roomId, stableTimeline[i].value)) {
         isValid = false;
         break;
       }
    }
    
    if (isValid && isAvailableForRange(roomId, newCheckIn, newCheckOut)) {
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
    <div className="relative z-0 mt-5 flex w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="relative z-20 flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-3">
        <div className="text-[11px] font-semibold text-slate-500">
          <span className="hidden sm:inline">{t("booking.calendarInstruction", "Kéo ngang trên các ô để chọn nhiều đêm · Kéo thanh cuộn để xem ngày")}</span>
        </div>
        <div className="relative flex items-center gap-1.5">
          <button type="button" disabled={!canGoPrevious} onClick={() => scrollByDays(-7)} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40">
            <ChevronLeft size={14} /> {formatRange(timelineStart)}
          </button>
          <button type="button" onClick={scrollToToday} aria-label={t("booking.today", "Hôm nay")} title={t("booking.today", "Hôm nay")} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900">
            <CalendarDays size={16} />
          </button>
          <button type="button" onClick={() => scrollByDays(7)} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900">
            {formatRange(shiftDay(timelineStart, 7))} <ChevronRight size={14} />
          </button>
          {timelinePickerOpen && <div className="absolute right-0 top-12 z-50 rounded-xl border border-slate-200 bg-white p-3 shadow-xl"><label className="block text-xs font-semibold text-slate-600">{t("booking.selectDate", "Chọn ngày")}</label><input type="date" min={todayValue} value={timelineStart} onChange={(event) => { setTimelineStart(event.target.value); setTimelinePickerOpen(false); }} className="mt-2 h-9 rounded-lg border border-slate-200 px-2 text-sm text-slate-700 outline-none focus:border-violet-400" /></div>}
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="relative z-10 w-full touch-pan-x overflow-x-auto overflow-y-hidden overscroll-x-contain scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent"
        onPointerLeave={handlePointerUpContainer}
      >
        <div className="min-w-fit" style={{ width: `${260 + totalDays * 96}px` }}>
          <div className="grid border-b border-slate-200 bg-slate-50 relative" style={{ gridTemplateColumns: `260px repeat(${totalDays}, minmax(96px, 1fr))` }}>
            <div className="sticky left-0 top-0 z-30 flex items-center border-r border-slate-200 bg-slate-50 p-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
              {t("booking.roomTypeLabel")}
            </div>
            {stableTimeline.map((date) => (
              <div key={date.value} className="border-l border-slate-200 p-3 text-center">
                <p className="text-[10px] font-bold uppercase text-slate-400">{date.day}</p>
                <p className={`mt-1 text-sm font-bold ${isPastDate(date.value) ? "text-slate-400" : "text-slate-700"}`}>{date.label}</p>
              </div>
            ))}
          </div>

          {visibleRooms.map((room) => (
            <div key={room.id} className="grid min-h-[106px] border-b border-slate-100 last:border-0 relative hover:bg-slate-50/30 transition-colors" style={{ gridTemplateColumns: `260px repeat(${totalDays}, minmax(96px, 1fr))` }}>
              <div className="sticky left-0 top-0 z-20 border-r border-slate-100 bg-white p-0 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                <button
                  type="button"
                  disabled={Boolean(checkIn && checkOut) && !isAvailableForRange(room.id, selectedRanges[room.id]?.checkIn ?? checkIn, selectedRanges[room.id]?.checkOut ?? checkOut)}
                  onClick={() => {
                    if (selected.includes(room.id)) {
                      const remainingRooms = selected.filter((id) => id !== room.id);
                      setSelected(remainingRooms);
                      setSelectedRanges((prev) => {
                        const next = { ...prev };
                        delete next[room.id];
                        return next;
                      });
                      return;
                    }

                    const defaultRange = selected
                      .map((id) => selectedRanges[id])
                      .find((range): range is RoomDateRange => Boolean(range))
                      ?? (checkIn && checkOut ? { checkIn, checkOut } : undefined);
                    setSelected((current) => [...current, room.id]);
                    if (defaultRange) {
                      setSelectedRanges((prev) => ({ ...prev, [room.id]: defaultRange }));
                    }
                  }}
                  className={`flex h-full w-full items-center gap-3 p-4 text-left transition-all duration-200 ${selected.includes(room.id) ? "bg-violet-50" : "bg-white hover:bg-slate-50"} ${Boolean(checkIn && checkOut) && !isAvailableForRange(room.id, checkIn, checkOut) ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  <span className={`grid h-11 min-w-[58px] shrink-0 place-items-center rounded-xl px-2 text-[11px] font-bold whitespace-nowrap transition-all ${selected.includes(room.id) ? "bg-violet-600 text-white shadow-sm shadow-violet-200" : "bg-slate-100 text-slate-600"}`}>{room.id}</span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-xs font-semibold text-slate-800">{room.type}</strong>
                    <small className="mt-1 block truncate text-[10px] text-slate-500">{room.beds} · {room.size}</small>
                    <small className="mt-1 block truncate text-[10px] font-semibold text-violet-600">{money(room.price)} / đêm</small>
                    <em className={`mt-1 block truncate text-[10px] not-italic transition-colors ${selected.includes(room.id) ? "font-medium text-violet-600" : "text-slate-400"}`}>{selected.includes(room.id) ? t("booking.selectedRemove") : t("booking.selectRoomHint")}</em>
                  </span>
                </button>
              </div>

              {stableTimeline.map((date, dayIndex) => {
                const day = date.value;
                const reservation = (booked[room.id] || []).find((item) => day >= item.start && day < item.end);
                const roomRange = selectedRanges[room.id];
                const inRange = Boolean(roomRange) && day >= roomRange.checkIn && day < roomRange.checkOut;
                const pastDay = isPastDate(day);
                
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
                    title={reservation ? `${reservation.guest} · đã đặt` : t("booking.dragToSelect")}
                  >
                    <div className={`flex h-full min-h-[76px] flex-col justify-center rounded-xl border px-2 py-1.5 shadow-sm transition-all duration-200 ${
                      pastDay
                        ? "border-slate-200 bg-slate-200 text-slate-500"
                        : reservation
                          ? "border-emerald-300 bg-emerald-500 text-white shadow-emerald-100"
                          : isDraggingCell
                            ? "border-violet-300 bg-violet-500 text-white shadow-violet-200"
                            : inRange && selected.includes(room.id)
                              ? "border-violet-300 bg-violet-600 text-white shadow-violet-100"
                              : inRange
                                ? "border-violet-200 bg-violet-100 text-violet-700"
                                : "border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100"
                    }`}>
                      {reservation ? (
                        <>
                          <span className="truncate text-[10px] font-bold">{t("booking.booked")}</span>
                          <span className="mt-1 truncate text-[9px] opacity-90">{reservation.guest}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] font-semibold">{isDraggingCell || inRange ? t("booking.selecting") : pastDay ? "Quá khứ" : t("booking.available")}</span>
                          <span className="mt-1 truncate text-[9px] opacity-80">{pastDay ? "Không khả dụng" : isDraggingCell || inRange ? day : t("booking.dragToSelect")}</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BookingWorkspace() {
  const location = useLocation();
  const initialBooking = (location.state as { editBooking?: BookingListItem } | null)?.editBooking;
  const { t, i18n } = useTranslation();
  const hotelId = useAppSelector((state) => state.auth.hotelId);
  const employeeId = useAppSelector((state) => state.auth.employeeId);
  const [createCounterBooking, { isLoading: isCreatingBooking, error: bookingError }] = useCreateCounterBookingMutation();
  const [modifyBooking, { isLoading: isModifyingBooking }] = useModifyBookingMutation();
  const { data: services = [], isLoading: isServicesLoading, isError: isServicesError } = useGetAllServicesQuery(hotelId ? { hotelId: Number(hotelId), activeOnly: true } : { activeOnly: true });
  const { data: apiBuildings } = useGetBuildingsByHotelIdQuery(Number(hotelId), { skip: !hotelId || Number.isNaN(Number(hotelId)) });
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
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  const [bookingGuest, setBookingGuest] = useState<BookingGuest>({ name: "", phone: "", identityNumber: "" });
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
  useEffect(() => {
    if (!initialBooking) return;
    const details = Array.isArray(initialBooking.bookingDetails) ? initialBooking.bookingDetails : [];
    const roomKey = (detail: Record<string, unknown>) => String(detail.roomId ?? detail.roomID ?? "");
    const selectedRoomKeys = details.map(roomKey);
    const matchedRooms = rooms.filter((room) => selectedRoomKeys.includes(String(room.databaseId ?? room.id)) || selectedRoomKeys.includes(room.id));
    const fallbackRooms = details
      .filter((detail) => !matchedRooms.some((room) => String(room.databaseId ?? room.id) === roomKey(detail) || room.id === roomKey(detail)))
      .map((detail, index) => {
        const key = roomKey(detail) || `booking-room-${index + 1}`;
        return {
          id: key,
          databaseId: Number.isFinite(Number(key)) ? Number(key) : undefined,
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
      const serviceRequests = ([
        detail.bookingServiceResponsesForHotels,
        detail.bookingServiceResponseForHotels,
        detail.bookingServiceDetails,
        detail.serviceRequests,
        detail.serviceResponses,
        detail.services,
      ].find(Array.isArray) ?? Object.entries(detail).find(([key, value]) => Array.isArray(value) && key.toLowerCase().includes("service"))?.[1] ?? []) as Record<string, unknown>[];
      const detailRoomKey = roomKey(detail);
      const matchedRoom = matchedRooms.find((room) => String(room.databaseId ?? room.id) === detailRoomKey || room.id === detailRoomKey);
      const selections = serviceRequests.map((service) => ({
        serviceId: String(service.serviceId ?? service.serviceID ?? service.id ?? ""),
        name: String(service.name ?? service.serviceName ?? service.nameService ?? service.service_name ?? ""),
        quantity: Number(service.quantity ?? service.amount ?? 1),
        originalQuantity: Number(service.quantity ?? service.amount ?? 1),
        detailId: serviceDetailIdOf(service),
        price: service.price === undefined || service.price === null
          ? service.unitPrice === undefined || service.unitPrice === null ? undefined : Number(service.unitPrice)
          : Number(service.price),
        usedAt: service.usedAt === undefined && service.usedAtTime === undefined ? undefined : String(service.usedAt ?? service.usedAtTime),
        isExisting: true,
        applyToRoom: false,
      }));
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
      name: String(initialBooking.customerName ?? initialBooking.nameCustomer ?? customer.name ?? initialBooking.guestName ?? ""),
      phone: String(initialBooking.customerPhone ?? initialBooking.phone ?? initialBooking.phoneNumber ?? customer.phone ?? ""),
      identityNumber: String(initialBooking.identityNumber ?? initialBooking.customerIdentityNumber ?? initialBooking.identityCard ?? customer.identityNumber ?? ""),
      customerId: (initialBooking.customerId ?? initialBooking.customerID ?? customer.id) === undefined
        ? undefined
        : String(initialBooking.customerId ?? initialBooking.customerID ?? customer.id),
    });
    const firstRange = Object.values(nextRanges)[0] as { checkIn: string; checkOut: string } | undefined;
    setCheckIn(firstRange?.checkIn ?? todayLocal());
    setCheckOut(firstRange?.checkOut ?? shiftDay(todayLocal(), 1));
    setStep("guest");
  }, [initialBooking, rooms]);
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

  // Phòng có trống trong khoảng [start, end) hay không
  const isAvailableForRange = (id: string, start: string, end: string) =>
    !(booked[id] || []).some((item) => item.start < end && item.end > start);

  const isAvailable = (id: string) => !hasDates || isAvailableForRange(id, checkIn, checkOut);

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
    () => filteredRooms.filter((room) => selected.includes(room.id) || showFull || !hasDates || isAvailable(room.id)),
    [filteredRooms, showFull, checkIn, checkOut, hasDates, selected]
  );

  const selectedRooms = [...rooms, ...loadedBookingRooms].filter((room, index, allRooms) => selected.includes(room.id) && allRooms.findIndex((candidate) => candidate.id === room.id) === index);
  const getRoomPrice = (room: BookingRoom) => bookingRoomPrices[room.id] ?? (room.databaseId === undefined ? undefined : bookingRoomPrices[String(room.databaseId)]) ?? room.price;
  const getRoomServiceSelections = (room: BookingRoom) => roomServices[room.id] ?? (room.databaseId === undefined ? undefined : roomServices[String(room.databaseId)]) ?? [];
  const nightsForRoom = (roomId: string) => {
    const range = selectedRanges[roomId];
    return range ? Math.max(1, Math.round((new Date(range.checkOut).getTime() - new Date(range.checkIn).getTime()) / 86400000)) : nights;
  };
  const persistedRoomTotal = Number(initialBooking?.roomTotal ?? initialBooking?.totalRoomAmount ?? initialBooking?.roomAmount);
  const persistedServiceTotal = Number(initialBooking?.serviceTotal ?? initialBooking?.totalServiceAmount ?? initialBooking?.serviceAmount);
  const calculatedRoomTotal = selectedRooms.reduce((sum, room) => sum + (getRoomPrice(room) + (roomGuestSurcharges[room.id] ?? 0)) * nightsForRoom(room.id), 0);
  const roomTotal = initialBooking && selectedRooms.length === 0 && Number.isFinite(persistedRoomTotal) ? persistedRoomTotal : calculatedRoomTotal;
  const getServiceTotal = (selections: ServiceSelection[]) => selections.reduce((sum, selection) => sum + (selection.price ?? services.find((service) => String(service.id) === selection.serviceId)?.price ?? 0) * selection.quantity, 0);
  const selectedGuestsForRoom = (room: BookingRoom) => roomGuestCounts[room.id] ? roomGuestCounts[room.id].adults + roomGuestCounts[room.id].children + roomGuestCounts[room.id].infants : room.guests;
  const getRoomServiceTotal = (room: BookingRoom, selections: ServiceSelection[]) => getServiceTotal(selections) * (serviceMode === "all" ? selectedGuestsForRoom(room) : 1);
  const formatRoomServices = (room: BookingRoom, selections: ServiceSelection[]) => selections.map((selection) => `${services.find((service) => String(service.id) === selection.serviceId)?.name ?? "Dịch vụ"} x${selection.quantity * (serviceMode === "all" ? selectedGuestsForRoom(room) : 1)}`).join(", ");
  const calculatedServiceTotal = selectedRooms.reduce((sum, room) => {
    const roomSelections = getRoomServiceSelections(room);
    const selections = roomSelections.length > 0 ? roomSelections : allRoomServices;
    return sum + getServiceTotal(selections) * (roomSelections.length > 0 || serviceMode !== "all" ? 1 : selectedGuestsForRoom(room));
  }, 0);
  const serviceTotal = initialBooking && calculatedServiceTotal === 0 && Number.isFinite(persistedServiceTotal) ? persistedServiceTotal : calculatedServiceTotal;
  const subtotal = roomTotal + serviceTotal;
  const discountAmount = appliedPromotion ? Math.round(subtotal * appliedPromotion.value / 100) : 0;
  const total = subtotal - discountAmount;
  const bookingEstimate = useMemo(() => ({ roomTotal, serviceTotal, subtotal, discountAmount, total }), [roomTotal, serviceTotal, subtotal, discountAmount, total]);
  useEffect(() => {
    setBookingRoomTotalCache(roomTotal);
  }, [roomTotal]);
  const submitBooking = async () => {
    setPaymentError("");
    const customerId = Number(bookingGuest.customerId);
    const storedEmployeeId = localStorage.getItem("id");
    const rawEmp = Number(storedEmployeeId ?? employeeId ?? 1);
    const counterEmployeeId = Number.isFinite(rawEmp) && rawEmp > 0 ? rawEmp : 1;

    console.log("==========================================");
    console.log("===> [BOOKING WORKSPACE - submitBooking TRIGGERED]");
    console.log("===> Is Editing Initial Booking?:", Boolean(initialBooking));
    console.log("===> Customer ID:", customerId, "| Employee ID:", counterEmployeeId);

    const bookingDetails = selectedRooms.map((room) => {
      const range = selectedRanges[room.id] ?? { checkIn, checkOut };
      const selections = serviceMode === "all" ? getRoomServiceSelections(room).length > 0 ? getRoomServiceSelections(room) : allRoomServices : getRoomServiceSelections(room);
      const counts = roomGuestCounts[room.id] ?? { adults: room.guests, children: 0, infants: 0 };
      return {
        roomId: room.databaseId ?? Number(room.id),
        checkInTime: `${range.checkIn}T14:00:00`,
        checkOutTime: `${range.checkOut}T12:00:00`,
        numAdults: counts.adults,
        numChildren: counts.children,
        numInfants: counts.infants,
        serviceRequests: selections
          .filter((selection) => Number.isFinite(Number(selection.serviceId)) && selection.quantity > 0)
          .map((selection) => {
            const service = services.find((item) => String(item.id) === selection.serviceId);
            return {
              serviceId: Number(selection.serviceId),
              quantity: selection.quantity,
              name: selection.name ?? service?.name,
              price: selection.price ?? service?.price,
              usedAt: selection.usedAt ?? new Date().toISOString().slice(0, 19),
            };
          }),
      };
    });

    const cachedRoomTotal = bookingCache.roomTotal;
    const promotionEligible = Boolean(appliedPromotion) && (!appliedPromotion?.minimumOrderAmount || cachedRoomTotal >= appliedPromotion.minimumOrderAmount);
    const isCustomerPromotion = Boolean((appliedPromotion as SelectedPromotion & { customerId?: number } | null)?.customerId);

    const request = {
      customerId,
      employeeId: counterEmployeeId,
      bookingChannel: "OFFLINE" as const,
      customerPromotionId: promotionEligible && isCustomerPromotion ? Number(appliedPromotion?.id) : null,
      promotionId: promotionEligible && !isCustomerPromotion ? Number(appliedPromotion?.id) : null,
      bookingDetails,
    };

    if (initialBooking) {
      const id = initialBooking.bookingId ?? initialBooking.orderId;
      if (id === undefined) {
        console.error("===> [BOOKING WORKSPACE] Không tìm thấy mã booking để cập nhật.");
        setPaymentError("Không tìm thấy mã booking để cập nhật.");
        return;
      }
      const initialDetails = Array.isArray(initialBooking.bookingDetails) ? initialBooking.bookingDetails : [];
      const roomKey = (detail: Record<string, unknown>) => String(detail.roomId ?? detail.roomID ?? "");
      const detailIdOf = (detail: Record<string, unknown>) => Number(
        detail.bookingDetailId
        ?? detail.bookingDetailsId
        ?? detail.bookingDetailID
        ?? detail.detailId
        ?? detail.detailID
        ?? detail.id,
      );
      const servicesToAddForExistingRooms: { bookingDetailId: number; services: any[] }[] = [];
      const serviceQuantityUpdates: { bookingDetailId: number; services: { serviceId: number; quantity: number }[] }[] = [];
      const servicesToCancelMap: Record<number, number[]> = {};

      selectedRooms.forEach((room) => {
        const roomKeyValue = String(room.databaseId ?? Number(room.id));
        const initialDetail = initialDetails.find((detail) => {
          const detailRoomId = roomKey(detail);
          return detailRoomId === roomKeyValue || detailRoomId === room.id;
        });
        const bookingDetailId = initialDetail ? detailIdOf(initialDetail) : NaN;
        if (!Number.isFinite(bookingDetailId)) return;

        const roomSelections = getRoomServiceSelections(room);
        const selections = serviceMode === "all"
          ? roomSelections.length > 0 ? roomSelections : allRoomServices.map((selection) => ({ ...selection, quantity: selectedGuestsForRoom(room) }))
          : roomSelections;

        const additionsForRoom: any[] = [];
        const quantityUpdatesForRoom: { serviceId: number; quantity: number }[] = [];

        selections.forEach((selection) => {
          const serviceIdNum = Number(selection.serviceId);
          if (!Number.isFinite(serviceIdNum)) return;
          const currentQty = selection.quantity;
          const origQty = selection.isExisting ? Number(selection.originalQuantity ?? selection.quantity) : 0;

          if (!selection.isExisting) {
            if (currentQty > 0) {
              const serviceObj = services.find((item) => String(item.id) === selection.serviceId);
              additionsForRoom.push({
                serviceId: serviceIdNum,
                quantity: currentQty,
                name: selection.name ?? serviceObj?.name,
                price: selection.price ?? serviceObj?.price,
                usedAt: selection.usedAt ?? new Date().toISOString().slice(0, 19),
              });
            }
          } else {
            if (currentQty < origQty) {
              quantityUpdatesForRoom.push({
                serviceId: serviceIdNum,
                quantity: currentQty,
              });
            } else if (currentQty > origQty) {
              const extraQty = currentQty - origQty;
              const serviceObj = services.find((item) => String(item.id) === selection.serviceId);
              additionsForRoom.push({
                serviceId: serviceIdNum,
                quantity: extraQty,
                name: selection.name ?? serviceObj?.name,
                price: selection.price ?? serviceObj?.price,
                usedAt: selection.usedAt ?? new Date().toISOString().slice(0, 19),
              });
            }
          }
        });

        const existingServicesInDetail = servicesOf(initialDetail);
        existingServicesInDetail.forEach((srv) => {
          const sId = Number(srv.serviceId ?? srv.id);
          if (Number.isFinite(sId)) {
            const matchedSelection = selections.find((sel) => sel.isExisting && Number(sel.serviceId) === sId);
            if (!matchedSelection) {
              if (!quantityUpdatesForRoom.some((item) => item.serviceId === sId)) {
                quantityUpdatesForRoom.push({
                  serviceId: sId,
                  quantity: 0,
                });
              }
            }
          }
        });

        if (additionsForRoom.length > 0) {
          servicesToAddForExistingRooms.push({ bookingDetailId, services: additionsForRoom });
        }
        if (quantityUpdatesForRoom.length > 0) {
          serviceQuantityUpdates.push({ bookingDetailId, services: quantityUpdatesForRoom });
        }
      });

      const servicesToCancel = Object.entries(servicesToCancelMap).map(([bId, sIds]) => ({
        bookingDetailId: Number(bId),
        serviceDetailIds: sIds,
      }));
      const modificationRequest: ManagementBookingModificationRequest = {
        employeeId: counterEmployeeId,
        bookingDetailIdsToCancel: [],
        servicesToCancel,
        roomsToAdd: [],
        roomsToChange: [],
        roomsToUpdateDates: [],
        servicesToAddForExistingRooms,
        serviceQuantityUpdates,
      };

      console.log("===> [BOOKING WORKSPACE MODIFY PAYLOAD SENT TO BE]:");
      console.log(JSON.stringify(modificationRequest, null, 2));
      console.log("==========================================");

      try {
        const res = await modifyBooking({ bookingId: id, request: modificationRequest }).unwrap();
        console.log("===> [BOOKING WORKSPACE MODIFY SUCCESS]:", res);
        toast({
          variant: "success",
          title: "Cập nhật booking thành công!",
          description: `Đã cập nhật các thay đổi cho booking #${id}.`,
        });
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
    if (!Number.isFinite(customerId) || !Number.isFinite(counterEmployeeId)) {
      console.warn("[booking] blocked: customerId or employeeId is not numeric", { customerId, employeeId: storedEmployeeId ?? employeeId, request });
      return;
    }
    if (bookingDetails.some((detail) => !Number.isFinite(detail.roomId))) {
      console.warn("[booking] blocked: roomId is not numeric", request);
      return;
    }
    try {
      await createCounterBooking({ employeeId: counterEmployeeId, request }).unwrap();
      clearRoomGuestCache();
      setStep("success");
    } catch (error) {
      console.error("[booking] create counter booking failed", error);
      setPaymentError(error instanceof Error ? error.message : "Không thể tạo QR/thanh toán. Vui lòng thử lại.");
    }
  };
  const storedEmployeeId = localStorage.getItem("id");
  const bookingEmployeeId = storedEmployeeId ?? employeeId;
  const canSubmitBooking = !promotionBlocked && Number.isFinite(Number(bookingGuest.customerId)) && (Boolean(initialBooking) || Number.isFinite(Number(bookingEmployeeId))) && !isCreatingBooking && !isModifyingBooking;
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [step]);
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
          {step === "guest" && <button onClick={() => setStep("rooms")} className="flex items-center gap-1 text-sm font-semibold text-violet-600"><ChevronLeft size={16} />{t("booking.changeRoom")}</button>}
          {step === "services" && <button onClick={() => setStep("guest")} className="flex items-center gap-1 text-sm font-semibold text-violet-600"><ChevronLeft size={16} />{t("booking.guestInformation")}</button>}
          {step === "promotion" && <button onClick={() => setStep("services")} className="flex items-center gap-1 text-sm font-semibold text-violet-600"><ChevronLeft size={16} />Dịch vụ</button>}
        </div>
      </div>

      {step === "rooms" ? (
        <div className="p-5">
          <div className="relative z-50 grid gap-3 rounded-xl bg-violet-50/70 p-4 sm:grid-cols-[1fr_1fr_auto]">
            <DatePicker label={t("booking.checkInDate")} value={checkIn} onChange={setCheckIn} />
            <DatePicker label={t("booking.checkOutDate")} value={checkOut} min={checkIn || undefined} onChange={setCheckOut} />
            <div className="flex items-end pb-2 text-xs font-semibold text-violet-700">{hasDates ? `${nights} ${t("booking.nights")}` : t("booking.noDateSelected")}</div>
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

          {isRoomsLoading ? <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">Đang tải danh sách phòng...</p> : isRoomsError ? <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-600">Không thể tải danh sách phòng.</p> : <DesktopCalendar
            visibleRooms={visibleRooms}
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
          />}

          <div className="mt-5 flex flex-col items-stretch justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm text-slate-500">
              {t("booking.selectedRooms")} <strong className="text-slate-900">{selected.length} {t("booking.rooms")}</strong>
              {selected.length > 0 && <span> · {t("booking.estimatedTotal")} <strong className="text-violet-700">{money(bookingEstimate.total)}</strong></span>}
              </p>
              {isAddingRoom && <p className="mt-1 text-xs text-blue-600">{t("booking.selectDateToAddRoom")}</p>}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              {selected.length > 0 && <button type="button" onClick={() => {
                if (checkIn && checkOut) {
                  setSelectedRanges((prev) => Object.fromEntries(selected.map((roomId) => [roomId, prev[roomId] ?? { checkIn, checkOut }])));
                }
                setIsAddingRoom(false);
                setQuery("");
                setRoomType(allRoomTypesLabel);
                setBuilding(allBuildingsLabel);
                setFloor(allFloorsLabel);
              }} className="flex items-center justify-center gap-2 rounded-lg border border-violet-200 px-4 py-2.5 text-sm font-semibold text-violet-700 hover:bg-violet-50">{t("booking.viewBookedRooms")}</button>}
              <button disabled={!canContinue} onClick={() => setStep("guest")} className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
              {t("booking.continue")} <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : step === "services" ? (<div className="space-y-5 p-5">
        <BookingServiceSelector
          rooms={selectedRooms.map((room) => ({ ...room, databaseId: room.databaseId, guests: roomGuestCounts[room.id] ? roomGuestCounts[room.id].adults + roomGuestCounts[room.id].children + roomGuestCounts[room.id].infants : room.guests, price: getRoomPrice(room) + (roomGuestSurcharges[room.id] ?? 0) }))}
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
                  <span className="shrink-0 text-right font-bold text-slate-800">{money((getRoomPrice(room) + (roomGuestSurcharges[room.id] ?? 0)) * nightsForRoom(room.id) + getRoomServiceTotal(room, selections))}</span>
                </div>;
              })}
            </div>
          </div>
          <div className="mt-5 flex flex-col-reverse justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center"><button type="button" onClick={() => setStep("promotion")} className="text-sm font-semibold text-slate-500 hover:text-slate-800">Bỏ qua dịch vụ</button><button type="button" onClick={() => setStep("promotion")} className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">Tiếp tục <ChevronRight size={16} className="ml-1 inline" /></button></div>
        </div>
      ) : (
        <div className="grid gap-6 p-5 lg:grid-cols-[1fr_360px]">
          {step === "promotion" && <PromotionSelector customerId={bookingGuest.customerId} orderTotal={roomTotal} onApply={setAppliedPromotion} onEligibilityChange={setPromotionBlocked} />}
          <div className={step === "promotion" ? "hidden" : "payment-column"}>
            {false && <div className="payment-heading flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3"><CreditCard size={16} className="text-blue-600" /><div><p className="text-sm font-bold text-slate-900">{t("booking.paymentMethod")}</p><p className="mt-0.5 text-xs text-slate-500">{t("booking.paymentRequired")}</p></div></div>}
            {step === "guest" ? <><div className="mb-4 grid gap-2 sm:grid-cols-2">{selectedRooms.map((room) => <div key={room.id} className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-slate-600"><strong className="text-blue-700">Phòng {room.id}</strong><span className="ml-2">Tối đa {room.maxAdults} người lớn · {room.maxChildren} trẻ em · {room.maxInfants} em bé</span></div>)}</div><GuestRoomForms rooms={selectedRooms} guest={bookingGuest} onGuestChange={setBookingGuest} /></> : <div className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm font-bold text-slate-900">{t("booking.paymentMethod")}</p><p className="mt-1 text-xs text-slate-500">{t("booking.paymentRequired")}</p><div className="mt-4 grid gap-3"><button type="button" onClick={() => setPaymentMethod("cash")} className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${paymentMethod === "cash" ? "border-violet-500 bg-violet-50 ring-2 ring-violet-100" : "border-slate-200 hover:border-violet-300"}`}><Banknote size={20} className="text-emerald-600" /><span><strong className="block text-sm text-slate-800">{t("booking.cash")}</strong><small className="text-xs text-slate-500">{t("booking.cashDescription")}</small></span>{paymentMethod === "cash" && <Check size={17} className="ml-auto text-violet-600" />}</button><button type="button" onClick={() => setPaymentMethod("bank")} className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${paymentMethod === "bank" ? "border-violet-500 bg-violet-50 ring-2 ring-violet-100" : "border-slate-200 hover:border-violet-300"}`}><QrCode size={20} className="text-blue-600" /><span><strong className="block text-sm text-slate-800">{t("booking.bankQr")}</strong><small className="text-xs text-slate-500">{t("booking.bankQrDescription")}</small></span>{paymentMethod === "bank" && <Check size={17} className="ml-auto text-violet-600" />}</button><button type="button" onClick={() => setPaymentMethod("wallet")} className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${paymentMethod === "wallet" ? "border-violet-500 bg-violet-50 ring-2 ring-violet-100" : "border-slate-200 hover:border-violet-300"}`}><Wallet size={20} className="text-orange-500" /><span><strong className="block text-sm text-slate-800">{t("booking.wallet")}</strong><small className="text-xs text-slate-500">{t("booking.walletDescription")}</small></span>{paymentMethod === "wallet" && <Check size={17} className="ml-auto text-violet-600" />}</button></div></div>}
          </div>
          <div className="h-fit rounded-xl bg-slate-50 p-4">
            <p className="text-center text-xs font-bold uppercase tracking-wider text-blue-600">{t("booking.bookingSummary")}</p>
            <p className="mt-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600"><UserRound size={14} />Thông tin người đặt</p>
            <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
              <p className="mt-1 text-sm font-bold text-slate-800">{bookingGuest.name || "Chưa nhập tên người đặt"}</p>
              <p className="mt-0.5 text-xs text-slate-500">{bookingGuest.phone || "Chưa nhập số điện thoại"}</p>
            </div>
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
                const roomServiceTotal = getServiceTotal(selections) * (roomSelections.length > 0 || serviceMode !== "all" ? 1 : selectedGuestsForRoom(room));
                const roomSubtotal = (getRoomPrice(room) + (roomGuestSurcharges[room.id] ?? 0)) * nightsForRoom(room.id) + roomServiceTotal;
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
                  {!isSummaryRoomCollapsed && <div className="space-y-2 px-3 py-3 text-slate-600">
                    <div className="flex items-center gap-2"><CalendarDays size={14} className="shrink-0 text-blue-600" /><span>{t("booking.checkInDate", "Nhận")}: {formatDateLabel(range.checkIn, "", i18n.language)}</span></div>
                    <div className="flex items-center gap-2"><CalendarDays size={14} className="shrink-0 text-blue-600" /><span>{t("booking.checkOutDate", "Trả")}: {formatDateLabel(range.checkOut, "", i18n.language)}</span></div>
                    <div className="flex items-center gap-2"><UsersRound size={14} className="shrink-0 text-blue-600" /><span>{selectedGuestCount} người · {nightsForRoom(room.id)} đêm</span></div>
                    <div className="my-2 border-t border-blue-100" />
                    <div className="flex justify-between gap-3"><span>Tiền phòng</span><span className="font-medium text-slate-800">{money(getRoomPrice(room) * nightsForRoom(room.id))}</span></div>
                    {(roomGuestSurcharges[room.id] ?? 0) > 0 && <><div className="flex justify-between gap-3"><span>Phụ thu người lớn</span><span className="font-medium text-amber-700">{money((roomGuestSurchargeDetails[room.id]?.adult ?? 0) * nightsForRoom(room.id))}</span></div><div className="flex justify-between gap-3"><span>Phụ thu trẻ em</span><span className="font-medium text-amber-700">{money((roomGuestSurchargeDetails[room.id]?.child ?? 0) * nightsForRoom(room.id))}</span></div></>}
                    <div className="flex justify-between gap-3"><span>Dịch vụ</span><span className="text-right font-medium text-slate-800">{roomServiceTotal ? money(roomServiceTotal) : "Chưa chọn"}</span></div>
                    <div className="mt-2 flex items-center justify-between gap-3 border-t border-blue-100 pt-2 font-bold text-blue-700"><span>Tạm tính phòng</span><span>{money(roomSubtotal)}</span></div>
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
            {step === "guest" ? <button onClick={() => setStep("services")} className="mt-5 w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">Tiếp tục chọn dịch vụ</button> : <>
              {step === "promotion" && !bookingGuest.customerId && <p className="mt-3 text-xs text-amber-600">Vui lòng chọn khách hàng đã lưu để tạo đơn đặt phòng.</p>}
              {step === "promotion" && !Number.isFinite(Number(bookingEmployeeId)) && <p className="mt-1 text-xs text-amber-600">Không tìm thấy ID admin/nhân viên dạng số trong phiên đăng nhập.</p>}
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