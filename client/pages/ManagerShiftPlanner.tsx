import { useEffect, useMemo, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, Copy, Save, Trash2 } from "lucide-react";
import { useGetMyHotelEmployeesQuery } from "../services/employeeApi";
import {
  useClearWeeklyShiftScheduleMutation,
  useCopyWeeklyShiftScheduleMutation,
  useGetWeeklyShiftScheduleQuery,
  useSaveWeeklyShiftScheduleMutation,
  type ShiftAssignmentRequest,
} from "../services/shiftApi";
import { useAppSelector } from "../store/hooks";

const shifts = [
  { type: "Ca sáng", time: "06:00 – 14:00" },
  { type: "Ca chiều", time: "14:00 – 22:00" },
  { type: "Ca đêm", time: "22:00 – 06:00" },
] as const;

const roles = [
  { name: "Lễ tân", count: 2, task: "Trực quầy lễ tân" },
  { name: "Buồng phòng", count: 2, task: "Dọn phòng" },
  { name: "Bảo vệ", count: 1, task: "Trực an ninh" },
] as const;

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const mondayOf = (date: Date) => {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
};

const addDays = (date: Date, count: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + count);
  return result;
};

const formatDay = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString("vi-VN", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
});

const normalizePosition = (position: string) => position
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/đ/g, "d");

const positionMatches = (position: string, role: string) => {
  const value = normalizePosition(position);
  if (role === "Lễ tân") {
    return value.includes("le tan") || value.includes("reception") || value.includes("front desk") || value.includes("front office");
  }
  if (role === "Buồng phòng") {
    return value.includes("buong") || value.includes("housekeeping") || value.includes("housekeeper") || value.includes("room attendant");
  }
  return value.includes("bao ve") || value.includes("security") || value.includes("guard");
};

const assignmentKey = (date: string, shift: string, role: string, slot: number) => `${date}|${shift}|${role}|${slot}`;
export const shiftDraftStorageKey = (hotelId: string | null, weekStart: string) =>
  `shift-schedule-draft:${hotelId ?? "unknown"}:${weekStart}`;

type DraftStatus = { dirty: boolean; storageKey: string };

