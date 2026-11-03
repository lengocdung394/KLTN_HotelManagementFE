import { Fragment, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Clock3 } from "lucide-react";
import EmployeeDirectory from "../components/EmployeeDirectory";
import EmployeeShiftSchedule from "./EmployeeShiftSchedule";
import HousekeepingTaskManagement from "./HousekeepingTaskManagement";
import WeeklyShiftPrototype from "./WeeklyShiftPrototype";
import {
  useGetWeeklyShiftScheduleQuery,
  type ShiftAssignment,
} from "../services/shiftApi";
import { useAppSelector } from "../store/hooks";
import { isEmployeePortalUser } from "../lib/employeeRoles";
import { localizedText } from "../i18n";

type StaffTab = "today" | "employees" | "shifts" | "tasks" | "weekly-demo";

const roleStyles = {
  reception: {
    label: "Lễ tân",
    matches: ["lễ tân", "le tan", "reception", "front desk", "front office"],
    card: "border-blue-200 bg-blue-50/60",
    avatar: "bg-blue-100 text-blue-700",
    badge: "bg-blue-100 text-blue-700",
    dot: "bg-blue-500",
  },
  housekeeping: {
    label: "Buồng phòng",
    matches: [
      "buồng phòng",
      "buong phong",
      "housekeeping",
      "housekeeper",
      "room attendant",
    ],
    card: "border-emerald-200 bg-emerald-50/60",
    avatar: "bg-emerald-100 text-emerald-700",
    badge: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500",
  },
  security: {
    label: "Bảo vệ",
    matches: ["bảo vệ", "bao ve", "security", "guard"],
    card: "border-amber-200 bg-amber-50/70",
    avatar: "bg-amber-100 text-amber-800",
    badge: "bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
  },
} as const;

const roleOrder = ["reception", "housekeeping", "security"] as const;

const assignmentRoleKey = (role: string) => {
  const normalized = role
    .trim()
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (
    normalized.includes("le tan") ||
    normalized.includes("reception") ||
    normalized.includes("front desk") ||
    normalized.includes("front office")
  )
    return "reception";
  if (
    normalized.includes("buong") ||
    normalized.includes("housekeeping") ||
    normalized.includes("housekeeper") ||
    normalized.includes("room attendant")
  )
    return "housekeeping";
  if (
    normalized.includes("bao ve") ||
    normalized.includes("security") ||
    normalized.includes("guard")
  )
    return "security";
  return null;
};

const assignmentRoleOrder = (role: string) => {
  const roleKey = assignmentRoleKey(role);
  return roleKey ? roleOrder.indexOf(roleKey) : roleOrder.length;
};

