import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { useGetMyHotelEmployeesQuery } from "../services/employeeApi";
import {
  useClearWeeklyShiftScheduleMutation,
  useCopyWeeklyShiftScheduleMutation,
  useGetWeeklyShiftScheduleQuery,
  useSaveWeeklyShiftScheduleMutation,
  type ShiftAssignment,
  type ShiftAssignmentRequest,
  type WeeklyShiftSchedule,
} from "../services/shiftApi";
import { localizedText } from "../i18n";

type ShiftCode = "M" | "A" | "N" | "";
type ShiftTool = Exclude<ShiftCode, ""> | "X";

const shifts: Record<
  Exclude<ShiftCode, "">,
  {
    label: string;
    shortLabel: string;
    time: string;
    hours: number;
    classes: string;
  }
> = {
  M: {
    label: "Ca sáng",
    shortLabel: "Sáng",
    time: "06:00–14:00",
    hours: 8,
    classes: "border-amber-200 bg-amber-100 text-amber-950",
  },
  A: {
    label: "Ca chiều",
    shortLabel: "Chiều",
    time: "14:00–22:00",
    hours: 8,
    classes: "border-blue-200 bg-blue-100 text-blue-900",
  },
  N: {
    label: "Ca đêm",
    shortLabel: "Đêm",
    time: "22:00–06:00",
    hours: 8,
    classes: "border-indigo-800 bg-indigo-900 text-white",
  },
};
const shiftTypeByCode: Record<Exclude<ShiftCode, "">, string> = {
  M: "Ca sáng",
  A: "Ca chiều",
  N: "Ca đêm",
};
const shiftTimeByCode: Record<Exclude<ShiftCode, "">, string> = {
  M: "06:00 – 14:00",
  A: "14:00 – 22:00",
  N: "22:00 – 06:00",
};
const shiftOrder: Exclude<ShiftCode, "">[] = ["M", "A", "N"];
const dayLabels = [
  ["Thứ 2", "Monday"],
  ["Thứ 3", "Tuesday"],
  ["Thứ 4", "Wednesday"],
  ["Thứ 5", "Thursday"],
  ["Thứ 6", "Friday"],
  ["Thứ 7", "Saturday"],
  ["Chủ nhật", "Sunday"],
] as const;
const staffRoles = ["Lễ tân", "Buồng phòng", "Bảo vệ"] as const;
type StaffRole = (typeof staffRoles)[number];
type CoverageFocus = {
  code: Exclude<ShiftCode, "">;
  role: StaffRole;
  dayIndex: number;
  weekStart: string;
};
const taskByRole: Record<StaffRole, string> = {
  "Lễ tân": "Trực quầy lễ tân",
  "Buồng phòng": "Dọn phòng",
  "Bảo vệ": "Trực an ninh",
};
const shiftRoleNeeds: Record<
  Exclude<ShiftCode, "">,
  Record<StaffRole, number>
> = {
  M: { "Lễ tân": 2, "Buồng phòng": 2, "Bảo vệ": 1 },
  A: { "Lễ tân": 2, "Buồng phòng": 2, "Bảo vệ": 1 },
  N: { "Lễ tân": 2, "Buồng phòng": 2, "Bảo vệ": 1 },
};

const employeeShiftRole = (position: string) => {
  const normalized = position
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
  if (
    normalized.includes("le tan") ||
    normalized.includes("reception") ||
    normalized.includes("front desk") ||
    normalized.includes("front office")
  ) {
    return "Lễ tân";
  }
  if (
    normalized.includes("buong") ||
    normalized.includes("housekeeping") ||
    normalized.includes("housekeeper") ||
    normalized.includes("room attendant")
  ) {
    return "Buồng phòng";
  }
  if (
    normalized.includes("bao ve") ||
    normalized.includes("security") ||
    normalized.includes("guard")
  ) {
    return "Bảo vệ";
  }
  return null;
};

const localizedRole = (role: (typeof staffRoles)[number]) =>
  role === "Lễ tân"
    ? localizedText(role, "Front desk")
    : role === "Buồng phòng"
      ? localizedText(role, "Housekeeping")
      : localizedText(role, "Security");

const localizedShift = (code: Exclude<ShiftCode, "">) =>
  localizedText(
    shifts[code].label,
    code === "M"
      ? "Morning shift"
      : code === "A"
        ? "Afternoon shift"
        : "Night shift",
  );

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

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

