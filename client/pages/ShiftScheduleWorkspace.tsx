import { CalendarClock } from "lucide-react";
import { useTranslation } from "react-i18next";

export type ShiftName = "Ca sáng" | "Ca tối";
export type RoleName = "Lễ tân" | "Housekeeping";
export type Assignment = { staff: string; task: string };
export type ScheduleData = Record<string, Record<RoleName, Record<ShiftName, Assignment>>>;

type ShiftScheduleWorkspaceProps = {
  schedule: ScheduleData;
  onEdit: (dayKey: string) => void;
  title?: string;
  description?: string;
};

const week = [
  ["mon", "Thứ 2", "14/10"], ["tue", "Thứ 3", "15/10"], ["wed", "Thứ 4", "16/10"],
  ["thu", "Thứ 5", "17/10"], ["fri", "Thứ 6", "18/10"], ["sat", "Thứ 7", "19/10"], ["sun", "Chủ nhật", "20/10"],
] as const;
const shiftTimes: Record<ShiftName, string> = { "Ca sáng": "06:00 – 14:00", "Ca tối": "14:00 – 22:00" };

export default function ShiftScheduleWorkspace({ schedule, onEdit, title = "Thời khóa biểu cả tuần", description = "Theo dõi đầy đủ người trực và công việc của từng ngày." }: ShiftScheduleWorkspaceProps) {
  const { t } = useTranslation();
  const translatedWeek = week.map(([dayKey, label, date]) => [dayKey, t(`staff.days.${dayKey}`, label), date] as const);
  return <section className="shift-schedule-workspace mt-5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"><div className="flex items-start gap-3 border-b border-slate-100 p-5"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600"><CalendarClock size={20} /></div><div><h3 className="font-bold text-slate-900">{t("staff.weeklySchedule", title)}</h3><p className="mt-1 text-sm text-slate-500">{t("staff.weeklyScheduleDescription", description)}</p></div></div><div className="grid gap-3 overflow-x-auto p-4 md:grid-cols-7">{translatedWeek.map(([dayKey, label, date]) => <div key={dayKey} className="min-w-45 rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-bold text-slate-900">{label}</p><p className="mt-1 text-[11px] text-slate-500">{date}</p></div><button type="button" onClick={() => onEdit(dayKey)} className="rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700 hover:bg-blue-100">{t("staff.edit")}</button></div><div className="mt-3 space-y-2">{Object.entries(schedule[dayKey]).flatMap(([role, shifts]) => Object.entries(shifts).map(([shift, assignment]) => <div key={`${dayKey}-${role}-${shift}`} className={`rounded-lg border p-2.5 ${shift === "Ca sáng" ? "border-amber-100 bg-amber-50" : "border-blue-100 bg-blue-50"}`}><p className="text-[9px] font-semibold text-slate-500">{role} · {shift === "Ca sáng" ? t("staff.morningShort") : t("staff.eveningShort")}</p><p className="mt-1 truncate text-[10px] font-bold text-slate-800">{assignment.staff}</p><p className="mt-0.5 truncate text-[9px] text-slate-500">{assignment.task}</p><p className="mt-0.5 text-[9px] text-slate-500">{shiftTimes[shift as ShiftName]}</p></div>))}</div></div>)}</div></section>;
}
