import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, UserRound } from "lucide-react";
import { emitCustomerCreated } from "../lib/socket";
import { useCreateWalkInCustomerMutation, useGetCustomersByHotelIdQuery, useLazyGetCustomerByIdQuery, type CustomerResponse } from "../services/customerApi";
import { useAppSelector } from "../store/hooks";
import { toast } from "@/components/ui/use-toast";

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
export type BookingGuest = { name: string; phone: string; identityNumber: string; email: string; emailOnFile?: boolean; customerId?: string };
export type RoomGuestCounts = { adults: number; children: number; infants: number };
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
const normalizeSearchText = (value: string) => value
  .trim()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase()
  .replace(/đ/g, "d")
  .replace(/\s+/g, " ");
export const isBookingGuestValid = (guest: BookingGuest) => Boolean(
  guest.name.trim()
  && /^\d{10}$/.test(guest.phone)
  && /^\d{12}$/.test(guest.identityNumber)
  && (!guest.email.trim() || guest.emailOnFile || isValidEmail(guest.email)),
);
type Customer = CustomerResponse;

const countOptions = (max: number, value: number) => Array.from({ length: Math.max(max, value) + 1 }, (_, index) => index);
const getCustomerErrorMessage = (error: any) => {
  const data = error?.data;
  if (typeof data === "string") return data;
  if (data?.result?.message) return String(data.result.message);
  if (data?.message) return String(data.message);
  if (data?.result?.error) return String(data.result.error);
  if (Array.isArray(data?.errors)) return data.errors.map((item: any) => item?.message || item).join(", ");
  return error?.message || "Không thể tạo khách hàng. Vui lòng kiểm tra lại thông tin.";
};
const isCustomerIdentityConflict = (error: unknown) => {
  if (!error || typeof error !== "object" || !("data" in error)) return false;
  const data = error.data;
  if (!data || typeof data !== "object" || !("code" in data)) return false;
  return Number(data.code) === 2015;
};
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

