import { Pencil, Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

type FloorManagementPanelProps = {
  floors: string[];
  rooms: { floor: string }[];
  onEdit: (floor: string) => void;
};

export default function FloorManagementPanel({ floors, rooms, onEdit }: FloorManagementPanelProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const filteredFloors = floors.filter((floor) => floor.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(normalizedQuery));

  return <div className="border-b border-slate-100 p-4">
    <div className="mb-3 flex justify-end">
      <div className="relative w-full sm:w-64">
        <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("room.searchFloors", "Tìm tầng nhà...")} className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    {filteredFloors.map((floor) => <div key={floor} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div><p className="text-sm font-bold text-slate-800">{floor}</p><p className="mt-1 text-xs text-slate-500">{rooms.filter((room) => room.floor === floor).length} {t("room.rooms")}</p></div>
      <button type="button" onClick={() => onEdit(floor)} aria-label={`${t("room.editFloor")} ${floor}`} className="rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-blue-600"><Pencil size={15} /></button>
    </div>)}
    </div>
    {filteredFloors.length === 0 && <p className="py-4 text-center text-xs text-slate-400">{t("room.noFloorsFound", "Không tìm thấy tầng nhà phù hợp.")}</p>}
  </div>;
}
