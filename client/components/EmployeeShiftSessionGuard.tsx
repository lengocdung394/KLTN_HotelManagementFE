import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { useGetWeeklyShiftScheduleQuery } from "../services/shiftApi";
import { logout } from "../store/authSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { isEmployeePortalUser } from "../lib/employeeRoles";

const getWeekStart = (date: Date) => {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const month = String(monday.getMonth() + 1).padStart(2, "0");
  const day = String(monday.getDate()).padStart(2, "0");
  return `${monday.getFullYear()}-${month}-${day}`;
};

const shiftWindow = (workDate: string, shiftTime: string) => {
  const match = shiftTime.match(/(\d{2}:\d{2})\s*[–-]\s*(\d{2}:\d{2})/);
  if (!match) return null;
  const start = new Date(`${workDate}T${match[1]}:00`);
  let end = new Date(`${workDate}T${match[2]}:00`);
  if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
};

export default function EmployeeShiftSessionGuard({ onLogout }: { onLogout: () => void }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const employeeId = useAppSelector((state) => state.auth.employeeId);
  const roles = useAppSelector((state) => state.auth.roles);
  const isEmployee = isEmployeePortalUser(roles);
  const weekStart = useMemo(() => getWeekStart(new Date()), []);
  const previousWeekStart = useMemo(() => {
    const monday = new Date(`${weekStart}T00:00:00`);
    monday.setDate(monday.getDate() - 7);
    return getWeekStart(monday);
  }, [weekStart]);
  const { data: currentWeek } = useGetWeeklyShiftScheduleQuery(weekStart, { skip: !isEmployee || !employeeId });
  const { data: previousWeek } = useGetWeeklyShiftScheduleQuery(previousWeekStart, { skip: !isEmployee || !employeeId });
  const warnedShift = useRef<string | null>(null);
  const didLogout = useRef(false);

  useEffect(() => {
    if (!isEmployee || !employeeId || (!currentWeek && !previousWeek)) return;

    const interval = window.setInterval(() => {
      if (didLogout.current) return;
      const now = new Date();
      const assignments = [...(previousWeek?.days ?? []), ...(currentWeek?.days ?? [])]
        .flatMap((day) => day.assignments
          .filter((assignment) => assignment.employeeId === employeeId)
          .map((assignment) => ({
            key: `${day.date}:${assignment.shiftType}:${assignment.employeeId}`,
            window: shiftWindow(day.date, assignment.shiftTime),
          })))
        .filter((assignment): assignment is { key: string; window: NonNullable<ReturnType<typeof shiftWindow>> } => assignment.window !== null);
      const currentShift = assignments
        .filter(({ window }) => now >= window.start && now < window.end)
        .sort((a, b) => b.window.start.getTime() - a.window.start.getTime())[0]
        ?? assignments
          .filter(({ window }) =>
            now >= window.end && now.getTime() <= window.end.getTime() + 5 * 60 * 1000,
          )
          .sort((a, b) => b.window.end.getTime() - a.window.end.getTime())[0];
      if (!currentShift) return;

      const remainingMs = currentShift.window.end.getTime() - now.getTime();
      if (remainingMs <= 5 * 60 * 1000 && remainingMs > 0 && warnedShift.current !== currentShift.key) {
        warnedShift.current = currentShift.key;
        toast({
          title: "Ca làm sắp kết thúc",
          description: "Còn 5 phút nữa hết ca. Vui lòng đăng xuất để nhân viên ca tiếp theo đăng nhập.",
        });
      }
      if (remainingMs <= 0) {
        didLogout.current = true;
        toast({
          title: "Đã hết ca làm",
          description: "Hệ thống đã đăng xuất để bàn giao thiết bị cho ca tiếp theo.",
        });
        dispatch(logout());
        onLogout();
        navigate("/login", { replace: true });
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [currentWeek, dispatch, employeeId, isEmployee, navigate, onLogout, previousWeek]);

  return null;
}