export default function GuestRoomForms({ rooms, guest, onGuestChange, onRoomGuestsChange, roomGuestValues, onRoomGuestChange, customerLocked = false }: { rooms: GuestRoom[]; guest: BookingGuest; onGuestChange: (guest: BookingGuest) => void; onRoomGuestsChange?: (roomId: string, surcharge: number) => void; roomGuestValues?: Record<string, RoomGuestCounts>; onRoomGuestChange?: (roomId: string, counts: RoomGuestCounts) => void; customerLocked?: boolean }) {
  const { t } = useTranslation();
  const hotelId = useAppSelector((state) => state.auth.hotelId);
  const {
    data: customers = [],
    isLoading: isCustomersLoading,
    isError: isCustomersError,
  } = useGetCustomersByHotelIdQuery(Number(hotelId), { skip: !hotelId || Number.isNaN(Number(hotelId)) });
  const [getCustomerById, { isFetching: isFindingCustomer }] = useLazyGetCustomerByIdQuery();
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerListOpen, setCustomerListOpen] = useState(false);
  const customerListCloseTimeout = useRef<number | null>(null);
  const [localRoomGuests, setLocalRoomGuests] = useState<Record<string, RoomGuestCounts>>({});
  const [createWalkInCustomer, { isLoading: isCreatingCustomer }] = useCreateWalkInCustomerMutation();
  const guestFieldsLocked = customerLocked || Boolean(guest.customerId);
  const cancelCustomerListClose = () => {
    if (customerListCloseTimeout.current !== null) {
      window.clearTimeout(customerListCloseTimeout.current);
      customerListCloseTimeout.current = null;
    }
  };

  useEffect(() => {
    const clearCache = () => clearRoomGuestCache();
    window.addEventListener("booking-workspace-left", clearCache);
    return () => {
      window.removeEventListener("booking-workspace-left", clearCache);
      if (customerListCloseTimeout.current !== null) {
        window.clearTimeout(customerListCloseTimeout.current);
      }
    };
  }, []);

  const search = normalizeSearchText(customerQuery);
  const phoneSearch = customerQuery.replace(/\D/g, "");
  const matches = search
    ? customers.filter((customer) => (
      normalizeSearchText(customer.name).includes(search)
      || (phoneSearch.length > 0
        && /^[+\d\s()-]+$/.test(customerQuery)
        && customer.phone.replace(/\D/g, "").includes(phoneSearch))
    ))
    : customers;
  const updateGuest = (field: keyof BookingGuest, value: string) => {
    if (guestFieldsLocked) return;
    const normalizedValue = field === "phone"
      ? value.replace(/\D/g, "").slice(0, 10)
      : field === "identityNumber"
        ? value.replace(/\D/g, "").slice(0, 12)
        : value;
    onGuestChange({
      ...guest,
      [field]: normalizedValue,
      customerId: field === "email" ? guest.customerId : undefined,
      emailOnFile: field === "email" ? guest.emailOnFile : false,
    });
  };
  const chooseCustomer = (customer: Customer) => {
    if (customerLocked) return;
    const email = customer.email.trim();
    onGuestChange({ name: customer.name, phone: customer.phone, identityNumber: customer.identityNumber, email, emailOnFile: Boolean(email), customerId: customer.id });
    setCustomerQuery("");
    setCustomerListOpen(false);
  };
  const findCustomerByCode = async () => {
    if (customerLocked) return;
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
    if (customerLocked || !isBookingGuestValid(guest) || guest.customerId || isCreatingCustomer) return;
    try {
      const email = guest.email.trim();
      const customer = await createWalkInCustomer({
        fullName: guest.name.trim(),
        phone: guest.phone.trim(),
        cccd: guest.identityNumber.trim(),
        ...(email ? { email } : {}),
      }).unwrap();
      chooseCustomer({ ...customer, email: customer.email || email });
      if (customer.alreadyExists) {
        toast({
          title: t("booking.existingCustomerSelectedTitle"),
          description: t("booking.existingCustomerSelectedDescription", { name: customer.name }),
        });
      } else {
        emitCustomerCreated(hotelId, {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          identityNumber: customer.identityNumber,
          tier: customer.tier,
        });
      }
    } catch (error) {
      const message = getCustomerErrorMessage(error);
      console.error("[booking] create walk-in customer failed", error);
      toast({
        variant: "destructive",
        title: t("booking.customerCreateFailedTitle"),
        description: isCustomerIdentityConflict(error)
          ? t("booking.customerIdentityConflict")
          : message,
      });
      if (isCustomerIdentityConflict(error)) {
        onGuestChange({ name: "", phone: "", identityNumber: "", email: "", emailOnFile: false, customerId: undefined });
        setCustomerQuery("");
        setCustomerListOpen(false);
      }
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
      <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-violet-100 text-violet-700"><UserRound size={16} /></div>
        <div>
          <p className="text-sm font-bold text-slate-900">{t("booking.stayingGuest")}</p>
          <p className="mt-0.5 text-xs text-slate-500">{rooms.length} {t("booking.rooms")}</p>
        </div>
      </div>
      <div
        className="relative z-20 mb-4"
        onMouseEnter={cancelCustomerListClose}
        onMouseLeave={() => {
          cancelCustomerListClose();
          customerListCloseTimeout.current = window.setTimeout(() => {
            setCustomerListOpen(false);
            customerListCloseTimeout.current = null;
          }, 180);
        }}
      >
        <label className="text-sm font-semibold text-slate-700">{t("booking.searchCustomer")}</label>
        {customerLocked && <p className="mt-1 text-xs text-slate-500">{t("booking.customerCreated")}</p>}
        <div className="relative mt-1.5">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={customerQuery}
            disabled={customerLocked}
            onFocus={() => setCustomerListOpen(true)}
            onChange={(event) => {
              setCustomerQuery(event.target.value);
              setCustomerListOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void findCustomerByCode();
              }
            }}
            placeholder={t("booking.searchCustomerPlaceholder")}
            className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
          {isFindingCustomer && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{t("booking.guestSearchLoading")}</span>
          )}
        </div>
        {customerListOpen && !customerLocked && (
          <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            {isCustomersLoading ? (
              <p className="px-3 py-3 text-sm text-slate-500">{t("booking.customerListLoading")}</p>
            ) : isCustomersError ? (
              <p className="px-3 py-3 text-sm text-rose-600">{t("booking.customerListError")}</p>
            ) : matches.length === 0 ? (
              <p className="px-3 py-3 text-sm text-slate-500">{t(search ? "booking.customerListNoMatches" : "booking.customerListEmpty")}</p>
            ) : (
              <>
                {matches.map((customer) => (
                  <button
                    type="button"
                    key={customer.id}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      cancelCustomerListClose();
                      chooseCustomer(customer);
                    }}
                    onClick={() => chooseCustomer(customer)}
                    className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-violet-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-slate-700">{customer.name}</span>
                      <span className="mt-0.5 block text-xs text-slate-400">{customer.phone}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${customer.registered ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
                      {t(customer.registered ? "booking.registeredCustomer" : "booking.walkInCustomer")}
                    </span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-semibold text-slate-700">
          {t("customer.fullName")}<span className="ml-1 text-red-500">*</span>
          <input value={guest.name} disabled={guestFieldsLocked} onChange={(event) => updateGuest("name", event.target.value)} placeholder={t("common.guestNamePlaceholder")} className={`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 ${requiredGuestField(guest.name)}`} />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          {t("customer.phone")}<span className="ml-1 text-red-500">*</span>
          <input value={guest.phone} disabled={guestFieldsLocked} onChange={(event) => updateGuest("phone", event.target.value)} placeholder="0901234567" className={`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 ${requiredGuestField(guest.phone)}`} />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          {t("customer.identityNumber")}<span className="ml-1 text-red-500">*</span>
          <input value={guest.identityNumber} disabled={guestFieldsLocked} onChange={(event) => updateGuest("identityNumber", event.target.value)} placeholder="012345678901" className={`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 ${requiredGuestField(guest.identityNumber)}`} />
        </label>
      </div>
      {!guest.emailOnFile && (
        <label className="mt-4 block text-sm font-semibold text-slate-700">
          {t("booking.emailConfirmation")}
          <input type="email" autoComplete="email" value={guest.email} disabled={guestFieldsLocked} onChange={(event) => updateGuest("email", event.target.value)} placeholder="name@example.com" className={`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 ${guest.email.trim() && !isValidEmail(guest.email) ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-slate-200 focus:border-violet-400 focus:ring-violet-100"}`} />
          <span className="mt-1 block text-xs font-normal text-slate-500">{t("booking.emailConfirmationHelp")}</span>
        </label>
      )}
      <div className="mt-4 flex justify-end">
        <button type="button" disabled={customerLocked || !isBookingGuestValid(guest) || Boolean(guest.customerId) || isCreatingCustomer} onClick={createCustomer} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
          {customerLocked || guest.customerId ? t("booking.customerCreated") : isCreatingCustomer ? t("booking.creatingCustomer") : t("booking.createCustomer")}
        </button>
      </div>
    </div>
    {rooms.map((room, index) => {
      const selected = getRoomGuests(room);
      const roomLimits = getRoomLimits(room);
      const limits = {
        ...roomLimits,
        adults: Math.max(0, totalCapacityFor(room) - selected.children),
        children: Math.max(0, totalCapacityFor(room) - selected.adults),
      };
      return (
        <div key={room.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-100 text-blue-700"><UserRound size={17} /></div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">{t("booking.guestStayingInRoom", { room: room.id })}</p>
              <p className="mt-0.5 truncate text-xs text-slate-500">{room.type} · {room.beds}</p>
            </div>
            <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">{t("booking.guestNumber", { count: index + 1 })}</span>
          </div>
          <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-3 text-xs">
            <p className="font-bold text-blue-700">{t("booking.roomGuestPolicy")}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <p className="text-slate-600">{t("booking.standardCapacity")} <strong className="text-slate-800">{room.guests} {t("booking.people")}</strong></p>
              <p className="text-slate-600">{t("booking.maxAdditionalGuests")} <strong className="text-slate-800">{room.maxExtraGuests ?? 0} {t("booking.people")}</strong></p>
              <p className="text-slate-600">{t("booking.adultAgeRange")}: <strong className="text-amber-800">{(room.extraAdultFee ?? 0).toLocaleString("vi-VN")}{t("booking.currencyPerPerson")}</strong></p>
              <p className="text-slate-600">{t("booking.childAgeRange")}: <strong className="text-amber-800">{(room.extraChildFee ?? 0).toLocaleString("vi-VN")}{t("booking.currencyPerPerson")}</strong></p>
            </div>
            <p className="mt-2 border-t border-blue-100 pt-2 text-slate-500">{t("booking.infantAgeRange")}: <strong className="text-emerald-700">{t("booking.infantFree")}</strong></p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm font-semibold text-slate-700">{t("booking.adultAgeRange")}
              <select value={selected.adults} onChange={(event) => updateRoomGuest(room, "adults", Number(event.target.value))} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-violet-400">
                {countOptions(limits.adults, selected.adults).map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">{t("booking.childAgeRange")}
              <select value={selected.children} onChange={(event) => updateRoomGuest(room, "children", Number(event.target.value))} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-violet-400">
                {countOptions(limits.children, selected.children).map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">{t("booking.infantAgeRange")}
              <select value={selected.infants} onChange={(event) => updateRoomGuest(room, "infants", Number(event.target.value))} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-violet-400">
                {countOptions(limits.infants, selected.infants).map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            {t("booking.privateRoomNote", { room: room.id })}
            <textarea placeholder={t("booking.specialGuestRequests")} className="mt-1.5 min-h-20 w-full resize-none rounded-lg border border-slate-200 px-3 py-3 text-sm font-normal outline-none focus:border-violet-400" />
          </label>
        </div>
      );
    })}
  </div>;
}
