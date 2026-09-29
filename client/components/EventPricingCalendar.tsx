import { useEffect, useMemo, useRef, useState } from "react";
import DatePickerPopover from "./DatePickerPopover";
import { toast } from "../hooks/use-toast";
import { bindHotelSocketEvents, SEASONAL_RATE_UPDATE_EVENT } from "../lib/socket";
import { useSelector } from "react-redux";
import { useCreateRoomSeasonalRateMutation, useGetRoomSeasonalRatesByMonthQuery, useUpdateRoomSeasonalRateMutation, type RoomSeasonalRate } from "../services/roomApi";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  Sparkles,
  Tag,
  Trash2,
  X,
  TrendingUp,
  TrendingDown,
  Layers,
  Info,
  Pencil,
  Search,
  BedDouble,
  Clock,
  BadgePercent,
} from "lucide-react";

type RoomType = "Standard Room" | "Deluxe Room" | "Suite Room" | "Family Room";

const roomTypesList: RoomType[] = [
  "Standard Room",
  "Deluxe Room",
  "Suite Room",
  "Family Room",
];


const roomTypeThemeStyles: Record<RoomType, { bg: string; border: string; text: string; badge: string }> = {
  "Standard Room": {
    bg: "bg-blue-50/50",
    border: "border-blue-200",
    text: "text-blue-900",
    badge: "bg-blue-100 text-blue-800",
  },
  "Deluxe Room": {
    bg: "bg-amber-50/50",
    border: "border-amber-200",
    text: "text-amber-900",
    badge: "bg-amber-100 text-amber-800",
  },
  "Suite Room": {
    bg: "bg-purple-50/50",
    border: "border-purple-200",
    text: "text-purple-900",
    badge: "bg-purple-100 text-purple-800",
  },
  "Family Room": {
    bg: "bg-emerald-50/50",
    border: "border-emerald-200",
    text: "text-emerald-900",
    badge: "bg-emerald-100 text-emerald-800",
  },
};

export type PriceEventRule = {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  roomTypes: string[]; // ["Standard Room", ...] or ["ALL"]
  modifierType: "PERCENT" | "FIXED";
  percentValue: number; // fallback overall percent
  fixedPrices: Record<string, number>;
  colorTheme: "amber" | "emerald" | "purple" | "rose" | "blue";
  roomTypeAdjustments?: Record<string, number>; // roomType -> percentValue
  recordIds?: Record<string, number | string | null>;
};

type PricingGroupForm = {
  id: string;
  roomTypes: string[]; // ["ALL"] or ["Standard Room", ...]
  percentValue: string;
};

const colorThemeHeader: Record<string, string> = {
  amber: "from-orange-50/80 via-orange-50 to-amber-50/60 border-orange-100 text-orange-900",
  emerald: "from-emerald-50/80 via-emerald-50 to-lime-50/60 border-emerald-100 text-emerald-900",
  purple: "from-violet-50/80 via-violet-50/40 to-violet-50/80 border-violet-100 text-violet-900",
  rose: "from-rose-50/80 via-rose-50/40 to-rose-50/80 border-rose-100 text-rose-900",
  blue: "from-blue-50/80 via-sky-50/80 to-blue-50/80 border-blue-100 text-blue-900",
};

const statusColorHeader: Record<"ACTIVE" | "UPCOMING" | "EXPIRED", string> = {
  ACTIVE: "from-emerald-50/80 via-emerald-50 to-lime-50/60 border-emerald-100 text-emerald-900",
  UPCOMING: "from-blue-50/80 via-sky-50/80 to-blue-50/80 border-blue-100 text-blue-900",
  EXPIRED: "from-orange-50/80 via-orange-50 to-amber-50/60 border-orange-100 text-orange-900",
};

const money = (value: number) => value.toLocaleString("vi-VN") + "đ";

const normalizeDateKey = (value: string | null | undefined) => {
  if (!value) return "";

  const trimmed = String(value).trim();
  if (!trimmed) return "";

  const isoMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}/);
  const dateFromIso = isoMatch ? isoMatch[0] : trimmed.split("T")[0];

  if (dateFromIso && /^\d{4}-\d{2}-\d{2}$/.test(dateFromIso)) {
    return dateFromIso;
  }

  const slashMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${String(Number(month)).padStart(2, "0")}-${String(Number(day)).padStart(2, "0")}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
};

const mapRoomTypeLabel = (value: string) => {
  const normalized = String(value).trim().toUpperCase();
  const roomTypeMap: Record<string, string> = {
    STANDARD: "Standard Room",
    DELUXE: "Deluxe Room",
    SUITE: "Suite Room",
    FAMILY: "Family Room",
  };

  return roomTypeMap[normalized] ?? value;
};

