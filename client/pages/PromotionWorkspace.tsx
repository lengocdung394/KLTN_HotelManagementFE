import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { CalendarDays, Copy, Eye, Pencil, Plus, Search, Tag, X } from "lucide-react";
import ListPagination from "../components/ListPagination";
import { toast } from "@/components/ui/use-toast";
import DatePickerPopover from "../components/DatePickerPopover";
import { useCreatePromotionMutation, useGetPromotionSummaryQuery, useGetPromotionsQuery, useUpdatePromotionMutation, type CreatePromotionRequest, type Promotion, type PromotionDiscountType, type PromotionScope, type PromotionStatus } from "../services/promotionApi";
import { useGetHotelReportQuery } from "../services/reportApi";
import { bindHotelSocketEvents } from "../lib/socket";
import { baseApi } from "../services/baseApi";
import type { SuperAdminBranch } from "../services/superAdminApi";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import SearchableFilter, { FilterResetButton } from "../components/SearchableFilter";
import ClearSearchButton from "../components/ClearSearchButton";
import FilterResultStatus from "../components/FilterResultStatus";

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
type PromotionFormField = keyof PromotionFormValues;
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

const isPromotionUsed = (promotion: Promotion) => Number(promotion.usedCount ?? 0) > 0;

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
  if (!error || typeof error !== "object") return "Không thể lưu khuyến mãi. Vui lòng thử lại.";
  const data = "data" in error ? error.data : undefined;
  if (typeof data === "string") return data;
  if (data && typeof data === "object" && "message" in data && typeof data.message === "string") return data.message;
  if ("error" in error && typeof error.error === "string") return error.error;
  return "Không thể lưu khuyến mãi. Vui lòng thử lại.";
};

const isPercentageDiscount = (valueType: unknown) => String(valueType ?? "").toUpperCase().includes("PERCENT");

