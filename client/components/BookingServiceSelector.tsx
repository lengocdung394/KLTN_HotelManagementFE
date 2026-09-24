import { useEffect, useState } from "react";
import { Ban, Check, ChevronRight, CreditCard, DoorOpen, ListChecks, ReceiptText, Search } from "lucide-react";
import type { HotelService } from "../services/serviceApi";

export type ServiceSelection = { serviceId: string; quantity: number; originalQuantity?: number; price?: number; name?: string; usedAt?: string; detailId?: number; isExisting?: boolean; applyToRoom?: boolean };
export type ServiceRoom = { id: string; databaseId?: string; type: string; guests: number; price: number; dailyPrices?: Record<string, number>; nightlySurcharge?: number };

export type BookingServiceSelectorProps = {
  rooms: ServiceRoom[];
  services: HotelService[];
  servicesLoading?: boolean;
  servicesError?: boolean;
  serviceMode: "all" | "per-room";
  setServiceMode: (mode: "all" | "per-room") => void;
  allRoomServices: ServiceSelection[];
  setAllRoomServices: React.Dispatch<React.SetStateAction<ServiceSelection[]>>;
  roomServices: Record<string, ServiceSelection[]>;
  setRoomServices: React.Dispatch<React.SetStateAction<Record<string, ServiceSelection[]>>>;
  roomRanges: Record<string, { checkIn: string; checkOut: string }>;
  fallbackRange: { checkIn: string; checkOut: string };
  language: string;
  nightsForRoom: (roomId: string) => number;
  onContinue: () => void;
  onSkip: () => void;
  continueLabel?: string;
  skipLabel?: string;
};

