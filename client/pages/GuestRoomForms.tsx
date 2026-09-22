import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, UserRound } from "lucide-react";
import { useCreateWalkInCustomerMutation, useGetCustomersByHotelIdQuery, useLazyGetCustomerByIdQuery, type CustomerResponse } from "../services/customerApi";
import { useAppSelector } from "../store/hooks";

type GuestRoom = {
  id: string;
  type: string;
  beds: string;
  guests: number;
  standardAdults?: number;
  maxAdults?: number;
  maxChildren?: number;
  maxInfants?: number;
  maxExtraGuests?: number;
  extraAdultFee?: number;
  extraChildFee?: number;
};
export type BookingGuest = { name: string; phone: string; identityNumber: string; customerId?: string };
export type RoomGuestCounts = { adults: number; children: number; infants: number };
type Customer = CustomerResponse;

const countOptions = (max: number, value: number) => Array.from({ length: Math.max(max, value) + 1 }, (_, index) => index);
const roomGuestCache: Record<string, RoomGuestCounts> = {};
export const bookingCache = { roomTotal: 0 };
export const setBookingRoomTotalCache = (roomTotal: number) => {
  bookingCache.roomTotal = Number.isFinite(roomTotal) ? roomTotal : 0;
  if (import.meta.env.DEV) {
    console.log("[booking] room total cache updated:\n" + JSON.stringify(bookingCache, null, 2));
  }
};
export const clearRoomGuestCache = () => {
  Object.keys(roomGuestCache).forEach((roomId) => { delete roomGuestCache[roomId]; });
  bookingCache.roomTotal = 0;
  if (import.meta.env.DEV) {
    console.log("[booking] booking cache cleared:\n" + JSON.stringify(bookingCache, null, 2));
  }
};

export const setRoomGuestCache = (values: Record<string, RoomGuestCounts>) => {
  Object.entries(values).forEach(([roomId, counts]) => {
    roomGuestCache[roomId] = counts;
  });
};

