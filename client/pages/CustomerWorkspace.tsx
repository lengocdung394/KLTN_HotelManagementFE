import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mail, Pencil, Phone, Plus, Search, UserRound, X } from "lucide-react";
import { useGetCustomersByHotelIdQuery, useUpdateCustomerMutation, type CustomerResponse } from "../services/customerApi";
import { useAppSelector } from "../store/hooks";

type Customer = CustomerResponse;
type Tier = Customer["tier"];
type Form = Pick<Customer, "name" | "phone" | "email" | "identityNumber" | "note">;

const blankForm: Form = { name: "", phone: "", email: "", identityNumber: "", note: "" };
const tierStyle: Record<Tier, string> = { loyal: "bg-amber-50 text-amber-700", potential: "bg-blue-50 text-blue-700", new: "bg-emerald-50 text-emerald-700" };

export default function CustomerWorkspace() {
  const { t } = useTranslation();
  const hotelId = useAppSelector((state) => state.auth.hotelId);
  const { data: apiCustomers = [], isLoading, isError } = useGetCustomersByHotelIdQuery(Number(hotelId), { skip: !hotelId || Number.isNaN(Number(hotelId)) });
  const [updateCustomer, { isLoading: isUpdating }] = useUpdateCustomerMutation();
  const [localCustomers, setLocalCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState("all");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [customerToVerify, setCustomerToVerify] = useState<Customer | null>(null);
  const [identityCheck, setIdentityCheck] = useState("");
  const [identityError, setIdentityError] = useState(false);
  const [form, setForm] = useState<Form>(blankForm);
  const customers = useMemo(() => [...localCustomers, ...apiCustomers], [localCustomers, apiCustomers]);
  const filtered = useMemo(() => customers.filter((customer) => `${customer.name} ${customer.phone} ${customer.email}`.toLowerCase().includes(search.toLowerCase())).filter((customer) => tier === "all" || customer.tier === tier), [customers, search, tier]);
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
      if (editing.id.startsWith("local-")) setLocalCustomers((current) => current.map((customer) => customer.id === editing.id ? { ...customer, ...values } : customer));
      else await updateCustomer({ id: editing.id, request: values }).unwrap();
    } else setLocalCustomers((current) => [{ id: `local-${Date.now()}`, ...values, visits: 0, lastStay: t("customer.noStay"), totalSpend: 0, tier: "new" }, ...current]);
    closeModal();
  };
  return <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
    <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between"><div><h3 className="font-bold text-slate-900">{t("customer.listTitle")}</h3><p className="mt-1 text-sm text-slate-500">{t("customer.listDescription")}</p></div><button type="button" onClick={openCreate} className="flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16} />{t("customer.add")}</button></div>
    <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("customer.searchPlaceholder")} className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm" /></div><select value={tier} onChange={(event) => setTier(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="all">{t("customer.allTiers")}</option>{(["loyal", "potential", "new"] as Tier[]).map((value) => <option key={value} value={value}>{tierLabel(value)}</option>)}</select></div>
    <div className="divide-y divide-slate-100">{isLoading ? <p className="p-6 text-sm text-slate-500">{t("common.loading")}</p> : isError ? <p className="p-6 text-sm text-rose-600">{t("customer.loadError")}</p> : filtered.length === 0 ? <p className="p-6 text-sm text-slate-500">{t("customer.noResults")}</p> : filtered.map((customer) => <div key={customer.id} className="flex items-center gap-4 p-5 transition hover:bg-slate-50"><button type="button" onClick={() => setSelected(customer)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-600"><UserRound size={20} /></span><span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-900">{customer.name}</span><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${tierStyle[customer.tier]}`}>{tierLabel(customer.tier)}</span></span><span className="mt-1 block truncate text-xs text-slate-500"><Phone size={12} className="mr-1 inline" />{customer.phone} <Mail size={12} className="mx-1 inline" />{customer.email}</span></span></button><button type="button" onClick={() => openEdit(customer)} aria-label={t("customer.edit")} title={t("customer.edit")} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"><Pencil size={16} /></button></div>)}</div>
    {selected && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onMouseDown={() => setSelected(null)}><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{t("customer.profile")}</p><h3 className="mt-1 text-xl font-bold text-slate-900">{selected.name}</h3></div><button type="button" onClick={() => setSelected(null)} aria-label={t("common.close")}><X size={18} /></button></div><div className="mt-5 grid gap-3 text-sm text-slate-600"><p><Phone size={14} className="mr-2 inline" />{selected.phone}</p><p><Mail size={14} className="mr-2 inline" />{selected.email}</p><p>{t("customer.note")}: {selected.note}</p></div><button type="button" onClick={() => openEdit(selected)} className="mt-6 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"><Pencil size={15} />{t("customer.edit")}</button></div></div>}
    {customerToVerify && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onMouseDown={closeModal}><form onSubmit={(event) => { event.preventDefault(); verifyIdentity(); }} onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{t("customer.edit")}</p><h3 className="mt-1 text-xl font-bold text-slate-900">Xác thực CCCD</h3><p className="mt-2 text-sm text-slate-500">Nhập đúng số CCCD của {customerToVerify.name} để tiếp tục chỉnh sửa.</p></div><button type="button" onClick={closeModal} aria-label={t("common.close")}><X size={18} /></button></div><label className="mt-5 block text-sm font-semibold text-slate-700">{t("customer.identityNumber")}<input autoFocus required value={identityCheck} onChange={(event) => { setIdentityCheck(event.target.value); setIdentityError(false); }} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" />{identityError && <span className="mt-2 block text-xs font-normal text-rose-600">CCCD không đúng, vui lòng kiểm tra lại.</span>}</label><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={closeModal} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">{t("common.cancel")}</button><button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Tiếp tục</button></div></form></div>}
    {modal && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onMouseDown={closeModal}><form onSubmit={(event) => { event.preventDefault(); void save(); }} onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h3 className="text-xl font-bold text-slate-900">{modal === "edit" ? t("customer.edit") : t("customer.addTitle")}</h3><button type="button" onClick={closeModal} aria-label={t("common.close")}><X size={18} /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2">{([["name", "fullName"], ["phone", "phone"], ["email", "email"], ["identityNumber", "identityNumber"]] as const).map(([field, label]) => <label key={field} className="text-sm font-semibold text-slate-700">{t(`customer.${label}`)}<input required value={form[field]} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" /></label>)}<label className="text-sm font-semibold text-slate-700 sm:col-span-2">{t("customer.note")}<textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder={t("customer.notePlaceholder")} className="mt-1.5 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" /></label></div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={closeModal} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">{t("common.cancel")}</button><button type="submit" disabled={isUpdating} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isUpdating ? t("common.loading") : t("customer.save")}</button></div></form></div>}
  </section>;
}
