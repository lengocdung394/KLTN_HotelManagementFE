import { useState } from "react";
import { ChevronRight } from "lucide-react";

export const bookingServices = [
  { id: "breakfast", name: "Bữa sáng", price: 120000 },
  { id: "minibar", name: "Minibar", price: 80000 },
  { id: "laundry", name: "Giặt ủi", price: 50000 },
  { id: "airport", name: "Đưa đón sân bay", price: 350000 },
  { id: "massage", name: "Massage thư giãn", price: 450000 },
] as const;

export type ServiceSelection = { serviceId: string; quantity: number };
export type ServiceRoom = { id: string; type: string; guests: number; price: number };

export type BookingServiceSelectorProps = {
  rooms: ServiceRoom[];
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
const serviceTotal = (selections: ServiceSelection[]) => selections.reduce((sum, selection) => sum + (bookingServices.find((service) => service.id === selection.serviceId)?.price ?? 0) * selection.quantity, 0);

export default function BookingServiceSelector({ rooms, serviceMode, setServiceMode, allRoomServices, setAllRoomServices, roomServices, setRoomServices, roomRanges, fallbackRange, language, nightsForRoom, onContinue, onSkip, continueLabel = "Tiếp tục thanh toán", skipLabel = "Bỏ qua dịch vụ" }: BookingServiceSelectorProps) {
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null);
  const roomServiceTotal = (room: ServiceRoom, selections: ServiceSelection[]) => serviceTotal(selections) * (serviceMode === "all" ? room.guests : 1);
  const formatServices = (room: ServiceRoom, selections: ServiceSelection[]) => selections.map((selection) => `${bookingServices.find((service) => service.id === selection.serviceId)?.name} x${selection.quantity * (serviceMode === "all" ? room.guests : 1)}`).join(", ");

  return <div className="p-5">
    <div className="relative z-50 grid gap-3 rounded-xl bg-violet-50/70 p-4 sm:grid-cols-[1fr_1fr_auto]">
      <button type="button" onClick={() => setServiceMode("all")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${serviceMode === "all" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-white"}`}>Chọn cho tất cả phòng</button>
      <button type="button" onClick={() => setServiceMode("per-room")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${serviceMode === "per-room" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-white"}`}>Chọn riêng từng phòng</button>
    </div>
    {serviceMode === "all" ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {bookingServices.map((service) => { const selected = allRoomServices.some((item) => item.serviceId === service.id); return <label key={service.id} className={`rounded-xl border p-4 ${selected ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white"}`}><span className="flex items-start gap-3"><input type="checkbox" checked={selected} onChange={(event) => setAllRoomServices((current) => event.target.checked ? [...current, { serviceId: service.id, quantity: 1 }] : current.filter((item) => item.serviceId !== service.id))} className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600" /><span><strong className="block text-sm text-slate-800">{service.name}</strong><small className="mt-1 block text-xs text-slate-500">{money(service.price)} / người</small></span></span></label>; })}
    </div> : <div className="mt-4">
      <div className="mb-2 flex items-center justify-between"><p className="text-sm font-bold text-slate-800">Dịch vụ theo từng phòng</p><span className="text-xs font-semibold text-slate-500">{rooms.length} phòng</span></div>
      {rooms.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Chưa có phòng nào được chọn.</div> : <div className="space-y-2">{rooms.map((room) => { const selections = roomServices[room.id] ?? []; const expanded = expandedRoom === room.id; return <div key={room.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <button type="button" onClick={() => setExpandedRoom(expanded ? null : room.id)} className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-slate-50"><span className="min-w-0"><strong className="block text-sm text-slate-900">Phòng {room.id} · {room.type}</strong><span className="mt-1 block truncate text-xs text-slate-500">{selections.length > 0 ? formatServices(room, selections) : "Chưa chọn dịch vụ"}</span></span><span className="flex shrink-0 items-center gap-3"><strong className="text-xs text-blue-700">{money(roomServiceTotal(room, selections))}</strong><ChevronRight size={16} className={`text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`} /></span></button>
        {expanded && <div className="border-t border-slate-100 bg-slate-50 p-3"><p className="mb-2 text-xs font-semibold text-slate-500">{room.guests} người · Chọn dịch vụ và số lượng</p><div className="grid gap-2 sm:grid-cols-2">{bookingServices.map((service) => { const selection = selections.find((item) => item.serviceId === service.id); return <div key={service.id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2"><label className="flex min-w-0 items-center gap-2"><input type="checkbox" checked={Boolean(selection)} onChange={(event) => setRoomServices((current) => ({ ...current, [room.id]: event.target.checked ? [...(current[room.id] ?? []), { serviceId: service.id, quantity: room.guests }] : (current[room.id] ?? []).filter((item) => item.serviceId !== service.id) }))} className="h-4 w-4 rounded border-slate-300 text-blue-600" /><span className="truncate text-xs font-semibold text-slate-700">{service.name} · {money(service.price)}/người</span></label>{selection && <input type="number" min="1" value={selection.quantity} onChange={(event) => setRoomServices((current) => ({ ...current, [room.id]: (current[room.id] ?? []).map((item) => item.serviceId === service.id ? { ...item, quantity: Math.max(1, Number(event.target.value) || 1) } : item) }))} className="h-8 w-16 rounded-md border border-slate-200 bg-white px-2 text-center text-xs" />}</div>; })}</div></div>}
      </div>; })}</div>}
    </div>}
    <div className="mt-5 rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Thông tin phòng</p><div className="mt-3 space-y-2">{rooms.map((room) => { const selections = serviceMode === "all" ? allRoomServices : roomServices[room.id] ?? []; const range = roomRanges[room.id] ?? fallbackRange; return <div key={room.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-xs"><span className="min-w-0"><strong className="block text-slate-800">Phòng {room.id} · {room.type}</strong><span className="mt-1 block text-slate-500">Check-in: {formatDate(range.checkIn, language)}</span><span className="block text-slate-500">Check-out: {formatDate(range.checkOut, language)}</span><span className="mt-1 block text-blue-700">{selections.length > 0 ? formatServices(room, selections) : "Chưa chọn dịch vụ"}</span></span><span className="shrink-0 text-right font-bold text-slate-800">{money(room.price * nightsForRoom(room.id) + roomServiceTotal(room, selections))}</span></div>; })}</div></div>
    <div className="mt-5 flex flex-col-reverse justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center"><button type="button" onClick={onSkip} className="text-sm font-semibold text-slate-500 hover:text-slate-800">{skipLabel}</button><button type="button" onClick={onContinue} className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">{continueLabel} <ChevronRight size={16} className="ml-1 inline" /></button></div>
  </div>;
}
