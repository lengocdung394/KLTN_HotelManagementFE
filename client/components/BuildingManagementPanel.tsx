import { Pencil, Search } from "lucide-react";
import { useTranslation } from "react-i18next";

export type BuildingItem = { id: string; name: string };

type BuildingManagementPanelProps = {
  buildings: BuildingItem[];
  query: string;
  filteredBuildings: BuildingItem[];
  onQueryChange: (value: string) => void;
  onEdit: (building: BuildingItem) => void;
};

export default function BuildingManagementPanel({ buildings, query, filteredBuildings, onQueryChange, onEdit }: BuildingManagementPanelProps) {
  const { t } = useTranslation();

  return <div className="border-b border-slate-100 p-4">
    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{t("room.buildingList", "Danh sách tòa nhà")}</p>
      <div className="relative w-full sm:w-64">
        <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
        <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={t("room.searchBuildings", "Tìm tên hoặc mã tòa...")} className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
      </div>
    </div>
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {filteredBuildings.map((building) => <div key={building.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
        <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{building.name}</p><p className="mt-0.5 text-[10px] font-semibold tracking-wider text-slate-400">{building.id}</p></div>
        <button type="button" onClick={() => onEdit(building)} aria-label={`${t("room.editBuilding", "Sửa tòa nhà")} ${building.name}`} className="ml-2 rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-blue-600"><Pencil size={15} /></button>
      </div>)}
    </div>
    {filteredBuildings.length === 0 && <p className="py-4 text-center text-xs text-slate-400">{t("room.noBuildingsFound", "Không tìm thấy tòa nhà phù hợp.")}</p>}
    {!query.trim() && buildings.length > 4 && <p className="mt-3 text-center text-[11px] text-slate-400">{t("room.buildingLimitHint", "Đang hiển thị 4 tòa nhà gần nhất. Dùng ô tìm kiếm để xem thêm.")}</p>}
  </div>;
}
