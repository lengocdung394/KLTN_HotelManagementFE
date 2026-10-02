import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Mail, Pencil, Phone, Plus, Search, UserRound, X } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { bindHotelSocketEvents } from "../lib/socket";
import { baseApi } from "../services/baseApi";
import {
  useGetCustomersByHotelIdQuery,
  useCreateWalkInCustomerMutation,
  useUpdateCustomerMutation,
  type CustomerResponse,
} from "../services/customerApi";
import { useAppDispatch, useAppSelector } from "../store/hooks";

type Customer = CustomerResponse;
type Tier = Customer["tier"];
type Form = Pick<Customer, "name" | "phone" | "email" | "identityNumber" | "note">;

const blankForm: Form = { name: "", phone: "", email: "", identityNumber: "", note: "" };
const tierStyle: Record<Tier, string> = { loyal: "bg-amber-50 text-amber-700", potential: "bg-blue-50 text-blue-700", new: "bg-emerald-50 text-emerald-700" };

const normalizeSocketCustomer = (payload: unknown): Customer | null => {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  if (!root) return null;

  const nestedCustomer = "customer" in root && root.customer && typeof root.customer === "object"
    ? (root.customer as Record<string, unknown>)
    : null;
  const nestedBookingCustomer = "booking" in root && root.booking && typeof root.booking === "object"
    ? (root.booking as Record<string, unknown>)
    : null;
  const customer = nestedCustomer ?? (nestedBookingCustomer && "customer" in nestedBookingCustomer && nestedBookingCustomer.customer && typeof nestedBookingCustomer.customer === "object"
    ? (nestedBookingCustomer.customer as Record<string, unknown>)
    : root);

  if (!customer || typeof customer !== "object") return null;

  const loyaltyTier = customer.loyaltyTier ?? customer.customerTier ?? customer.tier;
  const tierText = typeof loyaltyTier === "object" && loyaltyTier !== null
    ? String((loyaltyTier as Record<string, unknown>).description ?? "")
    : String(loyaltyTier ?? "");
  const tierValue = tierText.toLowerCase();

  return {
    id: String(customer.id ?? customer.customerId ?? customer.userId ?? `socket-${Date.now()}`),
    name: String(customer.name ?? customer.fullName ?? "Khách hàng mới"),
    phone: String(customer.phone ?? ""),
    email: String(customer.email ?? ""),
    identityNumber: String(customer.identityNumber ?? customer.cccd ?? ""),
    visits: Number(customer.totalBookings ?? customer.visits ?? customer.visitCount ?? 0),
    lastStay: String(customer.lastStay ?? "Chưa lưu trú"),
    totalSpend: Number(customer.totalSpent ?? customer.totalSpend ?? 0),
    tier: tierValue.includes("vàng") || tierValue.includes("gold")
      ? "loyal"
      : tierValue.includes("bạc") || tierValue.includes("silver")
        ? "potential"
        : "new",
    note: String(customer.note ?? "Chưa có ghi chú."),
  };
};