const formatDate = (date: Date) =>
  `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
const newGrid = (employeeCount: number): ShiftCode[][] =>
  Array.from({ length: employeeCount }, () => Array<ShiftCode>(7).fill(""));
const codeFromShiftType = (shiftType: string): ShiftCode => {
  const normalized = shiftType
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
  if (normalized.includes("sang") || normalized.includes("morning")) return "M";
  if (normalized.includes("chieu") || normalized.includes("afternoon"))
    return "A";
  if (
    normalized.includes("dem") ||
    normalized.includes("toi") ||
    normalized.includes("night")
  ) {
    return "N";
  }
  return "";
};
const scheduleToGrid = (
  schedule: WeeklyShiftSchedule,
  employees: readonly { id: string }[],
): ShiftCode[][] => {
  const grid = newGrid(employees.length);
  const employeeIndexById = new Map(
    employees.map((employee, index) => [employee.id, index]),
  );
  const dayIndexByDate = new Map(
    Array.from({ length: 7 }, (_, index) => {
      const date = addDays(
        new Date(`${schedule.weekStartDate}T00:00:00`),
        index,
      );
      return [dateKey(date), index];
    }),
  );

  schedule.days.forEach((day) => {
    day.assignments.forEach((assignment: ShiftAssignment) => {
      const employeeIndex = employeeIndexById.get(assignment.employeeId);
      const dayIndex = dayIndexByDate.get(
        (assignment.workDate || day.date).slice(0, 10),
      );
      const code = codeFromShiftType(assignment.shiftType);
      if (employeeIndex !== undefined && dayIndex !== undefined && code) {
        grid[employeeIndex][dayIndex] = code;
      }
    });
  });

  return grid;
};
const apiErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error !== "object" || error === null) return fallback;
  if (
    "data" in error &&
    typeof error.data === "object" &&
    error.data !== null
  ) {
    const data = error.data;
    if ("message" in data && typeof data.message === "string") {
      return data.message;
    }
  }
  if ("error" in error && typeof error.error === "string") return error.error;
  return fallback;
};
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .slice(-2)
    .join("")
    .toLocaleUpperCase("vi");

export default function WeeklyShiftPrototype() {
  const {
    data: employeeRecords,
    isLoading,
    isError,
  } = useGetMyHotelEmployeesQuery();
  const employees = useMemo(
    () =>
      staffRoles.flatMap((role) =>
        (employeeRecords ?? []).filter((employee) => {
          const employeeRoles = employee.roleCodes?.length
            ? employee.roleCodes
            : employee.roles;
          return (
            !employeeRoles.includes("ROLE_ADMIN") &&
            !employeeRoles.includes("ROLE_MANAGER") &&
            employeeShiftRole(employee.position) === role
          );
        }),
      ),
    [employeeRecords],
  );
  const initialWeekStart = useMemo(() => dateKey(mondayOf(new Date())), []);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedTool, setSelectedTool] = useState<ShiftTool>("M");
  const [coverageFocus, setCoverageFocus] = useState<CoverageFocus | null>(
    null,
  );
  const [copyCellSource, setCopyCellSource] = useState<{
    employeeId: string;
    workDate: string;
    code: ShiftCode;
  } | null>(null);
  const [sourceWeekStart, setSourceWeekStart] = useState(() =>
    dateKey(addDays(mondayOf(new Date()), -7)),
  );
  const [gridsByWeek, setGridsByWeek] = useState<Record<string, ShiftCode[][]>>(
    {},
  );
  const [dirtyWeeks, setDirtyWeeks] = useState<Record<string, boolean>>({});
  const [savedWeeks, setSavedWeeks] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const weekStart = useMemo(
    () =>
      dateKey(
        addDays(new Date(`${initialWeekStart}T00:00:00`), weekOffset * 7),
      ),
    [initialWeekStart, weekOffset],
  );
  const weekKey = weekStart;
  const {
    currentData: schedule,
    isLoading: isScheduleLoading,
    isError: isScheduleError,
    refetch: refetchSchedule,
  } = useGetWeeklyShiftScheduleQuery(weekStart);
  const [saveWeeklySchedule, { isLoading: isSaving }] =
    useSaveWeeklyShiftScheduleMutation();
  const [copyWeeklySchedule, { isLoading: isCopying }] =
    useCopyWeeklyShiftScheduleMutation();
  const [clearWeeklySchedule, { isLoading: isClearing }] =
    useClearWeeklyShiftScheduleMutation();
  const dates = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) =>
        addDays(new Date(`${weekStart}T00:00:00`), index),
      ),
    [weekStart],
  );
  const todayKey = dateKey(new Date());
  const savedWeekGrid = gridsByWeek[weekKey];
  const weekGrid =
    (savedWeekGrid?.length === employees.length ? savedWeekGrid : undefined) ??
    (schedule?.weekStartDate === weekStart
      ? scheduleToGrid(schedule, employees)
      : newGrid(employees.length));
  const isDirty = dirtyWeeks[weekKey] ?? false;
  const isSaved =
    savedWeeks[weekKey] ??
    Boolean(schedule?.weekStartDate === weekStart && schedule.totalAssignments);
  const canEditWeek = dates.some((date) => dateKey(date) > todayKey);

  useEffect(() => {
    if (!schedule || schedule.weekStartDate !== weekStart) return;
    setGridsByWeek((current) =>
      current[weekStart]?.length === employees.length
        ? current
        : {
            ...current,
            [weekStart]: scheduleToGrid(schedule, employees),
          },
    );
    setSavedWeeks((current) => {
      const isSavedSchedule = schedule.totalAssignments > 0;
      return current[weekStart] === isSavedSchedule
        ? current
        : { ...current, [weekStart]: isSavedSchedule };
    });
  }, [employees, schedule, weekStart]);

  const employeeHours = weekGrid.map((row) =>
    row.reduce((total, code) => total + (code ? shifts[code].hours : 0), 0),
  );
  const totalHours = employeeHours.reduce((total, hours) => total + hours, 0);
  const emptyCount = weekGrid.reduce(
    (total, row) => total + row.filter((code) => !code).length,
    0,
  );
  const coverage = shiftOrder.flatMap((code) =>
    staffRoles.map((role) => ({
      code,
      role,
      required: shiftRoleNeeds[code][role],
      counts: dates.map((_, dayIndex) =>
        employees.reduce(
          (count, employee, employeeIndex) =>
            count +
            (employeeShiftRole(employee.position) === role &&
            weekGrid[employeeIndex][dayIndex] === code
              ? 1
              : 0),
          0,
        ),
      ),
    })),
  );
  const shortageCount = coverage.reduce(
    (total, line) =>
      total +
      line.counts.reduce(
        (dayTotal, count, dayIndex) =>
          dayTotal +
          (dateKey(dates[dayIndex]) > todayKey
            ? Math.max(0, line.required - count)
            : 0),
        0,
      ),
    0,
  );
  const focusCoverage = (
    code: Exclude<ShiftCode, "">,
    role: StaffRole,
    dayIndex: number,
  ) => {
    if (
      coverageFocus?.weekStart === weekStart &&
      coverageFocus.code === code &&
      coverageFocus.role === role &&
      coverageFocus.dayIndex === dayIndex
    ) {
      setCoverageFocus(null);
      return;
    }

    setCoverageFocus({ code, role, dayIndex, weekStart });
    const employeeIndex = employees.findIndex(
      (employee) => employeeShiftRole(employee.position) === role,
    );
    const targetId =
      employeeIndex >= 0
        ? `weekly-shift-cell-${employeeIndex}-${dayIndex}`
        : "weekly-shift-assignment-grid";
    document.getElementById(targetId)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center",
    });
  };
  const saveGrid = (nextGrid: ShiftCode[][]) => {
    setGridsByWeek((current) => ({ ...current, [weekKey]: nextGrid }));
    setDirtyWeeks((current) => ({ ...current, [weekKey]: true }));
    setNotice("");
    setError("");
  };

  const applyShift = (
    employeeIndex: number,
    dayIndex: number,
    code: ShiftCode,
  ) => {
    const nextGrid = weekGrid.map((row) => [...row]);
    const currentCode = nextGrid[employeeIndex][dayIndex];
    if (code && currentCode !== code) {
      const role = employeeShiftRole(employees[employeeIndex].position);
      if (role) {
        const alreadyAssigned = employees.reduce(
          (count, employee, index) =>
            count +
            (index !== employeeIndex &&
            employeeShiftRole(employee.position) === role &&
            weekGrid[index][dayIndex] === code
              ? 1
              : 0),
          0,
        );
        if (alreadyAssigned >= shiftRoleNeeds[code][role]) {
          setNotice(
            localizedText(
              `${localizedShift(code)} ngày ${formatDate(dates[dayIndex])} đã đủ ${shiftRoleNeeds[code][role]} nhân viên ${localizedRole(role)}.`,
              `${localizedShift(code)} on ${formatDate(dates[dayIndex])} already has the required ${shiftRoleNeeds[code][role]} ${localizedRole(role)} employees.`,
            ),
          );
          return false;
        }
      }
    }
    nextGrid[employeeIndex][dayIndex] = code;
    saveGrid(nextGrid);
    return true;
  };

  const assignShift = (employeeIndex: number, dayIndex: number) => {
    const workDate = dateKey(dates[dayIndex]);
    const currentCode = weekGrid[employeeIndex][dayIndex];
    if (selectedTool === "X" && !copyCellSource) {
      if (workDate <= todayKey) {
        setNotice(
          localizedText(
            "Hôm nay và ngày đã qua chỉ xem, không thể chỉnh sửa.",
            "Today and past dates are read-only.",
          ),
        );
        return;
      }
      if (currentCode) applyShift(employeeIndex, dayIndex, "");
      return;
    }

    if (copyCellSource) {
      if (workDate <= todayKey) {
        setNotice(
          localizedText(
            "Chỉ có thể sao chép vào ngày mai trở đi.",
            "You can only copy to tomorrow or a future date.",
          ),
        );
        return;
      }

      const applied = applyShift(employeeIndex, dayIndex, copyCellSource.code);
      if (applied) {
        setCopyCellSource(null);
        setNotice(
          localizedText(
            "Đã sao chép ca vào ô được chọn.",
            "Shift copied to the selected cell.",
          ),
        );
      }
      return;
    }

    if (currentCode) {
      setCopyCellSource({
        employeeId: employees[employeeIndex].id,
        workDate,
        code: currentCode,
      });
      setNotice(
        localizedText(
          "Đã sao chép trạng thái ô. Bấm vào ô đích để áp dụng; chọn màu bên cạnh để hủy.",
          "Cell state copied. Click a target cell to apply it; choose a color to cancel.",
        ),
      );
      return;
    }

    if (workDate <= todayKey) {
      setNotice(
        localizedText(
          "Hôm nay và ngày đã qua chỉ xem, không thể chỉnh sửa.",
          "Today and past dates are read-only.",
        ),
      );
      return;
    }

    const nextCode: ShiftCode =
      selectedTool === "X"
        ? ""
        : currentCode === selectedTool
          ? ""
          : selectedTool;
    applyShift(employeeIndex, dayIndex, nextCode);
  };

  const copyWeek = async () => {
    const sourceWeek = dateKey(
      mondayOf(new Date(`${sourceWeekStart}T00:00:00`)),
    );
    if (sourceWeek === weekKey) {
      setError(
        localizedText(
          "Tuần nguồn phải khác tuần đang mở.",
          "Choose a source week different from the current week.",
        ),
      );
      return;
    }
    if (
      isDirty &&
      !window.confirm(
        localizedText(
          "Tuần hiện tại có thay đổi chưa lưu. Tiếp tục sao chép sẽ bỏ các thay đổi đó. Bạn có muốn tiếp tục?",
          "This week has unsaved changes. Copying will discard them. Continue?",
        ),
      )
    ) {
      return;
    }
    if (
      isSaved &&
      !window.confirm(
        localizedText(
          "Sao chép sẽ thay thế lịch đã lưu của tuần này. Bạn có muốn tiếp tục?",
          "Copying will replace this week's saved schedule. Continue?",
        ),
      )
    ) {
      return;
    }

    setError("");
    setNotice("");
    try {
      const copiedSchedule = await copyWeeklySchedule({
        sourceWeekStartDate: sourceWeek,
        targetWeekStartDate: weekKey,
      }).unwrap();
      setGridsByWeek((current) => ({
        ...current,
        [weekKey]: scheduleToGrid(copiedSchedule, employees),
      }));
      setDirtyWeeks((current) => ({ ...current, [weekKey]: false }));
      setSavedWeeks((current) => ({
        ...current,
        [weekKey]: copiedSchedule.totalAssignments > 0,
      }));
      setNotice(
        localizedText(
          `Đã sao chép lịch từ tuần ${sourceWeek} và cập nhật lên hệ thống.`,
          `Copied the schedule from the week of ${sourceWeek} and updated the system.`,
        ),
      );
    } catch (copyError) {
      setError(
        apiErrorMessage(
          copyError,
          localizedText(
            "Không thể sao chép lịch tuần.",
            "Could not copy the weekly schedule.",
          ),
        ),
      );
    }
  };

  const clearWeek = async () => {
    if (
      !window.confirm(
        localizedText(
          "Xóa các ca từ ngày mai trở đi trong tuần này khỏi hệ thống?",
          "Clear this week's saved shifts from tomorrow onward?",
        ),
      )
    ) {
      return;
    }
    setError("");
    setNotice("");
    try {
      const clearedSchedule = await clearWeeklySchedule(weekKey).unwrap();
      const nextGrid = scheduleToGrid(clearedSchedule, employees);
      setGridsByWeek((current) => ({ ...current, [weekKey]: nextGrid }));
      setDirtyWeeks((current) => ({ ...current, [weekKey]: false }));
      setSavedWeeks((current) => ({
        ...current,
        [weekKey]: clearedSchedule.totalAssignments > 0,
      }));
      setNotice(
        localizedText(
          "Đã xóa lịch tuần khỏi hệ thống.",
          "Cleared the weekly schedule from the system.",
        ),
      );
    } catch (clearError) {
      setError(
        apiErrorMessage(
          clearError,
          localizedText(
            "Không thể xóa lịch tuần.",
            "Could not clear the weekly schedule.",
          ),
        ),
      );
    }
  };

  const saveWeek = async () => {
    if (!canEditWeek) {
      setError(
        localizedText(
          "Tuần này không còn ngày có thể chỉnh sửa.",
          "There are no editable dates left in this week.",
        ),
      );
      return;
    }

    for (let dayIndex = 0; dayIndex < dates.length; dayIndex += 1) {
      const workDate = dateKey(dates[dayIndex]);
      if (workDate <= todayKey) continue;
      for (const shift of shiftOrder) {
        for (const role of staffRoles) {
          const assignedCount = employees.reduce(
            (count, employee, employeeIndex) =>
              count +
              (employeeShiftRole(employee.position) === role &&
              weekGrid[employeeIndex][dayIndex] === shift
                ? 1
                : 0),
            0,
          );
          const required = shiftRoleNeeds[shift][role];
          if (assignedCount !== required) {
            setError(
              localizedText(
                `${formatDate(dates[dayIndex])} · ${localizedShift(shift)} cần đúng ${required} nhân viên ${localizedRole(role)} (hiện có ${assignedCount}).`,
                `${formatDate(dates[dayIndex])} · ${localizedShift(shift)} needs ${required} ${localizedRole(role)} employees (currently ${assignedCount}).`,
              ),
            );
            return;
          }
        }
      }
    }

    const assignments: ShiftAssignmentRequest[] = [];
    dates.forEach((date, dayIndex) => {
      const workDate = dateKey(date);
      if (workDate <= todayKey) return;
      employees.forEach((employee, employeeIndex) => {
        const code = weekGrid[employeeIndex][dayIndex];
        const role = employeeShiftRole(employee.position);
        if (!code || !role) return;
        assignments.push({
          workDate,
          shiftType: shiftTypeByCode[code],
          shiftTime: shiftTimeByCode[code],
          role,
          employeeId: employee.id,
          task: taskByRole[role],
        });
      });
    });

    setError("");
    setNotice("");
    try {
      const savedSchedule = await saveWeeklySchedule({
        weekStartDate: weekKey,
        assignments,
      }).unwrap();
      setGridsByWeek((current) => ({
        ...current,
        [weekKey]: scheduleToGrid(savedSchedule, employees),
      }));
      setDirtyWeeks((current) => ({ ...current, [weekKey]: false }));
      setSavedWeeks((current) => ({
        ...current,
        [weekKey]: savedSchedule.totalAssignments > 0,
      }));
      setNotice(
        localizedText(
          "Đã lưu và đăng lịch phân ca lên hệ thống.",
          "Shift schedule saved and published to the system.",
        ),
      );
    } catch (saveError) {
      setError(
        apiErrorMessage(
          saveError,
          localizedText(
            "Không thể lưu lịch phân ca.",
            "Could not save the shift schedule.",
          ),
        ),
      );
    }
  };

  if (isLoading) {
    return (
      <p className="mt-5 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
        {localizedText(
          "Đang tải danh sách nhân viên...",
          "Loading employees...",
        )}
      </p>
    );
  }

  if (isError) {
    return (
      <p
        role="alert"
        className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700"
      >
        {localizedText(
          "Không thể tải danh sách nhân viên để tạo lịch thử nghiệm. Vui lòng thử lại.",
          "Could not load employees for the schedule prototype. Please try again.",
        )}
      </p>
    );
  }

  if (employees.length === 0) {
    return (
      <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        {localizedText(
          "Chưa có nhân viên Lễ tân, Buồng phòng hoặc Bảo vệ để hiển thị lịch phân ca.",
          "There are no front desk, housekeeping, or security employees to display in the shift schedule.",
        )}
      </p>
    );
  }

  const toolOptions: {
    code: ShiftTool;
    label: string;
    detail: string;
    swatch: string;
  }[] = [
    {
      code: "M",
      label: localizedText("Ca sáng", "Morning shift"),
      detail: "06:00–14:00",
      swatch: "bg-amber-100 border-amber-300",
    },
    {
      code: "A",
      label: localizedText("Ca chiều", "Afternoon shift"),
      detail: "14:00–22:00",
      swatch: "bg-blue-100 border-blue-300",
    },
    {
      code: "N",
      label: localizedText("Ca đêm", "Night shift"),
      detail: "22:00–06:00",
      swatch: "bg-indigo-900 border-indigo-900",
    },
    {
      code: "X",
      label: localizedText("Xóa ca", "Clear shift"),
      detail: localizedText("Làm trống ô", "Clear cell"),
      swatch: "border-dashed border-slate-400 bg-white",
    },
  ];

  return (
    <section className="mt-5 space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {localizedText(
              isDirty
                ? "Có thay đổi chưa lưu"
                : isSaved
                  ? "Lịch đã lưu trên hệ thống"
                  : "Lịch phân ca theo dữ liệu hệ thống",
              isDirty
                ? "Unsaved changes"
                : isSaved
                  ? "Schedule saved in the system"
                  : "Shift schedule from the system",
            )}
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {localizedText(
              "Phân ca làm việc theo tuần",
              "Weekly shift planner",
            )}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {weekOffset !== 0 && (
            <button
              type="button"
              onClick={() => {
                setWeekOffset(0);
                setNotice("");
              }}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw size={15} />
              {localizedText("Về tuần này", "This week")}
            </button>
          )}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => {
                setWeekOffset((offset) => offset - 1);
                setNotice("");
              }}
              aria-label={localizedText("Xem tuần trước", "Previous week")}
              className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="min-w-40 text-center">
              <p className="text-sm font-bold text-slate-900">
                {formatDate(dates[0])} – {formatDate(dates[6])}/
                {dates[6].getFullYear()}
              </p>
              <p className="text-xs text-slate-500">
                {weekOffset === 0
                  ? localizedText("Tuần này", "This week")
                  : weekOffset === -1
                    ? localizedText("Tuần trước", "Last week")
                    : weekOffset === 1
                      ? localizedText("Tuần sau", "Next week")
                      : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setWeekOffset((offset) => offset + 1);
                setNotice("");
              }}
              aria-label={localizedText("Xem tuần sau", "Next week")}
              className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </header>

      <section className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
            {localizedText("Sao chép lịch từ tuần", "Copy schedule from week")}
            <input
              type="date"
              value={sourceWeekStart}
              onChange={(event) => {
                if (event.target.value) {
                  setSourceWeekStart(
                    dateKey(
                      mondayOf(new Date(`${event.target.value}T00:00:00`)),
                    ),
                  );
                }
              }}
              aria-label={localizedText(
                "Chọn tuần nguồn để sao chép",
                "Select a source week to copy",
              )}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
            />
          </label>
          <button
            type="button"
            onClick={() => void copyWeek()}
            disabled={
              isCopying ||
              isSaving ||
              isClearing ||
              isScheduleLoading ||
              isScheduleError
            }
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Copy size={15} />
            {isCopying
              ? localizedText("Đang sao chép...", "Copying...")
              : localizedText("Sao chép lịch", "Copy schedule")}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void clearWeek()}
            disabled={
              isClearing ||
              isSaving ||
              isCopying ||
              isScheduleLoading ||
              isScheduleError ||
              !canEditWeek
            }
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 size={15} />
            {isClearing
              ? localizedText("Đang xóa...", "Clearing...")
              : localizedText("Xóa lịch", "Clear schedule")}
          </button>
          <button
            type="button"
            onClick={() => void saveWeek()}
            disabled={
              !isDirty ||
              shortageCount > 0 ||
              isSaving ||
              isCopying ||
              isClearing ||
              isScheduleLoading ||
              isScheduleError ||
              !canEditWeek
            }
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          >
            <Save size={15} />
            {isSaving
              ? localizedText("Đang đăng...", "Publishing...")
              : localizedText("Đăng lịch", "Publish schedule")}
          </button>
        </div>
      </section>

      {notice && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label={localizedText("Đóng thông báo", "Dismiss notification")}
            className="font-bold"
          >
            ×
          </button>
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
        >
          {error}
        </p>
      )}
      {isScheduleError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
        >
          <span>
            {localizedText(
              "Không thể tải lịch từ hệ thống. Vui lòng thử lại.",
              "Could not load the schedule from the system. Please try again.",
            )}
          </span>
          <button
            type="button"
            onClick={() => void refetchSchedule()}
            className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 font-semibold hover:bg-rose-100"
          >
            {localizedText("Thử lại", "Retry")}
          </button>
        </div>
      )}
      {isScheduleLoading && (
        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          {localizedText("Đang tải lịch tuần...", "Loading weekly schedule...")}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-500">
            {localizedText("Tổng giờ làm cả tuần", "Total hours this week")}
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {totalHours} {localizedText("giờ", "hours")}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-500">
            {localizedText("Ô chưa xếp ca", "Unassigned cells")}
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{emptyCount}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-500">
            {localizedText("Vị trí ca còn thiếu", "Unfilled shift positions")}
          </p>
          <p
            className={`mt-1 text-2xl font-bold ${shortageCount > 0 ? "text-amber-700" : "text-emerald-700"}`}
          >
            {shortageCount}
          </p>
        </article>
      </div>

      <div className="sticky top-16 z-30 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-md backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900">
              {localizedText("Chọn màu ca", "Shift colors")}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {copyCellSource
                ? localizedText(
                    "Đã sao chép trạng thái ô. Chọn ô đích; bấm màu để hủy sao chép.",
                    "Cell state copied. Choose a target; click a color to cancel.",
                  )
                : localizedText(
                    "Bấm ô đã xếp ca để sao chép trạng thái; chọn màu để xếp ca mới.",
                    "Click an assigned cell to copy its state; choose a color to assign a new shift.",
                  )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {toolOptions.map((option) => (
              <button
                type="button"
                key={option.code}
                onClick={() => {
                  setSelectedTool(option.code);
                  setCopyCellSource(null);
                }}
                aria-pressed={!copyCellSource && selectedTool === option.code}
                className={`flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-left transition ${!copyCellSource && selectedTool === option.code ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-white hover:bg-slate-50"}`}
              >
                <span className={`h-5 w-5 shrink-0 rounded-md border ${option.swatch}`} />
                <span className="text-xs font-semibold text-slate-800">{option.label}</span>
                <span className="text-[11px] text-slate-500">{option.detail}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <section className="min-w-0 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="min-w-[700px] space-y-2 xl:min-w-0">
            <div
              id="weekly-shift-assignment-grid"
              className="grid grid-cols-[170px_repeat(7,minmax(0,1fr))_68px] items-stretch gap-1"
            >
              <div className="flex items-end px-2 pb-2 text-xs font-semibold text-slate-500">
                {localizedText("Nhân viên", "Employee")}
              </div>
              {dates.map((date, index) => (
                <div
                  key={dateKey(date)}
                  className={`flex flex-col items-center rounded-lg px-1 py-2 ${dateKey(date) === todayKey ? "bg-teal-50" : ""}`}
                >
                  <span className="text-xs font-bold text-slate-800">
                    {localizedText(dayLabels[index][0], dayLabels[index][1])}
                  </span>
                  <span className="mt-0.5 text-xs text-slate-600">
                    {formatDate(date)}
                  </span>
                  <span className="min-h-4 text-[10px] font-semibold text-teal-700">
                    {dateKey(date) === todayKey
                      ? localizedText("Hôm nay", "Today")
                      : ""}
                  </span>
                </div>
              ))}
              <div className="flex items-end justify-center pb-2 text-center text-xs font-semibold text-slate-500">
                {localizedText("Giờ trong tuần", "Weekly hours")}
              </div>
            </div>

            {employees.map((employee, employeeIndex) => {
              const hours = employeeHours[employeeIndex];
              const role = employeeShiftRole(employee.position);
              const previousRole =
                employeeIndex > 0
                  ? employeeShiftRole(employees[employeeIndex - 1].position)
                  : null;
              const hoursStyle =
                hours > 48
                  ? "bg-rose-100 text-rose-800"
                  : hours === 48
                    ? "bg-amber-100 text-amber-900"
                    : "bg-emerald-100 text-emerald-800";
              return (
                <Fragment key={employee.id}>
                  {role !== previousRole && role && (
                    <h3 className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
                      {localizedRole(role)}
                    </h3>
                  )}
                  <div className="grid grid-cols-[170px_repeat(7,minmax(0,1fr))_68px] items-center gap-1">
                    <div className="flex min-w-0 items-center gap-1.5 px-1 py-1">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                        {initials(employee.fullName)}
                      </span>
                      <span className="min-w-0">
                        <span className="block whitespace-normal break-words text-xs font-semibold leading-tight text-slate-800">
                          {employee.fullName}
                        </span>
                        <span className="block whitespace-normal break-words text-[11px] leading-tight text-slate-500">
                          {role ? localizedRole(role) : employee.position}
                        </span>
                      </span>
                    </div>
                    {weekGrid[employeeIndex].map((code, dayIndex) => {
                      const shift = code ? shifts[code] : null;
                      return (
                        <button
                          type="button"
                          key={`${employee.id}-${dayIndex}`}
                          id={`weekly-shift-cell-${employeeIndex}-${dayIndex}`}
                          onClick={() => assignShift(employeeIndex, dayIndex)}
                          disabled={
                            (dateKey(dates[dayIndex]) <= todayKey &&
                              (copyCellSource !== null || !shift)) ||
                            isScheduleLoading ||
                            isScheduleError ||
                            isSaving ||
                            isCopying ||
                            isClearing
                          }
                          aria-label={`${employee.fullName}, ${localizedText(dayLabels[dayIndex][0], dayLabels[dayIndex][1])} ${formatDate(dates[dayIndex])}: ${shift?.label ?? localizedText("Chưa xếp ca", "Unassigned")}${copyCellSource ? localizedText(" · chọn làm ô đích", " · select as target") : shift ? localizedText(" · bấm để sao chép ca", " · click to copy shift") : ""}`}
                          className={`flex min-h-[58px] flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-2 text-center transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-70 ${copyCellSource?.employeeId === employee.id && copyCellSource.workDate === dateKey(dates[dayIndex]) ? "ring-2 ring-violet-500 ring-offset-1" : coverageFocus?.weekStart === weekStart && coverageFocus.role === role && coverageFocus.dayIndex === dayIndex ? "ring-2 ring-amber-500 ring-offset-1" : ""} ${shift ? shift.classes : "border-dashed border-slate-300 bg-white text-slate-500"}`}
                        >
                          <span className="text-xs font-bold">
                            {shift?.shortLabel ?? "+"}
                          </span>
                          {shift && (
                            <span className="text-[10px]">{shift.time}</span>
                          )}
                        </button>
                      );
                    })}
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className={`rounded-full px-1.5 py-1 text-[11px] font-bold ${hoursStyle}`}
                      >
                        {hours} {localizedText("giờ", "hours")}
                      </span>
                      <span
                        className={`min-h-4 text-[10px] font-semibold ${hours > 48 ? "text-rose-700" : "text-slate-500"}`}
                      >
                        {hours > 48
                          ? localizedText("Vượt 48 giờ", "Over 48 hours")
                          : hours === 48
                            ? localizedText("Đã tối đa", "At limit")
                            : ""}
                      </span>
                    </div>
                  </div>
                </Fragment>
              );
            })}

            <div className="my-3 h-px bg-slate-200" />
            <h3 className="px-2 text-sm font-bold text-slate-900">
              {localizedText(
                "Định biên từng ca · 2 Lễ tân, 2 Buồng phòng, 1 Bảo vệ",
                "Staffing per shift · 2 front desk, 2 housekeeping, 1 security",
              )}
            </h3>
            {coverage.map(({ code, role, required, counts }) => (
              <div
                key={`${code}-${role}`}
                className="grid grid-cols-[170px_repeat(7,minmax(0,1fr))_68px] items-center gap-1"
              >
                <div className="flex items-center gap-2 px-2">
                  <span
                    className={`h-4 w-4 rounded border ${code === "M" ? "border-amber-300 bg-amber-100" : code === "A" ? "border-blue-300 bg-blue-100" : "border-indigo-900 bg-indigo-900"}`}
                  />
                  <span>
                    <span className="block text-xs font-semibold text-slate-800">
                      {localizedShift(code)} · {localizedRole(role)}
                    </span>
                    <span className="block text-[10px] text-slate-500">
                      {localizedText(
                        `Cần ${required} người`,
                        `Needs ${required} employees`,
                      )}
                    </span>
                  </span>
                </div>
                {counts.map((count, dayIndex) => {
                  const missing = required - count;
                  return (
                    <button
                      type="button"
                      key={`${code}-${dayIndex}`}
                      onClick={() => focusCoverage(code, role, dayIndex)}
                      aria-pressed={
                        coverageFocus?.weekStart === weekStart &&
                        coverageFocus.code === code &&
                        coverageFocus.role === role &&
                        coverageFocus.dayIndex === dayIndex
                      }
                      aria-label={localizedText(
                        `${localizedShift(code)} · ${localizedRole(role)} · ${dayLabels[dayIndex][0]} ${formatDate(dates[dayIndex])}: ${count}/${required} người`,
                        `${localizedShift(code)} · ${localizedRole(role)} · ${dayLabels[dayIndex][1]} ${formatDate(dates[dayIndex])}: ${count}/${required} employees`,
                      )}
                      className={`flex min-h-12 flex-col items-center justify-center rounded-lg border transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${coverageFocus?.weekStart === weekStart && coverageFocus.code === code && coverageFocus.role === role && coverageFocus.dayIndex === dayIndex ? "ring-2 ring-amber-500 ring-offset-1" : ""} ${missing > 0 ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
                    >
                      <span className="text-xs font-bold">
                        {count} / {required}
                      </span>
                      <span className="text-[10px] font-semibold">
                        {missing > 0
                          ? localizedText(
                              `Thiếu ${missing}`,
                              `${missing} needed`,
                            )
                          : localizedText("Đủ người", "Fully staffed")}
                      </span>
                    </button>
                  );
                })}
                <span />
              </div>
            ))}
          </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${isDirty ? "bg-amber-100 text-amber-800" : isSaved ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}
        >
          <Clock3 size={13} />
          {isDirty
            ? localizedText("Chưa lưu", "Unsaved")
            : isSaved
              ? localizedText("Đã lưu trên hệ thống", "Saved to system")
              : localizedText("Chưa có lịch đã lưu", "No saved schedule")}
        </span>
        <span className="text-xs text-slate-500">
          {localizedText(
            "Lịch được tải và lưu trực tiếp với hệ thống.",
            "Schedules are loaded from and saved directly to the system.",
          )}
        </span>
      </footer>
      <p className="text-xs text-slate-500">
        {localizedText(
          "Mỗi ca tính 8 giờ; một nhân viên chỉ được làm một ca/ngày. Mỗi ca cần 2 Lễ tân, 2 Buồng phòng và 1 Bảo vệ. Hôm nay và ngày đã qua chỉ xem.",
          "Each shift is 8 hours; each employee can work only one shift/day. Every shift needs 2 front desk, 2 housekeeping, and 1 security employee. Today and past dates are read-only.",
        )}
      </p>
    </section>
  );
}
