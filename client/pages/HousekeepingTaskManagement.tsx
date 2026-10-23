import { useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, Clock3, LoaderCircle, UserRound } from "lucide-react";
import {
  useAssignHousekeepingTaskMutation,
  useCompleteHousekeepingTaskByManagerMutation,
  useGetHotelHousekeepingTasksQuery,
  useGetWeeklyShiftScheduleQuery,
  type HousekeepingTask,
} from "../services/shiftApi";

const formatDateTime = (value: string) => new Date(value).toLocaleString("vi-VN");

const statusLabel = (status: string) => {
  if (status === "NEEDS_ASSIGNMENT") return "Chờ phân công";
  if (status === "REASSIGNED") return "Đã phân công lại";
  return "Đã giao việc";
};

const formatDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const mondayOf = (date: Date) => {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
};

const getShiftWorkDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getHours() < 6) date.setDate(date.getDate() - 1);
  return formatDate(date);
};

export default function HousekeepingTaskManagement() {
  const {
    data: tasks = [],
    isLoading: isTasksLoading,
    isError: isTasksError,
  } = useGetHotelHousekeepingTasksQuery(undefined, { pollingInterval: 30000 });
  const [assignTask, { isLoading: isAssigning }] = useAssignHousekeepingTaskMutation();
  const [completeTask, { isLoading: isCompleting }] = useCompleteHousekeepingTaskByManagerMutation();
  const [selectedEmployees, setSelectedEmployees] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const pendingTasks = tasks.filter((task) => task.status === "NEEDS_ASSIGNMENT");
  const assignedTasks = tasks.filter((task) => task.status !== "NEEDS_ASSIGNMENT");

  const assign = async (task: HousekeepingTask) => {
    const employeeId = selectedEmployees[task.id] ?? "";
    if (!employeeId) {
      setError(`Vui lòng chọn nhân viên trong ca làm phù hợp cho phòng ${task.roomNumber}.`);
      return;
    }

    setError("");
    try {
      await assignTask({ taskId: task.id, employeeId }).unwrap();
      setSelectedEmployees((current) => {
        const next = { ...current };
        delete next[task.id];
        return next;
      });
    } catch (assignError) {
      const response = assignError as { data?: { message?: string }; error?: string };
      setError(response.data?.message ?? response.error ?? "Không thể phân công việc dọn phòng. Vui lòng thử lại.");
    }
  };

  const complete = async (task: HousekeepingTask) => {
    setError("");
    try {
      await completeTask(task.id).unwrap();
    } catch (completeError) {
      const response = completeError as { data?: { message?: string }; error?: string };
      setError(response.data?.message ?? response.error ?? "Không thể xác nhận dọn phòng. Vui lòng thử lại.");
    }
  };

  return (
    <section className="mt-5 space-y-5">
      <header className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
          <ClipboardList size={20} />
        </span>
        <div>
          <h2 className="font-bold text-slate-900">Phân công công việc dọn phòng</h2>
          <p className="mt-1 text-sm text-slate-500">Chỉ chọn nhân viên buồng phòng được xếp trong ca tại thời điểm checkout.</p>
        </div>
      </header>

      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {isTasksError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Không tải được công việc dọn phòng của chi nhánh.</p>}
      {isTasksLoading ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Đang tải công việc...</p>
      ) : !isTasksError && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-900">Cần phân công</h3>
                <p className="mt-1 text-xs text-slate-500">Các phòng checkout đang chờ quản lý chọn nhân viên.</p>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{pendingTasks.length}</span>
            </div>
            <div className="space-y-3">
              {pendingTasks.map((task) => (
                <HousekeepingTaskCard
                  key={task.id}
                  task={task}
                  isPending
                  selectedEmployeeId={selectedEmployees[task.id] ?? ""}
                  onSelectEmployee={(employeeId) => {
                    setSelectedEmployees((current) => ({ ...current, [task.id]: employeeId }));
                    setError("");
                  }}
                  onAssign={() => void assign(task)}
                  onComplete={() => void complete(task)}
                  isAssigning={isAssigning}
                  isCompleting={isCompleting}
                />
              ))}
              {pendingTasks.length === 0 && <p className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500">Không có phòng nào đang chờ phân công.</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-900">Đã giao việc, đang chờ dọn</h3>
                <p className="mt-1 text-xs text-slate-500">Nhân viên sẽ xác nhận hoàn tất trong lịch làm việc của họ.</p>
              </div>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">{assignedTasks.length}</span>
            </div>
            <div className="space-y-3">
              {assignedTasks.map((task) => (
                <HousekeepingTaskCard
                  key={task.id}
                  task={task}
                  selectedEmployeeId={selectedEmployees[task.id] ?? task.assignedEmployeeId ?? ""}
                  onSelectEmployee={(employeeId) => {
                    setSelectedEmployees((current) => ({ ...current, [task.id]: employeeId }));
                    setError("");
                  }}
                  onAssign={() => void assign(task)}
                  onComplete={() => void complete(task)}
                  isAssigning={isAssigning}
                  isCompleting={isCompleting}
                />
              ))}
              {assignedTasks.length === 0 && <p className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500">Chưa có công việc được giao.</p>}
            </div>
          </section>
        </>
      )}
    </section>
  );
}