const formatDate = (value: string, language: string) => new Date(`${value}T00:00:00`).toLocaleDateString(language === "en" ? "en-US" : "vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
const money = (value: number) => `${value.toLocaleString("vi-VN")}đ`;
const shiftDay = (dateStr: string, delta: number) => {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export default function BookingServiceSelector({ rooms, services, servicesLoading = false, servicesError = false, serviceMode, setServiceMode, allRoomServices: selectedAllRoomServices, setAllRoomServices, roomServices, setRoomServices, roomRanges, fallbackRange, language, nightsForRoom: getNightsForRoom, onContinue, onSkip, continueLabel = "Tiếp tục thanh toán", skipLabel = "Bỏ qua dịch vụ" }: BookingServiceSelectorProps) {
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null);
  const [serviceSearch, setServiceSearch] = useState("");
  const [roomServiceSearch, setRoomServiceSearch] = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useState<"services" | "rooms" | "summary">("services");
  useEffect(() => {
    setRoomServices((current) => {
      let changed = false;
      const next = Object.fromEntries(Object.entries(current).map(([roomId, selections]) => {
        const filtered = selections.filter((selection) => !(selection.isExisting && selection.quantity === 0));
        if (filtered.length !== selections.length) changed = true;
        return [roomId, filtered];
      }));
      return changed ? next : current;
    });
  }, [roomServices, setRoomServices]);
  const allRoomServices = selectedAllRoomServices.filter((selection, index, source) => source.findIndex((item) => item.serviceId === selection.serviceId) === index);
  const uniqueServices = services.filter((service, index, source) => source.findIndex((candidate) => candidate.id === service.id) === index);
  const visibleServices = (search: string) => uniqueServices.filter((service) => service.name.toLowerCase().includes(search.trim().toLowerCase()));
  const getSelectionQuantity = (room: ServiceRoom, selection: ServiceSelection) => selection.quantity;
  const servicePrice = (selection: ServiceSelection) => selection.price ?? services.find((service) => String(service.id) === selection.serviceId)?.price ?? 0;
  const serviceName = (selection: ServiceSelection) => selection.name ?? services.find((service) => String(service.id) === selection.serviceId)?.name ?? "Dịch vụ";
  const roomServiceTotal = (room: ServiceRoom, selections: ServiceSelection[]) => selections.reduce((sum, selection) => sum + servicePrice(selection) * getSelectionQuantity(room, selection), 0);
  const roomRangeTotal = (room: ServiceRoom) => {
    const range = roomRanges[room.id] ?? fallbackRange;
    if (!range.checkIn || !range.checkOut || range.checkIn >= range.checkOut) return 0;
    let total = 0;
    for (let date = range.checkIn; date < range.checkOut; date = shiftDay(date, 1)) total += (room.dailyPrices?.[date] ?? room.price - (room.nightlySurcharge ?? 0)) + (room.nightlySurcharge ?? 0);
    return total;
  };
  const nightsForRoom = (roomId: string) => {
    const room = rooms.find((item) => item.id === roomId);
    if (!room || room.price === 0) return getNightsForRoom(roomId);
    return roomRangeTotal(room) / room.price;
  };
  const serviceUnit = (selection: ServiceSelection) => services.find((service) => String(service.id) === selection.serviceId)?.unit ?? "dịch vụ";
  const formatServices = (room: ServiceRoom, selections: ServiceSelection[]) => selections.map((selection) => `Tên: ${serviceName(selection)} · ${money(servicePrice(selection))}/${serviceUnit(selection)} × ${getSelectionQuantity(room, selection)}`).join(", ");
  const getRoomSelections = (room: ServiceRoom) => {
    const selections = roomServices[room.id] ?? (room.databaseId === undefined ? undefined : roomServices[String(room.databaseId)]) ?? [];
    return selections.map((selection) => {
      if (selection.quantity !== 0 || !selection.isExisting) return selection;
      const { quantity: _zeroQuantity, ...selectionWithoutQuantity } = selection;
      return selectionWithoutQuantity as ServiceSelection;
    });
  };

  const updateAllRoomService = (serviceId: string, checked: boolean) => {
    setAllRoomServices((current) => {
      if (!checked) return current.filter((item) => item.serviceId !== serviceId);
      return current.some((item) => item.serviceId === serviceId) ? current : [...current, { serviceId, quantity: 1 }];
    });
    setRoomServices((current) => Object.fromEntries(rooms.map((room) => {
      const selections = current[room.id] ?? [];
      if (!checked) {
        const existing = selections.find((item) => item.serviceId === serviceId);
        return [room.id, existing?.isExisting
          ? [...selections.filter((item) => item.serviceId !== serviceId), { ...existing, quantity: 0 }]
          : selections.filter((item) => item.serviceId !== serviceId)];
      }
      const existing = selections.find((item) => item.serviceId === serviceId);
      return [room.id, [
        ...selections.filter((item) => item.serviceId !== serviceId),
        existing
          ? { ...existing, quantity: existing.originalQuantity && existing.originalQuantity > 0 ? existing.originalQuantity : room.guests, applyToRoom: true }
          : { serviceId, quantity: room.guests, applyToRoom: true },
      ]];
    })));
  };

  const updateRoomService = (roomId: string, serviceId: string, changes: Partial<ServiceSelection>) => {
    setRoomServices((current) => {
      const selections = current[roomId] ?? [];
      const existing = selections.find((item) => item.serviceId === serviceId);
      const roomGuests = rooms.find((room) => room.id === roomId)?.guests ?? 1;
        const safeChanges = changes.quantity === undefined ? changes : { ...changes, quantity: Math.min(roomGuests, Math.max(0, changes.quantity)) };
      const updatedList = existing
          ? selections.map((item) => item.serviceId === serviceId ? { ...item, ...safeChanges } : item)
        : [...selections, { serviceId, quantity: roomGuests, applyToRoom: true, ...safeChanges }];
      return {
        ...current,
        [roomId]: updatedList.filter((item) => item.quantity > 0 || item.isExisting),
      };
    });
  };

  const scrollToServiceSection = (section: "services" | "rooms" | "summary", childIndex: number) => {
    setActiveSection(section);
    const targetElement = document.querySelector<HTMLElement>(".booking-service-selector")?.children[childIndex] as HTMLElement | undefined;
    if (!targetElement) return;
    const headerOffset = 96;
    const modalScroller = targetElement.closest<HTMLElement>(".booking-service-modal-scroll");
    if (modalScroller) {
      const targetTop = targetElement.offsetTop - headerOffset;
      modalScroller.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
      return;
    }
    const targetTop = targetElement.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
  };

  return <div className="booking-service-selector p-5">
    <div className="relative z-50 grid gap-3 rounded-xl bg-violet-50/70 p-4 sm:grid-cols-[1fr_1fr_auto]">
      <button type="button" onClick={() => setServiceMode("all")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${serviceMode === "all" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-white"}`}>Chọn cho tất cả phòng</button>
      <button type="button" onClick={() => setServiceMode("per-room")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${serviceMode === "per-room" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-white"}`}>Chọn riêng từng phòng</button>
    </div>
    <nav className="mt-3 grid grid-cols-1 gap-1 rounded-lg border border-slate-200 bg-white p-1" aria-label="Điều hướng trang dịch vụ"><div className="grid grid-cols-1 gap-1 sm:grid-cols-3"><button type="button" aria-current={activeSection === "services" ? "page" : undefined} onClick={() => scrollToServiceSection("services", 3)} className={`flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${activeSection === "services" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}><ListChecks size={14} />Chọn dịch vụ</button><button type="button" aria-current={activeSection === "rooms" ? "page" : undefined} onClick={() => scrollToServiceSection("rooms", 4)} className={`flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${activeSection === "rooms" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}><DoorOpen size={14} />Thông tin phòng</button><button type="button" aria-current={activeSection === "summary" ? "page" : undefined} onClick={() => scrollToServiceSection("summary", 6)} className={`flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${activeSection === "summary" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}><ReceiptText size={14} />Tóm tắt chi phí</button></div><div className="mt-1 grid grid-cols-1 gap-1 border-t border-slate-200 pt-1 sm:grid-cols-2"><button type="button" onClick={onSkip} className="flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"><Ban size={14} />Bỏ qua dịch vụ</button><button type="button" onClick={onContinue} className="flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"><CreditCard size={14} />{continueLabel === "Xác nhận" ? <><Check size={14} />Xác nhận</> : "Thanh toán"}</button></div></nav>
    <label className="relative mt-4 block"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="search" value={serviceSearch} onChange={(event) => setServiceSearch(event.target.value)} placeholder="Tìm dịch vụ..." aria-label="Tìm dịch vụ" className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
    {servicesLoading ? <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">Đang tải danh sách dịch vụ...</div> : servicesError ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-600">Không thể tải danh sách dịch vụ.</div> : services.length === 0 ? <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Chưa có dịch vụ khả dụng.</div> : serviceMode === "all" ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {visibleServices(serviceSearch).map((service, index) => { const selection = allRoomServices.find((item) => item.serviceId === service.id); return <div key={`svc-all-${service.id}-${index}`} className={`rounded-xl border-2 p-4 transition-colors ${selection ? "border-blue-500 bg-blue-50" : "border-blue-200 bg-white hover:border-blue-400"}`}><label className="flex min-w-0 items-start gap-3"><input type="checkbox" checked={Boolean(selection)} onChange={(event) => updateAllRoomService(service.id, event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600" /><span className="min-w-0"><strong className="block truncate text-sm text-slate-800">{service.name}</strong><small className="mt-1 block text-xs text-slate-500">{service.category} · {money(service.price)} / {service.unit}</small><small className="mt-1 block truncate text-[11px] text-slate-400">{service.detail}</small></span></label></div>; })}
    </div> : <div className="mt-4">
      <div className="mb-2 flex items-center justify-between"><p className="text-sm font-bold text-slate-800">Dịch vụ theo từng phòng</p><span className="text-xs font-semibold text-slate-500">{rooms.length} phòng</span></div>
      {rooms.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Chưa có phòng nào được chọn.</div> : <div className="space-y-2">{rooms.map((room, index) => { const selections = getRoomSelections(room).filter((sel) => sel.quantity > 0); const expanded = expandedRoom === room.id; return <div key={`room-${room.id}-${index}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <button type="button" onClick={() => setExpandedRoom(expanded ? null : room.id)} className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-slate-50"><span className="min-w-0"><strong className="block text-sm text-slate-900">Phòng {room.id} · {room.type}</strong><span className="mt-1 block truncate text-xs text-slate-500">{selections.length > 0 ? formatServices(room, selections) : "Chưa chọn dịch vụ"}</span></span><span className="flex shrink-0 items-center gap-3"><strong className="text-xs text-blue-700">{money(roomServiceTotal(room, getRoomSelections(room)))}</strong><ChevronRight size={16} className={`text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`} /></span></button>
        {expanded && <div className="border-t border-slate-100 bg-slate-50 p-3"><p className="mb-2 text-xs font-semibold text-slate-500">{room.guests} người · Chọn dịch vụ và số lượng</p><label className="relative mb-3 block"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="search" value={roomServiceSearch[room.id] ?? ""} onChange={(event) => setRoomServiceSearch((current) => ({ ...current, [room.id]: event.target.value }))} placeholder={`Tìm dịch vụ cho phòng ${room.id}...`} aria-label={`Tìm dịch vụ cho phòng ${room.id}`} className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label><div className="grid gap-2 sm:grid-cols-2">{visibleServices(roomServiceSearch[room.id] ?? "").map((service, sIndex) => { const storedSelection = getRoomSelections(room).find((item) => item.serviceId === service.id); const selection = storedSelection && storedSelection.quantity > 0 ? storedSelection : undefined; const isSelected = Boolean(selection); return <div key={`room-${room.id}-svc-${service.id}-${sIndex}`} className={`flex items-center justify-between gap-3 rounded-lg border-2 px-3 py-2 transition-colors ${isSelected ? "border-blue-500 bg-blue-50" : "border-blue-200 bg-white hover:border-blue-400"}`}><label className="flex min-w-0 items-center gap-2"><input type="checkbox" checked={isSelected} onChange={(event) => setRoomServices((current) => { const currentSelections = current[room.id] ?? []; const existing = currentSelections.find((item) => item.serviceId === service.id); if (event.target.checked) { const initQty = existing?.originalQuantity && existing.originalQuantity > 0 ? existing.originalQuantity : room.guests; return { ...current, [room.id]: [...currentSelections.filter((item) => item.serviceId !== service.id), { serviceId: service.id, quantity: initQty, ...(existing ?? {}) }] }; } return { ...current, [room.id]: existing?.isExisting ? [...currentSelections.filter((item) => item.serviceId !== service.id), { ...existing, quantity: 0 }] : currentSelections.filter((item) => item.serviceId !== service.id) }; })} className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600" /><span className="truncate text-xs font-semibold text-slate-700">{service.name} · {money(service.price)}/người</span></label>{isSelected && <input type="number" min="0" value={selection.quantity} onChange={(event) => { const newQty = Math.max(0, Number(event.target.value) || 0); setRoomServices((current) => { const currentSelections = current[room.id] ?? []; const existing = currentSelections.find((item) => item.serviceId === service.id); if (newQty === 0 && existing?.isExisting) return { ...current, [room.id]: currentSelections.map((item) => item.serviceId === service.id ? { ...item, quantity: 0 } : item) }; if (newQty === 0) return { ...current, [room.id]: currentSelections.filter((item) => item.serviceId !== service.id) }; return { ...current, [room.id]: currentSelections.map((item) => item.serviceId === service.id ? { ...item, quantity: newQty } : item) }; }); }} className="h-8 w-16 rounded-md border border-slate-200 bg-white px-2 text-center text-xs" />}</div>; })}</div></div>}
      </div>; })}</div>}
    </div>}
    <div className="mt-5 rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Thông tin phòng</p><div className="mt-3 space-y-2">{rooms.map((room, index) => { const selections = roomServices[room.id] ?? []; const range = roomRanges[room.id] ?? fallbackRange; const displaySelections = serviceMode === "all" ? allRoomServices.map((item) => selections.find((selection) => selection.serviceId === item.serviceId) ?? { ...item, quantity: room.guests, applyToRoom: true }) : selections; return <div key={`info-room-${room.id}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3 text-xs"><div className="flex items-start justify-between gap-3"><span className="min-w-0"><strong className="block text-slate-800">Phòng {room.id} · {room.type}</strong><span className="mt-1 block text-slate-500">Số người: {room.guests}</span><span className="mt-1 block text-slate-500">Check-in: {formatDate(range.checkIn, language)}</span><span className="block text-slate-500">Check-out: {formatDate(range.checkOut, language)}</span></span><span className="shrink-0 text-right font-bold text-slate-800">{money(room.price * nightsForRoom(room.id) + roomServiceTotal(room, displaySelections))}</span></div>{serviceMode === "all" && allRoomServices.length > 0 && <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">{allRoomServices.map((serviceSelection, sIndex) => { const service = services.find((item) => String(item.id) === serviceSelection.serviceId); const selection = selections.find((item) => item.serviceId === serviceSelection.serviceId) ?? { serviceId: serviceSelection.serviceId, quantity: room.guests, applyToRoom: true }; return <div key={`info-svc-${serviceSelection.serviceId}-${sIndex}`} className="flex items-center justify-between gap-3"><span className="min-w-0 truncate font-semibold text-blue-700">{service?.name} · {money(service?.price ?? 0)} / người</span><div className="flex shrink-0 items-center gap-2"><label className="flex items-center gap-1 text-[11px] text-slate-500"><input type="checkbox" checked={selection.applyToRoom !== false} onChange={(event) => updateRoomService(room.id, serviceSelection.serviceId, { applyToRoom: event.target.checked, quantity: event.target.checked ? room.guests : selection.quantity })} />Áp dụng cả phòng</label><label className="flex items-center gap-1 text-[11px] text-slate-500">Số người<input aria-label={`Số người dùng ${service?.name ?? "dịch vụ"} tại phòng ${room.id}`} type="number" min="1" value={selection.quantity} onChange={(event) => updateRoomService(room.id, serviceSelection.serviceId, { quantity: Math.max(1, Number(event.target.value) || 1), applyToRoom: false })} className="h-8 w-16 rounded-md border border-slate-200 bg-white px-2 text-center text-xs" /></label></div></div>; })}</div>}{serviceMode !== "all" && <span className="mt-1 block text-blue-700">{selections.length > 0 ? formatServices(room, selections) : "Chưa chọn dịch vụ"}</span>}</div>; })}</div></div>
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Chi tiết từng phòng</div><div className="divide-y divide-slate-100">{rooms.map((room, index) => { const selections = serviceMode === "all" ? roomServices[room.id] ?? allRoomServices.map((item) => ({ ...item, quantity: room.guests })) : roomServices[room.id] ?? []; const roomAmount = roomRangeTotal(room); return <div key={`detail-room-${room.id}-${index}`} className="px-4 py-3 text-xs"><div className="flex items-center justify-between gap-3"><strong className="text-slate-800">Phòng {room.id} · {room.type}</strong><strong className="text-slate-800">Tiền phòng: {money(roomAmount)}</strong></div><div className="mt-2 space-y-1 border-t border-slate-100 pt-2">{selections.length > 0 ? selections.map((selection, sIndex) => { const service = services.find((item) => String(item.id) === selection.serviceId); const unitPrice = servicePrice(selection); const amount = unitPrice * selection.quantity; return <div key={`detail-svc-${selection.serviceId}-${sIndex}`} className="flex items-center justify-between gap-3 text-slate-500"><span>{service?.name ?? "Dịch vụ"} · {money(unitPrice)}/dịch vụ × {selection.quantity}</span><strong className="shrink-0 text-blue-700">{money(amount)}</strong></div>; }) : <span className="text-slate-400">Chưa chọn dịch vụ</span>}</div></div>; })}</div></div>
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Tóm tắt chi phí</div><div className="divide-y divide-slate-100">{rooms.map((room, index) => { const selections = serviceMode === "all" ? roomServices[room.id] ?? allRoomServices.map((item) => ({ ...item, quantity: room.guests })) : roomServices[room.id] ?? []; const roomAmount = roomRangeTotal(room); const serviceAmount = roomServiceTotal(room, selections); return <div key={`summary-room-${room.id}-${index}`} className="grid gap-2 px-4 py-3 text-xs sm:grid-cols-[1.5fr_1fr_1fr_1fr] sm:items-center"><strong className="text-slate-800">Phòng {room.id}</strong><span className="text-slate-500">Tiền phòng: <strong className="text-slate-700">{money(roomAmount)}</strong></span><span className="text-slate-500">Tiền dịch vụ: <strong className="text-blue-700">{money(serviceAmount)}</strong></span><span className="text-left font-bold text-slate-800 sm:text-right">Tổng: {money(roomAmount + serviceAmount)}</span></div>; })}</div></div>
    <div className="mt-5 flex flex-col-reverse justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center"><button type="button" onClick={onSkip} className="text-sm font-semibold text-slate-500 hover:text-slate-800">{skipLabel}</button><button type="button" onClick={onContinue} className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">{continueLabel} <ChevronRight size={16} className="ml-1 inline" /></button></div>
  </div>;
}
