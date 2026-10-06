import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, ChevronLeft, ChevronRight, Copy, Eye, Pencil, Plus, Search, Tag, X } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import DatePickerPopover from "../components/DatePickerPopover";
import { useCreatePromotionMutation, useGetPromotionsQuery, type CreatePromotionRequest, type Promotion, type PromotionDiscountType, type PromotionScope, type PromotionStatus } from "../services/promotionApi";
import { bindHotelSocketEvents } from "../lib/socket";
import { baseApi } from "../services/baseApi";
import { useAppDispatch, useAppSelector } from "../store/hooks";

type PromotionFormValues = {
  name: string;
  description: string;
  type: PromotionScope;
  discountType: PromotionDiscountType;
  discountValue: string;
  maxDiscountAmount: string;
  minBookingValue: string;
  minRoomValue: string;
  minServiceValue: string;
  startDate: string;
  endDate: string;
  usageLimit: string;
  status: PromotionStatus;
  isExclusive: boolean;
};

const initialForm: PromotionFormValues = {
  name: "",
  description: "",
  type: "TOTAL",
  discountType: "PERCENTAGE",
  discountValue: "",
  maxDiscountAmount: "",
  minBookingValue: "",
  minRoomValue: "",
  minServiceValue: "",
  startDate: "",
  endDate: "",
  usageLimit: "",
  status: "DRAFT",
  isExclusive: false,
};

const optionalNumber = (value: string) => value.trim() ? Number(value) : undefined;
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const promotionDateKey = (value: string) => {
  const isoDate = value.trim().match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (isoDate) return isoDate;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : dateKey(date);
};

const isPromotionExpired = (promotion: Promotion) => {
  const status = String(promotion.status ?? (promotion.active ? "ACTIVE" : "INACTIVE")).toUpperCase();
  const endDate = new Date(promotion.endDate).getTime();
  return status === "EXPIRED" || (Number.isFinite(endDate) && endDate < Date.now());
};

const promotionStatusOf = (promotion: Promotion): PromotionStatus => {
  if (isPromotionExpired(promotion)) return "EXPIRED";
  const status = String(promotion.status ?? (promotion.active ? "ACTIVE" : "INACTIVE")).toUpperCase();
  return status === "DRAFT" || status === "ACTIVE" || status === "INACTIVE"
    ? status
    : promotion.active ? "ACTIVE" : "INACTIVE";
};

const statusBadgeClass = (promotion: Promotion) => {
  const status = promotionStatusOf(promotion);
  if (status === "ACTIVE") return "bg-emerald-50 text-emerald-700";
  if (status === "DRAFT") return "bg-amber-50 text-amber-700";
  if (status === "EXPIRED") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-500";
};

const promotionScopeOf = (promotion: Promotion): PromotionScope => {
  const scope = String(promotion.type ?? "TOTAL").toUpperCase();
  return scope === "ROOM" || scope === "SERVICE" || scope === "TOTAL" ? scope : "TOTAL";
};

const scopeColorClasses: Record<PromotionScope, string> = {
  ROOM: "bg-blue-50 text-blue-700",
  SERVICE: "bg-amber-50 text-amber-700",
  TOTAL: "bg-emerald-50 text-emerald-700",
};

const scopeLabelKeys: Record<PromotionScope, string> = {
  ROOM: "scopeRoom",
  SERVICE: "scopeService",
  TOTAL: "scopeTotal",
};

const promotionErrorMessage = (error: unknown) => {
  if (!error || typeof error !== "object") return "Không thể tạo khuyến mãi. Vui lòng thử lại.";
  const data = "data" in error ? error.data : undefined;
  if (typeof data === "string") return data;
  if (data && typeof data === "object" && "message" in data && typeof data.message === "string") return data.message;
  if ("error" in error && typeof error.error === "string") return error.error;
  return "Không thể tạo khuyến mãi. Vui lòng thử lại.";
};

const isPercentageDiscount = (valueType: unknown) => String(valueType ?? "").toUpperCase().includes("PERCENT");

