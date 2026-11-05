import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BedDouble, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CreditCard, Mail, Pencil, Phone, Plus, Search, UserRound, X } from "lucide-react";
import { bindHotelSocketEvents } from "../lib/socket";
import { baseApi } from "../services/baseApi";
import { useGetBookingsByHotelQuery, type BookingListItem } from "../services/bookingApi";
import { useCreateWalkInCustomerMutation, useGetCustomersByHotelIdQuery, useUpdateCustomerMutation, type CustomerResponse } from "../services/customerApi";
import { useGetCustomerPromotionsQuery, useGetPromotionsQuery } from "../services/promotionApi";
import { useGetOrderByBookingIdQuery } from "../services/orderApi";
import { useAppDispatch, useAppSelector } from "../store/hooks";

type Customer = CustomerResponse;
type Tier = Customer["tier"];
type Form = Pick<Customer, "name" | "phone" | "email" | "identityNumber" | "note">;

const blankForm: Form = { name: "", phone: "", email: "", identityNumber: "", note: "" };
const tierStyle: Record<Tier, string> = { loyal: "bg-amber-50 text-amber-700", potential: "bg-blue-50 text-blue-700", new: "bg-emerald-50 text-emerald-700" };

export default function CustomerWorkspace() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const roles = useAppSelector((state) => state.auth.roles);
  const canManageCustomers = roles.includes("ROLE_MANAGER") || roles.includes("ROLE_SUPER_ADMIN");
  const hotelId = useAppSelector((state) => state.auth.hotelId);
  const { data: apiCustomers = [], isLoading, isError } = useGetCustomersByHotelIdQuery(Number(hotelId), { skip: !hotelId || Number.isNaN(Number(hotelId)) });
  const {
    data: hotelBookings = [],
    isLoading: isBookingsLoading,
    isError: isBookingsError,
  } = useGetBookingsByHotelQuery(Number(hotelId), { skip: !hotelId || Number.isNaN(Number(hotelId)) });
  const { data: hotelPromotions = [] } = useGetPromotionsQuery(
    { hotelId: Number(hotelId), page: 0, size: 100 },
    { skip: !hotelId || Number.isNaN(Number(hotelId)) },
  );
  const [createWalkInCustomer] = useCreateWalkInCustomerMutation();
  const [updateCustomer, { isLoading: isUpdating }] = useUpdateCustomerMutation();

  useEffect(() => {
    if (!hotelId || Number.isNaN(Number(hotelId))) return;

    const handleCustomerSocketUpdate = () => {
      dispatch(baseApi.util.invalidateTags(["Customer"]));
    };

    bindHotelSocketEvents({
      onCustomerCreated: handleCustomerSocketUpdate,
      onCustomerBookingUpdated: handleCustomerSocketUpdate,
    });
  }, [dispatch, hotelId]);
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const { data: customerPromotions = [] } = useGetCustomerPromotionsQuery(
    expandedCustomerId ?? "",
    { skip: !expandedCustomerId },
  );
  const [editing, setEditing] = useState<Customer | null>(null);
  const [customerToVerify, setCustomerToVerify] = useState<Customer | null>(null);
  const [identityCheck, setIdentityCheck] = useState("");
  const [identityError, setIdentityError] = useState(false);
  const [form, setForm] = useState<Form>(blankForm);
  const customers = apiCustomers.filter((customer) => customer.visits > 0);
  const customerBookings = useMemo(() => {
    if (!selected) return [];
    return hotelBookings
      .filter((booking) => String(booking.customerId ?? "") === selected.id)
      .sort((first, second) => {
        const firstDate = new Date(String(first.createdAt ?? "")).getTime();
        const secondDate = new Date(String(second.createdAt ?? "")).getTime();
        return (Number.isFinite(secondDate) ? secondDate : 0) - (Number.isFinite(firstDate) ? firstDate : 0);
      });
  }, [hotelBookings, selected]);
  const bookingsForCustomer = (customerId: string) => hotelBookings
    .filter((booking) => String(booking.customerId ?? "") === customerId)
    .sort((first, second) => {
      const firstDate = new Date(String(first.createdAt ?? "")).getTime();
      const secondDate = new Date(String(second.createdAt ?? "")).getTime();
      return (Number.isFinite(secondDate) ? secondDate : 0) - (Number.isFinite(firstDate) ? firstDate : 0);
    });
  const filtered = useMemo(() => customers.filter((customer) => `${customer.name} ${customer.phone} ${customer.email}`.toLowerCase().includes(search.toLowerCase())).filter((customer) => tier === "all" || customer.tier === tier), [customers, search, tier]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedCustomers = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, tier, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const tierLabel = (value: Tier) => t(`customer.tiers.${value}`);
  const formatMoney = (amount: number) => `${new Intl.NumberFormat(
    i18n.language.startsWith("en") ? "en-US" : "vi-VN",
    { maximumFractionDigits: 0 },
  ).format(amount)}${i18n.language.startsWith("en") ? " VND" : "đ"}`;
  const formatBookingDate = (value: string | null) => {
    if (!value) return t("customer.noBooking");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t("customer.noBooking");
    return new Intl.DateTimeFormat(i18n.language.startsWith("en") ? "en-US" : "vi-VN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };
  const formatBookingStatus = (booking: BookingListItem) => {
    const status = String(booking.bookingStatus ?? "").toUpperCase();
    const statusKeys: Record<string, string> = {
      PENDING: "customer.bookingStatuses.pending",
      CONFIRMED: "customer.bookingStatuses.confirmed",
      IN_HOUSE: "customer.bookingStatuses.inHouse",
      CHECKED_IN: "customer.bookingStatuses.checkedIn",
      CHECKED_OUT: "customer.bookingStatuses.checkedOut",
      PAID: "customer.bookingStatuses.paid",
      CANCELLED: "customer.bookingStatuses.cancelled",
      CANCELED: "customer.bookingStatuses.cancelled",
      CANCELLED_BY_CUSTOMER: "customer.bookingStatuses.cancelledByCustomer",
      CANCELLED_BY_STAFF: "customer.bookingStatuses.cancelledByStaff",
      CANCELLED_PAYMENT_TIMEOUT: "customer.bookingStatuses.cancelledPaymentTimeout",
      COMPLETED: "customer.bookingStatuses.completed",
    };
    return statusKeys[status] ? t(statusKeys[status]) : status.replace(/_/g, " ");
  };
  const openCreate = () => { setEditing(null); setForm(blankForm); setModal("create"); };
  const openEdit = (customer: Customer) => { setSelected(null); setCustomerToVerify(customer); setIdentityCheck(""); setIdentityError(false); };
  const verifyIdentity = () => {
    if (!customerToVerify || identityCheck.trim() !== customerToVerify.identityNumber.trim()) { setIdentityError(true); return; }
    setEditing(customerToVerify);
    setForm({ name: customerToVerify.name, phone: customerToVerify.phone, email: customerToVerify.email, identityNumber: customerToVerify.identityNumber, note: customerToVerify.note });
    setCustomerToVerify(null);
    setModal("edit");
  };
  const closeModal = () => { setModal(null); setEditing(null); setCustomerToVerify(null); setIdentityCheck(""); setIdentityError(false); setForm(blankForm); };
  const save = async () => {
    const values = { name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim(), identityNumber: form.identityNumber.trim(), note: form.note.trim() || t("customer.noNote") };
    if (!values.name || !values.phone || !values.email || !values.identityNumber) return;
    if (editing) {
      await updateCustomer({ id: editing.id, request: values }).unwrap();
    } else {
      await createWalkInCustomer({
        fullName: values.name,
        phone: values.phone,
        cccd: values.identityNumber,
        email: values.email,
      }).unwrap();
    }
    closeModal();
  };
  return <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
    <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between"><div><h3 className="font-bold text-slate-900">{t("customer.listTitle")}</h3><p className="mt-1 text-sm text-slate-500">{t("customer.listDescription")}</p></div>{canManageCustomers && <button type="button" onClick={openCreate} className="flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16} />{t("customer.add")}</button>}</div>
    <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("customer.searchPlaceholder")} className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm" /></div><select value={tier} onChange={(event) => setTier(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="all">{t("customer.allTiers")}</option>{(["loyal", "potential", "new"] as Tier[]).map((value) => <option key={value} value={value}>{tierLabel(value)}</option>)}</select></div>
    <div className="grid gap-3 p-4">
      {isLoading ? <p className="p-6 text-sm text-slate-500">{t("common.loading")}</p>
        : isError ? <p className="p-6 text-sm text-rose-600">{t("customer.loadError")}</p>
          : filtered.length === 0 ? <p className="p-6 text-sm text-slate-500">{t("customer.noResults")}</p>
            : paginatedCustomers.map((customer) => {
              const isExpanded = expandedCustomerId === customer.id;
              const bookings = bookingsForCustomer(customer.id);
              return <div key={customer.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-blue-200">
                <div className="flex flex-col gap-4 bg-slate-50/60 p-4 xl:flex-row xl:items-center">
                  <button type="button" onClick={() => setSelected(customer)} className="flex min-w-0 items-center gap-3 text-left xl:w-64 xl:shrink-0">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-600"><UserRound size={20} /></span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">{customer.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${tierStyle[customer.tier]}`}>{tierLabel(customer.tier)}</span>
                      </span>
                      <span className="mt-1 block truncate text-xs text-slate-500"><Phone size={12} className="mr-1 inline" />{customer.phone}</span>
                      <span className="mt-1 block truncate text-xs text-slate-500"><BedDouble size={12} className="mr-1 inline" />{t("customer.roomAmount")}: {formatMoney(customer.totalRoomAmount)}</span>
                    </span>
                  </button>
                  <div className="grid flex-1 grid-cols-2 gap-3 border-t border-slate-200 pt-3 sm:grid-cols-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
                    <div><span className="block text-[11px] text-slate-500">{t("customer.bookingCount")}</span><strong className="text-sm text-slate-800">{customer.visits}</strong></div>
                    <div><span className="block text-[11px] text-slate-500">{t("customer.cancelledBookings")}</span><strong className="text-sm text-slate-800">{customer.cancelledBookings}</strong></div>
                    <div><span className="block text-[11px] text-slate-500">{t("customer.bookingValue")}</span><strong className="text-sm text-slate-800">{formatMoney(customer.totalSpend)}</strong></div>
                    <div><span className="block text-[11px] text-slate-500"><CalendarDays size={12} className="mr-1 inline" />{t("customer.latestBooking")}</span><strong className="text-xs text-slate-800">{formatBookingDate(customer.latestBookingAt)}</strong></div>
                  </div>
                  <div className="flex items-center gap-2 xl:shrink-0">
                    <button
                      type="button"
                      onClick={() => setExpandedCustomerId(isExpanded ? null : customer.id)}
                      aria-expanded={isExpanded}
                      className="flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                    >
                      {isExpanded ? t("customer.hideBookings") : t("customer.viewBookings")}
                      <ChevronDown size={15} className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                    {canManageCustomers && <button type="button" onClick={() => openEdit(customer)} aria-label={t("customer.edit")} title={t("customer.edit")} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"><Pencil size={16} /></button>}
                  </div>
                </div>
                {isExpanded && <div className="border-t border-slate-200 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="font-semibold text-slate-900">{t("customer.bookingHistory")}</h4>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{bookings.length}</span>
                  </div>
                  {isBookingsLoading ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">{t("customer.bookingsLoading")}</p>
                    : isBookingsError ? <p className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700">{t("customer.bookingsLoadError")}</p>
                      : bookings.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">{t("customer.noBookings")}</p>
                        : <div className="space-y-3">{bookings.map((booking) => {
                          const bookingKey = String(booking.bookingId ?? booking.orderId ?? booking.id ?? "");
                          const details = Array.isArray(booking.bookingDetails) ? booking.bookingDetails : [];
                          const roomAmount = Number(booking.roomTotal ?? 0);
                          const serviceAmount = Number(booking.serviceTotal ?? 0);
                          const amount = Number(booking.finalAmount ?? 0);
                          const customerPromotion = customerPromotions.find((promotion) =>
                            promotion.id === booking.customerPromotionId
                            || promotion.customerPromotionId === booking.customerPromotionId,
                          );
                          const promotion = hotelPromotions.find((item) => item.id === booking.promotionId);
                          const appliedPromotionCode = customerPromotion?.code || promotion?.code;
                          const appliedPromotionId = booking.customerPromotionId ?? booking.promotionId;
                          const promotionDiscount = Number(
                            booking.estimatedDiscountAmount
                            ?? booking.applyAmount
                            ?? booking.discountAmountTotal
                            ?? 0,
                          );
                          return <article key={bookingKey} className="rounded-xl border border-slate-200 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{t("customer.bookingCode")}: {bookingKey || "-"}</p>
                                <p className="mt-1 text-xs text-slate-500"><CalendarDays size={12} className="mr-1 inline" />{formatBookingDate(booking.createdAt ?? null)}</p>
                              </div>
                              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${String(booking.bookingStatus ?? "").toUpperCase().includes("CANCEL") ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{formatBookingStatus(booking)}</span>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                              <div className="rounded-lg bg-slate-50 p-3"><span className="block text-xs text-slate-500">{t("customer.roomCharge")}</span><strong className="mt-1 block text-slate-800">{formatMoney(Number.isFinite(roomAmount) ? roomAmount : 0)}</strong></div>
                              <div className="rounded-lg bg-slate-50 p-3"><span className="block text-xs text-slate-500">{t("customer.serviceCharge")}</span><strong className="mt-1 block text-slate-800">{formatMoney(Number.isFinite(serviceAmount) ? serviceAmount : 0)}</strong></div>
                              <div className="col-span-2 rounded-lg bg-blue-50 p-3 sm:col-span-1"><span className="block text-xs text-slate-500">{t("customer.bookingAmount")}</span><strong className="mt-1 block text-slate-900">{formatMoney(Number.isFinite(amount) ? amount : 0)}</strong></div>
                            </div>
                            {appliedPromotionId && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><strong>{t("customer.appliedPromotion")}:</strong> {appliedPromotionCode || appliedPromotionId}<span className="ml-2">· {t("customer.promotionDiscount")}: <strong>{formatMoney(Number.isFinite(promotionDiscount) ? promotionDiscount : 0)}</strong></span></p>}
                            <BookingPaymentHistory bookingId={String(booking.bookingId ?? booking.id ?? "")} />
                            {details.length > 0 && <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">{details.map((detail, index) => {
                              const roomNumber = String(detail.roomNumber ?? detail.roomName ?? detail.roomTypeName ?? "-");
                              const actualCheckInTime = detail.actualCheckInTime ?? detail.actualCheckIn ?? detail.realCheckInTime ?? detail.checkInActualTime;
                              const actualCheckOutTime = detail.actualCheckOutTime ?? detail.actualCheckOut ?? detail.realCheckOutTime ?? detail.checkOutActualTime;
                              const detailStatus = String(detail.bookingStatusType ?? detail.bookingDetailStatus ?? detail.status ?? "").toUpperCase();
                              const isCancelled = detailStatus === "CANCELLED";
                              const isInHouse = !isCancelled && (
                                ["CHECKED_IN", "IN_HOUSE"].includes(detailStatus)
                                || ["CHECKED_IN", "IN_HOUSE"].includes(String(booking.bookingStatus ?? "").toUpperCase())
                              );
                              const isCheckedOut = !isCancelled && !isInHouse && (
                                detailStatus === "CHECKED_OUT" || Boolean(actualCheckOutTime)
                              );
                              const roomPrice = Number(detail.roomSubTotal ?? detail.roomSubtotal ?? detail.totalPrice ?? 0);
                              const earlyCheckInFee = Number(detail.earlyCheckInFee ?? detail.earlyCheckinFee ?? 0);
                              return <div
                                key={String(detail.bookingDetailId ?? index)}
                                className={`flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3 text-xs ${
                                  isCancelled
                                    ? "border-rose-200 bg-rose-50/60"
                                    : isInHouse
                                      ? "border-blue-200 bg-blue-50/70"
                                      : isCheckedOut
                                        ? "border-orange-200 bg-orange-50/70"
                                        : "border-slate-100 bg-slate-50/60"
                                }`}
                              >
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={`font-medium ${isInHouse ? "text-blue-800" : isCheckedOut ? "text-orange-800" : "text-slate-700"}`}><BedDouble size={13} className="mr-1 inline" />{t("customer.room")} {roomNumber}</span>
                                    {isCancelled && (
                                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                                        {t("customer.bookingStatuses.cancelled")}
                                      </span>
                                    )}
                                    {isInHouse && (
                                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                        {t("customer.bookingStatuses.inHouse")}
                                      </span>
                                    )}
                                    {isCheckedOut && (
                                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                                        {t("customer.bookingStatuses.checkedOut")}
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-1 text-slate-500">
                                    {t("customer.actualCheckIn")}: {actualCheckInTime ? formatBookingDate(String(actualCheckInTime)) : t("customer.notCheckedIn")}
                                    {" · "}
                                    {t("customer.actualCheckOut")}: {actualCheckOutTime ? formatBookingDate(String(actualCheckOutTime)) : t("customer.notCheckedOut")}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className="block text-[10px] text-slate-500">{t("customer.roomCharge")}</span>
                                  <strong className={`mt-0.5 block ${isCancelled ? "text-rose-700" : "text-slate-800"}`}>
                                    {formatMoney(Number.isFinite(roomPrice) ? roomPrice : 0)}
                                  </strong>
                                  {Number.isFinite(earlyCheckInFee) && earlyCheckInFee > 0 && (
                                    <span className="mt-1 block text-[10px] font-medium text-amber-700">
                                      {i18n.language.startsWith("en") ? "Early check-in fee" : "Phí check-in sớm"}: {formatMoney(earlyCheckInFee)}
                                    </span>
                                  )}
                                </div>
                              </div>;
                            })}</div>}
                          </article>;
                        })}</div>}
                </div>}
              </div>;
            })}
    </div>
    {filtered.length > 0 && <div className="flex flex-col gap-3 border-t border-slate-100 p-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between"><span>Hiển thị {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filtered.length)} trên {filtered.length} khách hàng</span><div className="flex items-center gap-2"><label className="flex items-center gap-2">Số dòng<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700"><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage === 1} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Trang trước"><ChevronLeft size={16} /></button><span className="min-w-16 text-center font-semibold text-slate-700">{safePage} / {totalPages}</span><button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage === totalPages} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Trang sau"><ChevronRight size={16} /></button></div></div>}
    {selected && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onMouseDown={() => setSelected(null)}><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{t("customer.profile")}</p><h3 className="mt-1 text-xl font-bold text-slate-900">{selected.name}</h3></div><button type="button" onClick={() => setSelected(null)} aria-label={t("common.close")}><X size={18} /></button></div><div className="mt-5 grid gap-3 text-sm text-slate-600"><p><Phone size={14} className="mr-2 inline" />{selected.phone}</p><p><Mail size={14} className="mr-2 inline" />{selected.email}</p></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-lg bg-slate-50 p-3"><span className="block text-xs text-slate-500">{t("customer.bookingCount")}</span><strong className="mt-1 block text-lg text-slate-900">{selected.visits}</strong></div><div className="rounded-lg bg-slate-50 p-3"><span className="block text-xs text-slate-500">{t("customer.cancelledBookings")}</span><strong className="mt-1 block text-lg text-slate-900">{selected.cancelledBookings}</strong></div><div className="rounded-lg bg-slate-50 p-3"><span className="block text-xs text-slate-500">{t("customer.bookingValue")}</span><strong className="mt-1 block text-sm text-slate-900">{formatMoney(selected.totalSpend)}</strong></div><div className="rounded-lg bg-slate-50 p-3"><span className="block text-xs text-slate-500"><CalendarDays size={12} className="mr-1 inline" />{t("customer.latestBooking")}</span><strong className="mt-1 block text-xs text-slate-900">{formatBookingDate(selected.latestBookingAt)}</strong></div></div><p className="mt-4 text-sm text-slate-600">{t("customer.note")}: {selected.note}</p><section className="mt-6 border-t border-slate-100 pt-5"><div className="mb-3 flex items-center justify-between gap-3"><h4 className="font-semibold text-slate-900">{t("customer.bookingHistory")}</h4><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{customerBookings.length}</span></div>{isBookingsLoading ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">{t("customer.bookingsLoading")}</p> : isBookingsError ? <p className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700">{t("customer.bookingsLoadError")}</p> : customerBookings.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">{t("customer.noBookings")}</p> : <div className="space-y-3">{customerBookings.map((booking) => { const bookingKey = String(booking.bookingId ?? booking.orderId ?? booking.id ?? ""); const details = Array.isArray(booking.bookingDetails) ? booking.bookingDetails : []; const roomAmount = Number(booking.roomTotal ?? 0); const serviceAmount = Number(booking.serviceTotal ?? 0); const amount = Number(booking.finalAmount ?? 0); return <article key={bookingKey} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-semibold text-slate-900">{t("customer.bookingCode")}: {bookingKey || "-"}</p><p className="mt-1 text-xs text-slate-500"><CalendarDays size={12} className="mr-1 inline" />{formatBookingDate(booking.createdAt ?? null)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${String(booking.bookingStatus ?? "").toUpperCase().includes("CANCEL") ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{formatBookingStatus(booking)}</span></div><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><div className="rounded-lg bg-slate-50 p-3"><span className="block text-xs text-slate-500">{t("customer.roomCharge")}</span><strong className="mt-1 block text-slate-800">{formatMoney(Number.isFinite(roomAmount) ? roomAmount : 0)}</strong></div><div className="rounded-lg bg-slate-50 p-3"><span className="block text-xs text-slate-500">{t("customer.serviceCharge")}</span><strong className="mt-1 block text-slate-800">{formatMoney(Number.isFinite(serviceAmount) ? serviceAmount : 0)}</strong></div></div><p className="mt-3 text-sm font-semibold text-slate-800">{t("customer.bookingAmount")}: {formatMoney(Number.isFinite(amount) ? amount : 0)}</p>    {details.length > 0 && <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">{details.map((detail, index) => {
      const roomNumber = String(detail.roomNumber ?? detail.roomName ?? detail.roomTypeName ?? "-");
      const detailStatus = String(detail.bookingStatusType ?? detail.bookingDetailStatus ?? detail.status ?? "").toUpperCase();
      const isCancelled = detailStatus === "CANCELLED";
      const roomPrice = Number(detail.roomSubTotal ?? detail.roomSubtotal ?? detail.totalPrice ?? 0);
      return (
        <div
          key={String(detail.bookingDetailId ?? index)}
          className={`flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3 text-xs ${
            isCancelled ? "border-rose-200 bg-rose-50/60" : "border-slate-100 bg-slate-50/60"
          }`}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-700">
                <BedDouble size={13} className="mr-1 inline" />{t("customer.room")} {roomNumber}
              </span>
              {isCancelled && (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                  {t("customer.bookingStatuses.cancelled")}
                </span>
              )}
            </div>
            <p className="mt-1 text-slate-500">
              {formatBookingDate(detail.checkInTime == null ? null : String(detail.checkInTime))}
              {" – "}
              {formatBookingDate(detail.checkOutTime == null ? null : String(detail.checkOutTime))}
            </p>
          </div>
          <div className="text-right">
            <span className="block text-[10px] text-slate-500">{t("customer.roomCharge")}</span>
            <strong className={`mt-0.5 block ${isCancelled ? "text-rose-700" : "text-slate-800"}`}>
              {formatMoney(Number.isFinite(roomPrice) ? roomPrice : 0)}
            </strong>
          </div>
        </div>
      );
    })}</div>}</article>; })}</div>}</section>{canManageCustomers && <button type="button" onClick={() => openEdit(selected)} className="mt-6 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"><Pencil size={15} />{t("customer.edit")}</button>}</div></div>}
    {customerToVerify && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onMouseDown={closeModal}><form onSubmit={(event) => { event.preventDefault(); verifyIdentity(); }} onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{t("customer.edit")}</p><h3 className="mt-1 text-xl font-bold text-slate-900">Xác thực CCCD</h3><p className="mt-2 text-sm text-slate-500">Nhập đúng số CCCD của {customerToVerify.name} để tiếp tục chỉnh sửa.</p></div><button type="button" onClick={closeModal} aria-label={t("common.close")}><X size={18} /></button></div><label className="mt-5 block text-sm font-semibold text-slate-700">{t("customer.identityNumber")}<input autoFocus required value={identityCheck} onChange={(event) => { setIdentityCheck(event.target.value); setIdentityError(false); }} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" />{identityError && <span className="mt-2 block text-xs font-normal text-rose-600">CCCD không đúng, vui lòng kiểm tra lại.</span>}</label><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={closeModal} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">{t("common.cancel")}</button><button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Tiếp tục</button></div></form></div>}
    {modal && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onMouseDown={closeModal}><form onSubmit={(event) => { event.preventDefault(); void save(); }} onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h3 className="text-xl font-bold text-slate-900">{modal === "edit" ? t("customer.edit") : t("customer.addTitle")}</h3><button type="button" onClick={closeModal} aria-label={t("common.close")}><X size={18} /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2">{([["name", "fullName"], ["phone", "phone"], ["email", "email"], ["identityNumber", "identityNumber"]] as const).map(([field, label]) => <label key={field} className="text-sm font-semibold text-slate-700">{t(`customer.${label}`)}<input required value={form[field]} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" /></label>)}<label className="text-sm font-semibold text-slate-700 sm:col-span-2">{t("customer.note")}<textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder={t("customer.notePlaceholder")} className="mt-1.5 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" /></label></div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={closeModal} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">{t("common.cancel")}</button><button type="submit" disabled={isUpdating} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isUpdating ? t("common.loading") : t("customer.save")}</button></div></form></div>}
  </section>;
}

function BookingPaymentHistory({ bookingId }: { bookingId: string }) {
  const { t, i18n } = useTranslation();
  const { data: order, isLoading, isError } = useGetOrderByBookingIdQuery(bookingId, { skip: !bookingId });
  const payments = (order?.paymentTransactions ?? [])
    .filter((transaction) => String(transaction.cashFlowType ?? "RECEIPT").toUpperCase() === "RECEIPT")
    .sort((first, second) => {
      const firstDate = new Date(String(first.transactionDate ?? first.createdAt ?? "")).getTime();
      const secondDate = new Date(String(second.transactionDate ?? second.createdAt ?? "")).getTime();
      return (Number.isFinite(secondDate) ? secondDate : 0) - (Number.isFinite(firstDate) ? firstDate : 0);
    });
  const formatMoney = (amount: number) => `${new Intl.NumberFormat(
    i18n.language.startsWith("en") ? "en-US" : "vi-VN",
    { maximumFractionDigits: 0 },
  ).format(amount)}${i18n.language.startsWith("en") ? " VND" : "đ"}`;
  const formatDate = (value?: string) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat(i18n.language.startsWith("en") ? "en-US" : "vi-VN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };
  const paymentMethodLabel = (method?: string) => {
    const normalized = String(method ?? "").toUpperCase();
    const methodKeys: Record<string, string> = {
      CASH: "customer.paymentMethods.cash",
      BANK: "customer.paymentMethods.bank",
      BANK_TRANSFER: "customer.paymentMethods.bank",
      PAYOS: "customer.paymentMethods.payos",
      EWALLET: "customer.paymentMethods.ewallet",
    };
    return methodKeys[normalized] ? t(methodKeys[normalized]) : normalized.replace(/_/g, " ") || "—";
  };
  const totalPaid = payments.reduce((total, transaction) => {
    const amount = Number(transaction.amount ?? 0);
    return total + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  return <section className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h5 className="flex items-center gap-2 text-xs font-semibold text-slate-800">
        <CreditCard size={14} />{t("customer.paymentHistory")}
      </h5>
      {!isLoading && !isError && <span className="text-xs text-slate-600">
        {t("customer.paymentCount")}: <strong>{payments.length}</strong> · {formatMoney(totalPaid)}
      </span>}
    </div>
    {isLoading ? <p className="mt-2 text-xs text-slate-500">{t("common.loading")}</p>
      : isError ? <p className="mt-2 text-xs text-rose-600">{t("customer.paymentsLoadError")}</p>
        : payments.length === 0 ? <p className="mt-2 text-xs text-slate-500">{t("customer.noPayments")}</p>
          : <div className="mt-2 space-y-2">{payments.map((transaction, index) => {
            const method = String(transaction.paymentType ?? "").toUpperCase();
            const transactionKey = String(transaction.id ?? `${bookingId}-${index}`);
            const amount = Number(transaction.amount ?? 0);
            return <div key={transactionKey} className="grid gap-2 rounded-md border border-slate-200 bg-white p-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
              <div><span className="block text-slate-500">{t("customer.paymentTime")}</span><strong className="mt-0.5 block text-slate-700">{formatDate(transaction.transactionDate ?? transaction.createdAt)}</strong></div>
              <div><span className="block text-slate-500">{t("customer.paymentAmount")}</span><strong className="mt-0.5 block text-slate-700">{formatMoney(Number.isFinite(amount) ? amount : 0)}</strong></div>
              <div><span className="block text-slate-500">{t("customer.paymentMethod")}</span><strong className="mt-0.5 block text-slate-700">{paymentMethodLabel(method)}</strong></div>
              <div>
                <span className="block text-slate-500">{t("customer.paymentSource")}</span>
                <strong className="mt-0.5 block text-slate-700">
                  {transaction.paymentSource === "FRONT_DESK"
                    ? `${t("customer.paymentSources.frontDesk")}${transaction.processorEmployeeName || transaction.processorEmployeeId ? ` · ${transaction.processorEmployeeName || transaction.processorEmployeeId}` : ` · ${t("customer.paymentStaffNotRecorded")}`}`
                    : transaction.paymentSource === "ONLINE_BOOKING"
                      ? t("customer.paymentSources.onlineBooking")
                      : t("customer.paymentSources.unknown")}
                </strong>
              </div>
            </div>;
          })}</div>}
  </section>;
}
