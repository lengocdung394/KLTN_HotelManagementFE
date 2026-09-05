import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Banknote, CalendarDays, Check, ChevronLeft, ChevronRight, QrCode, Search, Wallet } from "lucide-react";
import GuestRoomForms, { type BookingGuest } from "./GuestRoomForms";

const legacyRooms = [
  { id: "A-1-1", type: "Standard Room", beds: "1 giường đơn", size: "25 m²", guests: 1, price: 1000000, amenity: "Điều hòa · TV · Phòng tắm riêng" },
  { id: "A-1-2", type: "Standard Room", beds: "1 giường đơn", size: "25 m²", guests: 1, price: 1000000, amenity: "Điều hòa · TV · Minibar" },
  { id: "A-1-3", type: "Standard Room", beds: "1 giường đơn", size: "25 m²", guests: 1, price: 1000000, amenity: "Điều hòa · TV · Ấm đun nước" },
  { id: "A-1-4", type: "Standard Room", beds: "1 giường đơn", size: "25 m²", guests: 1, price: 1000000, amenity: "Điều hòa · TV · Wifi" },
  { id: "A-1-5", type: "Standard Room", beds: "1 giường đơn", size: "25 m²", guests: 1, price: 1000000, amenity: "Điều hòa · TV · Baby Cot" },
  { id: "A-2-1", type: "Superior Room", beds: "2 giường đơn", size: "30 m²", guests: 2, price: 1500000, amenity: "Điều hòa · TV · Bồn tắm" },
  { id: "A-2-2", type: "Superior Room", beds: "2 giường đơn", size: "30 m²", guests: 2, price: 1500000, amenity: "Điều hòa · TV · Minibar" },
  { id: "A-2-3", type: "Superior Room", beds: "2 giường đơn", size: "30 m²", guests: 2, price: 1500000, amenity: "Điều hòa · TV · Bàn làm việc" },
  { id: "A-2-4", type: "Superior Room", beds: "2 giường đơn", size: "30 m²", guests: 2, price: 1500000, amenity: "Điều hòa · TV · Wifi" },
  { id: "A-2-5", type: "Superior Room", beds: "2 giường đơn", size: "30 m²", guests: 2, price: 1500000, amenity: "Điều hòa · TV · Baby Cot" },
  { id: "B-3-1", type: "Deluxe Room", beds: "1 giường King Size", size: "45 m²", guests: 2, price: 2000000, amenity: "Minibar · TV màn hình lớn · Vòi sen massage" },
  { id: "B-3-2", type: "Deluxe Room", beds: "1 giường King Size", size: "45 m²", guests: 2, price: 2000000, amenity: "Khu vực tiếp khách · Bồn tắm · Wifi" },
  { id: "B-3-3", type: "Deluxe Room", beds: "1 giường King Size", size: "45 m²", guests: 2, price: 2000000, amenity: "Minibar · TV màn hình lớn · Bồn tắm" },
  { id: "B-3-4", type: "Deluxe Room", beds: "1 giường King Size", size: "45 m²", guests: 2, price: 2000000, amenity: "Minibar · Vòi sen massage · Wifi" },
  { id: "B-3-5", type: "Deluxe Room", beds: "1 giường King Size", size: "45 m²", guests: 2, price: 2000000, amenity: "Khu vực tiếp khách · Bồn tắm · Wifi" },
  { id: "C-4-1", type: "Suite Room", beds: "1 giường King Size + 1 giường đơn", size: "60 m²", guests: 3, price: 2500000, amenity: "Phòng khách riêng · Bồn tắm · Baby Cot" },
  { id: "C-4-2", type: "Suite Room", beds: "1 giường King Size + 1 giường đơn", size: "60 m²", guests: 3, price: 2500000, amenity: "Ban công riêng · Bồn tắm · Wifi" },
  { id: "C-4-3", type: "Suite Room", beds: "1 giường King Size + 1 giường đơn", size: "60 m²", guests: 3, price: 2500000, amenity: "Phòng khách riêng · Minibar · Baby Cot" },
  { id: "C-4-4", type: "Suite Room", beds: "1 giường King Size + 1 giường đơn", size: "60 m²", guests: 3, price: 2500000, amenity: "Khu vực làm việc · Bồn tắm · Baby Cot" },
  { id: "C-4-5", type: "Suite Room", beds: "1 giường King Size + 1 giường đơn", size: "60 m²", guests: 3, price: 2500000, amenity: "Ban công riêng · Minibar · Wifi" },
];

