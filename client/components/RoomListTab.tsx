import type { Dispatch, SetStateAction } from "react";
import { BedDouble, Check, ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Search, SlidersHorizontal, Sparkles, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

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
  onAssign: (room: RoomListItem) => void;
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
  onAssign,
}: RoomListTabProps) {
  const { t, i18n } = useTranslation();
  const money = (value: number) =>
    `${value.toLocaleString(i18n.resolvedLanguage?.startsWith("en") ? "en-US" : "vi-VN")}${i18n.resolvedLanguage?.startsWith("en") ? " VND" : "đ"}`;
  const translateBed = (bed: string) => bed.split(" · ").map((item) => {
    if (item.toLowerCase().includes("chưa cập nhật loại giường")) return t("room.bedNotUpdated");
    const quantity = item.match(/\s*[×x]\s*(\d+)$/i)?.[1];
    const name = quantity ? item.replace(/\s*[×x]\s*\d+$/i, "") : item;
    const normalized = name.toLowerCase();
    const translated = normalized.includes("2 giường đơn") || normalized.includes("2 single beds")
      ? t("room.doubleSingleBeds")
      : normalized.includes("giường đơn") || normalized.includes("single bed")
        ? t("room.singleBed")
        : normalized.includes("giường king") || normalized.includes("king-size") || normalized.includes("king size")
          ? t("room.kingBed")
          : name;
    return `${translated}${quantity ? ` × ${quantity}` : ""}`;
  }).join(" · ");
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
    return buildingName.replace(/^Tòa\s*/i, `${t("room.buildingPrefix")} `);
  };

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/60 p-4 sm:flex-row">
        <div className="relative flex-1"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={t("room.searchRooms")} className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
        <div className="relative"><SlidersHorizontal size={15} className="absolute left-3 top-3 text-slate-400" /><select value={building} onChange={(event) => onBuildingChange(event.target.value)} className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-600 outline-none focus:border-blue-400 sm:w-44"><option value="Tất cả các tòa">{t("room.allBuildings")}</option>{buildings.map((item) => <option key={item.id} value={item.id}>{localizeBuilding(item.name)}</option>)}</select></div>
        <div className="relative"><SlidersHorizontal size={15} className="absolute left-3 top-3 text-slate-400" /><select value={floor} onChange={(event) => onFloorChange(event.target.value)} className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-600 outline-none focus:border-blue-400 sm:w-44"><option value="Tất cả các tầng">{t("room.allFloors")}</option>{floors.map((item) => <option key={item} value={item}>{t("room.floorLabel", "Tầng: {{floor}}", { floor: item })}</option>)}</select></div>
        <div className="relative"><SlidersHorizontal size={15} className="absolute left-3 top-3 text-slate-400" /><select value={roomType} onChange={(event) => onRoomTypeChange(event.target.value)} className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-600 outline-none focus:border-blue-400 sm:w-52"><option value="Tất cả loại phòng">{t("room.allRoomTypes")}</option>{roomTypes.map((item) => <option key={item} value={item}>{localizeRoomType(item)}</option>)}</select></div>
        <div className="relative"><SlidersHorizontal size={15} className="absolute left-3 top-3 text-slate-400" /><select value={status} onChange={(event) => onStatusChange(event.target.value)} className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-600 outline-none focus:border-blue-400 sm:w-52"><option value="Tất cả trạng thái">{t("room.allStatuses")}</option>{statuses.map((item) => <option key={item} value={item}>{localizeStatus(item)}</option>)}</select></div>
      </div>

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
              <div className="mt-4 border-t border-slate-100 pt-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="min-w-0">{room.cleaner ? <p className="truncate text-[11px] text-slate-500"><Sparkles size={13} className="mr-1 inline text-amber-500" />{room.cleaner}</p> : <p className="text-[11px] text-slate-400">{t("room.unassignedCleaning")}</p>}</div><div className="flex shrink-0 items-center gap-2">{canManageRooms && <button type="button" onClick={() => onEditRoom(room)} className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"><Pencil size={12} />{t("room.edit")}</button>}<button type="button" onClick={() => onShowDetails(room)} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50">{t("room.details")}</button>{canManageRooms && !room.cleaner && <button type="button" onClick={() => onAssign(room)} className="rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-100">{t("room.assign")}</button>}</div></div></div>
            </div>
          </article>
        ))}
      </div>

      {filtered.length > 0 && <div className="flex flex-col gap-3 border-t border-slate-100 p-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between"><span>{t("room.paginationSummary", { from: (safePage - 1) * pageSize + 1, to: Math.min(safePage * pageSize, filtered.length), total: filtered.length })}</span><div className="flex items-center gap-2"><label className="flex items-center gap-2">{t("room.rowsPerPage")}<select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700"><option value={12}>12</option><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label><button type="button" onClick={() => onPageChange((current) => Math.max(1, current - 1))} disabled={safePage === 1} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label={t("common.previousPage")}><ChevronLeft size={16} /></button><span className="min-w-16 text-center font-semibold text-slate-700">{safePage} / {Math.max(1, Math.ceil(filtered.length / pageSize))}</span><button type="button" onClick={() => onPageChange((current) => Math.min(Math.max(1, Math.ceil(filtered.length / pageSize)), current + 1))} disabled={safePage >= Math.max(1, Math.ceil(filtered.length / pageSize))} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label={t("common.nextPage")}><ChevronRight size={16} /></button></div></div>}
      {filtered.length === 0 && <div className="p-10 text-center"><p className="font-semibold text-slate-700">{t("room.noRooms")}</p><p className="mt-1 text-xs text-slate-400">{t("room.changeFilters")}</p></div>}
    </>
  );
}