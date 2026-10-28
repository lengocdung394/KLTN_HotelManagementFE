import { CalendarClock, Clock3 } from "lucide-react";
import { useGetMyHousekeepingTasksQuery, useGetTodayShiftAssignmentsQuery } from "../services/shiftApi";
import { useAppSelector } from "../store/hooks";
import { localizedText } from "../i18n";

const localDate = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${dayOfMonth}`;
};

export default function EmployeeShiftSchedule() {
  const { data: shifts = [], isLoading, isError } = useGetTodayShiftAssignmentsQuery();
  const {
    data: housekeepingTasks = [],
    isLoading: isTasksLoading,
    isError: isTasksError,
  } = useGetMyHousekeepingTasksQuery(undefined, {
    pollingInterval: 30000,
  });
  const employeeId = useAppSelector((state) => state.auth.employeeId);
  const today = localDate();
  const myShifts = shifts.filter((shift) => shift.employeeId === employeeId && shift.workDate === today);

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-slate-100 p-5">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
          <CalendarClock size={20} />
        </div>
        <div>
          <h2 className="font-bold text-slate-900">{localizedText("Ca làm hôm nay và công việc được giao", "Today's shifts and assigned tasks")}</h2>
          <p className="mt-1 text-sm text-slate-500">{localizedText("Lịch ca cá nhân và các việc cần hoàn thành trong ca.", "Your shift schedule and tasks to complete during the shift.")}</p>
        </div>
      </div>
      {isLoading ? (
        <p className="p-6 text-sm text-slate-500">{localizedText("Đang tải ca làm hôm nay...", "Loading today's shifts...")}</p>
      ) : isError ? (
        <p role="alert" className="p-6 text-sm text-rose-600">{localizedText("Không thể tải ca làm hôm nay. Vui lòng thử lại sau.", "Could not load today's shifts. Please try again later.")}</p>
      ) : myShifts.length === 0 ? (
        <p className="p-6 text-sm text-slate-500">{localizedText("Hôm nay bạn chưa được phân ca.", "You have not been assigned a shift today.")}</p>
      ) : (
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {myShifts.map((shift) => (
            <article key={shift.id ?? `${shift.workDate}-${shift.shiftType}`} className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{shift.shiftType === "Ca sáng" ? localizedText("Ca sáng", "Morning shift") : shift.shiftType === "Ca chiều" ? localizedText("Ca chiều", "Afternoon shift") : shift.shiftType === "Ca đêm" ? localizedText("Ca đêm", "Night shift") : shift.shiftType}</h3>
                  <p className="mt-1 text-xs text-slate-500">{shift.role === "Lễ tân" ? localizedText("Lễ tân", "Front desk") : shift.role === "Buồng phòng" ? localizedText("Buồng phòng", "Housekeeping") : shift.role === "Bảo vệ" ? localizedText("Bảo vệ", "Security") : shift.role || shift.position}</p>
                </div>
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-blue-700">
                  <Clock3 size={12} />{shift.shiftTime}
                </span>
              </div>
              {shift.task && (
                <p className="mt-3 rounded-lg bg-white/80 p-3 text-sm text-slate-700">
                  <span className="font-semibold">{localizedText("Công việc:", "Task:")}</span> {shift.task === "Trực quầy lễ tân" ? localizedText(shift.task, "Front desk duty") : shift.task === "Dọn phòng" ? localizedText(shift.task, "Room cleaning") : shift.task === "Trực an ninh" ? localizedText(shift.task, "Security duty") : shift.task}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
      <section className="border-t border-slate-100 p-5">
        <h3 className="text-sm font-bold text-slate-900">{localizedText("Phân công dọn phòng", "Housekeeping assignments")}</h3>
        <p className="mt-1 text-xs text-slate-500">{localizedText("Các phòng được giao cho bạn dọn sau khi khách checkout.", "Rooms assigned to you for cleaning after guest checkout.")}</p>
        {isTasksLoading ? (
          <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">{localizedText("Đang tải phân công dọn phòng...", "Loading housekeeping assignments...")}</p>
        ) : isTasksError ? (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{localizedText("Không thể tải phân công dọn phòng.", "Could not load housekeeping assignments.")}</p>
        ) : housekeepingTasks.length === 0 ? (
          <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">{localizedText("Hiện chưa có phòng nào được giao cho bạn dọn.", "No rooms have been assigned to you for cleaning yet.")}</p>
        ) : (
          <div className="mt-3 space-y-2">
            {housekeepingTasks.map((task) => (
              <article key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{localizedText("Phòng", "Room")} {task.roomNumber}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {task.status === "REASSIGNED" ? localizedText("Đã chuyển giao sau 1 giờ chưa xác nhận", "Reassigned after no confirmation for 1 hour") : localizedText("Được giao sau khi khách checkout", "Assigned after guest checkout")}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
