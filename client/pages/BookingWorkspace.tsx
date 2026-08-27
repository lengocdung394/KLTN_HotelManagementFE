import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Banknote, CalendarDays, Check, ChevronLeft, ChevronRight, QrCode, Search, SlidersHorizontal, Wallet, X } from "lucide-react";
import GuestRoomForms from "./GuestRoomForms";

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

type DragPoint = { roomIndex: number; dayIndex: number };
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
  return <div className="relative"><p className="text-xs font-bold text-slate-700">{label}</p><button type="button" onClick={() => setOpen((current) => !current)} className="mt-1.5 flex h-11 w-full items-center justify-between rounded-lg border border-violet-100 bg-white px-3 text-left text-sm font-normal text-slate-700 outline-none transition hover:border-violet-300 focus:border-violet-400"><span>{formatDateLabel(value, t("booking.noDateSelected"), i18n.language)}</span><CalendarDays size={16} className="text-violet-500" /></button>{open && <div className="absolute left-0 top-[4.5rem] z-30 w-[min(19rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"><div className="flex items-center justify-between"><button type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))} className="rounded-lg p-1.5 text-slate-500 hover:bg-violet-50"><ChevronLeft size={16} /></button><p className="text-sm font-bold capitalize text-slate-800">{monthLabel}</p><button type="button" onClick={() => setViewDate(new Date(year, month + 1, 1))} className="rounded-lg p-1.5 text-slate-500 hover:bg-violet-50"><ChevronRight size={16} /></button></div><div className="mt-3 grid grid-cols-7 text-center text-[10px] font-bold uppercase text-slate-400">{["sunShort", "monShort", "tueShort", "wedShort", "thuShort", "friShort", "satShort"].map((day) => <span key={day} className="py-1">{t(`calendar.${day}`)}</span>)}</div><div className="grid grid-cols-7 gap-1">{Array.from({ length: firstDay }, (_, index) => <span key={`empty-${index}`} />)}{Array.from({ length: daysInMonth }, (_, index) => { const day = index + 1; const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`; const disabled = Boolean(min && date < min); return <button type="button" key={date} disabled={disabled} onClick={() => selectDay(day)} className={`grid aspect-square place-items-center rounded-lg text-xs transition ${disabled ? "cursor-not-allowed text-slate-300" : date === value ? "bg-violet-600 font-bold text-white" : date === today ? "border border-violet-300 font-bold text-violet-700" : "text-slate-700 hover:bg-violet-50 hover:text-violet-700"}`}>{day}</button>; })}</div><button type="button" onClick={selectToday} className="mt-3 w-full rounded-lg bg-slate-50 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50">{t("booking.today")}</button></div>}</div>;
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
  calendarOffset,
  setCalendarOffset,
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
  calendarOffset: number;
  setCalendarOffset: (value: number) => void;
}) {
  const { t } = useTranslation();
  const dayAt = (index: number) => `2026-09-${String(6 + index + calendarOffset).padStart(2, "0")}`;
  const visibleTimeline = timeline.map((_, index) => {
    const date = new Date(2026, 8, 6 + index + calendarOffset);
    return { label: `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`, day: ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][date.getDay()] };
  });

  const [dragAnchor, setDragAnchor] = useState<DragPoint | null>(null);
  const [dragCurrent, setDragCurrent] = useState<DragPoint | null>(null);
  const isDragging = dragAnchor !== null;

  const isReservedCell = (room: BookingRoom, dayIndex: number) => {
    const day = dayAt(dayIndex);
    return (booked[room.id] || []).some((item) => day >= item.start && day < item.end);
  };

  const dragDayRange = dragAnchor && dragCurrent ? [Math.min(dragAnchor.dayIndex, dragCurrent.dayIndex), Math.max(dragAnchor.dayIndex, dragCurrent.dayIndex)] : null;
  const dragRoomRange = dragAnchor && dragCurrent ? [Math.min(dragAnchor.roomIndex, dragCurrent.roomIndex), Math.max(dragAnchor.roomIndex, dragCurrent.roomIndex)] : null;

  const handlePointerDown = (roomIndex: number, dayIndex: number, room: BookingRoom) => (event: React.PointerEvent) => {
    event.preventDefault();
    if (isReservedCell(room, dayIndex)) return;
    setDragAnchor({ roomIndex, dayIndex });
    setDragCurrent({ roomIndex, dayIndex });
  };

  const handlePointerEnter = (roomIndex: number, dayIndex: number, room: BookingRoom) => () => {
    if (!isDragging) return;
    if (isReservedCell(room, dayIndex)) return;
    setDragCurrent({ roomIndex: dragAnchor?.roomIndex ?? roomIndex, dayIndex });
  };

  const finishInteraction = () => {
    if (!dragAnchor || !dragCurrent) {
      setDragAnchor(null);
      setDragCurrent(null);
      return;
    }

    const isClick = dragAnchor.roomIndex === dragCurrent.roomIndex && dragAnchor.dayIndex === dragCurrent.dayIndex;
    const room = visibleRooms[dragAnchor.roomIndex];

    if (isClick) {
      const day = dayAt(dragAnchor.dayIndex);

      const roomRange = selectedRanges[room.id];
      const newCheckOut = shiftDay(day, 1);

      if (roomRange && (day === roomRange.checkIn || day === shiftDay(roomRange.checkOut, -1))) {
        const isSingleNight = shiftDay(roomRange.checkIn, 1) === roomRange.checkOut;
        const nextRange = day === roomRange.checkIn
          ? { checkIn: shiftDay(roomRange.checkIn, 1), checkOut: roomRange.checkOut }
          : { checkIn: roomRange.checkIn, checkOut: shiftDay(roomRange.checkOut, -1) };

        if (isSingleNight) {
          setSelected((current) => current.filter((id) => id !== room.id));
          setSelectedRanges((current) => {
            const next = { ...current };
            delete next[room.id];
            return next;
          });
        } else {
          setCheckIn(nextRange.checkIn);
          setCheckOut(nextRange.checkOut);
          setSelectedRanges((current) => ({ ...current, [room.id]: nextRange }));
        }
      } else {
        // Click ngày mới hoặc click lần đầu: chọn đúng một đêm cho phòng đó.
        const newCheckIn = day;
        if (isAvailableForRange(room.id, newCheckIn, newCheckOut)) {
          setCheckIn(newCheckIn);
          setCheckOut(newCheckOut);
          setSelected((current) => (current.includes(room.id) ? current : [...current, room.id]));
          setSelectedRanges((current) => ({ ...current, [room.id]: { checkIn: newCheckIn, checkOut: newCheckOut } }));
        }
      }
    } else {
      // Kéo thật sự chỉ chọn các đêm trong hàng phòng đang kéo.
      const dayStart = Math.min(dragAnchor.dayIndex, dragCurrent.dayIndex);
      const dayEnd = Math.max(dragAnchor.dayIndex, dragCurrent.dayIndex) + 1;
      const roomStart = dragAnchor.roomIndex;
      const roomEnd = dragAnchor.roomIndex;
      const hasExistingRange = Boolean(checkIn && checkOut) && dayStart === dayEnd;
      const newCheckIn = hasExistingRange ? checkIn : dayAt(dayStart);
      const newCheckOut = hasExistingRange ? checkOut : dayAt(dayEnd);

      if (!hasExistingRange) {
        setCheckIn(newCheckIn);
        setCheckOut(newCheckOut);
      }
      setSelected((current) => {
        const spanned = visibleRooms
          .slice(roomStart, roomEnd + 1)
          .filter((r) => isAvailableForRange(r.id, newCheckIn, newCheckOut))
          .map((r) => r.id);
        return Array.from(new Set([...current, ...spanned]));
      });
      setSelectedRanges((current) => {
        const next = { ...current };
        visibleRooms.slice(roomStart, roomEnd + 1)
          .filter((candidate) => isAvailableForRange(candidate.id, newCheckIn, newCheckOut))
          .forEach((candidate) => { next[candidate.id] = { checkIn: newCheckIn, checkOut: newCheckOut }; });
        return next;
      });
    }

    setDragAnchor(null);
    setDragCurrent(null);
  };

  return (
    <div
      onPointerUp={finishInteraction}
      onPointerCancel={() => { setDragAnchor(null); setDragCurrent(null); }}
      className="mt-5 overflow-hidden rounded-xl border border-slate-200"
    >
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <p className="text-xs font-bold text-slate-800">{t("booking.roomCalendar")}</p>
          <p className="mt-0.5 text-[10px] text-slate-400">{t("booking.calendarInstruction")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setCalendarOffset(calendarOffset - 7)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><ChevronLeft size={15} /></button>
          <button type="button" onClick={() => { setCalendarOffset(0); window.dispatchEvent(new Event("open-check-in")); }} aria-label="Chọn ngày" title="Chọn ngày" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-blue-50 hover:text-blue-600"><CalendarDays size={15} /></button>
          <button type="button" onClick={() => setCalendarOffset(calendarOffset + 7)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><ChevronRight size={15} /></button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[260px_repeat(7,minmax(100px,1fr))] border-b border-slate-200 bg-slate-50">
            <div className="p-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("booking.roomTypeLabel")}</div>
            {visibleTimeline.map((date, index) => (
              <div key={date.label} className={`border-l border-slate-200 p-3 text-center ${dayAt(index) === checkIn ? "bg-blue-50" : ""}`}>
                <p className="text-[10px] font-bold uppercase text-slate-400">{date.day}</p>
                <p className={`mt-1 text-sm font-bold ${dayAt(index) === checkIn ? "text-blue-600" : "text-slate-700"}`}>{date.label}</p>
              </div>
            ))}
          </div>
          {visibleRooms.map((room, roomIndex) => {
            const roomAvailable = isAvailableForRange(room.id, checkIn || "0000-00-00", checkOut || "9999-99-99");
            return (
              <div key={room.id} className="grid min-h-[106px] grid-cols-[260px_repeat(7,minmax(100px,1fr))] border-b border-slate-100 last:border-0">
                <button
                  type="button"
                  disabled={!roomAvailable && Boolean(checkIn && checkOut)}
                  onClick={() => {
                    setSelected((current) => (current.includes(room.id) ? current.filter((id) => id !== room.id) : [...current, room.id]));
                    if (checkIn && checkOut && isAvailableForRange(room.id, checkIn, checkOut)) {
                      setSelectedRanges((current) => {
                        if (selected.includes(room.id)) {
                          const next = { ...current };
                          delete next[room.id];
                          return next;
                        }
                        return { ...current, [room.id]: { checkIn, checkOut } };
                      });
                    }
                  }}
                  className={`flex min-w-0 items-center gap-3 bg-white p-4 text-left hover:bg-slate-50 ${!roomAvailable && checkIn && checkOut ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  <span className={`grid h-11 min-w-[58px] shrink-0 place-items-center rounded-xl px-2 text-[11px] font-bold whitespace-nowrap ${selected.includes(room.id) ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600"}`}>{room.id}</span>
                  <span className="min-w-0">
                    <strong className="block text-xs text-slate-800">{room.type}</strong>
                    <small className="mt-1 block text-[10px] text-slate-400">{room.beds} · {room.size}</small>
                    <em className="mt-1 block text-[10px] not-italic text-violet-600">{selected.includes(room.id) ? t("booking.selectedRemove") : t("booking.selectRoomHint")}</em>
                  </span>
                </button>
                {timeline.map((date, dayIndex) => {
                  const day = dayAt(dayIndex);
                  const reservation = (booked[room.id] || []).find((item) => day >= item.start && day < item.end);
                  const roomRange = selectedRanges[room.id] || (selected.length === 0 && checkIn && checkOut ? { checkIn, checkOut } : undefined);
                  const inRange = Boolean(roomRange) && day >= roomRange.checkIn && day < roomRange.checkOut;
                  const dragging = Boolean(
                    dragDayRange && dragRoomRange &&
                    dayIndex >= dragDayRange[0] && dayIndex <= dragDayRange[1] &&
                    roomIndex >= dragRoomRange[0] && roomIndex <= dragRoomRange[1]
                  );
                  return (
                    <div
                      key={date}
                      onPointerDown={handlePointerDown(roomIndex, dayIndex, room)}
                      onPointerEnter={handlePointerEnter(roomIndex, dayIndex, room)}
                      title={reservation ? `${reservation.guest} · đã đặt` : "Kéo dọc để chọn nhiều phòng, bấm để chọn/bỏ"}
                      className={`relative select-none touch-none border-l border-slate-100 p-1.5 ${reservation ? "cursor-not-allowed bg-gray-100" : "cursor-crosshair bg-white hover:bg-blue-50"}`}
                    >
                      <div className={`flex h-full min-h-[76px] flex-col justify-center rounded-lg px-2 transition ${reservation ? "bg-gray-300 text-gray-600" : dragging || inRange ? "bg-blue-500 text-white shadow-sm" : "bg-blue-50 text-blue-700"}`}>
                        {reservation ? (
                          <>
                            <span className="truncate text-[10px] font-bold">{t("booking.booked")}</span>
                            <span className="mt-1 truncate text-[9px]">{reservation.guest}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] font-semibold">{inRange ? t("booking.selecting") : t("booking.available")}</span>
                            <span className="mt-1 text-[9px] opacity-70">{t("booking.dragToSelect")}</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function BookingWorkspace() {
  const { t } = useTranslation();
  const [step, setStep] = useState<"rooms" | "guest" | "payment" | "success">("rooms");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank" | "wallet" | "">("");
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedRanges, setSelectedRanges] = useState<Record<string, RoomDateRange>>({});
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [query, setQuery] = useState("");
  const [building, setBuilding] = useState("Tất cả các tòa");
  const [floor, setFloor] = useState("Tất cả các tầng");
  const [showFull, setShowFull] = useState(false);
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  const [calendarOffset, setCalendarOffset] = useState(0);

  useEffect(() => {
    if (!checkIn) return;
    const picked = new Date(`${checkIn}T00:00:00`);
    const calendarStart = new Date(2026, 8, 6);
    setCalendarOffset(Math.floor((picked.getTime() - calendarStart.getTime()) / 86400000 / 7) * 7);
  }, [checkIn]);

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
          <div className="grid gap-3 rounded-xl bg-violet-50/70 p-4 sm:grid-cols-[1fr_1fr_auto]">
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
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
              <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-gray-400" />{t("booking.unavailable")}</span>
              <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-500" />{t("booking.available")}</span>
              <span className="text-slate-400">{t("booking.dragToSelectRooms")}</span>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={showFull} onChange={(event) => setShowFull(event.target.checked)} />{t("booking.showFullRooms")}</label>
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
            calendarOffset={calendarOffset}
            setCalendarOffset={setCalendarOffset}
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
              }} className="flex items-center justify-center gap-2 rounded-lg border border-violet-200 px-4 py-2.5 text-sm font-semibold text-violet-700 hover:bg-violet-50"><SlidersHorizontal size={16} />{t("booking.holdRooms")}</button>}
              <button disabled={!selected.length || isAddingRoom || !hasDates} onClick={() => setStep("guest")} className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
              {t("booking.continue")} <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 p-5 lg:grid-cols-[1fr_280px]">
          <div>
            {step === "guest" ? <GuestRoomForms rooms={selectedRooms} /> : <div className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm font-bold text-slate-900">{t("booking.paymentMethod")}</p><p className="mt-1 text-xs text-slate-500">{t("booking.paymentRequired")}</p><div className="mt-4 grid gap-3"><button type="button" onClick={() => setPaymentMethod("cash")} className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${paymentMethod === "cash" ? "border-violet-500 bg-violet-50 ring-2 ring-violet-100" : "border-slate-200 hover:border-violet-300"}`}><Banknote size={20} className="text-emerald-600" /><span><strong className="block text-sm text-slate-800">{t("booking.cash")}</strong><small className="text-xs text-slate-500">{t("booking.cashDescription")}</small></span>{paymentMethod === "cash" && <Check size={17} className="ml-auto text-violet-600" />}</button><button type="button" onClick={() => setPaymentMethod("bank")} className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${paymentMethod === "bank" ? "border-violet-500 bg-violet-50 ring-2 ring-violet-100" : "border-slate-200 hover:border-violet-300"}`}><QrCode size={20} className="text-blue-600" /><span><strong className="block text-sm text-slate-800">{t("booking.bankQr")}</strong><small className="text-xs text-slate-500">{t("booking.bankQrDescription")}</small></span>{paymentMethod === "bank" && <Check size={17} className="ml-auto text-violet-600" />}</button><button type="button" onClick={() => setPaymentMethod("wallet")} className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${paymentMethod === "wallet" ? "border-violet-500 bg-violet-50 ring-2 ring-violet-100" : "border-slate-200 hover:border-violet-300"}`}><Wallet size={20} className="text-orange-500" /><span><strong className="block text-sm text-slate-800">{t("booking.wallet")}</strong><small className="text-xs text-slate-500">{t("booking.walletDescription")}</small></span>{paymentMethod === "wallet" && <Check size={17} className="ml-auto text-violet-600" />}</button></div></div>}
          </div>
          <div className="h-fit rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{t("booking.bookingSummary")}</p>
            <p className="mt-3 text-sm font-bold text-slate-800">{selected.length} {t("booking.rooms")} · {nights} {t("booking.nights")}</p>
            <div className="mt-3 space-y-1">
              {selectedRooms.map((room) => (
                <div key={room.id} className="flex justify-between gap-2 text-xs text-slate-500">
                  <span>{t("room.roomLabel", "Room")} {room.id} · {room.type}</span>
                  <span>{money(room.price * nights)}</span>
                </div>
              ))}
            </div>
            <div className="my-4 border-t border-slate-200" />
            <div className="flex justify-between text-sm font-bold text-slate-900">
              <span>{t("booking.total")}</span>
              <span className="text-violet-700">{money(total)}</span>
            </div>
            {step === "guest" ? <button onClick={() => setStep("payment")} className="mt-5 w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">{t("booking.continuePayment")}</button> : <button disabled={!paymentMethod} onClick={() => setStep("success")} className="mt-5 w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">{t("booking.confirmPayment")}</button>}
          </div>
        </div>
      )}
    </section>
  );
}