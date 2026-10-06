import { CalendarClock, Clock3 } from "lucide-react";
import { useGetWeeklyShiftScheduleQuery } from "../services/shiftApi";

const getMonday = () => {
  const date = new Date();
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${dayOfMonth}`;
};

export default function EmployeeShiftSchedule() {
  const { data, isLoading, isError } = useGetWeeklyShiftScheduleQuery(getMonday());

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-slate-100 p-5">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
          <CalendarClock size={20} />
        </div>
        <div>
          <h2 className="font-bold text-slate-900">Lịch làm việc tuần</h2>
          <p className="mt-1 text-sm text-slate-500">
            {data ? `${data.weekStartDate} – ${data.weekEndDate}` : "Lịch phân ca của chi nhánh"}
          </p>
        </div>
      </div>
      {isLoading ? (
        <p className="p-6 text-sm text-slate-500">Đang tải lịch làm việc...</p>
      ) : isError ? (
        <p className="p-6 text-sm text-rose-600">Không thể tải lịch làm việc. Vui lòng thử lại sau.</p>
      ) : !data || data.days.length === 0 ? (
        <p className="p-6 text-sm text-slate-500">Chưa có lịch làm việc cho tuần này.</p>
      ) : (
        <>
          <div className="grid gap-3 overflow-x-auto p-4 md:grid-cols-7">
            {data.days.map((day) => (
              <article key={day.date} className="min-w-45 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">{day.dayLabel}</h3>
                    <p className="mt-1 text-[11px] text-slate-500">{day.dateDisplay}</p>
                  </div>
                  <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-semibold text-blue-700">
                    {day.totalAssigned} ca
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {day.assignments.map((assignment, index) => (
                    <div key={`${day.date}-${assignment.employeeId}-${assignment.shiftType}-${index}`} className="rounded-lg border border-blue-100 bg-blue-50 p-2.5">
                      <p className="text-[9px] font-semibold text-slate-500">{assignment.role} · {assignment.shiftType}</p>
                      <p className="mt-1 truncate text-[10px] font-bold text-slate-800">{assignment.employeeName}</p>
                      <p className="mt-0.5 truncate text-[9px] text-slate-500">{assignment.task || assignment.position}</p>
                      <p className="mt-1 flex items-center gap-1 text-[9px] text-slate-500">
                        <Clock3 size={10} />{assignment.shiftTime}
                      </p>
                    </div>
                  ))}
                  {day.assignments.length === 0 && <p className="rounded-lg bg-white p-3 text-center text-[10px] text-slate-400">Chưa phân ca</p>}
                </div>
              </article>
            ))}
          </div>
          <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            Tổng cộng {data.totalAssignments} ca đã phân công trong tuần.
          </p>
        </>
      )}
    </section>
  );
}
