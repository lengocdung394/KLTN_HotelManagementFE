import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, UserRound } from "lucide-react";
import { loadCustomers, upsertCustomer, type Customer } from "../lib/customerStore";

type GuestRoom = {
  id: string;
  type: string;
  beds: string;
  guests: number;
  standardAdults?: number;
  maxAdults?: number;
  maxChildren?: number;
  maxInfants?: number;
};
export type BookingGuest = { name: string; phone: string; identityNumber: string };

const countOptions = (max: number, value: number) => Array.from({ length: Math.max(max, value) + 1 }, (_, index) => index);

export default function GuestRoomForms({ rooms, guest, onGuestChange }: { rooms: GuestRoom[]; guest: BookingGuest; onGuestChange: (guest: BookingGuest) => void }) {
  const { t } = useTranslation();
  const [customerQuery, setCustomerQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>(loadCustomers);
  const [roomGuests, setRoomGuests] = useState<Record<string, { adults: number; children: number; infants: number }>>({});

  useEffect(() => {
    if (guest.name.trim() && guest.phone.trim()) {
      const next = upsertCustomer(guest.name, guest.phone, guest.identityNumber);
      if (next) setCustomers(next);
    }
  }, [guest]);

  const search = customerQuery.trim().toLowerCase();
  const matches = search ? customers.filter((customer) => `${customer.name} ${customer.phone} ${customer.email} ${customer.identityNumber}`.toLowerCase().includes(search)).slice(0, 5) : [];
  const updateGuest = (field: keyof BookingGuest, value: string) => onGuestChange({ ...guest, [field]: value });
  const chooseCustomer = (customer: Customer) => { onGuestChange({ name: customer.name, phone: customer.phone, identityNumber: customer.identityNumber }); setCustomerQuery(""); };
  const getRoomLimits = (room: GuestRoom) => ({
    adults: Math.max(0, room.maxAdults ?? room.guests ?? 0),
    children: Math.max(0, room.maxChildren ?? 0),
    infants: Math.max(0, room.maxInfants ?? 0),
  });
  const getRoomGuests = (room: GuestRoom) => {
    const limits = getRoomLimits(room);
    const standardAdults = Math.max(0, Number(room.standardAdults ?? room.guests ?? 0));
    return roomGuests[room.id] ?? { adults: Math.min(standardAdults, limits.adults), children: limits.children, infants: limits.infants };
  };
  const updateRoomGuest = (room: GuestRoom, field: "adults" | "children" | "infants", value: number) => {
    setRoomGuests((current) => ({ ...current, [room.id]: { ...getRoomGuests(room), [field]: value } }));
  };

  return <div className="space-y-4">
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-violet-100 text-violet-700"><UserRound size={16} /></div><div><p className="text-sm font-bold text-slate-900">{t("booking.stayingGuest", "Guest staying")}</p><p className="mt-0.5 text-xs text-slate-500">{rooms.length} {t("booking.rooms")}</p></div></div>
      <div className="relative mb-4"><label className="text-sm font-semibold text-slate-700">{t("booking.searchCustomer", "Tìm khách hàng đã lưu")}</label><div className="relative mt-1.5"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder={t("booking.searchCustomerPlaceholder", "Tìm theo tên hoặc số điện thoại")} className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /></div>{matches.length > 0 && <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">{matches.map((customer) => <button type="button" key={customer.id} onClick={() => chooseCustomer(customer)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-violet-50"><span className="font-semibold text-slate-700">{customer.name}</span><span className="text-xs text-slate-400">{customer.phone}</span></button>)}</div>}</div>
      <div className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-semibold text-slate-700">{t("customer.fullName")}<input value={guest.name} onChange={(event) => updateGuest("name", event.target.value)} placeholder={t("common.guestNamePlaceholder", "Nguyễn Văn A")} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400" /></label><label className="text-sm font-semibold text-slate-700">{t("customer.phone")}<input value={guest.phone} onChange={(event) => updateGuest("phone", event.target.value)} placeholder="0901234567" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400" /></label><label className="text-sm font-semibold text-slate-700">{t("customer.identityNumber", "Số CCCD")}<input value={guest.identityNumber} onChange={(event) => updateGuest("identityNumber", event.target.value)} placeholder="012345678901" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400" /></label></div>
    </div>
    {rooms.map((room, index) => {
      const limits = getRoomLimits(room);
      const selected = getRoomGuests(room);
      return <div key={room.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-100 text-blue-700"><UserRound size={17} /></div><div className="min-w-0"><p className="text-sm font-bold text-slate-900">Khách lưu trú phòng {room.id}</p><p className="mt-0.5 truncate text-xs text-slate-500">{room.type} · {room.beds} · Tối đa {limits.adults} người lớn, {limits.children} trẻ em, {limits.infants} em bé</p></div><span className="ml-auto shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">Khách {index + 1}</span></div><div className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-semibold text-slate-700">Người lớn<select value={selected.adults} onChange={(event) => updateRoomGuest(room, "adults", Number(event.target.value))} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-violet-400">{countOptions(limits.adults, selected.adults).map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Trẻ em<select value={selected.children} onChange={(event) => updateRoomGuest(room, "children", Number(event.target.value))} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-violet-400">{countOptions(limits.children, selected.children).map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Em bé<select value={selected.infants} onChange={(event) => updateRoomGuest(room, "infants", Number(event.target.value))} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-violet-400">{countOptions(limits.infants, selected.infants).map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div><label className="mt-4 block text-sm font-semibold text-slate-700">Ghi chú riêng cho phòng {room.id}<textarea placeholder="Special guest requests..." className="mt-1.5 min-h-20 w-full resize-none rounded-lg border border-slate-200 px-3 py-3 text-sm font-normal outline-none focus:border-violet-400" /></label></div>;
    })}
  </div>;
}