const roomTypes = {
  1: { type: "Standard Room", beds: "1 giường đơn", size: "25 m²", guests: 1, price: 1000000, amenity: "Điều hòa · TV · Phòng tắm riêng" },
  2: { type: "Superior Room", beds: "2 giường đơn", size: "30 m²", guests: 2, price: 1500000, amenity: "Điều hòa · TV · Bồn tắm" },
  3: { type: "Deluxe Room", beds: "1 giường King Size", size: "45 m²", guests: 2, price: 2000000, amenity: "Minibar · TV màn hình lớn · Vòi sen massage" },
  4: { type: "Suite Room", beds: "1 giường King Size + 1 giường đơn", size: "60 m²", guests: 3, price: 2500000, amenity: "Phòng khách riêng · Bồn tắm · Baby Cot" },
} as const;
const bookingBuildings = ["A", "B", "C", "D"] as const;
const rooms = bookingBuildings.flatMap((building) => [1, 2, 3, 4].flatMap((floor) => Array.from({ length: 5 }, (_, index) => ({
  id: `${building}-${floor}-${index + 1}`,
  ...roomTypes[floor as keyof typeof roomTypes],
}))));

const booked: Record<string, { start: string; end: string; guest: string }[]> = {
  "A-1-1": [{ start: "2026-09-03", end: "2026-09-06", guest: "Nguyễn Minh Anh" }, { start: "2026-09-14", end: "2026-09-17", guest: "Lê Hoàng Nam" }],
  "A-1-2": [{ start: "2026-09-08", end: "2026-09-12", guest: "Trần Thùy Dương" }],
  "A-2-1": [{ start: "2026-09-05", end: "2026-09-07", guest: "Công ty VinaTech" }],
  "B-3-2": [{ start: "2026-09-08", end: "2026-09-10", guest: "Đỗ Khánh Linh" }],
  "C-4-1": [{ start: "2026-09-10", end: "2026-09-13", guest: "Phạm Gia đình" }],
};

const timeline = ["06/09", "07/09", "08/09", "09/09", "10/09", "11/09", "12/09"];
const money = (value: number) => value.toLocaleString("vi-VN") + "đ";

type BookingRoom = typeof rooms[number];

const floorOptions = ["Tất cả các tầng", "Tầng 1", "Tầng 2", "Tầng 3", "Tầng 4"];
const buildingOptions = ["Tất cả các tòa", "A", "B", "C", "D"];
const roomFloor = (room: BookingRoom) => `Tầng ${room.id.split("-")[1]}`;

// Dịch 1 chuỗi ngày "YYYY-MM-DD" đi +/- delta ngày
const shiftDay = (dateStr: string, delta: number) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
};

type RoomDateRange = { checkIn: string; checkOut: string };

