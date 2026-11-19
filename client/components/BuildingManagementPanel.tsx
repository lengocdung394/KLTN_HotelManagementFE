import { Pencil, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import ListPagination from "./ListPagination";
import ClearSearchButton from "./ClearSearchButton";
import FilterResultStatus from "./FilterResultStatus";

export type BuildingItem = { id: string; name: string };

type BuildingManagementPanelProps = {
  query: string;
  filteredBuildings: BuildingItem[];
  onQueryChange: (value: string) => void;
  onEdit: (building: BuildingItem) => void;
  canManage: boolean;
};

export default function BuildingManagementPanel({ query, filteredBuildings, onQueryChange, onEdit, canManage }: BuildingManagementPanelProps) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(filteredBuildings.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedBuildings = filteredBuildings.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return <div className="border-b border-slate-100 p-4">
    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{t("room.buildingList", "Danh sách tòa nhà")}</p>
      <div className="relative w-full sm:w-64">
        <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
        <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={t("room.searchBuildings")} className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-9 text-xs outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
        <ClearSearchButton value={query} onClear={() => onQueryChange("")} label={t("common.clearSearch")} className="h-6 w-6" />
      </div>
    </div>
    {canManage && <p className="mb-3 text-xs text-slate-500">{t("room.addBuildingHint")}</p>}
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="whitespace-nowrap px-4 py-3">{t("common.serialNumber", "STT")}</th>
            <th scope="col" className="px-4 py-3">{t("room.buildingNameColumn")}</th>
            {canManage && <th scope="col" className="px-4 py-3 text-right">{t("room.actionsColumn")}</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {paginatedBuildings.map((building, index) => <tr key={building.id} className="hover:bg-slate-50/70">
            <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-500">{(safePage - 1) * pageSize + index + 1}</td>
            <td className="px-4 py-3 font-semibold text-slate-800">{building.name}</td>
            {canManage && <td className="px-4 py-2 text-right">
              <button type="button" onClick={() => onEdit(building)} aria-label={`${t("room.editBuilding")} ${building.name}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                <Pencil size={13} />{t("common.edit")}
              </button>
            </td>}
          </tr>)}
          {filteredBuildings.length === 0 && <tr><td colSpan={canManage ? 3 : 2} className="p-0"><FilterResultStatus filterKey={query}><p className="px-4 py-6 text-center text-xs text-slate-400">{t("room.noBuildingsFound")}</p></FilterResultStatus></td></tr>}
        </tbody>
      </table>
    </div>
    <ListPagination totalItems={filteredBuildings.length} page={safePage} pageSize={pageSize} mode="table" onPageChange={setPage} onPageSizeChange={setPageSize} />
  </div>;
}
