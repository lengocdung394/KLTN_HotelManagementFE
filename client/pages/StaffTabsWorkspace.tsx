import { useSearchParams } from "react-router-dom";
import { Clock3 } from "lucide-react";
import EmployeeDirectory from "../components/EmployeeDirectory";
import EmployeeShiftSchedule from "./EmployeeShiftSchedule";
import HousekeepingTaskManagement from "./HousekeepingTaskManagement";
import ManagerShiftPlanner from "./ManagerShiftPlanner";
import { useGetWeeklyShiftScheduleQuery, type ShiftAssignment } from "../services/shiftApi";
import { useAppSelector } from "../store/hooks";

type StaffTab = "today" | "employees" | "shifts" | "tasks";

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
    matches: ["buồng phòng", "buong phong", "housekeeping", "housekeeper", "room attendant"],
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
  const normalized = role.trim().toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (normalized.includes("le tan") || normalized.includes("reception") || normalized.includes("front desk") || normalized.includes("front office")) return "reception";
  if (normalized.includes("buong") || normalized.includes("housekeeping") || normalized.includes("housekeeper") || normalized.includes("room attendant")) return "housekeeping";
  if (normalized.includes("bao ve") || normalized.includes("security") || normalized.includes("guard")) return "security";
  return null;
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

function ManagerTodayShifts() {
  const weekStart = getWeekStart();
  const { data, isLoading, isError } = useGetWeeklyShiftScheduleQuery(weekStart);
  const today = data?.days.find((day) => day.date === localDate());

  if (isLoading) return <p className="mt-5 rounded-xl bg-white p-5 text-sm text-slate-500">Đang tải ca làm hôm nay...</p>;
  if (isError) return <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-5 text-sm text-rose-700">Không thể tải ca làm hôm nay.</p>;

  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold text-slate-900">Ca làm hôm nay</h2>
      <p className="mt-1 text-sm text-slate-500">Danh sách nhân viên theo lịch phân ca đã lưu.</p>
      {!today || today.assignments.length === 0 ? (
        <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">Chưa có lịch phân ca cho hôm nay. Mở tab “Phân ca tuần” để lập lịch.</p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {["Ca sáng", "Ca chiều", "Ca đêm"].map((shiftType) => {
            const assignments = today.assignments.filter((assignment) => assignment.shiftType === shiftType);
            const shiftTime = assignments[0]?.shiftTime ?? "";
            const assignmentsByRole = roleOrder.map((roleKey) => ({
              roleKey,
              role: roleStyles[roleKey],
              employees: assignments.filter((assignment) => assignmentRoleKey(assignment.role) === roleKey),
            }));
            const uncategorized = assignments.filter((assignment) => assignmentRoleKey(assignment.role) === null);
            return (
              <article key={shiftType} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <h3 className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800">
                  <span>{shiftType}</span>
                  <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500"><Clock3 size={12} />{shiftTime || "Chưa có lịch"}</span>
                </h3>
                <div className="space-y-3 p-3">
                  {assignmentsByRole.map(({ roleKey, role, employees }) => (
                    <section key={roleKey} className={`rounded-lg border p-3 ${role.card}`}>
                      <h4 className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-700">
                        <span className={`h-2 w-2 rounded-full ${role.dot}`} />
                        {role.label}
                        <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${role.badge}`}>{employees.length}</span>
                      </h4>
                      {employees.length ? (
                        <div className="space-y-2">
                          {employees.map((assignment, index) => (
                            <EmployeeShiftRow key={`${assignment.employeeId}-${index}`} assignment={assignment} avatarClass={role.avatar} badgeClass={role.badge} />
                          ))}
                        </div>
                      ) : (
                        <p className="rounded-md bg-white/70 px-3 py-2 text-xs text-slate-500">Chưa có nhân viên</p>
                      )}
                    </section>
                  ))}
                  {uncategorized.map((assignment, index) => (
                    <EmployeeShiftRow key={`${assignment.employeeId}-other-${index}`} assignment={assignment} avatarClass="bg-slate-100 text-slate-600" badgeClass="bg-slate-100 text-slate-600" />
                  ))}
                  {!assignments.length && <p className="rounded-lg bg-amber-50 p-3 text-center text-xs text-amber-800">Chưa có nhân viên được phân ca này.</p>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
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

  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-white/80 bg-white p-2.5 shadow-sm">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-bold ${avatarClass}`}>{initials}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-slate-800">{assignment.employeeName}</p>
        {assignment.task && <p className="mt-0.5 truncate text-[10px] text-slate-500">{assignment.task}</p>}
      </div>
      <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold ${badgeClass}`}>Đã phân ca</span>
    </div>
  );
}

export default function StaffTabsWorkspace({ initialTab = "today" }: { initialTab?: StaffTab }) {
  const roles = useAppSelector((state) => state.auth.roles);
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const tab: StaffTab = requestedTab === "employees" || requestedTab === "shifts" || requestedTab === "tasks"
    ? requestedTab
    : initialTab;

  if (roles.includes("ROLE_EMPLOYEE") && !roles.includes("ROLE_MANAGER") && !roles.includes("ROLE_ADMIN")) {
    return <EmployeeShiftSchedule />;
  }

  return (
    <div className="staff-tabs-workspace">
      {tab === "today" && <ManagerTodayShifts />}
      {tab === "employees" && <div className="mt-5"><EmployeeDirectory /></div>}
      {tab === "shifts" && roles.includes("ROLE_MANAGER") && <ManagerShiftPlanner />}
      {tab === "tasks" && (roles.includes("ROLE_MANAGER") || roles.includes("ROLE_ADMIN")) && <HousekeepingTaskManagement />}
    </div>
  );
}