const formatDateLabel = (value: string, fallback: string, language: string) => value ? new Date(`${value}T00:00:00`).toLocaleDateString(language === "en" ? "en-US" : "vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : fallback;

function DatePicker({ label, value, min, onChange }: { label: string; value: string; min?: string; onChange: (value: string) => void }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => value ? new Date(`${value}T00:00:00`) : new Date(2026, 8, 1));
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = viewDate.toLocaleDateString(i18n.language === "en" ? "en-US" : "vi-VN", { month: "long", year: "numeric" });
  const pickerId = label === t("booking.checkInDate") ? "check-in" : "check-out";
  useEffect(() => { const openPicker = () => setOpen(true); window.addEventListener(`open-${pickerId}`, openPicker); return () => window.removeEventListener(`open-${pickerId}`, openPicker); }, [pickerId]);
  const today = new Date().toISOString().slice(0, 10);
  const selectDay = (day: number) => {
    const next = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!min || next >= min) { onChange(next); setOpen(false); }
  };
  const selectToday = () => { const current = new Date(); const date = current.toISOString().slice(0, 10); if (!min || date >= min) { onChange(date); setViewDate(new Date(current.getFullYear(), current.getMonth(), 1)); setOpen(false); } };
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
  const todayValue = new Date().toISOString().slice(0, 10);
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

  // Move the rendered window to the selected date when it is chosen externally.
  useEffect(() => {
    if (checkIn) setTimelineStart((current) => {
      const next = checkIn < todayValue ? todayValue : checkIn;
      return current === next ? current : next;
    });
  }, [checkIn, todayValue]);

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
      
      if (clickedDate === checkInDate || clickedDate === lastNightDate) {
        const isSingleNight = checkInDate === lastNightDate;
        
        if (isSingleNight) {
          const remainingRooms = selected.filter((id) => id !== roomId);
          setSelected(remainingRooms);
          setSelectedRanges((prev) => {
            const next = { ...prev };
            delete next[roomId];

            const remainingRange = remainingRooms
              .map((id) => next[id])
              .find((range): range is RoomDateRange => Boolean(range));
            setCheckIn(remainingRange?.checkIn || "");
            setCheckOut(remainingRange?.checkOut || "");
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
          
          setCheckIn(newCheckIn);
          setCheckOut(newCheckOut);
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
      setCheckIn(newCheckIn);
      setCheckOut(newCheckOut);
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
              <div key={date.value} className={`border-l border-slate-200 p-3 text-center ${date.value === checkIn ? "bg-violet-50/50" : ""}`}>
                <p className="text-[10px] font-bold uppercase text-slate-400">{date.day}</p>
                <p className={`mt-1 text-sm font-bold ${date.value === checkIn ? "text-violet-700" : isPastDate(date.value) ? "text-slate-400" : "text-slate-700"}`}>{date.label}</p>
              </div>
            ))}
          </div>

          {visibleRooms.map((room) => (
            <div key={room.id} className="grid min-h-[106px] border-b border-slate-100 last:border-0 relative hover:bg-slate-50/30 transition-colors" style={{ gridTemplateColumns: `260px repeat(${totalDays}, minmax(96px, 1fr))` }}>
              <div className="sticky left-0 top-0 z-20 border-r border-slate-100 bg-white p-0 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                <button
                  type="button"
                  disabled={Boolean(checkIn && checkOut) && !isAvailableForRange(room.id, checkIn, checkOut)}
                  onClick={() => {
                    if (selected.includes(room.id)) {
                      const remainingRooms = selected.filter((id) => id !== room.id);
                      setSelected(remainingRooms);
                      setSelectedRanges((prev) => {
                        const next = { ...prev };
                        delete next[room.id];

                        const remainingRange = remainingRooms
                          .map((id) => next[id])
                          .find((range): range is RoomDateRange => Boolean(range));
                        setCheckIn(remainingRange?.checkIn || "");
                        setCheckOut(remainingRange?.checkOut || "");
                        return next;
                      });
                      return;
                    }

                    setSelected((current) => [...current, room.id]);

                    if (checkIn && checkOut && isAvailableForRange(room.id, checkIn, checkOut)) {
                      setSelectedRanges(prev => ({ ...prev, [room.id]: { checkIn, checkOut } }));
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
                    className={`relative select-none touch-pan-x border-l border-slate-100 p-1.5 transition-colors duration-150 ${reservation ? "cursor-not-allowed bg-slate-50/50" : pastDay ? "cursor-not-allowed bg-slate-100/50" : "cursor-crosshair hover:bg-violet-50/50"}`}
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
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState<"rooms" | "guest" | "payment" | "success">("rooms");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank" | "wallet" | "">("");
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedRanges, setSelectedRanges] = useState<Record<string, RoomDateRange>>({});
  const [checkIn, setCheckIn] = useState(() => new Date().toISOString().slice(0, 10));
  const [checkOut, setCheckOut] = useState(() => shiftDay(new Date().toISOString().slice(0, 10), 1));
  const [query, setQuery] = useState("");
  const [building, setBuilding] = useState("Tất cả các tòa");
  const [floor, setFloor] = useState("Tất cả các tầng");
  const [showFull, setShowFull] = useState(false);
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  const [bookingGuest, setBookingGuest] = useState<BookingGuest>({ name: "", phone: "", identityNumber: "" });

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
        .filter((room) => building === "Tất cả các tòa" || room.id.startsWith(`${building}-`))
        .filter((room) => floor === "Tất cả các tầng" || roomFloor(room) === floor),
    [query, building, floor]
  );

  const hasRoomFilter = Boolean(query.trim() || building !== "Tất cả các tòa" || floor !== "Tất cả các tầng");
  const visibleRooms = useMemo(
    () => filteredRooms.filter((room) => {
      if (isAddingRoom) return selected.includes(room.id) || showFull || !hasDates || isAvailable(room.id);
      if (hasRoomFilter) return selected.includes(room.id) || showFull || !hasDates || isAvailable(room.id);
      return selected.length > 0 ? selected.includes(room.id) : showFull || !hasDates || isAvailable(room.id);
    }),
    [filteredRooms, hasRoomFilter, showFull, checkIn, checkOut, hasDates, selected, isAddingRoom]
  );

  const selectedRooms = rooms.filter((room) => selected.includes(room.id));
  const nightsForRoom = (roomId: string) => {
    const range = selectedRanges[roomId];
    return range ? Math.max(1, Math.round((new Date(range.checkOut).getTime() - new Date(range.checkIn).getTime()) / 86400000)) : nights;
  };
  const total = selectedRooms.reduce((sum, room) => sum + room.price * nightsForRoom(room.id), 0);
  const summaryRanges = selectedRooms.map((room) => ({ room, range: selectedRanges[room.id] ?? { checkIn, checkOut } }));
  const hasDifferentStayPeriods = summaryRanges.some(({ range }) => range.checkIn !== summaryRanges[0]?.range.checkIn || range.checkOut !== summaryRanges[0]?.range.checkOut);
  const formatStayPeriod = (range: RoomDateRange) => `${formatDateLabel(range.checkIn, "", i18n.language)} → ${formatDateLabel(range.checkOut, "", i18n.language)}`;

  if (step === "success")
    return (
      <section className="mt-6 rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600"><Check size={28} /></div>
        <h3 className="mt-4 text-xl font-bold text-slate-900">{t("booking.bookingSuccess")}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{t("booking.successDetail", { count: selected.length, checkIn, checkOut })}</p>
        <button onClick={() => { setStep("rooms"); setSelected([]); setSelectedRanges({}); }} className="mt-6 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white">{t("booking.createAnother")}</button>
      </section>
    );

  return (
    <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${step === "rooms" ? "bg-violet-600 text-white" : "bg-emerald-500 text-white"}`}>{step === "rooms" ? "1" : <Check size={14} />}</span>
          <span className="text-xs font-semibold text-slate-500">{t("booking.dateAndRooms")}</span>
          <span className="h-px w-8 bg-slate-200" />
          <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${step === "guest" ? "bg-violet-600 text-white" : step === "payment" ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"}`}>{step === "payment" ? <Check size={14} /> : "2"}</span>
          <span className="text-xs font-semibold text-slate-500">{t("booking.guestInformation")}</span>
          <span className="h-px w-8 bg-slate-200" />
          <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${step === "payment" ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-400"}`}>3</span>
          <span className="text-xs font-semibold text-slate-500">{t("booking.payment")}</span>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full bg-violet-600 transition-all ${step === "payment" ? "w-full" : step === "guest" ? "w-2/3" : "w-1/3"}`} /></div>
        <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{step === "rooms" ? t("booking.selectDateAndRoom") : step === "guest" ? t("booking.bookingInformation") : t("booking.payment")}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {step === "rooms"
                ? t("booking.calendarSelectionDescription")
                : `${selected.length} ${t("booking.rooms")} · ${nights} ${t("booking.nights")} · ${checkIn} → ${checkOut}`}
            </p>
          </div>
          {step === "guest" && <button onClick={() => setStep("rooms")} className="flex items-center gap-1 text-sm font-semibold text-violet-600"><ChevronLeft size={16} />{t("booking.changeRoom")}</button>}
          {step === "payment" && <button onClick={() => setStep("guest")} className="flex items-center gap-1 text-sm font-semibold text-violet-600"><ChevronLeft size={16} />{t("booking.guestInformation")}</button>}
        </div>
      </div>

      {step === "rooms" ? (
        <div className="p-5">
          <div className="relative z-50 grid gap-3 rounded-xl bg-violet-50/70 p-4 sm:grid-cols-[1fr_1fr_auto]">
            <DatePicker label={t("booking.checkInDate")} value={checkIn} onChange={setCheckIn} />
            <DatePicker label={t("booking.checkOutDate")} value={checkOut} min={checkIn || undefined} onChange={setCheckOut} />
            <div className="flex items-end pb-2 text-xs font-semibold text-violet-700">{hasDates ? `${nights} ${t("booking.nights")}` : t("booking.noDateSelected")}</div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <div className="relative w-full sm:w-64">
              <Search size={15} className="absolute left-3 top-3 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("booking.searchRooms")} className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-violet-400" />
              </div>
              <select value={floor} onChange={(event) => setFloor(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none focus:border-violet-400">
                {floorOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={building} onChange={(event) => setBuilding(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none focus:border-violet-400">
                {buildingOptions.map((item) => <option key={item} value={item}>{item === "Tất cả các tòa" ? item : `Tòa ${item}`}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
              <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full bg-slate-300 ring-1 ring-slate-200" />{t("booking.unavailable")}</span>
              <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full bg-sky-500" />{t("booking.available")}</span>
              <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full bg-violet-500" />{t("booking.selecting")}</span>
              <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />{t("booking.booked")}</span>
              
              <label className="flex items-center gap-1.5 text-slate-600"><input type="checkbox" checked={showFull} onChange={(event) => setShowFull(event.target.checked)} />{t("booking.showFullRooms")}</label>
            </div>
          </div>

          <DesktopCalendar
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
          />

          <div className="mt-5 flex flex-col items-stretch justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm text-slate-500">
              {t("booking.selectedRooms")} <strong className="text-slate-900">{selected.length} {t("booking.rooms")}</strong>
              {selected.length > 0 && <span> · {t("booking.estimatedTotal")} <strong className="text-violet-700">{money(total)}</strong></span>}
              </p>
              {isAddingRoom && <p className="mt-1 text-xs text-blue-600">{t("booking.selectDateToAddRoom")}</p>}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              {selected.length > 0 && <button type="button" onClick={() => {
                setIsAddingRoom(false);
                setQuery("");
                setBuilding("Tất cả các tòa");
                setFloor("Tất cả các tầng");
              }} className="flex items-center justify-center gap-2 rounded-lg border border-violet-200 px-4 py-2.5 text-sm font-semibold text-violet-700 hover:bg-violet-50">{t("booking.viewBookedRooms")}</button>}
              <button disabled={!selected.length || isAddingRoom || !hasDates} onClick={() => setStep("guest")} className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
              {t("booking.continue")} <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 p-5 lg:grid-cols-[1fr_360px]">
          <div>
            {step === "guest" ? <GuestRoomForms rooms={selectedRooms} guest={bookingGuest} onGuestChange={setBookingGuest} /> : <div className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm font-bold text-slate-900">{t("booking.paymentMethod")}</p><p className="mt-1 text-xs text-slate-500">{t("booking.paymentRequired")}</p><div className="mt-4 grid gap-3"><button type="button" onClick={() => setPaymentMethod("cash")} className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${paymentMethod === "cash" ? "border-violet-500 bg-violet-50 ring-2 ring-violet-100" : "border-slate-200 hover:border-violet-300"}`}><Banknote size={20} className="text-emerald-600" /><span><strong className="block text-sm text-slate-800">{t("booking.cash")}</strong><small className="text-xs text-slate-500">{t("booking.cashDescription")}</small></span>{paymentMethod === "cash" && <Check size={17} className="ml-auto text-violet-600" />}</button><button type="button" onClick={() => setPaymentMethod("bank")} className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${paymentMethod === "bank" ? "border-violet-500 bg-violet-50 ring-2 ring-violet-100" : "border-slate-200 hover:border-violet-300"}`}><QrCode size={20} className="text-blue-600" /><span><strong className="block text-sm text-slate-800">{t("booking.bankQr")}</strong><small className="text-xs text-slate-500">{t("booking.bankQrDescription")}</small></span>{paymentMethod === "bank" && <Check size={17} className="ml-auto text-violet-600" />}</button><button type="button" onClick={() => setPaymentMethod("wallet")} className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${paymentMethod === "wallet" ? "border-violet-500 bg-violet-50 ring-2 ring-violet-100" : "border-slate-200 hover:border-violet-300"}`}><Wallet size={20} className="text-orange-500" /><span><strong className="block text-sm text-slate-800">{t("booking.wallet")}</strong><small className="text-xs text-slate-500">{t("booking.walletDescription")}</small></span>{paymentMethod === "wallet" && <Check size={17} className="ml-auto text-violet-600" />}</button></div></div>}
          </div>
          <div className="h-fit rounded-xl bg-slate-50 p-4">
            <p className="text-center text-xs font-bold uppercase tracking-wider text-slate-400">{t("booking.bookingSummary")}</p>
            <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Thông tin người đặt</p>
            <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
              <p className="mt-1 text-sm font-bold text-slate-800">{bookingGuest.name || "Chưa nhập tên người đặt"}</p>
              <p className="mt-0.5 text-xs text-slate-500">{bookingGuest.phone || "Chưa nhập số điện thoại"}</p>
            </div>
            <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Thông tin phòng</p>
            <p className="mt-3 text-sm font-bold text-slate-800">{selected.length} {t("booking.rooms")} · {nights} {t("booking.nights")}</p>
            {!hasDifferentStayPeriods && summaryRanges[0] && <p className="mt-1 text-xs font-semibold text-violet-700 lg:whitespace-nowrap">{t("booking.stayPeriod", "Check-in / Check-out")}: {formatStayPeriod(summaryRanges[0].range)}</p>}
            <div className="mt-3 space-y-1">
              {summaryRanges.map(({ room, range }) => (
                <div key={room.id} className="flex justify-between gap-3 rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-500">
                  <span className="min-w-0">
                    <strong className="block text-slate-800">Phòng {room.id}</strong>
                    <span className="mt-0.5 block">{room.type} · {room.guests} người</span>
                    {hasDifferentStayPeriods && <small className="mt-0.5 block text-[10px] text-slate-400">{t("booking.stayPeriod", "Check-in / Check-out")}: {formatStayPeriod(range)}</small>}
                  </span>
                  <span className="shrink-0 text-right"><strong className="block text-slate-800">{money(room.price * nightsForRoom(room.id))}</strong><small className="mt-0.5 block text-[10px] text-slate-400">{money(room.price)}/đêm</small></span>
                </div>
              ))}
            </div>
            <div className="my-4 border-t border-slate-200" />
            <div className="flex justify-between text-sm font-bold text-slate-900">
              <span>{t("booking.total")}</span>
              <span className="text-violet-700">{money(total)}</span>
            </div>
            {step === "payment" && <>
              <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-violet-500">Thông tin thanh toán</p>
              <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-3">
              <p className="mt-1 text-sm font-bold text-violet-800">{paymentMethod === "cash" ? t("booking.cash") : paymentMethod === "bank" ? t("booking.bankQr") : paymentMethod === "wallet" ? t("booking.wallet") : "Chưa chọn phương thức"}</p>
              <p className="mt-0.5 text-xs text-violet-600">Số tiền cần thanh toán: {money(total)}</p>
              </div>
            </>}
            {step === "guest" ? <button onClick={() => setStep("payment")} className="mt-5 w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">{t("booking.continuePayment")}</button> : <button disabled={!paymentMethod} onClick={() => setStep("success")} className="mt-5 w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">{t("booking.confirmPayment")}</button>}
          </div>
        </div>
      )}
    </section>
  );
}