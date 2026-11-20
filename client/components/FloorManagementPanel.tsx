import { Pencil, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import ListPagination from "./ListPagination";
import ClearSearchButton from "./ClearSearchButton";
import FilterSelect from "./FilterSelect";
import FilterResultStatus from "./FilterResultStatus";

type FloorManagementPanelProps = {
  floors: string[];
  rooms: { floor: string }[];
  buildings: { id: string; name: string }[];
  selectedBuildingId: string;
  onBuildingChange: (buildingId: string) => void;
  onEdit: (floor: string) => void;
  canManage: boolean;
};

export default function FloorManagementPanel({ floors, rooms, buildings, selectedBuildingId, onBuildingChange, onEdit, canManage }: FloorManagementPanelProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const filteredFloors = floors.filter((floor) => floor.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(normalizedQuery));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(filteredFloors.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedFloors = filteredFloors.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, selectedBuildingId, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return <div className="border-b border-slate-100 p-4">
    <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row">
      <FilterSelect value={selectedBuildingId} onChange={(event) => onBuildingChange(event.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:w-64">
        {buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
      </FilterSelect>
      <div className="relative w-full sm:w-64">
        <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("room.searchFloors")} className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-9 text-xs outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
        <ClearSearchButton value={query} onClear={() => setQuery("")} label={t("common.clearSearch")} className="h-6 w-6" />
      </div>
    </div>
    {canManage && <p className="mb-3 text-xs text-slate-500">{t("room.addFloorHint")}</p>}
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[420px] text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="whitespace-nowrap px-4 py-3">{t("common.serialNumber", "STT")}</th>
            <th scope="col" className="px-4 py-3">{t("room.floorNameColumn")}</th>
            <th scope="col" className="px-4 py-3">{t("room.roomCountColumn")}</th>
            {canManage && <th scope="col" className="px-4 py-3 text-right">{t("room.actionsColumn")}</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {paginatedFloors.map((floor, index) => <tr key={floor} className="hover:bg-slate-50/70">
            <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-500">{(safePage - 1) * pageSize + index + 1}</td>
            <td className="px-4 py-3 font-semibold text-slate-800">{t("room.floorLabel", { floor })}</td>
            <td className="px-4 py-3 text-slate-600">{rooms.filter((room) => room.floor === floor).length} {t("room.rooms")}</td>
            {canManage && <td className="px-4 py-2 text-right">
              <button type="button" onClick={() => onEdit(floor)} aria-label={`${t("room.editFloor")} ${floor}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                <Pencil size={13} />{t("common.edit")}
              </button>
            </td>}
          </tr>)}
          {filteredFloors.length === 0 && <tr><td colSpan={canManage ? 4 : 3} className="p-0"><FilterResultStatus filterKey={JSON.stringify([query, selectedBuildingId])}><p className="px-4 py-6 text-center text-xs text-slate-400">{t("room.noFloorsFound")}</p></FilterResultStatus></td></tr>}
        </tbody>
      </table>
    </div>
    <ListPagination totalItems={filteredFloors.length} page={safePage} pageSize={pageSize} mode="table" onPageChange={setPage} onPageSizeChange={setPageSize} />
  </div>;
}