function HousekeepingTaskCard({
  task,
  isPending = false,
  selectedEmployeeId,
  onSelectEmployee,
  onAssign,
  onComplete,
  isAssigning,
  isCompleting,
}: {
  task: HousekeepingTask;
  isPending?: boolean;
  selectedEmployeeId: string;
  onSelectEmployee: (employeeId: string) => void;
  onAssign: () => void;
  onComplete: () => void;
  isAssigning: boolean;
  isCompleting: boolean;
}) {
  const workDate = getShiftWorkDate(task.createdAt);
  const weekStartDate = workDate ? formatDate(mondayOf(new Date(`${workDate}T00:00:00`))) : "";
  const {
    data: schedule,
    isLoading,
    isError,
  } = useGetWeeklyShiftScheduleQuery(weekStartDate, { skip: !weekStartDate });
  const shiftAssignments = schedule?.days
    .find((day) => day.date === workDate)
    ?.assignments.filter((assignment) => {
      const normalizedRole = assignment.role.trim().toLocaleLowerCase("vi");
      if (!normalizedRole.includes("buồng") && !normalizedRole.includes("buong") && !normalizedRole.includes("housekeeping")) return false;

      const times = Array.from(assignment.shiftTime.matchAll(/(\d{1,2}):(\d{2})/g), (match) => Number(match[1]) * 60 + Number(match[2]));
      if (times.length < 2) return false;
      const taskDate = new Date(task.createdAt);
      const taskMinutes = taskDate.getHours() * 60 + taskDate.getMinutes();
      const [start, end] = times;
      return start < end ? taskMinutes >= start && taskMinutes < end : taskMinutes >= start || taskMinutes < end;
    }) ?? [];
  const currentEmployeeListed = shiftAssignments.some((assignment) => assignment.employeeId === task.assignedEmployeeId);
  const changedAssignee = Boolean(task.assignedEmployeeId && selectedEmployeeId !== task.assignedEmployeeId);

  return (
    <article className={`rounded-xl border p-4 ${isPending ? "border-amber-200 bg-amber-50/70" : "border-slate-200 bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold text-slate-900">Phòng {task.roomNumber}</h4>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${isPending ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-700"}`}>
              {statusLabel(task.status)}
            </span>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <Clock3 size={13} />Checkout lúc {formatDateTime(task.createdAt)}
          </p>
          {task.assignedEmployeeName && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
              <UserRound size={13} />Đang giao cho {task.assignedEmployeeName}
            </p>
          )}
        </div>
        {isPending && <AlertTriangle size={18} className="text-amber-600" aria-label="Đang chờ phân công" />}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="min-w-0 flex-1">
          <select
            aria-label={`Chọn nhân viên dọn phòng ${task.roomNumber}`}
            value={selectedEmployeeId}
            onChange={(event) => onSelectEmployee(event.target.value)}
            disabled={isLoading || isError || isAssigning || isCompleting || shiftAssignments.length === 0}
            className="h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
          >
            <option value="">{isLoading ? "Đang tải nhân viên trong ca..." : "Chọn nhân viên trong ca"}</option>
            {task.assignedEmployeeId && !currentEmployeeListed && (
              <option value={task.assignedEmployeeId} disabled>{task.assignedEmployeeName} · đã phân công</option>
            )}
            {shiftAssignments.map((assignment) => (
              <option key={assignment.employeeId} value={assignment.employeeId}>
                {assignment.employeeName} · {assignment.shiftType}
              </option>
            ))}
          </select>
          {!isLoading && !isError && shiftAssignments.length === 0 && (
            <p className="mt-1 text-xs text-amber-700">Chưa có nhân viên buồng phòng được phân ca vào thời điểm checkout này.</p>
          )}
          {isError && <p role="alert" className="mt-1 text-xs text-rose-700">Không tải được lịch phân ca cho thời điểm checkout này.</p>}
        </div>
        {(isPending || changedAssignee) && (
          <button
            type="button"
            onClick={onAssign}
            disabled={isAssigning || isCompleting || isLoading || isError || !selectedEmployeeId || !shiftAssignments.some((assignment) => assignment.employeeId === selectedEmployeeId)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAssigning ? <LoaderCircle size={15} className="animate-spin" /> : <UserRound size={15} />}
            {isPending ? "Phân công" : "Chuyển nhân viên"}
          </button>
        )}
        {!isPending && (
          <button
            type="button"
            onClick={onComplete}
            disabled={isCompleting || isAssigning}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCompleting ? <LoaderCircle size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            Xác nhận đã dọn xong
          </button>
        )}
      </div>
    </article>
  );
}