export default function CustomerWorkspace() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const hotelId = useAppSelector((state) => state.auth.hotelId);
  const effectiveHotelId = Number(hotelId) || 1;
  const [localCustomers, setLocalCustomers] = useState<Customer[]>([]);
  const { data: apiCustomers = [], isLoading, isError, refetch } = useGetCustomersByHotelIdQuery(effectiveHotelId);
  const [createWalkInCustomer, { isLoading: isCreatingCustomer }] = useCreateWalkInCustomerMutation();
  const [updateCustomer, { isLoading: isUpdating }] = useUpdateCustomerMutation();

  useEffect(() => {
    if (!hotelId || Number.isNaN(Number(hotelId))) return;

    const handleCustomerSocketUpdate = (payload: unknown) => {
      const normalized = normalizeSocketCustomer(payload);
      if (!normalized) {
        console.log("👤 [CustomerWorkspace] ignored empty customer payload:", payload);
        return;
      }

      setLocalCustomers((current) => {
        const merged = [...current, ...apiCustomers];
        const exists = merged.some((item) => item.id === normalized.id);
        if (exists) return current;
        return [normalized, ...current];
      });

      console.log("👤 [CustomerWorkspace] customer socket payload handled:", payload);
      dispatch(baseApi.util.invalidateTags(["Customer"]));
    };

    bindHotelSocketEvents({
      onCustomerCreated: handleCustomerSocketUpdate,
      onCustomerBookingUpdated: handleCustomerSocketUpdate,
    });
  }, [apiCustomers, dispatch, hotelId]);
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [customerToVerify, setCustomerToVerify] = useState<Customer | null>(null);
  const [identityCheck, setIdentityCheck] = useState("");
  const [identityError, setIdentityError] = useState(false);
  const [form, setForm] = useState<Form>(blankForm);
  const customers = useMemo(() => {
    const merged = [...localCustomers, ...apiCustomers];
    return merged.filter((customer, index, list) => list.findIndex((item) => item.id === customer.id) === index);
  }, [localCustomers, apiCustomers]);
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
      if (editing.id.startsWith("local-")) {
        setLocalCustomers((current) => current.map((customer) => customer.id === editing.id ? { ...customer, ...values } : customer));
      } else {
        try {
          await updateCustomer({ id: editing.id, request: values }).unwrap();
          toast({ title: "Cập nhật thành công", description: `Đã cập nhật thông tin khách hàng ${values.name}.` });
        } catch (err: any) {
          toast({ variant: "destructive", title: "Cập nhật thất bại", description: err?.data?.message || "Lỗi khi cập nhật hồ sơ khách hàng." });
        }
      }
    } else {
      try {
        await createWalkInCustomer({
          fullName: values.name,
          phone: values.phone,
          cccd: values.identityNumber,
        }).unwrap();
        toast({ title: "Thêm khách hàng thành công", description: `Hồ sơ của khách hàng ${values.name} đã được lưu vào hệ thống.` });
      } catch (err: any) {
        setLocalCustomers((current) => [{ id: `local-${Date.now()}`, ...values, visits: 0, lastStay: t("customer.noStay"), totalSpend: 0, tier: "new" }, ...current]);
        toast({ title: "Đã thêm khách hàng", description: `Hồ sơ của khách hàng ${values.name} đã được ghi nhận.` });
      }
    }
    closeModal();
  };
  return <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
    <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between"><div><h3 className="font-bold text-slate-900">{t("customer.listTitle")}</h3><p className="mt-1 text-sm text-slate-500">{t("customer.listDescription")}</p></div><button type="button" onClick={openCreate} className="flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16} />{t("customer.add")}</button></div>
    <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("customer.searchPlaceholder")} className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm" /></div><select value={tier} onChange={(event) => setTier(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="all">{t("customer.allTiers")}</option>{(["loyal", "potential", "new"] as Tier[]).map((value) => <option key={value} value={value}>{tierLabel(value)}</option>)}</select></div>
    <div className="grid gap-4 p-4 md:grid-cols-2">
      {isLoading ? (
        <p className="p-6 text-sm text-slate-500 md:col-span-2">{t("common.loading")}</p>
      ) : isError ? (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 md:col-span-2">
          <span>Không thể tải danh sách khách hàng. Vui lòng kiểm tra kết nối Backend!</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="ml-3 rounded-md bg-rose-600 px-3 py-1 font-semibold text-white shadow-xs hover:bg-rose-700 transition"
          >
            Thử lại
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="p-6 text-sm text-slate-500 md:col-span-2">{t("customer.noResults")}</p>
      ) : (
        paginatedCustomers.map((customer) => (
          <div key={customer.id} className="flex h-full items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 transition hover:bg-slate-50">
            <button type="button" onClick={() => setSelected(customer)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-600">
                <UserRound size={20} />
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">{customer.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${tierStyle[customer.tier]}`}>{tierLabel(customer.tier)}</span>
                </span>
                <span className="mt-1 block truncate text-xs text-slate-500">
                  <Phone size={12} className="mr-1 inline" />{customer.phone} <Mail size={12} className="mx-1 inline" />{customer.email}
                </span>
              </span>
            </button>
            <button type="button" onClick={() => openEdit(customer)} aria-label={t("customer.edit")} title={t("customer.edit")} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600">
              <Pencil size={16} />
            </button>
          </div>
        ))
      )}
    </div>
    {filtered.length > 0 && <div className="flex flex-col gap-3 border-t border-slate-100 p-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between"><span>Hiển thị {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filtered.length)} trên {filtered.length} khách hàng</span><div className="flex items-center gap-2"><label className="flex items-center gap-2">Số dòng<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700"><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage === 1} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Trang trước"><ChevronLeft size={16} /></button><span className="min-w-16 text-center font-semibold text-slate-700">{safePage} / {totalPages}</span><button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage === totalPages} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Trang sau"><ChevronRight size={16} /></button></div></div>}
    {selected && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onMouseDown={() => setSelected(null)}><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{t("customer.profile")}</p><h3 className="mt-1 text-xl font-bold text-slate-900">{selected.name}</h3></div><button type="button" onClick={() => setSelected(null)} aria-label={t("common.close")}><X size={18} /></button></div><div className="mt-5 grid gap-3 text-sm text-slate-600"><p><Phone size={14} className="mr-2 inline" />{selected.phone}</p><p><Mail size={14} className="mr-2 inline" />{selected.email}</p><p>{t("customer.note")}: {selected.note}</p></div><button type="button" onClick={() => openEdit(selected)} className="mt-6 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"><Pencil size={15} />{t("customer.edit")}</button></div></div>}
    {customerToVerify && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onMouseDown={closeModal}><form onSubmit={(event) => { event.preventDefault(); verifyIdentity(); }} onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{t("customer.edit")}</p><h3 className="mt-1 text-xl font-bold text-slate-900">Xác thực CCCD</h3><p className="mt-2 text-sm text-slate-500">Nhập đúng số CCCD của {customerToVerify.name} để tiếp tục chỉnh sửa.</p></div><button type="button" onClick={closeModal} aria-label={t("common.close")}><X size={18} /></button></div><label className="mt-5 block text-sm font-semibold text-slate-700">{t("customer.identityNumber")}<input autoFocus required value={identityCheck} onChange={(event) => { setIdentityCheck(event.target.value); setIdentityError(false); }} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" />{identityError && <span className="mt-2 block text-xs font-normal text-rose-600">CCCD không đúng, vui lòng kiểm tra lại.</span>}</label><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={closeModal} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">{t("common.cancel")}</button><button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Tiếp tục</button></div></form></div>}
    {modal && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onMouseDown={closeModal}><form onSubmit={(event) => { event.preventDefault(); void save(); }} onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h3 className="text-xl font-bold text-slate-900">{modal === "edit" ? t("customer.edit") : t("customer.addTitle")}</h3><button type="button" onClick={closeModal} aria-label={t("common.close")}><X size={18} /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2">{([["name", "fullName"], ["phone", "phone"], ["email", "email"], ["identityNumber", "identityNumber"]] as const).map(([field, label]) => <label key={field} className="text-sm font-semibold text-slate-700">{t(`customer.${label}`)}<input required value={form[field]} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" /></label>)}<label className="text-sm font-semibold text-slate-700 sm:col-span-2">{t("customer.note")}<textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder={t("customer.notePlaceholder")} className="mt-1.5 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" /></label></div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={closeModal} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">{t("common.cancel")}</button><button type="submit" disabled={isUpdating} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isUpdating ? t("common.loading") : t("customer.save")}</button></div></form></div>}
  </section>;
}