export default function ManagerShiftPlanner({ onDraftStatusChange }: { onDraftStatusChange?: (status: DraftStatus) => void }) {
  const hotelId = useAppSelector((state) => state.auth.hotelId);
  const initialWeek = useMemo(() => dateKey(addDays(mondayOf(new Date()), 7)), []);
  const [weekStart, setWeekStart] = useState(initialWeek);
  const [sourceWeekStart, setSourceWeekStart] = useState(dateKey(addDays(mondayOf(new Date()), 0)));
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingWeek, setPendingWeek] = useState<string | null>(null);
  const [error, setError] = useState("");
  const storageKey = shiftDraftStorageKey(hotelId, weekStart);
  const { data: schedule, isLoading: isScheduleLoading, isError: isScheduleError } = useGetWeeklyShiftScheduleQuery(weekStart);
  const { data: employees = [], isLoading: isEmployeesLoading, isError: isEmployeesError, error: employeesError } = useGetMyHotelEmployeesQuery();
  const [saveSchedule, { isLoading: isSaving }] = useSaveWeeklyShiftScheduleMutation();
  const [clearSchedule, { isLoading: isClearing }] = useClearWeeklyShiftScheduleMutation();
  const [copySchedule, { isLoading: isCopying }] = useCopyWeeklyShiftScheduleMutation();
  const today = dateKey(new Date());
  const firstEditableDate = dateKey(addDays(new Date(`${today}T00:00:00`), 1));

  const dates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => dateKey(addDays(new Date(`${weekStart}T00:00:00`), index))),
    [weekStart],
  );
  const canEditWeek = dates[6] > today;

  useEffect(() => {
    if (!schedule || schedule.weekStartDate !== weekStart) return;
    const next: Record<string, string> = {};
    schedule.days.forEach((day) => {
      const grouped = new Map<string, string[]>();
      day.assignments.forEach((assignment) => {
        const key = `${day.date}|${assignment.shiftType}|${assignment.role}`;
        grouped.set(key, [...(grouped.get(key) ?? []), assignment.employeeId]);
      });
      grouped.forEach((employeeIds, groupKey) => {
        const [date, shift, role] = groupKey.split("|");
        employeeIds.forEach((employeeId, slot) => {
          next[assignmentKey(date, shift, role, slot)] = employeeId;
        });
      });
    });
    let hasRestorableDraft = false;
    const savedDraft = localStorage.getItem(storageKey);
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft) as { assignments?: Record<string, string> };
        if (draft.assignments && typeof draft.assignments === "object") {
          Object.entries(draft.assignments).forEach(([key, employeeId]) => {
            if (key.split("|")[0] > today) {
              next[key] = employeeId;
              hasRestorableDraft = true;
            }
          });
        }
        if (!hasRestorableDraft) localStorage.removeItem(storageKey);
      } catch {
        localStorage.removeItem(storageKey);
      }
    }
    setAssignments(next);
    setHasUnsavedChanges(hasRestorableDraft);
  }, [schedule, storageKey, today, weekStart]);

  useEffect(() => {
    if (hasUnsavedChanges) {
      localStorage.setItem(storageKey, JSON.stringify({ assignments, updatedAt: new Date().toISOString() }));
    }
    onDraftStatusChange?.({ dirty: hasUnsavedChanges, storageKey });
  }, [assignments, hasUnsavedChanges, onDraftStatusChange, storageKey]);

  const requestWeekChange = (nextWeek: string) => {
    if (nextWeek === weekStart) return;
    if (hasUnsavedChanges) {
      setPendingWeek(nextWeek);
      return;
    }
    setWeekStart(nextWeek);
    setError("");
  };

  const moveWeek = (days: number) => requestWeekChange(dateKey(addDays(new Date(`${weekStart}T00:00:00`), days)));

  const updateAssignment = (key: string, value: string) => {
    setAssignments((current) => ({ ...current, [key]: value }));
    setHasUnsavedChanges(true);
    setError("");
  };

  const acceptWeekChange = (saveDraft: boolean) => {
    if (!saveDraft) localStorage.removeItem(storageKey);
    setHasUnsavedChanges(false);
    if (pendingWeek) setWeekStart(pendingWeek);
    setPendingWeek(null);
    setError("");
  };

  const employeesForRole = (role: string) => employees.filter((employee) =>
    positionMatches(employee.position ?? "", role),
  );

  const save = async () => {
    const requests: ShiftAssignmentRequest[] = [];
    for (const date of dates) {
      if (date <= today) continue;
      for (const shift of shifts) {
        for (const role of roles) {
          for (let slot = 0; slot < role.count; slot += 1) {
            const employeeId = assignments[assignmentKey(date, shift.type, role.name, slot)];
            if (!employeeId) {
              setError(`${formatDay(date)} · ${shift.type}: cần phân đủ ${role.count} nhân viên ${role.name.toLowerCase()}.`);
              return;
            }
            requests.push({
              workDate: date,
              shiftType: shift.type,
              shiftTime: shift.time,
              role: role.name,
              employeeId,
              task: role.task,
            });
          }
        }
      }
    }

    try {
      await saveSchedule({ weekStartDate: weekStart, assignments: requests }).unwrap();
      setError("");
      localStorage.removeItem(storageKey);
      setHasUnsavedChanges(false);
    } catch (saveError) {
      const response = saveError as { data?: { message?: string }; error?: string };
      setError(response.data?.message ?? response.error ?? "Không thể lưu lịch phân ca. Vui lòng thử lại.");
    }
  };

  const clearWeek = async () => {
    const editableAssignments = schedule?.days
      .filter((day) => day.date > today)
      .reduce((count, day) => count + day.assignments.length, 0) ?? 0;
    if (!editableAssignments) {
      if (!hasUnsavedChanges) {
        setError("Tuần này không có phân công từ ngày mai trở đi để làm trống.");
        return;
      }
      if (!window.confirm("Bỏ các thay đổi bản nháp từ ngày mai trở đi? Lịch hôm nay và những ngày đã qua sẽ được giữ nguyên.")) return;
      setAssignments((current) => Object.fromEntries(
        Object.entries(current).filter(([key]) => key.split("|")[0] <= today),
      ));
      localStorage.removeItem(storageKey);
      setHasUnsavedChanges(false);
      setError("");
      return;
    }
    const confirmed = window.confirm(
      `Xóa ${editableAssignments} phân công đã lưu từ ngày mai trở đi trong tuần ${weekStart} – ${dates[6]}? Lịch hôm nay và những ngày đã qua sẽ được giữ nguyên.${hasUnsavedChanges ? " Các thay đổi bản nháp của tuần này cũng sẽ bị bỏ." : ""}`,
    );
    if (!confirmed) return;

    setError("");
    try {
      const clearedSchedule = await clearSchedule(weekStart).unwrap();
      localStorage.removeItem(storageKey);
      const next: Record<string, string> = {};
      clearedSchedule.days.forEach((day) => {
        const grouped = new Map<string, string[]>();
        day.assignments.forEach((assignment) => {
          const key = `${day.date}|${assignment.shiftType}|${assignment.role}`;
          grouped.set(key, [...(grouped.get(key) ?? []), assignment.employeeId]);
        });
        grouped.forEach((employeeIds, groupKey) => {
          const [date, shift, role] = groupKey.split("|");
          employeeIds.forEach((employeeId, slot) => {
            next[assignmentKey(date, shift, role, slot)] = employeeId;
          });
        });
      });
      setAssignments(next);
      setHasUnsavedChanges(false);
    } catch (clearError) {
      const response = clearError as { data?: { message?: string }; error?: string };
      setError(response.data?.message ?? response.error ?? "Không thể xóa lịch phân ca. Vui lòng thử lại.");
    }
  };

  const copyWeek = async () => {
    if (sourceWeekStart === weekStart) {
      setError("Hãy chọn tuần nguồn khác với tuần đang mở.");
      return;
    }
    if (hasUnsavedChanges && !window.confirm("Các thay đổi chưa lưu của tuần đích sẽ bị bỏ khi sao chép. Bạn có muốn tiếp tục không?")) return;
    const targetAssignments = schedule?.days
      .filter((day) => day.date > today)
      .reduce((count, day) => count + day.assignments.length, 0) ?? 0;
    if (targetAssignments > 0 && !window.confirm(
      `Tuần đích hiện có ${targetAssignments} phân công từ ngày mai trở đi. Sao chép sẽ thay thế các phân công này; lịch hôm nay và những ngày đã qua vẫn được giữ nguyên. Tiếp tục?`,
    )) return;

    setError("");
    try {
      const copiedSchedule = await copySchedule({ sourceWeekStartDate: sourceWeekStart, targetWeekStartDate: weekStart }).unwrap();
      localStorage.removeItem(storageKey);
      const next: Record<string, string> = {};
      copiedSchedule.days.forEach((day) => {
        const grouped = new Map<string, string[]>();
        day.assignments.forEach((assignment) => {
          const key = `${day.date}|${assignment.shiftType}|${assignment.role}`;
          grouped.set(key, [...(grouped.get(key) ?? []), assignment.employeeId]);
        });
        grouped.forEach((employeeIds, groupKey) => {
          const [date, shift, role] = groupKey.split("|");
          employeeIds.forEach((employeeId, slot) => {
            next[assignmentKey(date, shift, role, slot)] = employeeId;
          });
        });
      });
      setAssignments(next);
      setHasUnsavedChanges(false);
    } catch (copyError) {
      const response = copyError as { data?: { message?: string }; error?: string };
      setError(response.data?.message ?? response.error ?? "Không thể sao chép lịch tuần. Vui lòng thử lại.");
    }
  };

  const employeeOptions = (role: string, date: string, currentKey: string) => {
    const alreadyAssigned = new Set(Object.entries(assignments)
      .filter(([key, value]) => key !== currentKey && key.startsWith(`${date}|`) && value)
      .map(([, value]) => value));
    return { employees: employeesForRole(role), alreadyAssigned };
  };

  const staffingShortages = roles
    .map((role) => ({
      ...role,
      available: employeesForRole(role.name).length,
      required: role.count * shifts.length,
    }))
    .filter((role) => role.available < role.required);

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="space-y-4 border-b border-slate-100 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-64 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600"><CalendarClock size={20} /></span>
            <div>
              <h2 className="font-bold text-slate-900">Phân ca tuần tiếp theo</h2>
              <p className="mt-1 text-xs text-slate-500">Mỗi ca cần 2 lễ tân, 2 buồng phòng và 1 bảo vệ. Hệ thống nhắc quản lý lúc 15:00 thứ Bảy.</p>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2 sm:w-auto sm:flex-nowrap">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => moveWeek(-7)} aria-label="Tuần trước" disabled={isSaving || isClearing || isCopying} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-600 transition hover:bg-white hover:text-blue-700 disabled:opacity-50"><ChevronLeft size={17} /></button>
              <input
                aria-label="Chọn tuần cần phân ca"
                type="date"
                value={weekStart}
                onChange={(event) => {
                  if (event.target.value) {
                    const selectedMonday = dateKey(mondayOf(new Date(`${event.target.value}T00:00:00`)));
                    requestWeekChange(selectedMonday);
                  }
                }}
                disabled={isSaving || isClearing || isCopying}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
              />
              <button type="button" onClick={() => moveWeek(7)} aria-label="Tuần sau" disabled={isSaving || isClearing || isCopying} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-600 transition hover:bg-white hover:text-blue-700 disabled:opacity-50"><ChevronRight size={17} /></button>
            </div>
            <span className="min-w-40 text-center text-xs font-semibold text-slate-700 sm:border-l sm:border-slate-200 sm:pl-3">{weekStart} – {dates[6]}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
              Sao chép lịch từ tuần
              <input
                aria-label="Chọn tuần nguồn để sao chép"
                type="date"
                value={sourceWeekStart}
                onChange={(event) => {
                  if (event.target.value) setSourceWeekStart(dateKey(mondayOf(new Date(`${event.target.value}T00:00:00`))));
                }}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <button
              type="button"
              onClick={() => void copyWeek()}
              disabled={isCopying || isSaving || isClearing || isScheduleLoading || !canEditWeek}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Copy size={15} />{isCopying ? "Đang sao chép..." : "Sao chép tuần"}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => void clearWeek()}
              disabled={isClearing || isSaving || isCopying || isScheduleLoading || !canEditWeek}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={15} />{isClearing ? "Đang xóa..." : "Làm trống"}
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={isSaving || isClearing || isCopying || isScheduleLoading || isEmployeesLoading || !canEditWeek}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={15} />{isSaving ? "Đang lưu..." : "Lưu lịch"}
            </button>
          </div>
        </div>
        <p className="flex items-center gap-1.5 px-1 text-xs text-slate-500">
          <Copy size={13} className="shrink-0" />
          Có thể dùng tuần đã qua làm nguồn; lịch hôm nay và ngày đã qua trong tuần đích không bị thay đổi.
        </p>
      </header>

      {dates[6] <= today && <p className="mx-5 mt-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-600">Tuần này không còn ngày tương lai để chỉnh sửa.</p>}
      {weekStart <= today && dates[6] > today && <p className="mx-5 mt-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-600">Hôm nay và các ngày đã qua chỉ xem được. Bạn chỉ có thể chỉnh sửa lịch từ ngày mai ({firstEditableDate}) trở đi.</p>}
      {hasUnsavedChanges && <p className="mx-5 mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Thay đổi chưa lưu đang được giữ thành bản nháp trên trình duyệt cho tuần này.</p>}
      {pendingWeek && (
        <div className="mx-5 mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4" role="dialog" aria-modal="true" aria-labelledby="shift-draft-dialog-title">
          <h3 id="shift-draft-dialog-title" className="font-semibold text-blue-950">Bạn đang có thay đổi chưa lưu</h3>
          <p className="mt-1 text-sm text-blue-900">Bạn muốn lưu bản nháp của tuần này trước khi chuyển tuần?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => acceptWeekChange(true)} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white">Lưu bản nháp và chuyển tuần</button>
            <button type="button" onClick={() => acceptWeekChange(false)} className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700">Bỏ thay đổi và chuyển tuần</button>
            <button type="button" onClick={() => setPendingWeek(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Tiếp tục chỉnh sửa</button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="mx-5 mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {isScheduleError && <p role="alert" className="mx-5 mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">Không tải được lịch tuần. Hãy thử tải lại.</p>}
      {isEmployeesError && <p role="alert" className="mx-5 mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">Không tải được danh sách nhân viên của chi nhánh{typeof employeesError === "object" && employeesError !== null && "status" in employeesError ? ` (HTTP ${String(employeesError.status)})` : ""}. Kiểm tra tài khoản đã được liên kết với chi nhánh chưa.</p>}
      {!isEmployeesLoading && !isEmployeesError && (
        <div className={`mx-5 mt-4 rounded-lg p-3 text-xs ${staffingShortages.length ? "bg-amber-50 text-amber-900" : "bg-blue-50 text-blue-800"}`}>
          <p className="font-semibold">Nhân viên trong chi nhánh / nhu cầu mỗi ngày: {roles.map((role) => `${role.name} ${employeesForRole(role.name).length}/${role.count * shifts.length}`).join(" · ")}.</p>
          <p className="mt-1">Giới hạn chỉ áp dụng trong cùng một ngày: một nhân viên chỉ được làm một ca/ngày. Sang ngày kế tiếp, bạn có thể chọn lại chính nhân viên đó.</p>
          {staffingShortages.length > 0 && (
            <p className="mt-1 font-semibold">
              Chưa đủ nhân sự để lấp đủ ca: {staffingShortages.map((role) => `${role.name} còn thiếu ${role.required - role.available}`).join(" · ")}. Cần bổ sung nhân viên đúng chức vụ.
            </p>
          )}
        </div>
      )}
      {isEmployeesLoading || isScheduleLoading ? (
        <p className="p-6 text-sm text-slate-500">Đang tải nhân viên và lịch tuần...</p>
      ) : (
        <div className="space-y-5 p-5">
          {dates.map((date) => (
            <article key={date} className="overflow-hidden rounded-xl border border-slate-200">
              <h3 className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold capitalize text-slate-800">
                <span>{formatDay(date)}</span>
                {date <= today && <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-semibold normal-case text-slate-600">{date === today ? "Hôm nay · chỉ xem" : "Đã qua · chỉ xem"}</span>}
              </h3>
              <div className="grid gap-3 p-3 xl:grid-cols-3">
                {shifts.map((shift) => (
                  <section key={shift.type} className="rounded-lg border border-slate-100 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-800">{shift.type}</h4>
                      <span className="text-[11px] text-slate-500">{shift.time}</span>
                    </div>
                    <div className="space-y-3">
                      {roles.map((role) => (
                        <div key={role.name}>
                          <p className="mb-1 text-xs font-semibold text-slate-600">{role.name} · {role.count} người</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {Array.from({ length: role.count }, (_, slot) => {
                              const key = assignmentKey(date, shift.type, role.name, slot);
                              const selectedId = assignments[key] ?? "";
                              const { employees: options, alreadyAssigned } = employeeOptions(role.name, date, key);
                              return (
                                <select
                                  key={key}
                                  aria-label={`${formatDay(date)} ${shift.type} ${role.name} ${slot + 1}`}
                                  value={selectedId}
                                  onChange={(event) => updateAssignment(key, event.target.value)}
                                  disabled={date <= today || isSaving || isClearing || isCopying}
                                  className="h-9 min-w-0 rounded-md border border-slate-200 bg-white px-2 text-xs"
                                >
                                  <option value="">Chọn {role.name.toLocaleLowerCase()} {slot + 1}</option>
                                  {options.map((employee) => {
                                    const unavailable = alreadyAssigned.has(employee.id);
                                    return (
                                      <option key={employee.id} value={employee.id} disabled={unavailable}>
                                        {employee.fullName}{unavailable ? " (đã xếp ca trong ngày)" : ""}
                                      </option>
                                    );
                                  })}
                                </select>
                              );
                            })}
                          </div>
                          {employeesForRole(role.name).length < role.count * shifts.length
                            && <p className="mt-1 text-[10px] text-amber-700">Chi nhánh có {employeesForRole(role.name).length} người; cần {role.count * shifts.length} người/ngày để bố trí đủ 3 ca.</p>}
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