export default function GuestRoomForms({ rooms, guest, onGuestChange, onRoomGuestsChange, roomGuestValues, onRoomGuestChange }: { rooms: GuestRoom[]; guest: BookingGuest; onGuestChange: (guest: BookingGuest) => void; onRoomGuestsChange?: (roomId: string, surcharge: number) => void; roomGuestValues?: Record<string, RoomGuestCounts>; onRoomGuestChange?: (roomId: string, counts: RoomGuestCounts) => void }) {
  const { t } = useTranslation();
  const hotelId = useAppSelector((state) => state.auth.hotelId);
  const { data: customers = [] } = useGetCustomersByHotelIdQuery(Number(hotelId), { skip: !hotelId || Number.isNaN(Number(hotelId)) });
  const [getCustomerById, { isFetching: isFindingCustomer }] = useLazyGetCustomerByIdQuery();
  const [customerQuery, setCustomerQuery] = useState("");
  const [localRoomGuests, setLocalRoomGuests] = useState<Record<string, RoomGuestCounts>>({});
  const [createWalkInCustomer, { isLoading: isCreatingCustomer }] = useCreateWalkInCustomerMutation();

  useEffect(() => {
    const clearCache = () => clearRoomGuestCache();
    window.addEventListener("booking-workspace-left", clearCache);
    return () => window.removeEventListener("booking-workspace-left", clearCache);
  }, []);

  const search = customerQuery.trim().toLowerCase();
  const matches = search ? customers.filter((customer) => `${customer.name} ${customer.phone} ${customer.email} ${customer.identityNumber}`.toLowerCase().includes(search)).slice(0, 5) : [];
  const updateGuest = (field: keyof BookingGuest, value: string) => onGuestChange({ ...guest, [field]: value, customerId: undefined });
  const chooseCustomer = (customer: Customer) => { onGuestChange({ name: customer.name, phone: customer.phone, identityNumber: customer.identityNumber, customerId: customer.id }); setCustomerQuery(""); };
  const findCustomerByCode = async () => {
    const code = customerQuery.trim();
    if (!code) return;
    console.log("[booking] customer code:", code);
    try {
      const customer = await getCustomerById(code).unwrap();
      console.log("[booking] customer id:", customer.id, "customer:", customer);
      chooseCustomer(customer);
    } catch (error) {
      console.error("[booking] find customer by code failed:", code, error);
    }
  };
  const createCustomer = async () => {
    if (!guest.name.trim() || !guest.phone.trim() || !guest.identityNumber.trim() || guest.customerId || isCreatingCustomer) return;
    try {
      const customer = await createWalkInCustomer({ fullName: guest.name.trim(), phone: guest.phone.trim(), cccd: guest.identityNumber.trim() }).unwrap();
      onGuestChange({ ...guest, customerId: String(customer.id) });
    } catch (error) {
      console.error("[booking] create walk-in customer failed", error);
    }
  };
  const totalCapacityFor = (room: GuestRoom) => Math.max(0, Number(room.guests ?? 0) + Number(room.maxExtraGuests ?? 0));
  const isEmptyValue = (value: string) => !value.trim();
  const requiredGuestField = (value: string) => isEmptyValue(value) ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-slate-200 focus:border-violet-400 focus:ring-violet-100";
  const getRoomLimits = (room: GuestRoom) => ({
    adults: totalCapacityFor(room),
    children: totalCapacityFor(room),
    infants: Math.max(2, room.maxInfants ?? 0),
  });
  const getRoomGuests = (room: GuestRoom) => {
    const limits = getRoomLimits(room);
    const standardAdults = Math.max(0, Number(room.standardAdults ?? room.guests ?? 0));
    return roomGuestValues?.[room.id] ?? localRoomGuests[room.id] ?? roomGuestCache[room.id] ?? { adults: Math.min(standardAdults, limits.adults), children: 0, infants: 0 };
  };
  const updateRoomGuest = (room: GuestRoom, field: "adults" | "children" | "infants", value: number) => {
    const totalCapacity = totalCapacityFor(room);
    const currentGuests = getRoomGuests(room);
    const nextValue = field === "infants" ? Math.max(0, Math.min(value, getRoomLimits(room).infants)) : Math.max(0, Math.min(value, totalCapacity));
    const nextGuests = { ...currentGuests, [field]: nextValue };
    if (field === "adults") nextGuests.children = Math.min(nextGuests.children, Math.max(0, totalCapacity - nextGuests.adults));
    if (field === "children") nextGuests.adults = Math.min(nextGuests.adults, Math.max(0, totalCapacity - nextGuests.children));
    setLocalRoomGuests((current) => ({ ...current, [room.id]: nextGuests }));
    roomGuestCache[room.id] = nextGuests;
    onRoomGuestChange?.(room.id, nextGuests);
    const standardCapacity = Math.max(0, room.guests ?? 0);
    const extraGuests = Math.max(0, nextGuests.adults + nextGuests.children - standardCapacity);
    const extraAdults = Math.min(extraGuests, Math.max(0, nextGuests.adults - standardCapacity));
    const extraChildren = extraGuests - extraAdults;
    const surcharge = extraAdults * (room.extraAdultFee ?? 0) + extraChildren * (room.extraChildFee ?? 0);
    onRoomGuestsChange?.(room.id, surcharge);
    window.dispatchEvent(new CustomEvent("room-guest-surcharge", { detail: { roomId: room.id, counts: nextGuests, surcharge, adultSurcharge: extraAdults * (room.extraAdultFee ?? 0), childSurcharge: extraChildren * (room.extraChildFee ?? 0) } }));
  };

  return <div className="space-y-4">
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-violet-100 text-violet-700"><UserRound size={16} /></div><div><p className="text-sm font-bold text-slate-900">{t("booking.stayingGuest", "Guest staying")}</p><p className="mt-0.5 text-xs text-slate-500">{rooms.length} {t("booking.rooms")}</p></div></div>
      <div className="relative mb-4"><label className="text-sm font-semibold text-slate-700">{t("booking.searchCustomer", "Tìm khách hàng đã lưu")}</label><div className="relative mt-1.5"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void findCustomerByCode(); } }} placeholder={t("booking.searchCustomerPlaceholder", "Nhập mã khách hàng hoặc tìm theo tên, số điện thoại")} className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />{isFindingCustomer && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">Đang tìm...</span>}</div>{matches.length > 0 && <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">{matches.map((customer) => <button type="button" key={customer.id} onClick={() => chooseCustomer(customer)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-violet-50"><span className="font-semibold text-slate-700">{customer.name}</span><span className="text-xs text-slate-400">{customer.phone}</span></button>)}</div>}</div>
        <div className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-semibold text-slate-700">{t("customer.fullName")}<span className="ml-1 text-red-500">*</span><input value={guest.name} onChange={(event) => updateGuest("name", event.target.value)} placeholder={t("common.guestNamePlaceholder", "Nguyễn Văn A")} className={`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 ${requiredGuestField(guest.name)}`} /></label><label className="text-sm font-semibold text-slate-700">{t("customer.phone")}<span className="ml-1 text-red-500">*</span><input value={guest.phone} onChange={(event) => updateGuest("phone", event.target.value)} placeholder="0901234567" className={`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 ${requiredGuestField(guest.phone)}`} /></label><label className="text-sm font-semibold text-slate-700">{t("customer.identityNumber", "Số CCCD")}<span className="ml-1 text-red-500">*</span><input value={guest.identityNumber} onChange={(event) => updateGuest("identityNumber", event.target.value)} placeholder="012345678901" className={`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 ${requiredGuestField(guest.identityNumber)}`} /></label></div><div className="mt-4 flex justify-end"><button type="button" disabled={!guest.name.trim() || !guest.phone.trim() || !guest.identityNumber.trim() || Boolean(guest.customerId) || isCreatingCustomer} onClick={createCustomer} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">{isCreatingCustomer ? "Đang tạo khách hàng..." : guest.customerId ? "Đã có mã khách hàng" : "Tạo khách hàng"}</button></div>
    </div>
    {rooms.map((room, index) => {
      const selected = getRoomGuests(room);
      const roomLimits = getRoomLimits(room);
      const limits = { ...roomLimits, adults: Math.max(0, totalCapacityFor(room) - selected.children), children: Math.max(0, totalCapacityFor(room) - selected.adults) };
      return <div key={room.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-100 text-blue-700"><UserRound size={17} /></div><div className="min-w-0"><p className="text-sm font-bold text-slate-900">Khách lưu trú phòng {room.id}</p><p className="mt-0.5 truncate text-xs text-slate-500">{room.type} · {room.beds}</p></div><span className="ml-auto shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">Khách {index + 1}</span></div><div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-3 text-xs"><p className="font-bold text-blue-700">Quy định khách và phụ thu</p><div className="mt-2 grid gap-2 sm:grid-cols-2"><p className="text-slate-600">Tiêu chuẩn: <strong className="text-slate-800">{room.guests} người</strong></p><p className="text-slate-600">Ghép thêm tối đa: <strong className="text-slate-800">{room.maxExtraGuests ?? 0} người</strong></p><p className="text-slate-600">Người lớn từ 12 tuổi: <strong className="text-amber-800">{(room.extraAdultFee ?? 0).toLocaleString("vi-VN")}đ/người</strong></p><p className="text-slate-600">Trẻ em 2 - dưới 12 tuổi: <strong className="text-amber-800">{(room.extraChildFee ?? 0).toLocaleString("vi-VN")}đ/người</strong></p></div><p className="mt-2 border-t border-blue-100 pt-2 text-slate-500">Em bé dưới 2 tuổi: <strong className="text-emerald-700">miễn phí</strong></p></div><div className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-semibold text-slate-700">Người lớn (từ 12 tuổi)<select value={selected.adults} onChange={(event) => updateRoomGuest(room, "adults", Number(event.target.value))} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-violet-400">{countOptions(limits.adults, selected.adults).map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Trẻ em (2 - dưới 12 tuổi)<select value={selected.children} onChange={(event) => updateRoomGuest(room, "children", Number(event.target.value))} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-violet-400">{countOptions(limits.children, selected.children).map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Em bé (dưới 2 tuổi)<select value={selected.infants} onChange={(event) => updateRoomGuest(room, "infants", Number(event.target.value))} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-violet-400">{countOptions(limits.infants, selected.infants).map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div><label className="mt-4 block text-sm font-semibold text-slate-700">Ghi chú riêng cho phòng {room.id}<textarea placeholder="Special guest requests..." className="mt-1.5 min-h-20 w-full resize-none rounded-lg border border-slate-200 px-3 py-3 text-sm font-normal outline-none focus:border-violet-400" /></label></div>;
    })}
  </div>;
}
