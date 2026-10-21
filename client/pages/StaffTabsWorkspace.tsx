import { useState } from "react";
import { CalendarClock, Clock3, ShieldCheck, UserRound, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import EmployeeDirectory from "../components/EmployeeDirectory";
import PermissionsWorkspace from "./PermissionsWorkspace";
import EmployeeShiftSchedule from "./EmployeeShiftSchedule";
import ManagerShiftPlanner from "./ManagerShiftPlanner";
import { useGetWeeklyShiftScheduleQuery } from "../services/shiftApi";
import { useAppSelector } from "../store/hooks";

type StaffTab = "today" | "employees" | "permissions" | "shifts";

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
            return (
              <article key={shiftType} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="flex items-center justify-between text-sm font-bold text-slate-800">
                  {shiftType}
                  <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500"><Clock3 size={12} />{shiftTime}</span>
                </h3>
                <div className="mt-3 space-y-2">
                  {assignments.map((assignment, index) => (
                    <div key={`${assignment.employeeId}-${index}`} className="flex items-start justify-between gap-2 rounded-lg bg-white p-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-800">{assignment.employeeName}</p>
                        <p className="mt-0.5 text-[10px] text-slate-500">{assignment.role} · {assignment.task}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">Đã phân ca</span>
                    </div>
                  ))}
                  {assignments.length === 0 && <p className="rounded-lg bg-white p-3 text-center text-xs text-slate-400">Chưa có nhân viên</p>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function StaffTabsWorkspace({ initialTab = "today" }: { initialTab?: StaffTab }) {
  const { t } = useTranslation();
  const roles = useAppSelector((state) => state.auth.roles);
  const [tab, setTab] = useState<StaffTab>(initialTab);

  if (roles.includes("ROLE_EMPLOYEE") && !roles.includes("ROLE_MANAGER") && !roles.includes("ROLE_ADMIN")) {
    return <EmployeeShiftSchedule />;
  }

  const tabs: Array<{ id: StaffTab; label: string; icon: typeof Users }> = [
    { id: "today", label: "Ca hôm nay", icon: Users },
    { id: "employees", label: "Danh sách nhân viên", icon: UserRound },
    { id: "permissions", label: "Phân quyền", icon: ShieldCheck },
    ...(roles.includes("ROLE_MANAGER")
      ? [{ id: "shifts" as const, label: t("staff.assignmentTab", "Phân ca tuần"), icon: CalendarClock }]
      : []),
  ];

  return (
    <div className="staff-tabs-workspace mt-6">
      <nav className="flex w-fit flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm" aria-label="Quản lý nhân viên">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${tab === id ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}
          >
            <Icon size={16} />{label}
          </button>
        ))}
      </nav>
      {tab === "today" && <ManagerTodayShifts />}
      {tab === "employees" && <div className="mt-5"><EmployeeDirectory /></div>}
      {tab === "permissions" && <div className="mt-5"><PermissionsWorkspace /></div>}
      {tab === "shifts" && <ManagerShiftPlanner />}
    </div>
  );
}