const mapRoomTypeToEnum = (value: string) => {
  const normalized = String(value).trim().toUpperCase();
  const roomTypeEnumMap: Record<string, string> = {
    "STANDARD ROOM": "STANDARD",
    "DELUXE ROOM": "DELUXE",
    "SUITE ROOM": "SUITE",
    "FAMILY ROOM": "FAMILY",
    STANDARD: "STANDARD",
    DELUXE: "DELUXE",
    SUITE: "SUITE",
    FAMILY: "FAMILY",
    ALL: "ALL",
  };

  return roomTypeEnumMap[normalized] ?? normalized;
};

const mapRoomSeasonalRateToEvent = (item: RoomSeasonalRate): PriceEventRule => {
  const rawRoomTypeValues = Array.isArray(item.roomTypes)
    ? item.roomTypes
    : typeof item.roomTypes === "string"
      ? item.roomTypes.split(",")
      : typeof item.roomType === "string"
        ? [item.roomType]
        : Array.isArray(item.roomType)
          ? item.roomType
          : ["ALL"];

  const normalizedRoomTypes = rawRoomTypeValues
    .map((value) => mapRoomTypeLabel(String(value).trim()))
    .filter(Boolean);

  const absolutePrice = Number(item.price ?? item.value ?? 0);
  const computedPercent = Number(item.percentValue ?? 0);

  const roomTypeAdjustments = normalizedRoomTypes.length > 0
    ? Object.fromEntries(normalizedRoomTypes.map((roomType) => [roomType, computedPercent]))
    : undefined;

  const value = Number(item.percentValue ?? computedPercent ?? 0);
  const colorTheme = (item.colorTheme as "amber" | "emerald" | "purple" | "rose" | "blue") ?? (value >= 0 ? "amber" : "emerald");

  return {
    id: String(item.id ?? `evt-${Date.now()}`),
    name: String(item.rateName ?? item.name ?? "Sự kiện giá"),
    startDate: String(item.startDate ?? ""),
    endDate: String(item.endDate ?? ""),
    roomTypes: normalizedRoomTypes.length > 0 ? normalizedRoomTypes : ["ALL"],
    modifierType: "PERCENT",
    percentValue: value,
    roomTypeAdjustments,
    fixedPrices: item.fixedPrices ?? {},
    colorTheme: colorTheme in colorThemeHeader ? colorTheme : "emerald",
  };
};

const groupSeasonalRatesToEvents = (rates: RoomSeasonalRate[]): PriceEventRule[] => {
  if (!rates || rates.length === 0) return [];

  const groupsMap = new Map<string, RoomSeasonalRate[]>();

  rates.forEach((item) => {
    const name = String(item.rateName ?? item.name ?? "Sự kiện giá").trim();
    const startDate = String(item.startDate ?? "").trim();
    const endDate = String(item.endDate ?? "").trim();
    // Key bao gồm Tên + Ngày bắt đầu + Ngày kết thúc để gộp đúng sự kiện trùng ngày
    const groupKey = `${name}|${startDate}|${endDate}`;

    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, []);
    }
    groupsMap.get(groupKey)!.push(item);
  });

  const resultEvents: PriceEventRule[] = [];

  groupsMap.forEach((groupItems) => {
    const firstItem = groupItems[0];
    const name = String(firstItem.rateName ?? firstItem.name ?? "Sự kiện giá").trim();
    const startDate = String(firstItem.startDate ?? "").trim();
    const endDate = String(firstItem.endDate ?? "").trim();

    const mergedRoomTypes: string[] = [];
    const roomTypeAdjustments: Record<string, number> = {};
    const fixedPrices: Record<string, number> = {};
    const recordIds: Record<string, number | string | null> = {};

    groupItems.forEach((item) => {
      const rawRoomTypeValues = Array.isArray(item.roomTypes)
        ? item.roomTypes
        : typeof item.roomTypes === "string"
          ? item.roomTypes.split(",")
          : typeof item.roomType === "string"
            ? [item.roomType]
            : Array.isArray(item.roomType)
              ? item.roomType
              : ["ALL"];

      const normalizedRoomTypes = rawRoomTypeValues
        .map((value) => mapRoomTypeLabel(String(value).trim()))
        .filter(Boolean);

      const absolutePrice = Number(item.price ?? item.value ?? 0);

      normalizedRoomTypes.forEach((rt) => {
        if (!mergedRoomTypes.includes(rt)) {
          mergedRoomTypes.push(rt);
        }

        if (absolutePrice > 0) {
          fixedPrices[rt] = absolutePrice;
        }

        const percent = Number(item.percentValue ?? 0);
        roomTypeAdjustments[rt] = percent;
        const sourceId = item.id != null ? String(item.id) : null;
        recordIds[rt] = sourceId ? sourceId : null;
      });
    });

    const adjValues = Object.values(roomTypeAdjustments);
    const avgPercent = adjValues.length > 0 ? Math.round(adjValues.reduce((a, b) => a + b, 0) / adjValues.length) : 0;
    const firstColor = (firstItem.colorTheme as "amber" | "emerald" | "purple" | "rose" | "blue") ?? (avgPercent >= 0 ? "amber" : "emerald");

    resultEvents.push({
      id: String(firstItem.id ?? `evt-${startDate}-${endDate}-${Date.now()}`),
      name,
      startDate,
      endDate,
      roomTypes: mergedRoomTypes.length > 0 ? mergedRoomTypes : ["ALL"],
      modifierType: "PERCENT",
      percentValue: avgPercent,
      roomTypeAdjustments: Object.keys(roomTypeAdjustments).length > 0 ? roomTypeAdjustments : undefined,
      fixedPrices,
      colorTheme: firstColor in colorThemeHeader ? firstColor : "emerald",
      recordIds: Object.keys(recordIds).length > 0 ? recordIds : undefined,
    });
  });

  return resultEvents;
};

