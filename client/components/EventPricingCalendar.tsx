import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import DatePickerPopover from "./DatePickerPopover";
import ListPagination from "./ListPagination";
import { toast } from "../hooks/use-toast";
import { bindHotelSocketEvents, SEASONAL_RATE_UPDATE_EVENT } from "../lib/socket";
import { useSelector } from "react-redux";
import { useCreateRoomSeasonalRateMutation, useGetRoomSeasonalRatesByMonthQuery, useUpdateRoomSeasonalRateMutation, type CreateRoomSeasonalRateRequest, type RoomSeasonalRate } from "../services/roomApi";
import SearchableFilter, { FilterResetButton } from "./SearchableFilter";
import ClearSearchButton from "./ClearSearchButton";
import FilterResultStatus from "./FilterResultStatus";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  Sparkles,
  Tag,
  Trash2,
  X,
  Layers,
  Info,
  Pencil,
  Search,
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
const defaultEventName = "__DEFAULT_EVENT_NAME__";
const getLocalDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

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
    name: String(item.rateName ?? item.name ?? defaultEventName),
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
    const name = String(item.rateName ?? item.name ?? defaultEventName).trim();
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
    const name = String(firstItem.rateName ?? firstItem.name ?? defaultEventName).trim();
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
        if (item.id != null) recordIds[rt] = item.id;
      });
    });

    const adjValues = Object.values(roomTypeAdjustments);
    const avgPercent = adjValues.length > 0 ? Math.round(adjValues.reduce((a, b) => a + b, 0) / adjValues.length) : 0;
    const firstColor = (firstItem.colorTheme as "amber" | "emerald" | "purple" | "rose" | "blue") ?? (avgPercent >= 0 ? "amber" : "emerald");

    resultEvents.push({
      id: String(firstItem.id ?? `evt-${name}-${startDate}-${endDate}`),
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
  const { t: translate, i18n } = useTranslation();
  const t = (key: string, options?: Record<string, string | number>) =>
    translate(key.startsWith("eventPricing.") ? `room.${key}` : key, options);
  const getRoomTypeLabel = (roomType: string) => {
    const keys: Record<string, string> = {
      "Standard Room": "eventPricing.roomTypeStandard",
      "Deluxe Room": "eventPricing.roomTypeDeluxe",
      "Suite Room": "eventPricing.roomTypeSuite",
      "Family Room": "eventPricing.roomTypeFamily",
    };
    return t(keys[roomType] ?? roomType);
  };
  const getEventStatusLabel = (status: "ACTIVE" | "UPCOMING" | "EXPIRED") =>
    t(status === "ACTIVE" ? "eventPricing.active" : status === "UPCOMING" ? "eventPricing.upcoming" : "eventPricing.expired");
  const formatMoney = (value: number) =>
    `${Number(value).toLocaleString(i18n.resolvedLanguage?.startsWith("en") ? "en-US" : "vi-VN")}${i18n.resolvedLanguage?.startsWith("en") ? " VND" : "đ"}`;
  const today = getLocalDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [isDateFilterActive, setIsDateFilterActive] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const hotelId = useSelector((state: any) => state.auth.hotelId);

  const month = visibleMonth.getMonth() + 1;
  const year = visibleMonth.getFullYear();

  const monthQuery = useGetRoomSeasonalRatesByMonthQuery(
    { hotelId: Number(hotelId), month, year },
    { skip: !hotelId || Number.isNaN(Number(hotelId)) }
  );
  const calendarMonthQuery = useGetRoomSeasonalRatesByMonthQuery(
    { hotelId: Number(hotelId), month: calendarMonth.getMonth() + 1, year: calendarMonth.getFullYear() },
    { skip: !hotelId || Number.isNaN(Number(hotelId)) }
  );

  const { currentData: data, isLoading: isLoadingSeasonalRates, refetch } = monthQuery;
  const [createRoomSeasonalRate, { isLoading: isCreatingSeasonalRate }] = useCreateRoomSeasonalRateMutation();
  const [updateRoomSeasonalRate, { isLoading: isUpdatingSeasonalRate }] = useUpdateRoomSeasonalRateMutation();

  const seasonalRates = data?.content ?? [];
  const allSeasonalRates = seasonalRates;
  const highlightSeasonalRates = calendarMonthQuery.data?.content ?? [];

  const [events, setEvents] = useState<PriceEventRule[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "UPCOMING" | "EXPIRED">("ALL");
  const [selectedRoomTypeFilter, setSelectedRoomTypeFilter] = useState<"ALL" | RoomType>("ALL");
  const lastSyncedSeasonalSignatureRef = useRef("");
  const autoAlignedEventDateRef = useRef(false);

  useEffect(() => {
    if (autoAlignedEventDateRef.current || seasonalRates.length === 0) return;

    const firstEventDate = [...seasonalRates]
      .map((item) => normalizeDateKey(item.startDate))
      .filter(Boolean)
      .sort()[0];

    if (!firstEventDate) return;

    setSelectedDate(firstEventDate);
    autoAlignedEventDateRef.current = true;
  }, [seasonalRates]);

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
        fixedPrices: evt.fixedPrices,
        recordIds: evt.recordIds,
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
          t("eventPricing.seasonalPricing");

        toast({
          variant: "default",
          title: t("eventPricing.eventUpdatedToastTitle"),
          description: t("eventPricing.eventUpdatedToastDescription", { eventName: String(rateLabel) }),
          duration: 10000,
        });

        refetch();
      },
    });
  }, [refetch, t]);

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
  const todayStr = useMemo(() => getLocalDateKey(new Date()), []);

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
    setEventName(evt.name === defaultEventName ? t("eventPricing.seasonalPricing") : evt.name);
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
    const currentEditingEvent = editingEventId ? events.find((evt) => evt.id === editingEventId) : undefined;
    const editingEventStatus = currentEditingEvent ? getEventStatus(currentEditingEvent) : null;
    if (editingEventStatus && editingEventStatus !== "UPCOMING") {
      setFormValidationError(t(editingEventStatus === "ACTIVE"
        ? "eventPricing.activeEventEditError"
        : "eventPricing.expiredEventEditError"));
      return;
    }
    if (editingEventId && endDate < todayStr) {
      setFormValidationError(t("eventPricing.pastEndDateEditError"));
      return;
    }
    if (!eventName.trim() || !startDate || !endDate) {
      setFormValidationError(t("eventPricing.requiredFieldsError"));
      return;
    }
    if (startDate > endDate) {
      setFormValidationError(t("eventPricing.invalidDateRangeError"));
      return;
    }
    if (pricingGroups.some((group) => !Number.isFinite(Number(group.percentValue)) || Number(group.percentValue) <= 0)) {
      setFormValidationError(t("eventPricing.invalidPriceError"));
      return;
    }

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

    const seasonalRateRequests: CreateRoomSeasonalRateRequest[] = pricingGroups.flatMap((group) => {
      const priceValue = Number(group.percentValue);
      const roomTypesToSave = group.roomTypes.includes("ALL") ? roomTypesList : group.roomTypes;

      return roomTypesToSave.map((roomType): CreateRoomSeasonalRateRequest => {
        const recordIdForRoom = currentEditingEvent?.recordIds?.[roomType];
        return {
          ...(recordIdForRoom != null ? { id: recordIdForRoom } : {}),
          roomType: mapRoomTypeToEnum(roomType),
          rateName: eventName.trim(),
          startDate,
          endDate,
          price: priceValue,
        };
      });
    });
    if (seasonalRateRequests.length === 0) {
      setFormValidationError(t("eventPricing.noRoomTypesError"));
      return;
    }

    try {
      if (editingEventId) {
        await updateRoomSeasonalRate(seasonalRateRequests).unwrap();
        toast({
          variant: "default",
          title: t("eventPricing.updatedToastTitle"),
          description: t("eventPricing.updatedToastDescription", { eventName: eventName.trim() }),
          duration: 10000,
        });
      } else {
        await createRoomSeasonalRate(seasonalRateRequests).unwrap();
        toast({
          variant: "success",
          title: t("eventPricing.savedToastTitle"),
          description: t("eventPricing.savedToastDescription"),
          duration: 10000,
        });
      }

      const eventStartDate = new Date(`${startDate}T00:00:00`);
      if (!Number.isNaN(eventStartDate.getTime())) {
        setVisibleMonth(new Date(eventStartDate.getFullYear(), eventStartDate.getMonth(), 1));
        setCalendarMonth(new Date(eventStartDate.getFullYear(), eventStartDate.getMonth(), 1));
        setSelectedDate(startDate);
        setIsDateFilterActive(true);
      }
      setCurrentPage(0);
      closeFormModal();
    } catch (error) {
      console.error("Failed to save room event pricing:", error);
      const errorMessage =
        typeof error === "object" && error !== null && "data" in error
          ? ((error as { data?: { message?: string } }).data?.message ?? t("eventPricing.saveError"))
          : t("eventPricing.saveError");
      setFormValidationError(errorMessage);
      toast({
        variant: "destructive",
        title: editingEventId ? t("eventPricing.updateErrorTitle") : t("eventPricing.createErrorTitle"),
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
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(Math.ceil(filteredEvents.length / pageSize), 1);
  const safeCurrentPage = Math.min(currentPage, totalPages - 1);
  const paginatedEvents = filteredEvents.slice(safeCurrentPage * pageSize, (safeCurrentPage + 1) * pageSize);

  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery, statusFilter, selectedRoomTypeFilter, selectedDate, isDateFilterActive]);

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-lg font-bold text-slate-900 tracking-tight">{t("eventPricing.listTitle")}</h4>
              <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-bold text-violet-700 uppercase tracking-wider">
                Event Pricing
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {t("eventPricing.description")}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="flex w-fit items-center gap-2 rounded-xl bg-linear-to-r from-blue-600 to-sky-500 px-4.5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-sky-600 transition duration-150 active:scale-95"
        >
          <Plus size={16} className="stroke-[2.5]" />
          {t("eventPricing.create")}
        </button>
      </div>

      {/* 2. Controls & Search Filter Bar */}
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_auto_auto_auto_auto] lg:items-center">
          {/* Search Input */}
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("eventPricing.searchPlaceholder")}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9.5 pr-10 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
            <ClearSearchButton value={searchQuery} onClear={() => setSearchQuery("")} label={t("common.clearSearch")} />
          </div>

          {/* Date Picker */}
          <div className="w-fit">
            <DatePickerPopover
              iconOnly
              value={selectedDate ? new Date(`${selectedDate}T00:00:00`) : undefined}
              onMonthChange={(nextMonth) => {
                setVisibleMonth(nextMonth);
                setCalendarMonth(nextMonth);
                setIsDateFilterActive(false);
                setCurrentPage(0);
              }}
              onChange={(nextDate) => {
                if (!nextDate) return;
                const nextValue = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;
                setSelectedDate(nextValue);
                const nextMonth = new Date(nextDate.getFullYear(), nextDate.getMonth(), 1);
                setVisibleMonth(nextMonth);
                setCalendarMonth(nextMonth);
                setIsDateFilterActive(true);
                setCurrentPage(0);
              }}
              highlightDates={eventDates}
              placeholder={t("eventPricing.chooseDate")}
              buttonClassName="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white p-0 text-slate-700 shadow-2xs outline-none transition hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <SearchableFilter
            ariaLabel={t("eventPricing.allStatuses")}
            searchPlaceholder={t("eventPricing.searchStatus")}
            emptyMessage={t("eventPricing.noFilterResults")}
            value={statusFilter}
            options={[
              { value: "ALL", label: t("eventPricing.allStatuses") },
              { value: "ACTIVE", label: t("eventPricing.active") },
              { value: "UPCOMING", label: t("eventPricing.upcoming") },
              { value: "EXPIRED", label: t("eventPricing.expired") },
            ]}
            onChange={(value) => setStatusFilter(value as typeof statusFilter)}
            className="w-full lg:w-44"
          />

          <SearchableFilter
            ariaLabel={t("eventPricing.allRoomTypes")}
            searchPlaceholder={t("eventPricing.searchRoomType")}
            emptyMessage={t("eventPricing.noFilterResults")}
            value={selectedRoomTypeFilter}
            options={[
              { value: "ALL", label: t("eventPricing.allRoomTypes") },
              ...roomTypesList.map((roomType) => ({
                value: roomType,
                label: getRoomTypeLabel(roomType),
              })),
            ]}
            onChange={(value) => setSelectedRoomTypeFilter(value === "ALL" ? "ALL" : value as RoomType)}
            className="w-full lg:w-44"
          />
          {(searchQuery || statusFilter !== "ALL" || selectedRoomTypeFilter !== "ALL" || isDateFilterActive) && <FilterResetButton
            label={t("common.resetFilter")}
            onClick={() => {
              const todayDate = new Date();
              setSearchQuery("");
              setStatusFilter("ALL");
              setSelectedRoomTypeFilter("ALL");
              setSelectedDate(today);
              setVisibleMonth(todayDate);
              setCalendarMonth(todayDate);
              setIsDateFilterActive(false);
              setCurrentPage(0);
            }}
          />}
        </div>

      </div>

      {/* 3. Event Rules List (Main View) */}
      {isLoadingSeasonalRates ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-8 text-center text-sm font-medium text-slate-500">
          {t("eventPricing.loading")}
        </div>
      ) : filteredEvents.length === 0 ? (
        <FilterResultStatus filterKey={JSON.stringify([searchQuery, statusFilter, selectedRoomTypeFilter, selectedDate, isDateFilterActive])}><div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center">
          <Sparkles size={32} className="mx-auto text-slate-400 opacity-60 mb-2" />
          <h5 className="text-sm font-bold text-slate-700">{t("eventPricing.emptyTitle")}</h5>
          <p className="mt-1 text-xs text-slate-500">{t("eventPricing.emptyDescription")}</p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
          >
            <Plus size={15} /> {t("eventPricing.createNew")}
          </button>
        </div></FilterResultStatus>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[1160px] text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="whitespace-nowrap px-4 py-3">{t("common.serialNumber")}</th>
                <th scope="col" className="whitespace-nowrap px-4 py-3">{t("eventPricing.eventColumn")}</th>
                <th scope="col" className="whitespace-nowrap px-4 py-3">{t("eventPricing.statusColumn")}</th>
                <th scope="col" className="whitespace-nowrap px-4 py-3">{t("eventPricing.dateRange")}</th>
                {roomTypesList.map((roomType) => (
                  <th scope="col" key={roomType} className="min-w-36 whitespace-nowrap px-4 py-3 text-right">{getRoomTypeLabel(roomType)}</th>
                ))}
                <th scope="col" className="whitespace-nowrap px-4 py-3 text-right">{t("room.actionsColumn")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedEvents.map((evt, index) => {
                const status = getEventStatus(evt);
                const statusClass = status === "ACTIVE"
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : status === "UPCOMING"
                    ? "bg-blue-50 text-blue-700 ring-blue-200"
                    : "bg-orange-50 text-orange-700 ring-orange-200";

                return (
                  <tr key={evt.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-500">{safeCurrentPage * pageSize + index + 1}</td>
                    <th scope="row" className="max-w-56 px-4 py-3 font-bold text-slate-800">
                      {evt.name === defaultEventName ? t("eventPricing.seasonalPricing") : evt.name}
                    </th>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${statusClass}`}>
                        {getEventStatusLabel(status)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-600">
                      {evt.startDate.split("-").reverse().join("/")} – {evt.endDate.split("-").reverse().join("/")}
                    </td>
                    {roomTypesList.map((roomType) => {
                      const isApplicable = evt.roomTypes.includes("ALL")
                        || evt.roomTypes.includes(roomType)
                        || evt.roomTypeAdjustments?.[roomType] !== undefined
                        || Boolean(evt.fixedPrices?.[roomType]);
                      const price = isApplicable ? evt.fixedPrices?.[roomType] : undefined;

                      return (
                        <td key={roomType} className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${
                          isApplicable && price && price > 0 ? "text-slate-800" : "text-slate-400"
                        }`}>
                          {price && price > 0 ? formatMoney(price) : t("eventPricing.noPrice")}
                        </td>
                      );
                    })}
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEditModal(evt)}
                        disabled={status !== "UPCOMING"}
                        title={status === "ACTIVE"
                          ? t("eventPricing.activeEventEditError")
                          : status === "EXPIRED"
                            ? t("eventPricing.expiredEventEditError")
                            : undefined}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-bold text-amber-700 transition enabled:hover:border-amber-300 enabled:hover:bg-amber-50 enabled:hover:text-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Pencil size={13} />
                        {t("eventPricing.edit")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isLoadingSeasonalRates && (
        <ListPagination
          totalItems={filteredEvents.length}
          page={safeCurrentPage + 1}
          pageSize={pageSize}
          mode="table"
          onPageChange={(nextPage) => setCurrentPage(nextPage - 1)}
          onPageSizeChange={setPageSize}
        />
      )}

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
                    {editingEventId ? t("eventPricing.editTitle") : t("eventPricing.createTitle")}
                  </h3>
                  <p className="text-xs text-slate-500">{t("eventPricing.formDescription")}</p>
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
                  title={t("eventPricing.closeError")}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="mt-5 space-y-4 text-xs sm:text-sm">
              <label className="block font-bold text-slate-700">
                {t("eventPricing.eventName")} <span className="text-rose-500">*</span>
                <input
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder={t("eventPricing.eventNamePlaceholder")}
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block font-bold text-slate-700">
                  {t("eventPricing.startDate")} <span className="text-rose-500">*</span>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </label>
                <label className="block font-bold text-slate-700">
                  {t("eventPricing.endDate")} <span className="text-rose-500">*</span>
                  <input
                    type="date"
                    required
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </label>
              </div>

              {/* Multi-Group Pricing Configurations */}
              <div className="space-y-4 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs sm:text-sm">{t("eventPricing.groupPricingTitle")}</h4>
                    <p className="text-[11px] text-slate-500">{t("eventPricing.groupPricingDescription")}</p>
                  </div>
                </div>

                {pricingGroups.map((group, groupIdx) => {
                  const assignedInOtherGroups = pricingGroups
                    .filter((g) => g.id !== group.id)
                    .flatMap((g) => (g.roomTypes.includes("ALL") ? roomTypesList : g.roomTypes));
                  const isAllSelected = group.roomTypes.includes("ALL");

                  return (
                    <div key={group.id} className="relative space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-violet-700">
                          <span className="grid h-5 w-5 place-items-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                            {groupIdx + 1}
                          </span>
                          {t("eventPricing.roomGroup", { number: groupIdx + 1 })}
                        </span>
                        {pricingGroups.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setPricingGroups((current) => current.filter((g) => g.id !== group.id))}
                            className="flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700"
                          >
                            <Trash2 size={13} /> {t("eventPricing.removeGroup")}
                          </button>
                        )}
                      </div>

                      <div>
                        <p className="mb-1.5 text-xs font-semibold text-slate-700">{t("eventPricing.roomTypesInGroup")}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {groupIdx === 0 && pricingGroups.length === 1 && (
                            <button
                              type="button"
                              onClick={() => setPricingGroups((current) => current.map((g) => g.id === group.id ? { ...g, roomTypes: ["ALL"] } : g))}
                              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-2xs ${
                                isAllSelected ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                              }`}
                            >
                              {t("eventPricing.allRoomTypesButton")}
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
                                  const nextTypes = isAllSelected
                                    ? [rt]
                                    : isSelected
                                      ? group.roomTypes.filter((type) => type !== rt)
                                      : [...group.roomTypes, rt];
                                  setPricingGroups((current) =>
                                    current.map((g) => (g.id === group.id ? { ...g, roomTypes: nextTypes } : g))
                                  );
                                }}
                                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-2xs ${
                                  isSelected
                                    ? "bg-blue-600 text-white"
                                    : isAssignedElsewhere
                                      ? "cursor-not-allowed border border-slate-200 bg-slate-200 text-slate-400 opacity-60"
                                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                                }`}
                              >
                                {getRoomTypeLabel(rt)} {isAssignedElsewhere && t("eventPricing.assignedElsewhere")}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700">
                          {t("eventPricing.applicablePrice")} <span className="text-rose-500">*</span>
                        </label>
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            required
                            value={group.percentValue}
                            onChange={(event) => {
                              const val = event.target.value;
                              setPricingGroups((current) =>
                                current.map((g) => (g.id === group.id ? { ...g, percentValue: val } : g))
                              );
                            }}
                            placeholder={t("eventPricing.pricePlaceholder")}
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                          />
                          <span className="shrink-0 text-xs font-bold text-slate-500">{t("room.pricingConfig.currency")}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {Number(group.percentValue) > 0
                            ? t("eventPricing.fixedPrice", { price: formatMoney(Number(group.percentValue)) })
                            : t("eventPricing.enterFixedPrice")}
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
                        {t("eventPricing.addRemainingTypes", { roomTypes: unassigned.map(getRoomTypeLabel).join(", ") })}
                      </button>
                    );
                  }
                  return (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-center text-xs font-bold text-emerald-800">
                      <Check size={15} className="inline mr-1 text-emerald-600" />
                      {t("eventPricing.allTypesAssigned")}
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
                {t("eventPricing.cancel")}
              </button>
              <button
                type="button"
                onClick={saveEventRule}
                disabled={!eventName.trim() || !startDate || !endDate || isCreatingSeasonalRate || isUpdatingSeasonalRate}
                className="rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 px-4.5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-50"
              >
                {isCreatingSeasonalRate || isUpdatingSeasonalRate ? t("eventPricing.saving") : editingEventId ? t("eventPricing.update") : t("eventPricing.savePricing")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
