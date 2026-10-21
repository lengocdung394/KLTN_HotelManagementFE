import { CalendarClock, Check, Clock3 } from "lucide-react";
import { useCompleteHousekeepingTaskMutation, useGetMyHousekeepingTasksQuery, useGetWeeklyShiftScheduleQuery } from "../services/shiftApi";
import { useAppSelector } from "../store/hooks";
import { useState } from "react";

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
  const roles = useAppSelector((state) => state.auth.roles);
  const { data: housekeepingTasks = [], isError: isTasksError } = useGetMyHousekeepingTasksQuery(undefined, {
    skip: !roles.includes("ROLE_EMPLOYEE"),
    pollingInterval: 30000,
  });
  const [completeTask, { isLoading: isCompletingTask }] = useCompleteHousekeepingTaskMutation();
  const [taskActionError, setTaskActionError] = useState("");

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
      {isTasksError && <p role="alert" className="mx-5 mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">Không thể tải yêu cầu dọn phòng.</p>}
      {housekeepingTasks.length > 0 && (
        <section className="border-t border-slate-100 p-5">
          <h3 className="text-sm font-bold text-slate-900">Phòng cần dọn sau checkout</h3>
          <p className="mt-1 text-xs text-slate-500">Bạn cần xác nhận hoàn tất sau khi dọn để chuyển phòng sang trạng thái sẵn sàng.</p>
          <div className="mt-3 space-y-2">
            {housekeepingTasks.map((task) => (
              <article key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Phòng {task.roomNumber}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {task.status === "REASSIGNED" ? "Đã chuyển giao sau 1 giờ chưa xác nhận" : "Được giao sau khi khách checkout"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isCompletingTask}
                  onClick={() => {
                    setTaskActionError("");
                    void completeTask(task.id).unwrap().catch((error: { data?: { message?: string } }) => {
                      setTaskActionError(error.data?.message ?? "Không xác nhận được việc dọn phòng. Vui lòng thử lại.");
                    });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  <Check size={14} />Xác nhận đã dọn xong
                </button>
              </article>
            ))}
          </div>
          {taskActionError && <p role="alert" className="mt-3 text-sm text-rose-700">{taskActionError}</p>}
        </section>
      )}
    </section>
  );
}
