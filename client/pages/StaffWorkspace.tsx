import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, Clock3, UserRound } from "lucide-react";
import type { ScheduleData, ShiftName } from "./ShiftScheduleWorkspace";

const week = [
  ["mon", "14/10"],
  ["tue", "15/10"],
  ["wed", "16/10"],
  ["thu", "17/10"],
  ["fri", "18/10"],
  ["sat", "19/10"],
  ["sun", "20/10"],
] as const;

export default function StaffWorkspace({ schedule, onEdit }: { schedule: ScheduleData; onEdit: (dayKey: string) => void }) {
  const { t } = useTranslation();
  const [selectedDay, setSelectedDay] = useState("mon");
  const selectedDate = week.find(([key]) => key === selectedDay)?.[1] ?? "";
  const shifts = Object.entries(schedule[selectedDay]).flatMap(([role, roleShifts]) =>
    Object.entries(roleShifts).map(([shift, assignment]) => ({
      role,
      shift: shift as ShiftName,
      assignment,
    })),
  );
  const dayLabel = (key: string) => t(`staff.days.${key}`, key);
  const shiftLabel = (shift: ShiftName) => shift === "Ca sáng" ? t("staff.morning", "Morning shift") : t("staff.evening", "Evening shift");
  const roleLabel = (role: string) => role === "Lễ tân" ? t("staff.frontDesk", "Front desk") : t("staff.housekeeping", "Housekeeping");

  return (
    <>
    <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><CalendarDays size={19} /></div>
          <div>
            <h3 className="font-bold text-slate-900">{t("staff.dailySchedule", "Daily schedule")}</h3>
            <p className="mt-1 text-sm text-slate-500">{dayLabel(selectedDay)} · {selectedDate} · {t("staff.todayShifts", "Today's shifts")}</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 border-b border-slate-100 p-4 sm:grid-cols-4 lg:grid-cols-7">
        {week.map(([key, date]) => <button type="button" key={key} onClick={() => setSelectedDay(key)} className={`rounded-xl px-2 py-3 text-center transition ${selectedDay === key ? "bg-blue-600 text-white shadow-sm" : "bg-slate-50 text-slate-600 hover:bg-blue-50"}`}><p className="text-xs font-semibold">{dayLabel(key)}</p><p className={`mt-1 text-sm font-bold ${selectedDay === key ? "text-white" : "text-slate-900"}`}>{date}</p></button>)}
      </div>
      <div className="grid gap-3 p-5 md:grid-cols-2">
        {shifts.map(({ role, shift, assignment }) => <div key={`${role}-${shift}`} className={`rounded-xl border p-4 ${shift === "Ca sáng" ? "border-amber-100 bg-amber-50/70" : "border-blue-100 bg-blue-50/70"}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-500">{roleLabel(role)} · {shiftLabel(shift)}</p>
              <p className="mt-2 flex items-center gap-2 text-base font-bold text-slate-900"><UserRound size={15} className="text-slate-400" />{assignment.staff}</p>
              <p className="mt-1 text-sm text-slate-600">{assignment.task}</p>
            </div>
            <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-500"><Clock3 size={13} />{shift === "Ca sáng" ? "06:00" : "14:00"} {t("staff.to", "to")} {shift === "Ca sáng" ? "14:00" : "22:00"}</span>
          </div>
        </div>)}
      </div>
    </section>
    </>
  );
}