export default function PromotionWorkspace() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { hotelId, roles } = useAppSelector((state) => state.auth);
  const canManagePromotions = roles.includes("ROLE_MANAGER") || roles.includes("ROLE_SUPER_ADMIN");
  const hasHotelId = Boolean(hotelId) && !Number.isNaN(Number(hotelId));
  const { data: apiPromotions = [], isLoading, isError } = useGetPromotionsQuery(hasHotelId ? { hotelId: Number(hotelId), page: 0, size: 100 } : undefined, { skip: !hasHotelId });
  const [createPromotion, { isLoading: isCreatingPromotion }] = useCreatePromotionMutation();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailPromotion, setDetailPromotion] = useState<Promotion | null>(null);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [form, setForm] = useState<PromotionFormValues>(initialForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [formError, setFormError] = useState("");
  const pendingLocalPromotionName = useRef("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | PromotionStatus>("ALL");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [isDateFilterActive, setIsDateFilterActive] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const displayedPromotions = promotions.length > 0 ? promotions : apiPromotions;
  const locale = i18n.resolvedLanguage?.startsWith("en") ? "en-US" : "vi-VN";
  const monthStartKey = dateKey(calendarMonth);
  const monthEndKey = dateKey(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0));
  const promotionDateMarkers = useMemo(() => {
    const markers: Record<string, Array<"ROOM" | "SERVICE" | "TOTAL">> = {};
    displayedPromotions.forEach((promotion) => {
      const startDate = promotionDateKey(promotion.startDate);
      const endDate = promotionDateKey(promotion.endDate);
      if (!startDate || !endDate || startDate > endDate) return;
      const scope = String(promotion.type ?? "TOTAL").toUpperCase();
      if (scope !== "ROOM" && scope !== "SERVICE" && scope !== "TOTAL") return;
      const cursor = new Date(`${startDate}T00:00:00`);
      const end = new Date(`${endDate}T00:00:00`);
      while (cursor <= end) {
        const key = dateKey(cursor);
        const dayMarkers = markers[key] ?? [];
        if (!dayMarkers.includes(scope)) markers[key] = [...dayMarkers, scope];
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return markers;
  }, [displayedPromotions]);
  const monthlyPromotions = displayedPromotions.filter((promotion) => {
    const startDate = promotionDateKey(promotion.startDate);
    const endDate = promotionDateKey(promotion.endDate);
    return startDate && endDate && startDate <= monthEndKey && endDate >= monthStartKey;
  });
  const dateFilteredPromotions = isDateFilterActive
    ? monthlyPromotions.filter((promotion) => {
      const startDate = promotionDateKey(promotion.startDate);
      const endDate = promotionDateKey(promotion.endDate);
      const selectedDateKey = dateKey(selectedDate);
      return startDate <= selectedDateKey && selectedDateKey <= endDate;
    })
    : monthlyPromotions;
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase("vi-VN");
  const visiblePromotions = dateFilteredPromotions.filter((promotion) => {
    const matchesStatus = statusFilter === "ALL" || promotionStatusOf(promotion) === statusFilter;
    const matchesSearch = `${promotion.name} ${promotion.code} ${promotion.description} ${promotion.type}`
      .toLocaleLowerCase("vi-VN")
      .includes(normalizedSearchQuery);
    return matchesStatus && matchesSearch;
  });
  const totalPages = Math.max(1, Math.ceil(visiblePromotions.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedPromotions = visiblePromotions.slice((safePage - 1) * pageSize, safePage * pageSize);
  const monthLabel = calendarMonth.toLocaleDateString(locale, { month: "long", year: "numeric" });

  useEffect(() => {
    setPage(1);
  }, [displayedPromotions.length, pageSize, calendarMonth, isDateFilterActive, selectedDate, searchQuery, statusFilter]);

  useEffect(() => {
    if (!hasHotelId) return;
    const refreshPromotions = () => dispatch(baseApi.util.invalidateTags(["Promotion"]));
    bindHotelSocketEvents({
      onPromotionUpdate: refreshPromotions,
      onPromotionCreate: (data) => {
        refreshPromotions();
        const payload = data && typeof data === "object" ? data as Record<string, unknown> : {};
        const promotionName = String(payload.name ?? payload.promotionName ?? payload.title ?? "").trim();
        if (promotionName && promotionName.toLowerCase() === pendingLocalPromotionName.current.toLowerCase()) return;
        toast({
          variant: "promotion",
          title: label("newPromotionNotification"),
          description: promotionName || label("programsDescription"),
        });
      },
    });
  }, [dispatch, hasHotelId, t]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const lastPromotionLogRef = useRef("");
  useEffect(() => {
    const signature = JSON.stringify({
      hotelId,
      promotionIds: displayedPromotions.map((promotion) => `${promotion.id}:${promotion.active}`),
      error: isError,
      isLoading,
    });
    if (lastPromotionLogRef.current === signature) return;
    lastPromotionLogRef.current = signature;
    console.log("[PromotionWorkspace] promotions", {
      hotelId,
      apiPromotions,
      localPromotions: promotions,
      displayedPromotions,
      error: isError,
      isLoading,
    });
  }, [hotelId, apiPromotions, promotions, displayedPromotions, isError, isLoading]);
  const formatDate = (value: string) => value ? new Date(value).toLocaleDateString("vi-VN") : "Chưa cập nhật";
  const formatDateTime = (value: string) => {
    if (!value) return "Chưa cập nhật";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Chưa cập nhật" : date.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  const toDateTimeInput = (value: string) => value ? value.replace(" ", "T").slice(0, 16) : "";
  const formatValue = (promotion: Promotion) => isPercentageDiscount(promotion.valueType) ? `${promotion.value}%` : `${promotion.value.toLocaleString("vi-VN")}đ`;
  const copyCode = (code: string) => { navigator.clipboard?.writeText(code); setCopied(code); window.setTimeout(() => setCopied(null), 1500); };
  const label = (key: string, options?: Record<string, string>) => t(`promotion.${key}`, options);
  const openCreatePromotion = () => {
    setEditingPromotion(null);
    setForm(initialForm);
    setImageFile(null);
    setFormError("");
    setModalOpen(true);
  };
  const openEditPromotion = (promotion: Promotion) => {
    const scope = String(promotion.type ?? "TOTAL").toUpperCase();
    const discountType = String(promotion.valueType ?? "PERCENTAGE").toUpperCase();
    const status = String(promotion.status ?? (promotion.active ? "ACTIVE" : "INACTIVE")).toUpperCase();
    setEditingPromotion(promotion);
    setForm({
      ...initialForm,
      name: promotion.name,
      description: promotion.description,
      type: (["ROOM", "SERVICE", "TOTAL"].includes(scope) ? scope : "TOTAL") as PromotionScope,
      discountType: (discountType === "FIXED_AMOUNT" ? "FIXED_AMOUNT" : "PERCENTAGE") as PromotionDiscountType,
      discountValue: String(promotion.value),
      maxDiscountAmount: promotion.maxDiscountAmount == null ? "" : String(promotion.maxDiscountAmount),
      minBookingValue: promotion.minBookingValue == null ? "" : String(promotion.minBookingValue),
      minRoomValue: promotion.minRoomValue == null ? "" : String(promotion.minRoomValue),
      minServiceValue: promotion.minServiceValue == null ? "" : String(promotion.minServiceValue),
      startDate: toDateTimeInput(promotion.startDate),
      endDate: toDateTimeInput(promotion.endDate),
      usageLimit: promotion.usageLimit == null ? "" : String(promotion.usageLimit),
      status: (["DRAFT", "ACTIVE", "INACTIVE", "EXPIRED"].includes(status) ? status : "DRAFT") as PromotionStatus,
      isExclusive: promotion.isExclusive ?? false,
    });
    setImageFile(null);
    setFormError("");
    setModalOpen(true);
  };
  const addPromotion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");

    if (new Date(form.startDate).getTime() >= new Date(form.endDate).getTime()) {
      setFormError(label("invalidDateRange"));
      return;
    }
    const discountValue = Number(form.discountValue);
    if (!Number.isFinite(discountValue) || discountValue <= 0 || (form.discountType === "PERCENTAGE" && discountValue > 100)) {
      setFormError(label("invalidDiscountValue"));
      return;
    }

    const promotionInfo: CreatePromotionRequest = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      type: form.type,
      discountType: form.discountType,
      discountValue,
      maxDiscountAmount: form.discountType === "PERCENTAGE" ? optionalNumber(form.maxDiscountAmount) : undefined,
      minBookingValue: optionalNumber(form.minBookingValue),
      minRoomValue: optionalNumber(form.minRoomValue),
      minServiceValue: optionalNumber(form.minServiceValue),
      startDate: `${form.startDate}:00`,
      endDate: `${form.endDate}:00`,
      usageLimit: optionalNumber(form.usageLimit),
      status: form.status,
      isExclusive: form.isExclusive,
    };

    if (editingPromotion) {
      setPromotions(displayedPromotions.map((promotion) => promotion.id === editingPromotion.id
        ? {
          ...promotion,
          name: promotionInfo.name,
          description: promotionInfo.description ?? "",
          type: promotionInfo.type,
          value: promotionInfo.discountValue,
          valueType: promotionInfo.discountType,
          maxDiscountAmount: promotionInfo.maxDiscountAmount,
          minBookingValue: promotionInfo.minBookingValue,
          minRoomValue: promotionInfo.minRoomValue,
          minServiceValue: promotionInfo.minServiceValue,
          startDate: promotionInfo.startDate,
          endDate: promotionInfo.endDate,
          usageLimit: promotionInfo.usageLimit,
          status: promotionInfo.status,
          active: promotionInfo.status === "ACTIVE",
          isExclusive: promotionInfo.isExclusive,
        }
        : promotion));
      setModalOpen(false);
      setEditingPromotion(null);
      setForm(initialForm);
      toast({ variant: "default", title: label("updatedLocally") });
      return;
    }

    try {
      pendingLocalPromotionName.current = promotionInfo.name;
      await createPromotion({ promotionInfo, image: imageFile ?? undefined }).unwrap();
      window.setTimeout(() => {
        if (pendingLocalPromotionName.current === promotionInfo.name) pendingLocalPromotionName.current = "";
      }, 5000);
      setPromotions([]);
      setForm(initialForm);
      setImageFile(null);
      setEditingPromotion(null);
      setModalOpen(false);
      toast({ variant: "promotion", title: label("createdSuccessfully") });
    } catch (error) {
      pendingLocalPromotionName.current = "";
      const message = promotionErrorMessage(error);
      setFormError(message);
      toast({ variant: "destructive", title: label("createFailed"), description: message });
    }
  };
  return (
    <div className="mt-6 space-y-5">
      {modalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4">
          <form
            onSubmit={addPromotion}
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {label(editingPromotion ? "editTitle" : "createTitle")}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {label(editingPromotion ? "editDescription" : "createDescription")}
                </p>
                  <p className="mt-1 text-xs text-slate-400">{label("autoCodeNotice")}</p>
              </div>
              <button
                type="button"
                onClick={() => { setModalOpen(false); setEditingPromotion(null); setFormError(""); }}
                aria-label={t("common.close")}
                className="text-2xl leading-none text-slate-400"
              >
                ×
              </button>
            </div>
            <div className="mt-5 space-y-4">
              <section className="rounded-xl border border-slate-200 p-4">
                <div className="mb-4 border-b border-slate-100 pb-3">
                  <h4 className="text-sm font-bold text-slate-900">{label("sectionGeneral")}</h4>
                  <p className="mt-1 text-xs text-slate-500">{label("sectionGeneralDescription")}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                    {label("programName")} <span className="text-rose-500">*</span>
                    <input required value={form.name} maxLength={200} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={label("exampleWeekendOffer")} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" />
                  </label>
                  <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                    {label("description")} <span className="text-rose-500">*</span>
                    <textarea value={form.description} maxLength={2000} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder={label("descriptionPlaceholder")} className="mt-1.5 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    {label("status")} <span className="text-rose-500">*</span>
                    <select value={form.status} disabled={Boolean(editingPromotion && isPromotionExpired(editingPromotion))} title={editingPromotion && isPromotionExpired(editingPromotion) ? label("expiredStatusLocked") : undefined} onChange={(event) => setForm({ ...form, status: event.target.value as PromotionStatus })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">
                      <option value="DRAFT">{label("statusDraft")}</option>
                      <option value="ACTIVE">{label("statusActive")}</option>
                      <option value="INACTIVE">{label("statusInactive")}</option>
                      <option value="EXPIRED">{label("statusExpired")}</option>
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    {label("image")} <span className="text-rose-500">*</span>
                    <input type="file" accept="image/*" disabled={Boolean(editingPromotion)} onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} className="mt-1.5 block w-full text-sm font-normal text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50" />
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
                    <input type="checkbox" checked={form.isExclusive} onChange={(event) => setForm({ ...form, isExclusive: event.target.checked })} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    {label("exclusive")} <span className="text-rose-500">*</span>
                  </label>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 p-4">
                <div className="mb-4 border-b border-slate-100 pb-3">
                  <h4 className="text-sm font-bold text-slate-900">{label("sectionDiscount")}</h4>
                  <p className="mt-1 text-xs text-slate-500">{label("sectionDiscountDescription")}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700">
                    {label("scope")} <span className="text-rose-500">*</span>
                    <select required value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as PromotionScope })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal">
                      <option value="ROOM">{label("scopeRoom")}</option>
                      <option value="SERVICE">{label("scopeService")}</option>
                      <option value="TOTAL">{label("scopeTotal")}</option>
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    {label("discountType")} <span className="text-rose-500">*</span>
                    <select value={form.discountType} onChange={(event) => {
                      const discountType = event.target.value as PromotionDiscountType;
                      setForm({ ...form, discountType, ...(discountType === "FIXED_AMOUNT" ? { maxDiscountAmount: "" } : {}) });
                    }} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal">
                      <option value="PERCENTAGE">{label("percentage")}</option>
                      <option value="FIXED_AMOUNT">{label("fixedAmount")}</option>
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    {label("discountValue")} <span className="text-rose-500">*</span>
                    <div className="relative mt-1.5">
                      <input required type="number" min="0.01" max={form.discountType === "PERCENTAGE" ? "100" : undefined} step="0.01" value={form.discountValue} onChange={(event) => setForm({ ...form, discountValue: event.target.value })} className="h-10 w-full rounded-lg border border-slate-200 px-3 pr-10 text-sm font-normal" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">{form.discountType === "PERCENTAGE" ? "%" : "đ"}</span>
                    </div>
                  </label>
                  {form.discountType === "PERCENTAGE" && <label className="text-sm font-semibold text-slate-700">
                    {label("maxDiscountAmount")}
                    <div className="relative mt-1.5">
                      <input type="number" min="0" step="0.01" value={form.maxDiscountAmount} onChange={(event) => setForm({ ...form, maxDiscountAmount: event.target.value })} className="h-10 w-full rounded-lg border border-slate-200 px-3 pr-10 text-sm font-normal" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">đ</span>
                    </div>
                  </label>}
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 p-4">
                <div className="mb-4 border-b border-slate-100 pb-3">
                  <h4 className="text-sm font-bold text-slate-900">{label("sectionConditions")}</h4>
                  <p className="mt-1 text-xs text-slate-500">{label("sectionConditionsDescription")}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700">
                    {label("minBookingValue")} <span className="text-rose-500">*</span>
                    <input type="number" min="0" step="0.01" value={form.minBookingValue} onChange={(event) => setForm({ ...form, minBookingValue: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    {label("minRoomValue")} <span className="text-rose-500">*</span>
                    <input type="number" min="0" step="0.01" value={form.minRoomValue} onChange={(event) => setForm({ ...form, minRoomValue: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    {label("minServiceValue")} <span className="text-rose-500">*</span>
                    <input type="number" min="0" step="0.01" value={form.minServiceValue} onChange={(event) => setForm({ ...form, minServiceValue: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    {label("usageLimit")} <span className="text-rose-500">*</span>
                    <input type="number" min="1" step="1" value={form.usageLimit} onChange={(event) => setForm({ ...form, usageLimit: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    {label("fromDate")} <span className="text-rose-500">*</span>
                    <input required type="datetime-local" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal" />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    {label("toDate")} <span className="text-rose-500">*</span>
                    <input required type="datetime-local" min={form.startDate || undefined} value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal" />
                  </label>
                </div>
              </section>
            </div>
            {formError && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={isCreatingPromotion}
                className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600"
              >
                {label("cancel")}
              </button>
              <button
                type="submit"
                disabled={isCreatingPromotion}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreatingPromotion ? label("creating") : label(editingPromotion ? "update" : "save")}
              </button>
            </div>
          </form>
        </div>
      )}
      {detailPromotion && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="promotion-detail-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="promotion-detail-title" className="text-lg font-bold text-slate-900">
                  {label("detailTitle")}
                </h3>
                <p className="mt-1 text-sm text-slate-500">{detailPromotion.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailPromotion(null)}
                aria-label={t("common.close")}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            {detailPromotion.imageUrl && (
              <img src={detailPromotion.imageUrl} alt={detailPromotion.name} className="mt-5 max-h-56 w-full rounded-lg object-cover" />
            )}
            <div className="mt-5 space-y-4">
              <section className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
                <h4 className="mb-3 text-sm font-bold text-emerald-900">{label("detailSectionDiscount")}</h4>
                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  {[
                    ["code", detailPromotion.code || label("codeGenerated")],
                    ["discountType", label(isPercentageDiscount(detailPromotion.valueType) ? "percentage" : "fixedAmount")],
                    ["offerLevel", formatValue(detailPromotion)],
                    ...(isPercentageDiscount(detailPromotion.valueType) ? [["maxDiscountAmount", detailPromotion.maxDiscountAmount == null ? "-" : `${detailPromotion.maxDiscountAmount.toLocaleString("vi-VN")}đ`]] : []),
                  ].map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-xs font-semibold text-slate-500">{label(key)}</dt>
                      <dd className="mt-1 wrap-break-word text-sm font-medium text-slate-900">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
              <section className="rounded-xl border border-slate-200 p-4">
                <h4 className="mb-3 text-sm font-bold text-slate-900">{label("detailSectionConditions")}</h4>
                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  {[
                    ["scope", label(`scope${String(detailPromotion.type ?? "TOTAL").toLowerCase().replace(/^./, (letter) => letter.toUpperCase())}`)],
                    ["minBookingValue", Math.max(Number(detailPromotion.minimumOrderAmount ?? 0), Number(detailPromotion.minBookingValue ?? 0)) > 0 ? `${Math.max(Number(detailPromotion.minimumOrderAmount ?? 0), Number(detailPromotion.minBookingValue ?? 0)).toLocaleString("vi-VN")}đ` : "-"],
                    ["minRoomValue", detailPromotion.minRoomValue == null ? "-" : `${detailPromotion.minRoomValue.toLocaleString("vi-VN")}đ`],
                    ["minServiceValue", detailPromotion.minServiceValue == null ? "-" : `${detailPromotion.minServiceValue.toLocaleString("vi-VN")}đ`],
                    ["usageLimit", detailPromotion.usageLimit == null ? "-" : detailPromotion.usageLimit.toLocaleString("vi-VN")],
                    ["hotelName", detailPromotion.hotelName ?? (detailPromotion.hotelId == null ? "-" : String(detailPromotion.hotelId))],
                    ["exclusive", detailPromotion.isExclusive ? label("yes") : label("no")],
                  ].map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-xs font-semibold text-slate-500">{label(key)}</dt>
                      <dd className="mt-1 wrap-break-word text-sm font-medium text-slate-900">{value}</dd>
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-semibold text-slate-500">{label("description")}</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{detailPromotion.description || "-"}</dd>
                  </div>
                </dl>
              </section>
              <section className="rounded-xl border border-slate-200 p-4">
                <h4 className="mb-3 text-sm font-bold text-slate-900">{label("detailSectionValidity")}</h4>
                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  {[
                    ["status", label(`status${String(detailPromotion.status ?? (detailPromotion.active ? "ACTIVE" : "INACTIVE")).toLowerCase().replace(/^./, (letter) => letter.toUpperCase())}`)],
                    ["validity", `${formatDateTime(detailPromotion.startDate)} – ${formatDateTime(detailPromotion.endDate)}`],
                  ].map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs font-semibold text-slate-500">{label(key)}</dt>
                  <dd className="mt-1 wrap-break-word text-sm font-medium text-slate-900">{value}</dd>
                </div>
                  ))}
                </dl>
              </section>
            </div>
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={() => setDetailPromotion(null)} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">
                {label("closeDetails")}
              </button>
            </div>
          </section>
        </div>
      )}
      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <Tag size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">{label("programs")}</h3>
              <p className="mt-1 text-sm text-slate-500">{label("programsDescription")}</p>
            </div>
          </div>
          {canManagePromotions && <button onClick={openCreatePromotion} className="flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">
            <Plus size={16} />{label("create")}
          </button>}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="flex items-center gap-2">
              <DatePickerPopover
                iconOnly
                value={selectedDate}
                placeholder={label("selectDate")}
                onMonthChange={(nextMonth) => {
                  setCalendarMonth(nextMonth);
                  setIsDateFilterActive(false);
                  setPage(1);
                }}
                onChange={(nextDate) => {
                  if (!nextDate) return;
                  setSelectedDate(nextDate);
                  setCalendarMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
                  setIsDateFilterActive(true);
                  setPage(1);
                }}
                highlightDates={Object.keys(promotionDateMarkers)}
                highlightDateMarkers={promotionDateMarkers}
                buttonClassName="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white p-0 text-slate-700 shadow-2xs outline-none transition hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              <span className="text-sm font-semibold capitalize text-slate-700">{monthLabel}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-600" aria-label={label("promotionTypes")}>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-600" />{label("scopeRoom")}</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />{label("scopeService")}</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-600" />{label("scopeTotal")}</span>
            </div>
          </div>
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold text-slate-900">{label("codeList")}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {label("codeListDescription")}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <label className="relative block w-full sm:w-72">
            <span className="sr-only">{label("searchPromotion")}</span>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={label("searchPromotion")}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-10 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            {searchQuery && <button type="button" onClick={() => setSearchQuery("")} aria-label={label("clearSearch")} className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={15} /></button>}
          </label>
          <label>
            <span className="sr-only">{label("status")}</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              aria-label={label("status")}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:w-48"
            >
              <option value="ALL">{label("allPromotionStatuses")}</option>
              <option value="DRAFT">{label("statusDraft")}</option>
              <option value="ACTIVE">{label("statusActive")}</option>
              <option value="INACTIVE">{label("statusInactive")}</option>
              <option value="EXPIRED">{label("statusExpired")}</option>
            </select>
          </label>
          </div>
        </div>
        {isLoading ? (
          <p className="p-8 text-center text-sm text-slate-500">
            Đang tải danh sách khuyến mãi...
          </p>
        ) : isError ? (
          <p className="p-8 text-center text-sm text-rose-600">
            Không thể tải danh sách khuyến mãi.
          </p>
        ) : !hasHotelId ? (
          <p className="p-8 text-center text-sm text-slate-500">
            Chưa xác định được chi nhánh hiện tại.
          </p>
        ) : displayedPromotions.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            Chi nhánh chưa có khuyến mãi.
          </p>
        ) : visiblePromotions.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">{normalizedSearchQuery || statusFilter !== "ALL" ? label("noPromotionsMatchingFilters") : label(isDateFilterActive ? "noPromotionsOnDate" : "noPromotionsThisMonth")}</p>
        ) : (
          <>
            <div className="divide-y divide-slate-100">
              {paginatedPromotions.map((promotion) => {
                const scope = promotionScopeOf(promotion);
                const status = promotionStatusOf(promotion);
                return (
                <article
                  key={promotion.id}
                  className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <div className={`grid h-10 w-10 place-items-center rounded-xl ${scopeColorClasses[scope]}`}>
                      <Tag size={18} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-slate-900">
                          {promotion.name}
                        </h4>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${scopeColorClasses[scope]}`}>
                          {label(scopeLabelKeys[scope])}
                        </span>
                        {promotion.code ? (
                          <button
                            type="button"
                            onClick={() => copyCode(promotion.code)}
                            title={label("copyCode")}
                            className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600"
                          >
                            <Copy size={11} />
                            {copied === promotion.code ? label("copied") : promotion.code}
                          </button>
                        ) : <span className="text-xs text-slate-400">{label("codeGenerated")}</span>}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {promotion.description}
                      </p>
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
                        <CalendarDays size={13} />
                        {formatDate(promotion.startDate)} –{" "}
                        {formatDate(promotion.endDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-end">
                    <div>
                      <p className="text-xs text-slate-400">
                        {label("offerLevel")}
                      </p>
                      <p className="mt-1 text-xl font-bold text-slate-900">
                        {formatValue(promotion)}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1.5 text-xs font-semibold ${statusBadgeClass(promotion)}`}>
                      {label(`status${status.charAt(0)}${status.slice(1).toLowerCase()}`)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDetailPromotion(promotion)}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Eye size={14} />
                      {label("viewDetails")}
                    </button>
                    {canManagePromotions && <button
                      type="button"
                      onClick={() => openEditPromotion(promotion)}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Pencil size={14} />
                      {label("edit")}
                    </button>}
                  </div>
                </article>
                );
              })}
            </div>
            {visiblePromotions.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-slate-100 p-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  {label("showingPromotions", {
                    from: String((safePage - 1) * pageSize + 1),
                    to: String(Math.min(safePage * pageSize, visiblePromotions.length)),
                    total: String(visiblePromotions.length),
                  })}
                </span>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2">
                    Số dòng
                    <select
                      value={pageSize}
                      onChange={(event) =>
                        setPageSize(Number(event.target.value))
                      }
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                    disabled={safePage === 1}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Trang trước"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="min-w-16 text-center font-semibold text-slate-700">
                    {safePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPage((current) => Math.min(totalPages, current + 1))
                    }
                    disabled={safePage === totalPages}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Trang sau"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
