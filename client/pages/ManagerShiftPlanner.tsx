import { useEffect, useMemo, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, Save } from "lucide-react";
import { useGetMyHotelEmployeesQuery } from "../services/employeeApi";
import { useGetWeeklyShiftScheduleQuery, useSaveWeeklyShiftScheduleMutation, type ShiftAssignmentRequest } from "../services/shiftApi";

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

export default function ManagerShiftPlanner() {
  const initialWeek = useMemo(() => dateKey(addDays(mondayOf(new Date()), 7)), []);
  const [weekStart, setWeekStart] = useState(initialWeek);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const { data: schedule, isLoading: isScheduleLoading, isError: isScheduleError } = useGetWeeklyShiftScheduleQuery(weekStart);
  const { data: employees = [], isLoading: isEmployeesLoading, isError: isEmployeesError, error: employeesError } = useGetMyHotelEmployeesQuery();
  const [saveSchedule, { isLoading: isSaving }] = useSaveWeeklyShiftScheduleMutation();

  const dates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => dateKey(addDays(new Date(`${weekStart}T00:00:00`), index))),
    [weekStart],
  );

  useEffect(() => {
    if (!schedule) return;
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
    setAssignments(next);
  }, [schedule]);

  const moveWeek = (days: number) => {
    setWeekStart((current) => dateKey(addDays(new Date(`${current}T00:00:00`), days)));
    setError("");
  };

  const updateAssignment = (key: string, value: string) => {
    setAssignments((current) => ({ ...current, [key]: value }));
    setError("");
  };

  const employeesForRole = (role: string) => employees.filter((employee) =>
    positionMatches(employee.position ?? "", role),
  );

  const save = async () => {
    const requests: ShiftAssignmentRequest[] = [];
    for (const date of dates) {
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
    } catch (saveError) {
      const response = saveError as { data?: { message?: string }; error?: string };
      setError(response.data?.message ?? response.error ?? "Không thể lưu lịch phân ca. Vui lòng thử lại.");
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
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><CalendarClock size={20} /></span>
          <div>
            <h2 className="font-bold text-slate-900">Phân ca tuần tiếp theo</h2>
            <p className="mt-1 text-xs text-slate-500">Mỗi ca cần 2 lễ tân, 2 buồng phòng và 1 bảo vệ. Hệ thống nhắc quản lý lúc 15:00 thứ Bảy.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => moveWeek(-7)} aria-label="Tuần trước" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><ChevronLeft size={16} /></button>
          <span className="min-w-36 text-center text-sm font-semibold text-slate-700">{weekStart} – {dates[6]}</span>
          <button type="button" onClick={() => moveWeek(7)} aria-label="Tuần sau" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><ChevronRight size={16} /></button>
          <button type="button" onClick={() => void save()} disabled={isSaving || isScheduleLoading || isEmployeesLoading} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
            <Save size={15} />{isSaving ? "Đang lưu..." : "Lưu lịch"}
          </button>
        </div>
      </header>

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
              <h3 className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold capitalize text-slate-800">{formatDay(date)}</h3>
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