export default function EventPricingCalendar() {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [isDateFilterActive, setIsDateFilterActive] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const hotelId = useSelector((state: any) => state.auth.hotelId);

  const month = visibleMonth.getMonth() + 1;
  const year = visibleMonth.getFullYear();

  const monthQuery = useGetRoomSeasonalRatesByMonthQuery(
    { hotelId: Number(hotelId), month, year },
    { skip: !hotelId || Number.isNaN(Number(hotelId)) }
  );

  const { data, isLoading: isLoadingSeasonalRates, refetch } = monthQuery;
  const [createRoomSeasonalRate, { isLoading: isCreatingSeasonalRate }] = useCreateRoomSeasonalRateMutation();
  const [updateRoomSeasonalRate, { isLoading: isUpdatingSeasonalRate }] = useUpdateRoomSeasonalRateMutation();

  const seasonalRates = data?.content ?? [];
  const allSeasonalRates = seasonalRates;
  const totalPages = Math.max(data?.page?.totalPages ?? 1, 1);

  const highlightSeasonalRates = useMemo(() => seasonalRates, [seasonalRates]);

  const [events, setEvents] = useState<PriceEventRule[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "UPCOMING" | "EXPIRED">("ALL");
  const [selectedRoomTypeFilter, setSelectedRoomTypeFilter] = useState<"ALL" | RoomType>("ALL");
  const lastSyncedSeasonalSignatureRef = useRef("");
  const autoAlignedEventDateRef = useRef(false);

  useEffect(() => {
    if (autoAlignedEventDateRef.current || highlightSeasonalRates.length === 0) return;

    const firstEventDate = [...highlightSeasonalRates]
      .map((item) => normalizeDateKey(item.startDate))
      .filter(Boolean)
      .sort()[0];

    if (!firstEventDate) return;

    setSelectedDate(firstEventDate);
    autoAlignedEventDateRef.current = true;
  }, [highlightSeasonalRates]);

  const calendarHighlightEvents = useMemo(() => groupSeasonalRatesToEvents(highlightSeasonalRates), [highlightSeasonalRates]);

  const eventDates = useMemo(
    () =>
      calendarHighlightEvents.flatMap((evt) => {
        const startDate = normalizeDateKey(evt.startDate);
        const endDate = normalizeDateKey(evt.endDate);

        if (!startDate || !endDate) return [];

        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T00:00:00`);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

        const days: string[] = [];

        for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
          days.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`);
        }

        return days;
      }),
    [calendarHighlightEvents],
  );

  useEffect(() => {
    const nextEvents = seasonalRates.length > 0 ? groupSeasonalRatesToEvents(seasonalRates) : [];
    const nextSignature = JSON.stringify(
      nextEvents.map((evt) => ({
        id: evt.id,
        name: evt.name,
        startDate: evt.startDate,
        endDate: evt.endDate,
        roomTypes: evt.roomTypes,
        percentValue: evt.percentValue,
        adjustments: evt.roomTypeAdjustments,
      }))
    );

    if (lastSyncedSeasonalSignatureRef.current === nextSignature) return;

    lastSyncedSeasonalSignatureRef.current = nextSignature;
    setEvents(nextEvents);
  }, [seasonalRates]);

  useEffect(() => {
    bindHotelSocketEvents({
      onSeasonalRateAnnouncementUpdate: (data) => {
        const payload = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
        const payloadData = Array.isArray(payload.data) ? payload.data : Array.isArray(data) ? data : [];
        const rateLabel =
          (payloadData[0] as Record<string, unknown> | undefined)?.rateName ??
          (payloadData[0] as Record<string, unknown> | undefined)?.name ??
          "giá mùa vụ";

        toast({
          variant: "default",
          title: "Cập nhật giá mùa vụ",
          description: `${String(rateLabel)} vừa được cập nhật. Danh sách giá đã được đồng bộ mới nhất.`,
          duration: 10000,
        });

        refetch();
      },
    });
  }, [refetch]);

  // Modal State
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [formValidationError, setFormValidationError] = useState<string | null>(null);

  // Form State
  const [eventName, setEventName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [colorTheme, setColorTheme] = useState<"amber" | "emerald" | "purple" | "rose" | "blue">("emerald");
  const [pricingGroups, setPricingGroups] = useState<PricingGroupForm[]>([
    { id: "group-1", roomTypes: ["ALL"], percentValue: "20" },
  ]);

  // Today reference string
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Helper to determine status
  const getEventStatus = (evt: PriceEventRule): "ACTIVE" | "UPCOMING" | "EXPIRED" => {
    if (todayStr >= evt.startDate && todayStr <= evt.endDate) return "ACTIVE";
    if (todayStr < evt.startDate) return "UPCOMING";
    return "EXPIRED";
  };

  const closeFormModal = () => {
    setShowEventModal(false);
    setFormValidationError(null);
  };

  const openCreateModal = () => {
    setEditingEventId(null);
    setEventName("");
    setStartDate(todayStr);
    setEndDate(todayStr);
    setColorTheme("emerald");
    setPricingGroups([
      { id: `group-${Date.now()}`, roomTypes: ["ALL"], percentValue: "20" },
    ]);
    setFormValidationError(null);
    setShowEventModal(true);
  };

  const openEditModal = (evt: PriceEventRule) => {
    setEditingEventId(evt.id);
    setEventName(evt.name);
    setStartDate(evt.startDate);
    setEndDate(evt.endDate);
    setColorTheme(evt.colorTheme);
    setFormValidationError(null);

    const rawMatchingEventRows = seasonalRates.filter((item) => {
      const itemName = String(item.rateName ?? item.name ?? "").trim();
      const itemStartDate = String(item.startDate ?? "").trim();
      const itemEndDate = String(item.endDate ?? "").trim();

      return itemName === evt.name && itemStartDate === evt.startDate && itemEndDate === evt.endDate;
    });

    if (rawMatchingEventRows.length > 0) {
      const groupedMap = new Map<string, string[]>();

      rawMatchingEventRows.forEach((item) => {
        const roomTypeValues = Array.isArray(item.roomTypes)
          ? item.roomTypes
          : typeof item.roomTypes === "string"
            ? item.roomTypes.split(",")
            : typeof item.roomType === "string"
              ? [item.roomType]
              : Array.isArray(item.roomType)
                ? item.roomType
                : ["ALL"];

        const normalizedRoomTypes = roomTypeValues
          .map((value) => mapRoomTypeLabel(String(value).trim()))
          .filter(Boolean);

        const rawValue = Number(item.price ?? item.value ?? item.percentValue ?? 0);
        const key = String(rawValue);
        const previous = groupedMap.get(key) ?? [];
        const nextRoomTypes = normalizedRoomTypes.length > 0 ? normalizedRoomTypes : ["ALL"];

        groupedMap.set(key, [...previous, ...nextRoomTypes]);
      });

      const groups: PricingGroupForm[] = Array.from(groupedMap.entries()).map(([pct, rts], idx) => {
        const uniqueRoomTypes = [...new Set(rts)];

        return {
          id: `group-${idx}-${Date.now()}`,
          roomTypes: uniqueRoomTypes.length === roomTypesList.length ? ["ALL"] : uniqueRoomTypes,
          percentValue: String(pct),
        };
      });

      setPricingGroups(groups.length > 0 ? groups : [{ id: `group-${Date.now()}`, roomTypes: evt.roomTypes, percentValue: String(evt.percentValue) }]);
    } else if (evt.roomTypeAdjustments && Object.keys(evt.roomTypeAdjustments).length > 0) {
      const groupedMap = new Map<number, string[]>();
      Object.entries(evt.roomTypeAdjustments).forEach(([rt, pct]) => {
        const list = groupedMap.get(pct) ?? [];
        list.push(rt);
        groupedMap.set(pct, list);
      });
      const groups: PricingGroupForm[] = Array.from(groupedMap.entries()).map(([pct, rts], idx) => ({
        id: `group-${idx}-${Date.now()}`,
        roomTypes: rts.length === roomTypesList.length ? ["ALL"] : rts,
        percentValue: String(pct),
      }));
      setPricingGroups(groups);
    } else {
      setPricingGroups([
        { id: `group-${Date.now()}`, roomTypes: evt.roomTypes, percentValue: String(evt.percentValue) },
      ]);
    }

    setShowEventModal(true);
  };

  const saveEventRule = async () => {
    if (!eventName.trim() || !startDate || !endDate) return;

    const roomTypeAdjustments: Record<string, number> = {};
    const allSelectedTypesSet = new Set<string>();
    let overallPercent = 0;
    let isAllCoverage = false;

    pricingGroups.forEach((group) => {
      const groupPct = Number(group.percentValue) || 0;
      overallPercent = groupPct;

      if (group.roomTypes.includes("ALL")) {
        isAllCoverage = true;
        roomTypesList.forEach((rt) => {
          roomTypeAdjustments[rt] = groupPct;
        });
      } else {
        group.roomTypes.forEach((rt) => {
          allSelectedTypesSet.add(rt);
          roomTypeAdjustments[rt] = groupPct;
        });
      }
    });

    const selectedRoomTypesList = isAllCoverage
      ? ["ALL"]
      : allSelectedTypesSet.size === roomTypesList.length
      ? ["ALL"]
      : Array.from(allSelectedTypesSet);

    const seasonalRateRequests = pricingGroups.flatMap((group) => {
      const priceValue = Number(group.percentValue) || 0;
      const roomTypesToSave = group.roomTypes.includes("ALL") ? roomTypesList : group.roomTypes;

      return roomTypesToSave.map((roomType) => {
        const currentEditingEvent = editingEventId ? events.find((evt) => evt.id === editingEventId) : undefined;
        const recordIdForRoom = currentEditingEvent?.recordIds?.[roomType] ?? null;

        return {
          id: recordIdForRoom ?? null,
          roomType: mapRoomTypeToEnum(roomType),
          rateName: eventName.trim(),
          startDate,
          endDate,
          price: priceValue,
        };
      });
    });

    try {
      if (editingEventId) {
        await updateRoomSeasonalRate(seasonalRateRequests).unwrap();
        toast({
          variant: "default",
          title: "Cập nhật giá mùa vụ",
          description: `Đã chỉnh sửa ${eventName.trim()} và đồng bộ thay đổi tới khách hàng.`,
          duration: 10000,
        });
      } else {
        await createRoomSeasonalRate(seasonalRateRequests).unwrap();
        toast({
          variant: "success",
          title: "Cập nhật giá thành công",
          description: "Đã lưu cấu hình giá theo sự kiện cho các loại phòng đã chọn.",
          duration: 10000,
        });
      }

      await refetch();
      closeFormModal();
    } catch (error) {
      console.error("Lỗi khi lưu sự kiện giá theo phòng:", error);
      const errorMessage =
        typeof error === "object" && error !== null && "data" in error
          ? ((error as { data?: { message?: string } }).data?.message ?? "Không thể lưu cấu hình giá.")
          : "Không thể lưu cấu hình giá.";
      setFormValidationError(errorMessage);
      toast({
        variant: "destructive",
        title: editingEventId ? "Cập nhật cấu hình giá thất bại" : "Lưu cấu hình giá thất bại",
        description: errorMessage,
        duration: 10000,
      });
    }
  };

  const deleteEventRule = (id: string) => {
    setEvents((current) => current.filter((item) => item.id !== id));
  };

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      const matchesSearch = evt.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
      const status = getEventStatus(evt);
      const matchesStatus = statusFilter === "ALL" || status === statusFilter;
      const matchesRoomType =
        selectedRoomTypeFilter === "ALL" ||
        evt.roomTypes.includes("ALL") ||
        evt.roomTypes.includes(selectedRoomTypeFilter) ||
        Boolean(evt.roomTypeAdjustments?.[selectedRoomTypeFilter] !== undefined);
      const eventStartDate = normalizeDateKey(evt.startDate);
      const eventEndDate = normalizeDateKey(evt.endDate);
      const matchesDate = !isDateFilterActive || Boolean(
        eventStartDate && eventEndDate && eventStartDate <= selectedDate && selectedDate <= eventEndDate
      );

      return matchesSearch && matchesStatus && matchesRoomType && matchesDate;
    });
  }, [events, searchQuery, statusFilter, selectedRoomTypeFilter, selectedDate, isDateFilterActive, todayStr]);

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-lg font-bold text-slate-900 tracking-tight">Danh sách cấu hình giá theo sự kiện</h4>
              <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-bold text-violet-700 uppercase tracking-wider">
                Event Pricing
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Quản lý các quy tắc sự kiện tăng/giảm giá theo % linh hoạt cho từng loại phòng theo khoảng thời gian.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="flex w-fit items-center gap-2 rounded-xl bg-linear-to-r from-blue-600 to-sky-500 px-4.5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-sky-600 transition duration-150 active:scale-95"
        >
          <Plus size={16} className="stroke-[2.5]" />
          Tạo sự kiện giá mới
        </button>
      </div>

      {/* 2. Controls & Search Filter Bar */}
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_auto_auto_auto] lg:items-center">
          {/* Search Input */}
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên sự kiện giá..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9.5 pr-3.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Date Picker */}
          <div className="w-fit">
            <DatePickerPopover
              iconOnly
              value={selectedDate ? new Date(`${selectedDate}T00:00:00`) : undefined}
              onMonthChange={(nextMonth) => {
                setVisibleMonth(nextMonth);
                setIsDateFilterActive(false);
                setCurrentPage(0);
              }}
              onChange={(nextDate) => {
                if (!nextDate) return;
                const nextValue = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;
                setSelectedDate(nextValue);
                setVisibleMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
                setIsDateFilterActive(true);
                setCurrentPage(0);
              }}
              highlightDates={eventDates}
              placeholder="Chọn ngày"
              buttonClassName="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white p-0 text-slate-700 shadow-2xs outline-none transition hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Status Filter Dropdown */}
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "UPCOMING" | "EXPIRED")}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 shadow-2xs outline-none focus:border-blue-500"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang diễn ra</option>
              <option value="UPCOMING">Sắp diễn ra</option>
              <option value="EXPIRED">Hết hạn</option>
            </select>
          </div>

          {/* Room Type Filter Dropdown */}
          <div className="flex items-center gap-2">
            <select
              value={selectedRoomTypeFilter}
              onChange={(e) => setSelectedRoomTypeFilter(e.target.value as any)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 shadow-2xs outline-none focus:border-blue-500"
            >
              <option value="ALL">Tất cả loại phòng</option>
              {roomTypesList.map((rt) => (
                <option key={rt} value={rt}>
                  {rt}
                </option>
              ))}
            </select>
          </div>
        </div>

      </div>

      {/* 3. Event Rules List (Main View) */}
      {isLoadingSeasonalRates ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-8 text-center text-sm font-medium text-slate-500">
          Đang tải danh sách sự kiện giá...
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center">
          <Sparkles size={32} className="mx-auto text-slate-400 opacity-60 mb-2" />
          <h5 className="text-sm font-bold text-slate-700">Chưa có sự kiện cấu hình giá nào</h5>
          <p className="mt-1 text-xs text-slate-500">Thử thay đổi bộ lọc tìm kiếm hoặc tạo thêm sự kiện cấu hình giá mới.</p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
          >
            <Plus size={15} /> Tạo sự kiện mới
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
          {filteredEvents.map((evt) => {
            const status = getEventStatus(evt);
            const statusPill =
              status === "ACTIVE" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Đang diễn ra
                </span>
              ) : status === "UPCOMING" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800 border border-blue-200">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  Sắp diễn ra
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700 border border-orange-300">
                  Đã hết hạn
                </span>
              );

            const adjValues = evt.roomTypeAdjustments ? Object.values(evt.roomTypeAdjustments) : [evt.percentValue];
            const minPct = Math.min(...adjValues);
            const maxPct = Math.max(...adjValues);
            const hasMultipleAdjustments = evt.roomTypeAdjustments && Object.keys(evt.roomTypeAdjustments).length > 0 && minPct !== maxPct;

            const modifierBadge = hasMultipleAdjustments ? (
              <span className="inline-flex items-center gap-1 rounded-xl bg-purple-500/15 px-3 py-1 text-xs font-extrabold text-purple-900 border border-purple-300">
                <TrendingUp size={14} className="text-purple-600" />
                Điều chỉnh {minPct > 0 ? `+${minPct}%` : `${minPct}%`} ~ {maxPct > 0 ? `+${maxPct}%` : `${maxPct}%`} theo nhóm phòng
              </span>
            ) : evt.percentValue > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-xl bg-orange-50 px-3 py-1 text-xs font-extrabold text-orange-900 border border-orange-100">
                <TrendingUp size={14} className="text-orange-600" />
                Tăng +{evt.percentValue}% giá phòng
              </span>
            ) : evt.percentValue < 0 ? (
              <span className="inline-flex items-center gap-1 rounded-xl bg-orange-50 px-3 py-1 text-xs font-extrabold text-orange-900 border border-orange-100">
                <TrendingDown size={14} className="text-orange-600" />
                Giảm {evt.percentValue}% ưu đãi
              </span>
            ) : null;

            return (
              <div
                key={evt.id}
                className={`group relative overflow-hidden rounded-2xl border bg-white shadow-xs transition duration-200 hover:shadow-md ${
                  status === "ACTIVE"
                    ? "border-emerald-300 hover:border-emerald-400"
                    : status === "UPCOMING"
                      ? "border-blue-300 hover:border-blue-400"
                      : "border-orange-300 hover:border-orange-400"
                }`}
              >
                {/* Event Card Header */}
                <div className={`flex flex-col gap-3 bg-linear-to-r ${statusColorHeader[status] || colorThemeHeader[evt.colorTheme] || colorThemeHeader.amber} p-5 border-b sm:flex-row sm:items-center sm:justify-between`}>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      {statusPill}
                      {modifierBadge}
                    </div>
                    <h5 className="mt-2.5 text-base font-extrabold text-slate-900 tracking-tight">{evt.name}</h5>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(evt)}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/90 px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-white hover:text-blue-700 transition"
                    >
                      <Pencil size={14} />
                      Chỉnh sửa
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteEventRule(evt.id)}
                      className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white/90 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 transition"
                      title="Xóa sự kiện"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Event Body */}
                <div className="p-5 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 text-xs">
                    <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                      <CalendarDays size={18} className="text-blue-600 shrink-0" />
                      <div>
                        <span className="text-slate-400 block text-[11px] font-semibold">Khoảng thời gian áp dụng</span>
                        <strong className="font-extrabold text-slate-800">
                          {evt.startDate.split("-").reverse().join("/")} ➔ {evt.endDate.split("-").reverse().join("/")}
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                      <BedDouble size={18} className="text-purple-600 shrink-0" />
                      <div>
                        <span className="text-slate-400 block text-[11px] font-semibold">Loại phòng áp dụng</span>
                        <strong className="font-extrabold text-slate-800">
                          {evt.roomTypes.includes("ALL") ? "Tất cả 4 loại phòng" : evt.roomTypes.join(", ")}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Calculated Price Breakdown Table */}
                  <div>
                    <div className="grid grid-cols-2 gap-2">
                      {roomTypesList.map((rt) => {
                        const isApplicable = evt.roomTypes.includes("ALL") || evt.roomTypes.includes(rt) || Boolean(evt.roomTypeAdjustments?.[rt] !== undefined) || Boolean(evt.fixedPrices?.[rt]);
                        const exactPriceFromBackend = evt.fixedPrices?.[rt];
                        const displayPrice = isApplicable && exactPriceFromBackend && exactPriceFromBackend > 0 ? exactPriceFromBackend : 0;
                        const theme = roomTypeThemeStyles[rt];

                        return (
                          <div
                            key={rt}
                            className={`rounded-xl border p-3 transition ${
                              isApplicable && displayPrice > 0
                                ? `${theme.bg} ${theme.border}`
                                : "border-slate-100 bg-slate-50/20 opacity-60"
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className={`font-bold ${isApplicable && displayPrice > 0 ? theme.text : "text-slate-800"}`}>{rt}</span>
                              {isApplicable && displayPrice > 0 && (
                                <span className="text-[10px] font-extrabold text-blue-700">
                                  Áp dụng
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex items-baseline justify-between">
                              <span className={`text-xs font-extrabold ${isApplicable && displayPrice > 0 ? theme.text : "text-slate-900"}`}>
                                {displayPrice > 0 ? money(displayPrice) : "Chưa có giá"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="text-xs font-semibold text-slate-500">
          Trang {Math.min(currentPage + 1, totalPages)} / {totalPages}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(0, page - 1))}
            disabled={currentPage === 0}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Trước
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.min(totalPages - 1, page + 1))}
            disabled={currentPage >= totalPages - 1}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Sau
          </button>
        </div>
      </div>

      {/* Modal Create / Edit Event */}
      {showEventModal && (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-slate-900/10 p-4 overflow-y-auto"
        >
          <div
            className="my-8 w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl border border-slate-100"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <BadgePercent size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingEventId ? "Chỉnh sửa sự kiện giá" : "Tạo sự kiện giá mới"}
                  </h3>
                  <p className="text-xs text-slate-500">Thiết lập khoảng thời gian và tỷ lệ % điều chỉnh giá linh hoạt theo nhóm phòng</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeFormModal}
                className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X size={18} />
              </button>
            </div>

            {formValidationError && (
              <div className="mt-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                <div className="flex items-center gap-2">
                  <Info size={16} className="shrink-0 text-rose-600" />
                  <span>{formValidationError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormValidationError(null)}
                  className="rounded-lg p-1 text-rose-500 hover:bg-rose-100 transition"
                  title="Đóng thông báo lỗi"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="mt-5 space-y-4 text-xs sm:text-sm">
              <label className="block font-bold text-slate-700">
                Tên sự kiện / Quy tắc giá <span className="text-rose-500">*</span>
                <input
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="Ví dụ: Phụ thu Lễ 30/4, Khuyến mãi mùa hè..."
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block font-bold text-slate-700">
                  Từ ngày <span className="text-rose-500">*</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </label>
                <label className="block font-bold text-slate-700">
                  Đến ngày <span className="text-rose-500">*</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </label>
              </div>

              {/* Multi-Group Pricing Configurations */}
              <div className="space-y-4 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs sm:text-sm">Cấu hình giá phòng theo nhóm</h4>
                    <p className="text-[11px] text-slate-500">Thiết lập giá tiền (VNĐ) cụ thể cho từng nhóm loại phòng trong sự kiện</p>
                  </div>
                </div>

                {pricingGroups.map((group, groupIdx) => {
                  const assignedInOtherGroups = pricingGroups
                    .filter((g) => g.id !== group.id)
                    .flatMap((g) => (g.roomTypes.includes("ALL") ? roomTypesList : g.roomTypes));

                  const isAllSelected = group.roomTypes.includes("ALL");

                  return (
                    <div key={group.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 relative">
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                        <span className="text-xs font-bold text-violet-700 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="grid h-5 w-5 place-items-center rounded-full bg-violet-600 text-white text-[10px] font-bold">
                            {groupIdx + 1}
                          </span>
                          Nhóm phòng #{groupIdx + 1}
                        </span>
                        {pricingGroups.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setPricingGroups((current) => current.filter((g) => g.id !== group.id))}
                            className="flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700"
                          >
                            <Trash2 size={13} /> Xóa nhóm
                          </button>
                        )}
                      </div>

                      {/* Room types selection */}
                      <div>
                        <p className="text-xs font-semibold text-slate-700 mb-1.5">Loại phòng áp dụng nhóm này:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {groupIdx === 0 && pricingGroups.length === 1 && (
                            <button
                              type="button"
                              onClick={() => setPricingGroups((current) => current.map((g) => g.id === group.id ? { ...g, roomTypes: ["ALL"] } : g))}
                              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-2xs ${
                                isAllSelected ? "bg-blue-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              Tất cả loại phòng
                            </button>
                          )}
                          {roomTypesList.map((rt) => {
                            const isAssignedElsewhere = assignedInOtherGroups.includes(rt);
                            const isSelected = !isAllSelected && group.roomTypes.includes(rt);

                            return (
                              <button
                                key={rt}
                                type="button"
                                disabled={isAssignedElsewhere}
                                onClick={() => {
                                  let nextTypes: string[];
                                  if (isAllSelected) {
                                    nextTypes = [rt];
                                  } else if (isSelected) {
                                    nextTypes = group.roomTypes.filter((t) => t !== rt);
                                  } else {
                                    nextTypes = [...group.roomTypes, rt];
                                  }
                                  setPricingGroups((current) =>
                                    current.map((g) => (g.id === group.id ? { ...g, roomTypes: nextTypes } : g))
                                  );
                                }}
                                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-2xs ${
                                  isSelected
                                    ? "bg-blue-600 text-white"
                                    : isAssignedElsewhere
                                    ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-200 opacity-60"
                                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                                }`}
                              >
                                {rt} {isAssignedElsewhere && "(Đã gán nhóm khác)"}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Fixed Price input for this group */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700">
                          Giá phòng áp dụng (VNĐ) <span className="text-rose-500">*</span>
                        </label>
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            type="number"
                            value={group.percentValue}
                            onChange={(e) => {
                              const val = e.target.value;
                              setPricingGroups((current) =>
                                current.map((g) => (g.id === group.id ? { ...g, percentValue: val } : g))
                              );
                            }}
                            placeholder="Ví dụ: 750000 hoặc 1200000"
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                          />
                          <span className="text-xs font-bold text-slate-500 shrink-0">VNĐ</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {Number(group.percentValue) > 0
                            ? `Giá cố định áp dụng: ${Number(group.percentValue).toLocaleString("vi-VN")}đ`
                            : "Nhập giá tiền cụ thể cho nhóm phòng"}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {/* Button to add another pricing group for remaining unassigned room types */}
                {(() => {
                  const allAssigned = pricingGroups.flatMap((g) => (g.roomTypes.includes("ALL") ? roomTypesList : g.roomTypes));
                  const unassigned = roomTypesList.filter((rt) => !allAssigned.includes(rt));

                  if (unassigned.length > 0) {
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          setPricingGroups((current) => {
                            const updatedCurrent = current.map((g) =>
                              g.roomTypes.includes("ALL")
                                ? { ...g, roomTypes: roomTypesList.filter((rt) => !unassigned.includes(rt)) }
                                : g
                            );
                            return [
                              ...updatedCurrent,
                              { id: `group-${Date.now()}`, roomTypes: unassigned, percentValue: "20" },
                            ];
                          });
                        }}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50/60 p-3 text-xs font-bold text-blue-700 hover:bg-blue-100/80 hover:border-blue-400 transition shadow-2xs"
                      >
                        <Plus size={16} />
                        + Thêm cấu hình giá riêng cho các loại phòng còn lại ({unassigned.join(", ")})
                      </button>
                    );
                  }
                  return (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-center text-xs font-bold text-emerald-800">
                      <Check size={15} className="inline mr-1 text-emerald-600" />
                      Tất cả loại phòng đã được phân bổ vào các nhóm cấu hình giá.
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={closeFormModal}
                className="rounded-xl border border-slate-200 px-4.5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={saveEventRule}
                disabled={!eventName.trim() || !startDate || !endDate || isCreatingSeasonalRate || isUpdatingSeasonalRate}
                className="rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 px-4.5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-50"
              >
                {isCreatingSeasonalRate || isUpdatingSeasonalRate ? "Đang lưu..." : editingEventId ? "Cập nhật sự kiện" : "Lưu cấu hình giá"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