export default function PromotionWorkspace({ branches = [] }: { branches?: SuperAdminBranch[] }) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { hotelId, roles } = useAppSelector((state) => state.auth);
  const isSystemAdmin = roles.includes("ROLE_SUPER_ADMIN");
  const canManagePromotions = roles.includes("ROLE_MANAGER") || roles.includes("ROLE_SUPER_ADMIN");
  const hasHotelId = Boolean(hotelId) && !Number.isNaN(Number(hotelId));
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [targetHotelId, setTargetHotelId] = useState("");
  const { data: apiPromotions = [], isLoading, isError } = useGetPromotionsQuery(
    isSystemAdmin
      ? { ...(selectedBranchId ? { hotelId: Number(selectedBranchId) } : {}), page: 0, size: 100 }
      : hasHotelId ? { hotelId: Number(hotelId), page: 0, size: 100 } : undefined,
    { skip: !hasHotelId && !isSystemAdmin },
  );
  const [createPromotion, { isLoading: isCreatingPromotion }] = useCreatePromotionMutation();
  const [updatePromotion, { isLoading: isUpdatingPromotion }] = useUpdatePromotionMutation();
  const isSavingPromotion = isCreatingPromotion || isUpdatingPromotion;
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailPromotion, setDetailPromotion] = useState<Promotion | null>(null);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [form, setForm] = useState<PromotionFormValues>(initialForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<PromotionFormField, string>>>({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [formError, setFormError] = useState("");
  const pendingLocalPromotionName = useRef("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | PromotionStatus>("ALL");
  const [scopeFilter, setScopeFilter] = useState<"ALL" | PromotionScope>("ALL");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [isDateFilterActive, setIsDateFilterActive] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const summaryMonth = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}`;
  const {
    data: promotionSummary,
    isLoading: isPromotionSummaryLoading,
    isError: isPromotionSummaryError,
    refetch: refetchPromotionSummary,
  } = useGetPromotionSummaryQuery({
    month: summaryMonth,
    ...(isSystemAdmin && selectedBranchId
      ? { hotelId: Number(selectedBranchId) }
      : !isSystemAdmin && hasHotelId
        ? { hotelId: Number(hotelId) }
        : {}),
  }, { skip: !hasHotelId && !isSystemAdmin });

  const displayedPromotions = promotions.length > 0 ? promotions : apiPromotions;
  const locale = i18n.resolvedLanguage?.startsWith("en") ? "en-US" : "vi-VN";
  const monthStartKey = dateKey(calendarMonth);
  const monthEndKey = dateKey(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0));
  const {
    data: promotionUsageReport,
    isLoading: isPromotionUsageLoading,
    isError: isPromotionUsageError,
  } = useGetHotelReportQuery({
    startDate: monthStartKey,
    endDate: monthEndKey,
    ...(isSystemAdmin && selectedBranchId
      ? { hotelId: Number(selectedBranchId) }
      : !isSystemAdmin && hasHotelId
        ? { hotelId: Number(hotelId) }
        : {}),
  }, { skip: !hasHotelId && !isSystemAdmin });
  const promotionSavingsById = new Map(
    (promotionUsageReport?.promotions ?? []).map((promotion) => [promotion.promotionId, promotion.savings]),
  );
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
    const matchesScope = scopeFilter === "ALL" || promotionScopeOf(promotion) === scopeFilter;
    const matchesSearch = `${promotion.name} ${promotion.code} ${promotion.description} ${promotion.type}`
      .toLocaleLowerCase("vi-VN")
      .includes(normalizedSearchQuery);
    return matchesStatus && matchesScope && matchesSearch;
  });
  const totalPages = Math.max(1, Math.ceil(visiblePromotions.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedPromotions = visiblePromotions.slice((safePage - 1) * pageSize, safePage * pageSize);
  const monthLabel = calendarMonth.toLocaleDateString(locale, { month: "long", year: "numeric" });
  const summaryCards = [
    {
      label: "Đang hoạt động",
      value: promotionSummary?.activePromotions,
      format: (value: number) => value.toLocaleString(locale),
      accent: true,
    },
    {
      label: `Lượt sử dụng tháng ${calendarMonth.getMonth() + 1}`,
      value: promotionSummary?.monthlyUsageCount,
      format: (value: number) => value.toLocaleString(locale),
    },
    {
      label: "Tiết kiệm cho khách",
      value: promotionSummary?.monthlySavingsAmount,
      format: (value: number) => `${value.toLocaleString(locale)}đ`,
    },
    {
      label: "Sắp hết hạn (7 ngày tới)",
      value: promotionSummary?.expiringSoonPromotions,
      format: (value: number) => value.toLocaleString(locale),
    },
  ];

  useEffect(() => {
    setPage(1);
  }, [displayedPromotions.length, pageSize, calendarMonth, isDateFilterActive, selectedDate, searchQuery, statusFilter, scopeFilter]);

  useEffect(() => {
    if (!hasHotelId && !isSystemAdmin) return;
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
  }, [dispatch, hasHotelId, isSystemAdmin, t]);

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
  const requiredMinimumField: PromotionFormField = form.type === "ROOM"
    ? "minRoomValue"
    : form.type === "SERVICE" ? "minServiceValue" : "minBookingValue";
  const updateFormField = <K extends PromotionFormField>(field: K, value: PromotionFormValues[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => {
      const next = { ...current };
      delete next[field];
      if (field === "startDate") delete next.endDate;
      return next;
    });
    setFormError("");
  };
  const openCreatePromotion = () => {
    setEditingPromotion(null);
    setForm(initialForm);
    setFormErrors({});
    setTargetHotelId("");
    setImageFile(null);
    setFormError("");
    setModalOpen(true);
  };
  const openEditPromotion = (promotion: Promotion) => {
    if (isPromotionExpired(promotion) || isPromotionUsed(promotion)) return;
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
    setFormErrors({});
    setModalOpen(true);
  };
  const addPromotion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    const errors: Partial<Record<PromotionFormField, string>> = {};
    if (!form.name.trim()) errors.name = label("fieldRequired", { field: label("programName") });
    if (!form.startDate) errors.startDate = label("fieldRequired", { field: label("fromDate") });
    if (!form.endDate) errors.endDate = label("fieldRequired", { field: label("toDate") });
    if (form.startDate && form.endDate && new Date(form.startDate).getTime() >= new Date(form.endDate).getTime()) {
      errors.endDate = label("invalidDateRange");
    }
    const discountValue = Number(form.discountValue);
    if (!Number.isFinite(discountValue) || discountValue <= 0 || (form.discountType === "PERCENTAGE" && discountValue > 100)) {
      errors.discountValue = label("invalidDiscountValue");
    }
    const minimumFields = ["minBookingValue", "minRoomValue", "minServiceValue"] as const;
    for (const field of minimumFields) {
      const value = form[field];
      if (field === requiredMinimumField && !value.trim()) {
        errors[field] = label("fieldRequired", { field: label(field) });
      } else if (value.trim() && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
        errors[field] = label("invalidMinimumAmount");
      }
    }
    if (form.discountType === "PERCENTAGE") {
      if (!form.maxDiscountAmount.trim()) {
        errors.maxDiscountAmount = label("fieldRequired", { field: label("maxDiscountAmount") });
      } else if (!Number.isFinite(Number(form.maxDiscountAmount)) || Number(form.maxDiscountAmount) <= 0) {
        errors.maxDiscountAmount = label("invalidMaxDiscountAmount");
      }
    }
    if (form.usageLimit.trim() && (!Number.isInteger(Number(form.usageLimit)) || Number(form.usageLimit) < 1)) {
      errors.usageLimit = label("invalidUsageLimit");
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
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
      isExclusive: editingPromotion ? form.isExclusive : false,
    };

    if (editingPromotion) {
      try {
        await updatePromotion({
          id: editingPromotion.id,
          promotionInfo,
          image: imageFile ?? undefined,
        }).unwrap();
        setPromotions([]);
        setForm(initialForm);
        setImageFile(null);
        setEditingPromotion(null);
        setModalOpen(false);
        toast({ variant: "promotion", title: label("updatedSuccessfully") });
      } catch (error) {
        const message = promotionErrorMessage(error);
        setFormError(message);
        toast({ variant: "destructive", title: label("updateFailed"), description: message });
      }
      return;
    }

    try {
      pendingLocalPromotionName.current = promotionInfo.name;
      const createdPromotion = await createPromotion({
        promotionInfo,
        image: imageFile ?? undefined,
        ...(isSystemAdmin && targetHotelId ? { hotelId: Number(targetHotelId) } : {}),
      }).unwrap();
      window.setTimeout(() => {
        if (pendingLocalPromotionName.current === promotionInfo.name) pendingLocalPromotionName.current = "";
      }, 5000);
      setPromotions([]);
      setForm(initialForm);
      setImageFile(null);
      setEditingPromotion(null);
      setModalOpen(false);
      toast({
        variant: "promotion",
        title: label("createdSuccessfully"),
        description: (
          <div className="grid gap-1.5">
            <p>
              <span className="font-medium">{label("nameLabel")}</span>{" "}
              <span className="font-semibold">{createdPromotion.name || promotionInfo.name}</span>
            </p>
            <p>
              <span className="font-medium">{label("codeLabel")}</span>{" "}
              <span className="inline-flex rounded-md bg-white/70 px-1.5 py-0.5 font-mono font-semibold tracking-wide">
                {createdPromotion.code || "—"}
              </span>
            </p>
          </div>
        ),
      });
    } catch (error) {
      pendingLocalPromotionName.current = "";
      const message = promotionErrorMessage(error);
      setFormError(message);
      toast({ variant: "destructive", title: label("createFailed"), description: message });
    }
  };
  return (
    <div className="mt-2 space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Thống kê khuyến mãi">
        {summaryCards.map((card) => (
          <div key={card.label} className={`rounded-xl border border-slate-200/80 p-4 shadow-sm ${card.accent ? "bg-[#28233f] text-white" : "bg-white"}`}>
            <p className={`text-xs font-medium ${card.accent ? "text-blue-200" : "text-slate-500"}`}>{card.label}</p>
            <p className="mt-2 text-xl font-bold tracking-tight">
              {isPromotionSummaryLoading ? "Đang tải…" : isPromotionSummaryError || card.value === undefined ? "—" : card.format(card.value)}
            </p>
            <p className={`mt-1 text-[11px] ${card.accent ? "text-blue-200" : "text-slate-400"}`}>
              {card.label === "Tiết kiệm cho khách" || card.label.startsWith("Lượt sử dụng")
                ? monthLabel
                : "Dữ liệu cập nhật từ hệ thống"}
            </p>
          </div>
        ))}
      </section>
      {isPromotionSummaryError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span>Không tải được thống kê khuyến mãi.</span>
          <button type="button" onClick={() => void refetchPromotionSummary()} className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-rose-100">
            Thử tải lại
          </button>
        </div>
      )}
      {modalOpen && createPortal((
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4">
          <form
            onSubmit={addPromotion}
            noValidate
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
                  {isSystemAdmin && !editingPromotion && (
                    <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                      {label("promotionTarget")}
                      <select
                        value={targetHotelId}
                        onChange={(event) => setTargetHotelId(event.target.value)}
                        className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal"
                      >
                        <option value="">{label("allSystemBranches")}</option>
                        {branches.map((branch) => (
                          <option key={branch.id} value={String(branch.id)}>{branch.name}</option>
                        ))}
                      </select>
                      <span className="mt-1 block text-xs font-normal text-slate-500">
                        {targetHotelId ? label("branchPromotionNotice") : label("systemPromotionNotice")}
                      </span>
                    </label>
                  )}
                  <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                    {label("programName")} <span className="text-rose-500">*</span>
                    <input value={form.name} maxLength={200} onChange={(event) => updateFormField("name", event.target.value)} placeholder={label("exampleWeekendOffer")} aria-invalid={Boolean(formErrors.name)} className={`mt-1.5 h-10 w-full rounded-lg border px-3 text-sm font-normal ${formErrors.name ? "border-rose-400" : "border-slate-200"}`} />
                    {formErrors.name && <span className="mt-1 block text-xs font-normal text-rose-600">{formErrors.name}</span>}
                  </label>
                  <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                    {label("description")} <span className="text-xs font-normal text-slate-400">({label("optional")})</span>
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
                    {label("image")} <span className="text-xs font-normal text-slate-400">({label("optional")})</span>
                    <input type="file" accept="image/*" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} className="mt-1.5 block w-full text-sm font-normal text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700 hover:file:bg-blue-100" />
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
                    <select value={form.type} onChange={(event) => { setForm({ ...form, type: event.target.value as PromotionScope }); setFormErrors({}); }} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal">
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
                      setFormErrors((current) => ({ ...current, discountValue: undefined, maxDiscountAmount: undefined }));
                    }} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal">
                      <option value="PERCENTAGE">{label("percentage")}</option>
                      <option value="FIXED_AMOUNT">{label("fixedAmount")}</option>
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    {label("discountValue")} <span className="text-rose-500">*</span>
                    <div className="relative mt-1.5">
                    <input type="number" min="0.01" max={form.discountType === "PERCENTAGE" ? "100" : undefined} step="0.01" value={form.discountValue} onChange={(event) => updateFormField("discountValue", event.target.value)} aria-invalid={Boolean(formErrors.discountValue)} className={`h-10 w-full rounded-lg border px-3 pr-10 text-sm font-normal ${formErrors.discountValue ? "border-rose-400" : "border-slate-200"}`} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">{form.discountType === "PERCENTAGE" ? "%" : "đ"}</span>
                    </div>
                  {formErrors.discountValue && <span className="mt-1 block text-xs font-normal text-rose-600">{formErrors.discountValue}</span>}
                  </label>
                  {form.discountType === "PERCENTAGE" && <label className="text-sm font-semibold text-slate-700">
                    {label("maxDiscountAmount")} <span className="text-rose-500">*</span>
                    <div className="relative mt-1.5">
                      <input type="number" min="0.01" step="0.01" value={form.maxDiscountAmount} onChange={(event) => updateFormField("maxDiscountAmount", event.target.value)} aria-invalid={Boolean(formErrors.maxDiscountAmount)} className={`h-10 w-full rounded-lg border px-3 pr-10 text-sm font-normal ${formErrors.maxDiscountAmount ? "border-rose-400" : "border-slate-200"}`} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">đ</span>
                    </div>
                    {formErrors.maxDiscountAmount && <span className="mt-1 block text-xs font-normal text-rose-600">{formErrors.maxDiscountAmount}</span>}
                  </label>}
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 p-4">
                <div className="mb-4 border-b border-slate-100 pb-3">
                  <h4 className="text-sm font-bold text-slate-900">{label("sectionConditions")}</h4>
                  <p className="mt-1 text-xs text-slate-500">{label("sectionConditionsDescription")}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {([requiredMinimumField, ...(["minBookingValue", "minRoomValue", "minServiceValue"] as const).filter((field) => field !== requiredMinimumField)]).map((field) => {
                    const isRequired = field === requiredMinimumField;
                    return <label key={field} className="text-sm font-semibold text-slate-700">
                      {label(field)} {isRequired
                        ? <span className="text-rose-500">*</span>
                        : <span className="text-xs font-normal text-slate-400">({label("optional")})</span>}
                      <input type="number" min="0" step="0.01" value={form[field]} onChange={(event) => updateFormField(field, event.target.value)} aria-invalid={Boolean(formErrors[field])} className={`mt-1.5 h-10 w-full rounded-lg border px-3 text-sm font-normal ${formErrors[field] ? "border-rose-400" : "border-slate-200"}`} />
                      {formErrors[field] && <span className="mt-1 block text-xs font-normal text-rose-600">{formErrors[field]}</span>}
                    </label>;
                  })}
                  <label className="text-sm font-semibold text-slate-700">
                    {label("usageLimit")} <span className="text-xs font-normal text-slate-400">({label("optional")})</span>
                    <input type="number" min="1" step="1" value={form.usageLimit} onChange={(event) => updateFormField("usageLimit", event.target.value)} aria-invalid={Boolean(formErrors.usageLimit)} className={`mt-1.5 h-10 w-full rounded-lg border px-3 text-sm font-normal ${formErrors.usageLimit ? "border-rose-400" : "border-slate-200"}`} />
                    {formErrors.usageLimit && <span className="mt-1 block text-xs font-normal text-rose-600">{formErrors.usageLimit}</span>}
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    {label("fromDate")} <span className="text-rose-500">*</span>
                    <input type="datetime-local" value={form.startDate} onChange={(event) => updateFormField("startDate", event.target.value)} aria-invalid={Boolean(formErrors.startDate)} className={`mt-1.5 h-10 w-full rounded-lg border bg-white px-3 text-sm font-normal ${formErrors.startDate ? "border-rose-400" : "border-slate-200"}`} />
                    {formErrors.startDate && <span className="mt-1 block text-xs font-normal text-rose-600">{formErrors.startDate}</span>}
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    {label("toDate")} <span className="text-rose-500">*</span>
                    <input type="datetime-local" min={form.startDate || undefined} value={form.endDate} onChange={(event) => updateFormField("endDate", event.target.value)} aria-invalid={Boolean(formErrors.endDate)} className={`mt-1.5 h-10 w-full rounded-lg border bg-white px-3 text-sm font-normal ${formErrors.endDate ? "border-rose-400" : "border-slate-200"}`} />
                    {formErrors.endDate && <span className="mt-1 block text-xs font-normal text-rose-600">{formErrors.endDate}</span>}
                  </label>
                </div>
              </section>
            </div>
            {Object.keys(formErrors).length > 0 && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{label("formHasErrors")}</p>}
            {formError && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={isSavingPromotion}
                className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600"
              >
                {label("cancel")}
              </button>
              <button
                type="submit"
                disabled={isSavingPromotion}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingPromotion ? label("creating") : label(editingPromotion ? "update" : "save")}
              </button>
            </div>
          </form>
        </div>
      ), document.body)}
      {detailPromotion && createPortal((
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
                    ["claimedCount", (detailPromotion.claimedCount ?? 0).toLocaleString(locale)],
                    ["usedCount", (detailPromotion.usedCount ?? 0).toLocaleString(locale)],
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
      ), document.body)}
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
            {isSystemAdmin && (
              <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <span>Chi nhánh</span>
                <select
                  value={selectedBranchId}
                  onChange={(event) => setSelectedBranchId(event.target.value)}
                  aria-label="Lọc khuyến mãi theo chi nhánh"
                  className="h-10 min-w-48 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Tất cả chi nhánh</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              </label>
            )}
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
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={label("searchPromotion")}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-10 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <ClearSearchButton value={searchQuery} onClear={() => setSearchQuery("")} label={t("common.clearSearch")} />
          </label>
          <SearchableFilter
            ariaLabel={label("scope")}
            searchPlaceholder={label("searchScopeFilter")}
            emptyMessage={label("noFilterOptions")}
            value={scopeFilter}
            onChange={(value) => setScopeFilter(value as typeof scopeFilter)}
            className="w-full sm:w-44"
            options={[
              { value: "ALL", label: label("allPromotionScopes") },
              { value: "ROOM", label: label("scopeRoom") },
              { value: "SERVICE", label: label("scopeService") },
              { value: "TOTAL", label: label("scopeTotal") },
            ]}
          />
          <SearchableFilter
            ariaLabel={label("status")}
            searchPlaceholder={label("searchStatusFilter")}
            emptyMessage={label("noFilterOptions")}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as typeof statusFilter)}
            className="w-full sm:w-48"
            options={[
              { value: "ALL", label: label("allPromotionStatuses") },
              { value: "DRAFT", label: label("statusDraft") },
              { value: "ACTIVE", label: label("statusActive") },
              { value: "INACTIVE", label: label("statusInactive") },
              { value: "EXPIRED", label: label("statusExpired") },
            ]}
          />
          {(searchQuery || scopeFilter !== "ALL" || statusFilter !== "ALL") && <FilterResetButton
            label={t("common.resetFilter")}
            onClick={() => {
              setSearchQuery("");
              setScopeFilter("ALL");
              setStatusFilter("ALL");
            }}
          />}
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
        ) : !hasHotelId && !isSystemAdmin ? (
          <p className="p-8 text-center text-sm text-slate-500">
            Chưa xác định được chi nhánh hiện tại.
          </p>
        ) : displayedPromotions.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            Chi nhánh chưa có khuyến mãi.
          </p>
        ) : visiblePromotions.length === 0 ? (
          <FilterResultStatus filterKey={JSON.stringify([searchQuery, statusFilter, scopeFilter, selectedDate, isDateFilterActive])}><p className="p-8 text-center text-sm text-slate-500">{normalizedSearchQuery || statusFilter !== "ALL" || scopeFilter !== "ALL" ? label("noPromotionsMatchingFilters") : label(isDateFilterActive ? "noPromotionsOnDate" : "noPromotionsThisMonth")}</p></FilterResultStatus>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                  <tr>
                    <th scope="col" className="whitespace-nowrap px-5 py-3">{label("programName")}</th>
                    <th scope="col" className="whitespace-nowrap px-5 py-3">{label("scope")}</th>
                    <th scope="col" className="whitespace-nowrap px-5 py-3">{label("validity")}</th>
                    <th scope="col" className="whitespace-nowrap px-5 py-3 text-right">{label("offerLevel")}</th>
                    <th scope="col" className="whitespace-nowrap px-5 py-3 text-right">{label("claimedCount")}</th>
                    <th scope="col" className="whitespace-nowrap px-5 py-3 text-right">{label("usedCount")}</th>
                    <th scope="col" className="whitespace-nowrap px-5 py-3 text-right">{label("usedValue")}</th>
                    <th scope="col" className="whitespace-nowrap px-5 py-3">{label("status")}</th>
                    <th scope="col" className="whitespace-nowrap px-5 py-3 text-right">{label("actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedPromotions.map((promotion) => {
                    const scope = promotionScopeOf(promotion);
                    const status = promotionStatusOf(promotion);
                    const expired = isPromotionExpired(promotion);
                    const used = isPromotionUsed(promotion);
                    const editDisabledReason = expired ? label("editDisabledExpired") : label("editDisabledUsed");
                    return (
                      <tr key={promotion.id} className="text-slate-700 transition hover:bg-slate-50/70">
                        <td className="max-w-80 px-5 py-3">
                          <p className="truncate font-semibold text-slate-900" title={promotion.name}>{promotion.name}</p>
                          {promotion.description && <p className="mt-1 truncate text-xs text-slate-500" title={promotion.description}>{promotion.description}</p>}
                          {promotion.code ? (
                            <button
                              type="button"
                              onClick={() => copyCode(promotion.code)}
                              title={label("copyCode")}
                              className="mt-1 inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 transition hover:bg-slate-200"
                            >
                              <Copy size={11} />
                              {copied === promotion.code ? label("copied") : promotion.code}
                            </button>
                          ) : <span className="mt-1 inline-block text-xs text-slate-400">{label("codeGenerated")}</span>}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${scopeColorClasses[scope]}`}>
                            {label(scopeLabelKeys[scope])}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                          <span className="inline-flex items-center gap-1.5"><CalendarDays size={13} className="text-slate-400" />{formatDate(promotion.startDate)} – {formatDate(promotion.endDate)}</span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right font-bold text-slate-900">{formatValue(promotion)}</td>
                        <td className="px-5 py-3 text-right tabular-nums">{(promotion.claimedCount ?? 0).toLocaleString(locale)}</td>
                        <td className="px-5 py-3 text-right tabular-nums">{(promotion.usedCount ?? 0).toLocaleString(locale)}</td>
                        <td className="whitespace-nowrap px-5 py-3 text-right font-semibold tabular-nums text-slate-700">
                          {isPromotionUsageLoading
                            ? "…"
                            : isPromotionUsageError
                              ? "—"
                              : `${(promotionSavingsById.get(promotion.id) ?? 0).toLocaleString(locale)}${locale === "en-US" ? " VND" : "đ"}`}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(promotion)}`}>
                            {label(`status${status.charAt(0)}${status.slice(1).toLowerCase()}`)}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="grid grid-cols-[80px_96px] justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setDetailPromotion(promotion)}
                              className="inline-flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-blue-200 px-2 py-2 text-xs font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
                            >
                              <Eye size={14} />
                              {label("viewDetails")}
                            </button>
                            {canManagePromotions && (isSystemAdmin || promotion.hotelId != null) ? (
                              <span
                                className="block"
                                title={expired || used ? editDisabledReason : undefined}
                                aria-label={expired || used ? editDisabledReason : undefined}
                                tabIndex={expired || used ? 0 : undefined}
                              >
                                <button
                                  type="button"
                                  disabled={expired || used}
                                  onClick={() => openEditPromotion(promotion)}
                                  className="inline-flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-200 px-2 py-2 text-xs font-semibold text-amber-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-60 disabled:hover:border-slate-200 disabled:hover:bg-slate-100"
                                >
                                  <Pencil size={16} className="shrink-0" aria-hidden="true" />
                                  {label("edit")}
                                </button>
                              </span>
                            ) : <span aria-hidden="true" />}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {isPromotionUsageError && (
              <p role="alert" className="border-t border-rose-100 px-5 py-3 text-xs text-rose-700">
                {label("usageValueLoadError")}
              </p>
            )}
            <ListPagination totalItems={visiblePromotions.length} page={safePage} pageSize={pageSize} mode="table" onPageChange={setPage} onPageSizeChange={setPageSize} />
          </>
        )}
      </section>
    </div>
  );
}