const getWeekStart = () => {
  const date = new Date();
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

function ManagerShiftOverview() {
  const [view, setView] = useState<"today" | "week">("today");
  const weekStart = getWeekStart();
  const { data, isLoading, isError } =
    useGetWeeklyShiftScheduleQuery(weekStart);
  const today = data?.days.find((day) => day.date === localDate());

  if (isLoading)
    return (
      <p className="mt-5 rounded-xl bg-white p-5 text-sm text-slate-500">
        {localizedText(
          "Đang tải ca làm hôm nay...",
          "Loading today's shifts...",
        )}
      </p>
    );
  if (isError)
    return (
      <p
        role="alert"
        className="mt-5 rounded-xl bg-rose-50 p-5 text-sm text-rose-700"
      >
        {localizedText(
          "Không thể tải ca làm hôm nay.",
          "Could not load today's shifts.",
        )}
      </p>
    );

  return (
    <div className="mt-5 space-y-4">
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label={localizedText("Chế độ xem ca trực", "Shift views")}
      >
        <button
          type="button"
          role="tab"
          aria-selected={view === "today"}
          onClick={() => setView("today")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${view === "today" ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
        >
          {localizedText("Ca trực hôm nay", "Today's shifts")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "week"}
          onClick={() => setView("week")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${view === "week" ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
        >
          {localizedText("Lịch trực theo tuần", "Weekly shift schedule")}
        </button>
      </div>
      {view === "today" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-900">
            {localizedText("Ca làm hôm nay", "Today's shifts")}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {localizedText(
              "Danh sách nhân viên theo lịch phân ca đã lưu.",
              "Employees scheduled for today's saved shifts.",
            )}
          </p>
          {!today || today.assignments.length === 0 ? (
            <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
              {localizedText(
                "Chưa có lịch phân ca cho hôm nay. Mở tab “Phân ca làm” để lập lịch.",
                "No shifts are scheduled for today. Open the “Assign shifts” tab to create a schedule.",
              )}
            </p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {["Ca sáng", "Ca chiều", "Ca đêm"].map((shiftType) => {
                const assignments = today.assignments.filter(
                  (assignment) => assignment.shiftType === shiftType,
                );
                const shiftTime = assignments[0]?.shiftTime ?? "";
                const assignmentsByRole = roleOrder.map((roleKey) => ({
                  roleKey,
                  role: roleStyles[roleKey],
                  employees: assignments.filter(
                    (assignment) =>
                      assignmentRoleKey(assignment.role) === roleKey,
                  ),
                }));
                const uncategorized = assignments.filter(
                  (assignment) => assignmentRoleKey(assignment.role) === null,
                );
                return (
                  <article
                    key={shiftType}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                  >
                    <h3 className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800">
                      <span>
                        {shiftType === "Ca sáng"
                          ? localizedText("Ca sáng", "Morning shift")
                          : shiftType === "Ca chiều"
                            ? localizedText("Ca chiều", "Afternoon shift")
                            : localizedText("Ca đêm", "Night shift")}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                        <Clock3 size={12} />
                        {shiftTime ||
                          localizedText("Chưa có lịch", "No schedule")}
                      </span>
                    </h3>
                    <div className="space-y-3 p-3">
                      {assignmentsByRole.map(({ roleKey, role, employees }) => (
                        <section
                          key={roleKey}
                          className={`rounded-lg border p-3 ${role.card}`}
                        >
                          <h4 className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-700">
                            <span
                              className={`h-2 w-2 rounded-full ${role.dot}`}
                            />
                            {roleKey === "reception"
                              ? localizedText(role.label, "Front desk")
                              : roleKey === "housekeeping"
                                ? localizedText(role.label, "Housekeeping")
                                : localizedText(role.label, "Security")}
                            <span
                              className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${role.badge}`}
                            >
                              {employees.length}
                            </span>
                          </h4>
                          {employees.length ? (
                            <div className="space-y-2">
                              {employees.map((assignment, index) => (
                                <EmployeeShiftRow
                                  key={`${assignment.employeeId}-${index}`}
                                  assignment={assignment}
                                  avatarClass={role.avatar}
                                  badgeClass={role.badge}
                                />
                              ))}
                            </div>
                          ) : (
                            <p className="rounded-md bg-white/70 px-3 py-2 text-xs text-slate-500">
                              {localizedText(
                                "Chưa có nhân viên",
                                "No employees assigned",
                              )}
                            </p>
                          )}
                        </section>
                      ))}
                      {uncategorized.map((assignment, index) => (
                        <EmployeeShiftRow
                          key={`${assignment.employeeId}-other-${index}`}
                          assignment={assignment}
                          avatarClass="bg-slate-100 text-slate-600"
                          badgeClass="bg-slate-100 text-slate-600"
                        />
                      ))}
                      {!assignments.length && (
                        <p className="rounded-lg bg-amber-50 p-3 text-center text-xs text-amber-800">
                          {localizedText(
                            "Chưa có nhân viên được phân ca này.",
                            "No employees are assigned to this shift.",
                          )}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-bold text-slate-900">
                {localizedText("Lịch trực theo tuần", "Weekly shift schedule")}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {localizedText(
                  "Lịch ca đã được phân cho tuần này.",
                  "Assigned shifts for this week.",
                )}
              </p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {localizedText(
                `Đã xếp đủ ${data?.daysFullyStaffed ?? 0}/7 ngày`,
                `${data?.daysFullyStaffed ?? 0}/7 days fully staffed`,
              )}
            </span>
          </div>
          {data?.days.length ? (
            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                <div className="grid grid-cols-[88px_repeat(7,minmax(0,1fr))] gap-1.5">
                  <div className="flex items-end px-2 pb-2 text-xs font-semibold text-slate-500">
                    {localizedText("Ca trực", "Shift")}
                  </div>
                  {data.days.map((day) => (
                    <div
                      key={day.date}
                      className="rounded-lg bg-slate-50 px-1 py-2 text-center"
                    >
                      <p className="text-xs font-bold text-slate-800">
                        {day.dayLabel}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {day.dateDisplay}
                      </p>
                    </div>
                  ))}
                  {(
                    [
                      {
                        type: "Ca sáng",
                        label: localizedText("Ca sáng", "Morning shift"),
                        color: "border-amber-200 bg-amber-50",
                        dot: "bg-amber-400",
                      },
                      {
                        type: "Ca chiều",
                        label: localizedText("Ca chiều", "Afternoon shift"),
                        color: "border-blue-200 bg-blue-50",
                        dot: "bg-blue-400",
                      },
                      {
                        type: "Ca đêm",
                        label: localizedText("Ca đêm", "Night shift"),
                        color: "border-indigo-200 bg-indigo-50",
                        dot: "bg-indigo-700",
                      },
                    ] as const
                  ).map((shift) => (
                    <Fragment key={shift.type}>
                      <div className="flex flex-col justify-center rounded-lg bg-slate-50 px-2 py-3">
                        <span className="text-xs font-bold text-slate-800">
                          {shift.label}
                        </span>
                        <span className="mt-1 text-[10px] text-slate-500">
                          {shift.type === "Ca sáng"
                            ? "06:00–14:00"
                            : shift.type === "Ca chiều"
                              ? "14:00–22:00"
                              : "22:00–06:00"}
                        </span>
                      </div>
                      {data.days.map((day) => {
                        const assignments = day.assignments
                          .filter(
                            (assignment) => assignment.shiftType === shift.type,
                          )
                          .sort(
                            (first, second) =>
                              assignmentRoleOrder(first.role) -
                                assignmentRoleOrder(second.role) ||
                              first.employeeName.localeCompare(
                                second.employeeName,
                                "vi",
                              ),
                          );
                        return (
                          <div
                            key={`${day.date}-${shift.type}`}
                            className={`min-h-24 space-y-1.5 rounded-lg border p-2 ${shift.color}`}
                          >
                            {assignments.length ? (
                              assignments.map((assignment, index) => {
                                const roleKey = assignmentRoleKey(
                                  assignment.role,
                                );
                                const roleStyle = roleKey
                                  ? roleStyles[roleKey]
                                  : null;
                                return (
                                  <div
                                    key={`${assignment.employeeId}-${index}`}
                                    className="flex min-w-0 items-center gap-1.5 rounded-md border border-white/80 bg-white/90 px-1.5 py-1 shadow-sm"
                                    title={`${assignment.employeeName} · ${assignment.role || assignment.position}`}
                                  >
                                    <span
                                      className={`h-2 w-2 shrink-0 rounded-full ${roleStyle?.dot ?? shift.dot}`}
                                    />
                                    <span className="min-w-0">
                                      <span className="block break-words text-[11px] font-semibold leading-tight text-slate-800">
                                        {assignment.employeeName}
                                      </span>
                                      <span className="block truncate text-[10px] leading-tight text-slate-500">
                                        {roleKey
                                          ? localizedText(
                                              roleStyles[roleKey].label,
                                              roleKey === "reception"
                                                ? "Front desk"
                                                : roleKey === "housekeeping"
                                                  ? "Housekeeping"
                                                  : "Security",
                                            )
                                          : assignment.role ||
                                            assignment.position}
                                      </span>
                                    </span>
                                  </div>
                                );
                              })
                            ) : (
                              <p className="flex min-h-20 items-center justify-center text-center text-[10px] text-slate-400">
                                {localizedText("Chưa phân ca", "Unassigned")}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
              {localizedText(
                "Chưa có lịch trực cho tuần này.",
                "No shifts are scheduled for this week.",
              )}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function EmployeeShiftRow({
  assignment,
  avatarClass,
  badgeClass,
}: {
  assignment: ShiftAssignment;
  avatarClass: string;
  badgeClass: string;
}) {
  const initials = assignment.employeeName
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0] ?? "")
    .join("")
    .toLocaleUpperCase("vi");
  const translatedTask =
    assignment.task === "Trực quầy lễ tân"
      ? localizedText(assignment.task, "Front desk duty")
      : assignment.task === "Dọn phòng"
        ? localizedText(assignment.task, "Room cleaning")
        : assignment.task === "Trực an ninh"
          ? localizedText(assignment.task, "Security duty")
          : assignment.task;
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-white/80 bg-white p-2.5 shadow-sm">
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-bold ${avatarClass}`}
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-slate-800">
          {assignment.employeeName}
        </p>
        {translatedTask && (
          <p className="mt-0.5 truncate text-[10px] text-slate-500">
            {translatedTask}
          </p>
        )}
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold ${badgeClass}`}
      >
        {localizedText("Đã phân ca", "Assigned")}
      </span>
    </div>
  );
}

export default function StaffTabsWorkspace({
  initialTab = "today",
}: {
  initialTab?: StaffTab;
}) {
  const roles = useAppSelector((state) => state.auth.roles);
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const tab: StaffTab =
    requestedTab === "employees" ||
    requestedTab === "shifts" ||
    requestedTab === "tasks" ||
    requestedTab === "weekly-demo"
      ? requestedTab
      : initialTab;

  if (isEmployeePortalUser(roles)) {
    return tab === "tasks" ? (
      <HousekeepingTaskManagement employeeMode />
    ) : (
      <EmployeeShiftSchedule />
    );
  }

  return (
    <div className="staff-tabs-workspace">
      {tab === "today" && <ManagerShiftOverview />}
      {tab === "employees" && (
        <div className="mt-5">
          <EmployeeDirectory />
        </div>
      )}
      {(tab === "shifts" || tab === "weekly-demo") &&
        roles.includes("ROLE_MANAGER") && <WeeklyShiftPrototype />}
      {tab === "tasks" &&
        (roles.includes("ROLE_MANAGER") || roles.includes("ROLE_ADMIN")) && (
          <HousekeepingTaskManagement />
        )}
    </div>
  );
}
