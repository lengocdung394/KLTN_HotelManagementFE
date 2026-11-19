import { useState, type Dispatch, type SetStateAction } from "react";
import { BedDouble, Check, Eye, MoreHorizontal, Pencil, RefreshCw, RotateCcw, Search, Sparkles, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import ListPagination from "./ListPagination";
import SearchableFilter from "./SearchableFilter";
import ClearSearchButton from "./ClearSearchButton";
import FilterResultStatus from "./FilterResultStatus";
import { localizedText } from "../i18n";
import { localizeBedDescription, localizeRoomNamePrefix } from "../lib/roomLocalization";

export type RoomListItem = {
  id: string;
  buildingName?: string;
  buildingId?: string;
  name: string;
  images: string[];
  floor: string;
  size: string;
  beds: string;
  capacity: number;
  standardCapacity: number;
  maxExtraGuests: number;
  guestPolicy: string;
  price: number;
  status: string;
  services: string[];
  extraAdultFee: number;
  extraChildFee: number;
  cleaner: string;
};

type BuildingOption = { id: string; name: string };

type RoomListTabProps = {
  canManageRooms: boolean;
  canUpdateRoomStatus: boolean;
  localizeRoomType: (value: string) => string;
  filtered: RoomListItem[];
  paginatedRooms: RoomListItem[];
  buildings: BuildingOption[];
  floors: string[];
  roomTypes: string[];
  statuses: string[];
  statusStyle: Record<string, string>;
  query: string;
  onQueryChange: (value: string) => void;
  building: string;
  onBuildingChange: (value: string) => void;
  floor: string;
  onFloorChange: (value: string) => void;
  roomType: string;
  onRoomTypeChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  statusMenuRoom: string | null;
  setStatusMenuRoom: Dispatch<SetStateAction<string | null>>;
  safePage: number;
  pageSize: number;
  onPageChange: Dispatch<SetStateAction<number>>;
  onPageSizeChange: (value: number) => void;
  onUpdateRoom: (id: string, changes: Partial<RoomListItem>) => Promise<void>;
  onEditRoom: (room: RoomListItem) => void;
  onShowGallery: (room: RoomListItem) => void;
  onShowDetails: (room: RoomListItem) => void;
  isLoading: boolean;
  isError: boolean;
  onRefresh: () => Promise<void>;
};

const statusesForRoom = ["Sẵn sàng", "Bảo trì"];

export default function RoomListTab({
  canManageRooms,
  canUpdateRoomStatus,
  localizeRoomType,
  filtered,
  paginatedRooms,
  buildings,
  floors,
  roomTypes,
  statuses,
  statusStyle,
  query,
  onQueryChange,
  building,
  onBuildingChange,
  floor,
  onFloorChange,
  roomType,
  onRoomTypeChange,
  status,
  onStatusChange,
  statusMenuRoom,
  setStatusMenuRoom,
  safePage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onUpdateRoom,
  onEditRoom,
  onShowGallery,
  onShowDetails,
  isLoading,
  isError,
  onRefresh,
}: RoomListTabProps) {
  const { t, i18n } = useTranslation();
  const [isManuallyRefreshing, setIsManuallyRefreshing] = useState(false);
  const hasActiveFilters = Boolean(
    query
    || building !== "Tất cả các tòa"
    || floor !== "Tất cả các tầng"
    || roomType !== "Tất cả loại phòng"
    || status !== "Tất cả trạng thái",
  );
  const isRoomListLoading = isLoading || isManuallyRefreshing;
  const refreshOrResetFilters = async () => {
    if (isRoomListLoading) return;
    const refreshStartedAt = Date.now();
    setIsManuallyRefreshing(true);
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
    if (hasActiveFilters) {
      onQueryChange("");
      onBuildingChange("Tất cả các tòa");
      onFloorChange("Tất cả các tầng");
      onRoomTypeChange("Tất cả loại phòng");
      onStatusChange("Tất cả trạng thái");
      onPageChange(1);
    }
    try {
      await onRefresh();
    } finally {
      const remainingLoadingTime = 2000 - (Date.now() - refreshStartedAt);
      if (remainingLoadingTime > 0) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, remainingLoadingTime));
      }
      setIsManuallyRefreshing(false);
    }
  };
  const money = (value: number) =>
    `${value.toLocaleString(i18n.resolvedLanguage?.startsWith("en") ? "en-US" : "vi-VN")}${i18n.resolvedLanguage?.startsWith("en") ? " VND" : "đ"}`;
  const translateBed = (bed: string) => localizeBedDescription(bed, (key) => t(key));
  const localizeStatus = (value: string) => {
    if (value === "Sẵn sàng") return t("room.ready");
    if (value === "Đang dọn") return t("room.cleaning");
    if (value === "Đang ở") return t("room.staying");
    if (value === "Bảo trì") return t("room.maintenance");
    return value;
  };
  const localizeSize = (value: string) => value === "Chưa cập nhật" ? t("room.areaNotUpdated") : value;
  const localizeBuilding = (buildingName?: string) => {
    if (!buildingName) return t("room.buildingNotUpdated");
    return localizeRoomNamePrefix(buildingName, "toa", t("room.buildingPrefix"));
  };

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/60 p-4 sm:flex-row sm:flex-wrap xl:flex-nowrap">
        <div className="relative flex-1"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={t("room.searchRooms")} className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-10 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /><ClearSearchButton value={query} onClear={() => onQueryChange("")} label={t("common.clearSearch")} /></div>
        <SearchableFilter
          ariaLabel={t("room.building")}
          searchPlaceholder={t("common.search")}
          emptyMessage={t("room.noFilterOptions")}
          value={building}
          options={[
            { value: "Tất cả các tòa", label: t("room.allBuildings") },
            ...buildings.map((item) => ({ value: item.id, label: localizeBuilding(item.name) })),
          ]}
          onChange={onBuildingChange}
          className="sm:w-44"
        />
        <SearchableFilter
          ariaLabel={t("room.floor")}
          searchPlaceholder={t("common.search")}
          emptyMessage={t("room.noFilterOptions")}
          value={floor}
          options={[
            { value: "Tất cả các tầng", label: t("room.allFloors") },
            ...floors.map((item) => ({ value: item, label: t("room.floorLabel", "Tầng: {{floor}}", { floor: item }) })),
          ]}
          onChange={onFloorChange}
          className="sm:w-44"
        />
        <SearchableFilter
          ariaLabel={t("room.roomType")}
          searchPlaceholder={t("common.search")}
          emptyMessage={t("room.noFilterOptions")}
          value={roomType}
          options={[
            { value: "Tất cả loại phòng", label: t("room.allRoomTypes") },
            ...roomTypes.map((item) => ({ value: item, label: localizeRoomType(item) })),
          ]}
          onChange={onRoomTypeChange}
          className="sm:w-52"
        />
        <SearchableFilter
          ariaLabel={t("room.roomStatus")}
          searchPlaceholder={t("common.search")}
          emptyMessage={t("room.noFilterOptions")}
          value={status}
          options={[
            { value: "Tất cả trạng thái", label: t("room.allStatuses") },
            ...statuses.map((item) => ({ value: item, label: localizeStatus(item) })),
          ]}
          onChange={onStatusChange}
          className="sm:w-52"
        />
        <button type="button" onClick={() => void refreshOrResetFilters()} disabled={isRoomListLoading} aria-label={hasActiveFilters ? localizedText("Xóa bộ lọc", "Reset filters") : localizedText("Tải lại danh sách phòng", "Reload rooms")} title={hasActiveFilters ? localizedText("Xóa bộ lọc", "Reset filters") : localizedText("Tải lại danh sách phòng", "Reload rooms")} aria-busy={isRoomListLoading} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60">
          {isRoomListLoading ? <RefreshCw size={16} className="animate-spin" /> : hasActiveFilters ? <RotateCcw size={15} /> : <RefreshCw size={16} />}
        </button>
      </div>

      {isRoomListLoading ? (
        <div role="status" aria-live="polite" className="mx-4 my-4 flex min-h-48 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-8 text-sm text-blue-700">
          <RefreshCw size={17} className="animate-spin" />
          <span>{t("common.loading")}</span>
        </div>
      ) : isError ? (
        <div role="alert" className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="text-sm text-rose-700">{localizedText("Không thể tải danh sách phòng.", "Could not load rooms.")}</p>
          <button type="button" onClick={onRefresh} className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            {localizedText("Thử lại", "Try again")}
          </button>
        </div>
      ) : <>
      <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
        {paginatedRooms.map((room) => (
          <article key={room.id} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/50">
            <button type="button" onClick={() => onShowGallery(room)} className="group relative block h-36 w-full overflow-hidden text-left"><img src={room.images[0]} alt={`${room.name} · ${t("room.roomLabel", "Room")} ${room.id}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /><div className="absolute inset-0 bg-linear-to-t from-slate-950/55 via-transparent to-transparent" /><span className="absolute bottom-3 left-3 rounded-md bg-white/90 px-2 py-1 text-[10px] font-bold text-slate-800 shadow-sm">{t("room.roomLabel", "Room")} {room.id}</span><span className="absolute bottom-3 right-3 rounded-md bg-slate-950/60 px-2 py-1 text-[10px] font-semibold text-white">{t("room.photoCount", "{{count}} photos", { count: room.images.length })}</span></button>
            <div className="flex items-start justify-between bg-linear-to-br from-blue-50 to-slate-50 p-4">
              <div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-950 text-sm font-bold text-white shadow-sm">{room.id}</div><div><p className="font-bold text-slate-900">{localizeRoomType(room.name)}</p><p className="mt-0.5 text-xs text-slate-500">{localizeBuilding(room.buildingName)} · {t("room.floorLabel", "Floor {{floor}}", { floor: room.floor.match(/\d+/)?.[0] ?? room.floor })} · {localizeSize(room.size)}</p></div></div>
              {canUpdateRoomStatus && room.status !== "Đang ở" && <div className="relative"><button type="button" onClick={() => setStatusMenuRoom((current) => current === room.id ? null : room.id)} aria-label={t("room.roomStatus")} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-700"><MoreHorizontal size={18} /></button>{statusMenuRoom === room.id && <div className="absolute right-0 top-9 z-20 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"><p className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">{t("room.roomStatus")}</p>{statusesForRoom.filter((nextStatus) => room.status !== "Đang dọn" || nextStatus !== "Sẵn sàng").map((nextStatus) => <button type="button" key={nextStatus} onClick={() => { void onUpdateRoom(room.id, { status: nextStatus }); setStatusMenuRoom(null); }} className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition hover:bg-slate-50 ${room.status === nextStatus ? "text-blue-700" : "text-slate-600"}`}><span>{localizeStatus(nextStatus)}</span>{room.status === nextStatus && <Check size={14} />}</button>)}</div>}</div>}
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle[room.status]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{room.status === "Sẵn sàng" ? t("room.ready") : room.status === "Đang dọn" ? t("room.cleaning") : room.status === "Đang ở" ? t("room.staying") : t("room.maintenance")}</span><p className="text-sm font-bold text-slate-900">{money(room.price)}<span className="text-xs font-normal text-slate-400"> {t("room.perNight")}</span></p></div>
              <div className="mt-4 grid grid-cols-2 gap-2 border-y border-slate-100 py-3"><p className="flex min-w-0 items-center gap-2 text-xs text-slate-600"><BedDouble size={15} className="shrink-0 text-slate-400" /><span className="truncate">{translateBed(room.beds)}</span></p><p className="flex min-w-0 items-center justify-end gap-2 text-right text-xs text-slate-600"><Users size={15} className="shrink-0 text-slate-400" /><span className="truncate">{t("room.standardCapacitySummary", { count: room.standardCapacity })}</span></p></div>
              <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2.5"><div className="grid grid-cols-2 gap-2 text-[11px]"><p className="text-slate-600">{t("room.adultSurcharge")}: <strong className="text-amber-800">{money(room.extraAdultFee)}{t("room.perPersonSuffix")}</strong></p><p className="text-slate-600">{t("room.childSurcharge")}: <strong className="text-amber-800">{money(room.extraChildFee)}{t("room.perPersonSuffix")}</strong></p></div><p className="mt-1 text-[10px] text-slate-500">{t("room.infantFreeNotice")}</p></div>
              <div className="mt-4 border-t border-slate-100 pt-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="min-w-0">{room.cleaner && <p className="truncate text-[11px] text-slate-500"><Sparkles size={13} className="mr-1 inline text-amber-500" />{room.cleaner}</p>}</div><div className="flex shrink-0 items-center gap-2"><button type="button" onClick={() => onShowDetails(room)} className="flex items-center gap-1 rounded-md border border-blue-200 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"><Eye size={13} />{t("room.details")}</button>{canManageRooms && <button type="button" onClick={() => onEditRoom(room)} className="flex items-center gap-1 rounded-md border border-amber-200 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800"><Pencil size={12} />{t("room.edit")}</button>}</div></div></div>
            </div>
          </article>
        ))}
      </div>

      <ListPagination totalItems={filtered.length} page={safePage} pageSize={pageSize} mode="cards" onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />
      {filtered.length === 0 && <FilterResultStatus filterKey={JSON.stringify([query, building, floor, roomType, status])}><div className="p-10 text-center"><p className="font-semibold text-slate-700">{t("room.noRooms")}</p><p className="mt-1 text-xs text-slate-400">{t("room.changeFilters")}</p></div></FilterResultStatus>}
      </>}
    </>
  );
}