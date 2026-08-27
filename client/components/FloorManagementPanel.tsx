import { Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";

type FloorManagementPanelProps = {
  floors: string[];
  rooms: { floor: string }[];
  onEdit: (floor: string) => void;
};

export default function FloorManagementPanel({ floors, rooms, onEdit }: FloorManagementPanelProps) {
  const { t } = useTranslation();

  return <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-4">
    {floors.map((floor) => <div key={floor} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div><p className="text-sm font-bold text-slate-800">{floor}</p><p className="mt-1 text-xs text-slate-500">{rooms.filter((room) => room.floor === floor).length} {t("room.rooms")}</p></div>
      <button type="button" onClick={() => onEdit(floor)} aria-label={`${t("room.editFloor")} ${floor}`} className="rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-blue-600"><Pencil size={15} /></button>
    </div>)}
  </div>;
}
