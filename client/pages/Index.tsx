import { Link } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Download,
  Plus,
  UserRound,
} from "lucide-react";
import OverviewCalendar from "../components/OverviewCalendarNew";
import DashboardCheckInOut from "../components/DashboardCheckInOut";
import { useGetCheckInOutSummaryQuery } from "../services/checkInOutApi";
import { useGetBookingsByHotelQuery } from "../services/bookingApi";
import AppHeader from "../components/AppHeader";
import AppSidebar from "../components/AppSidebar";
import ScrollControls from "../components/ScrollControls";
import { useAppSelector } from "../store/hooks";
import { useAppDispatch } from "../store/hooks";
import { useSidebar } from "../hooks/useSidebar";
import { useGetRoomsByCurrentHotelQuery } from "../services/roomApi";
import { useGetHotelHousekeepingTasksQuery, useGetMyHousekeepingTasksQuery } from "../services/shiftApi";
import { bindHotelSocketEvents } from "../lib/socket";
import { baseApi } from "../services/baseApi";
import { useGetHotelReportQuery } from "../services/reportApi";
import { isEmployeePortalUser } from "../lib/employeeRoles";

const getLocalDateParam = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};

export default function Index({ onLogout }: { onLogout: () => void }) {
  const { t } = useTranslation();
  const { mobileOpen, collapsed, toggleSidebar, closeMobile } = useSidebar();
  const dispatch = useAppDispatch();
  const { fullName, email, position, hotelId, roles } = useAppSelector((state) => state.auth);
  const isEmployee = isEmployeePortalUser(roles);
  const { data: rooms = [], isLoading: roomsLoading, isError: roomsError } = useGetRoomsByCurrentHotelQuery(undefined, {
    skip: !hotelId,
    pollingInterval: 30000,
  });
  const today = getLocalDateParam();
  const {
    data: dailyReport,
    isLoading: reportLoading,
    isError: reportError,
  } = useGetHotelReportQuery(
    { startDate: today, endDate: today },
    { skip: !hotelId, pollingInterval: 30000 },
  );
  const {
    data: todaySummary,
    isLoading: summaryLoading,
    isError: summaryError,
  } = useGetCheckInOutSummaryQuery({ date: today }, { skip: !hotelId, pollingInterval: 30000 });
  const {
    data: bookings = [],
    isLoading: bookingsLoading,
    isError: bookingsError,
  } = useGetBookingsByHotelQuery(Number(hotelId), { skip: !hotelId, pollingInterval: 30000 });
  const { data: managementTasks = [], isLoading: managementTasksLoading, isError: managementTasksError } = useGetHotelHousekeepingTasksQuery(undefined, {
    skip: !hotelId || isEmployee,
    pollingInterval: 30000,
  });
  const { data: employeeTasks = [], isLoading: employeeTasksLoading, isError: employeeTasksError } = useGetMyHousekeepingTasksQuery(undefined, {
    skip: !hotelId || !isEmployee,
    pollingInterval: 30000,
  });
  const housekeepingTasks = isEmployee ? employeeTasks : managementTasks;
  const tasksLoading = isEmployee ? employeeTasksLoading : managementTasksLoading;
  const tasksError = isEmployee ? employeeTasksError : managementTasksError;
  useEffect(() => {
    if (!hotelId) return;
    return bindHotelSocketEvents({
      onRoomUpdated: () => dispatch(baseApi.util.invalidateTags(["Room"])),
      onRoomCreated: () => dispatch(baseApi.util.invalidateTags(["Room"])),
      onRoomMatrixUpdated: () => dispatch(baseApi.util.invalidateTags(["Room", "Booking"])),
      onBookingStateUpdated: () => dispatch(baseApi.util.invalidateTags(["Booking", "Room"])),
      onNewBookingNotification: () => dispatch(baseApi.util.invalidateTags(["Booking", "Room"])),
      onNotificationCreated: () => dispatch(baseApi.util.invalidateTags(["Room"])),
    });
  }, [dispatch, hotelId]);

  const activeHousekeepingTasks = housekeepingTasks.filter((task) =>
    ["NEEDS_ASSIGNMENT", "ASSIGNED", "REASSIGNED"].includes(task.status.toUpperCase()),
  );
  const occupiedRooms = rooms.filter((room) => String(room.roomStatus ?? "").toUpperCase() === "IN_USE").length;
  const roomsAvailableForOccupancy = rooms.filter((room) => String(room.roomStatus ?? "").toUpperCase() !== "MAINTENANCE").length;
  const occupancyRate = roomsAvailableForOccupancy > 0
    ? Math.round((occupiedRooms / roomsAvailableForOccupancy) * 100)
    : 0;
  const currentGuestCount = bookings.reduce((guestCount, booking) => {
    if (String(booking.bookingStatus ?? "").toUpperCase() === "CANCELLED") return guestCount;
    const details = Array.isArray(booking.bookingDetails) ? booking.bookingDetails : [];
    return guestCount + details.reduce((roomGuestCount, detail) => {
      const status = String(detail.bookingStatusType ?? detail.status ?? "").toUpperCase();
      if (status !== "CHECKED_IN") return roomGuestCount;
      const adults = Number(detail.numAdults ?? 0);
      const children = Number(detail.numChildren ?? 0);
      const infants = Number(detail.numInfants ?? 0);
      return roomGuestCount + adults + children + infants;
    }, 0);
  }, 0);
  const formatTaskStatus = (status: string) => status === "NEEDS_ASSIGNMENT"
    ? t("common.pendingTask")
    : status === "REASSIGNED" ? "Đã phân công lại" : "Đã phân công";
  const roomStatusLabel = (value: unknown) => {
    const status = String(value ?? "").trim().toUpperCase();
    if (["READY", "AVAILABLE", "SẴN SÀNG"].includes(status)) return t("room.ready");
    if (["IN_USE", "OCCUPIED", "ĐANG Ở"].includes(status)) return t("room.staying");
    if (["CLEANING", "ĐANG DỌN", "ĐANG DỌN DẸP"].includes(status)) return t("room.cleaning");
    if (["MAINTENANCE", "BẢO TRÌ"].includes(status)) return t("room.maintenance");
    return String(value ?? "—");
  };
  const roomStatusColor = (value: unknown) => {
    const status = String(value ?? "").trim().toUpperCase();
    if (["READY", "AVAILABLE", "SẴN SÀNG"].includes(status)) return "text-emerald-700";
    if (["IN_USE", "OCCUPIED", "ĐANG Ở"].includes(status)) return "text-blue-700";
    if (["CLEANING", "ĐANG DỌN", "ĐANG DỌN DẸP"].includes(status)) return "text-amber-700";
    return "text-rose-700";
  };
  const visibleRooms = [...rooms].sort((left, right) =>
    String(left.roomNumber ?? left.roomCode ?? "").localeCompare(String(right.roomNumber ?? right.roomCode ?? ""), undefined, { numeric: true }),
  ).slice(0, 4);
  return (
    <div className="min-h-screen min-w-0 bg-[#f7f8fc] text-slate-800">
      <AppSidebar
        mobile={mobileOpen}
        onCloseMobile={closeMobile}
        onLogout={onLogout}
        fullName={fullName || email}
        position={position}
        collapsed={collapsed}
        onToggleCollapse={toggleSidebar}
      />
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
          onClick={closeMobile}
        />
      )}
      <main className={`min-w-0 transition-[padding] duration-300 ease-in-out ${collapsed ? "lg:pl-0" : "lg:pl-72"}`}>
        <AppHeader onMenuClick={toggleSidebar} fullName={fullName || email} collapsed={collapsed} />
        <div className={`mx-auto min-w-0 px-4 py-6 sm:px-6 lg:px-8 transition-[max-width] duration-300 ease-in-out ${collapsed ? "max-w-[1650px]" : "max-w-7xl"}`}>
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="mb-1 text-sm font-semibold text-blue-600">
                {t("dashboard.branchOverview")}
              </p>
              <h2 className="text-[28px] font-bold tracking-tight text-slate-900">
                {t("dashboard.whatsNew")}
              </h2>
            </div>
            <div className="flex gap-2">
              <button className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-600">
                <Download size={16} />
                {t("common.exportReport")}
              </button>
              <Link
                to="/bookings"
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white"
              >
                <Plus size={17} />
                {t("common.newBookingEyebrow")}
              </Link>
            </div>
          </div>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-blue-950 p-5 text-white">
              <p className="text-sm font-medium text-blue-100">
                {t("dashboard.todayRevenue")}
              </p>
              <p className="mt-4 text-[26px] font-bold">
                {reportLoading ? "—" : reportError ? "Lỗi" : `${Number(dailyReport?.netCashReceived ?? 0).toLocaleString("vi-VN")}đ`}
              </p>
              <p className="mt-1 text-xs text-blue-100">
                {reportError ? "Không tải được doanh thu hôm nay" : "Thu vào − hoàn tiền − tiền thừa trả khách"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
              <p className="text-sm font-medium text-slate-500">
                {t("dashboard.roomOccupancy")}
              </p>
              <p className="mt-4 text-[26px] font-bold">
                {roomsLoading ? "—" : roomsError ? "Lỗi" : `${occupancyRate}%`}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {roomsError ? "Không tải được trạng thái phòng" : `${occupiedRooms}/${roomsAvailableForOccupancy} phòng có thể khai thác`}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
              <p className="text-sm font-medium text-slate-500">
                {t("dashboard.currentGuests")}
              </p>
              <p className="mt-4 text-[26px] font-bold">
                {bookingsLoading || roomsLoading ? "—" : bookingsError || roomsError ? "Lỗi" : currentGuestCount}{" "}
                <span className="text-lg font-medium text-slate-400">
                  {t("common.guestCount")}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {bookingsError
                  ? "Không tải được số khách lưu trú"
                  : roomsError
                    ? "Không tải được trạng thái phòng"
                    : `${occupiedRooms} ${t("common.roomsInUse")}`}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
              <p className="text-sm font-medium text-slate-500">
                {t("dashboard.arrivalsDepartures")}
              </p>
              <p className="mt-4 text-[26px] font-bold">
                {summaryLoading ? "—" : summaryError ? "Lỗi" : todaySummary?.waitingCheckIn ?? 0}{" "}
                <span className="text-lg font-medium text-slate-400">
                  {t("common.arrivals")}
                </span>
                {" · "}{summaryLoading ? "—" : summaryError ? "Lỗi" : todaySummary?.waitingCheckOut ?? 0}{" "}
                <span className="text-lg font-medium text-slate-400">
                  {t("common.departures")}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {summaryError
                  ? "Không tải được dữ liệu check-in/check-out"
                  : "Phòng chờ xử lý hôm nay"}
              </p>
            </div>
          </section>
          <DashboardCheckInOut />
          <OverviewCalendar />
          <div className="mt-7 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900">
                    {t("dashboard.tasksToHandle")}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    {t("common.tasksUpdated")}
                  </p>
                </div>
                <Link
                  to="/staff?tab=tasks"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  {t("dashboard.viewAll")}
                </Link>
              </div>
              <div className="space-y-3">
                {tasksLoading ? (
                  <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">Đang tải công việc...</p>
                ) : tasksError ? (
                  <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">Không tải được danh sách công việc.</p>
                ) : activeHousekeepingTasks.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">Hiện không có công việc cần xử lý.</p>
                ) : (
                  activeHousekeepingTasks.slice(0, 4).map((task) => {
                      const needsAssignment = task.status.toUpperCase() === "NEEDS_ASSIGNMENT";
                      return (
                        <div key={task.id} className={`flex items-center gap-3 rounded-xl p-3 ${needsAssignment ? "bg-amber-50/70" : "bg-blue-50/70"}`}>
                          <UserRound size={16} className={needsAssignment ? "text-amber-600" : "text-blue-600"} />
                          <p className="flex-1 text-xs font-semibold text-slate-800">
                            {t("dashboard.roomStatus")} {task.roomNumber}
                            {task.assignedEmployeeName ? ` · ${task.assignedEmployeeName}` : ""}
                          </p>
                          <span className={`text-[10px] font-semibold ${needsAssignment ? "text-amber-700" : "text-blue-700"}`}>
                            {formatTaskStatus(task.status.toUpperCase())}
                          </span>
                        </div>
                      );
                    })
                )}
              </div>
            </section>
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5">
              <div className="mb-4">
                <h3 className="font-bold text-slate-900">
                  {t("dashboard.roomStatus")}
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  {roomsLoading ? "Đang tải..." : roomsError ? "Không tải được trạng thái phòng" : `${rooms.length} ${t("room.roomsAtBranch")}`}
                </p>
              </div>
              {roomsError ? (
                <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">Không tải được trạng thái phòng. Vui lòng thử lại.</p>
              ) : roomsLoading ? (
                <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Đang tải trạng thái phòng...</p>
              ) : rooms.length === 0 ? (
                <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Chưa có phòng tại chi nhánh.</p>
              ) : (
              <div className="grid grid-cols-2 gap-3">
                {visibleRooms.map((room) => (
                  <div
                    key={room.id ?? room.roomId ?? room.roomNumber}
                    className="flex items-center justify-between rounded-lg border border-slate-100 p-2.5"
                  >
                    <span className="text-xs font-semibold text-slate-700">
                      {room.roomNumber ?? room.roomCode ?? "—"}
                    </span>
                    <span className={`text-[10px] font-semibold ${roomStatusColor(room.roomStatus ?? room.status)}`}>
                      {roomStatusLabel(room.roomStatus ?? room.status)}
                    </span>
                  </div>
                ))}
              </div>
              )}
            </section>
          </div>
        </div>
      </main>
      <ScrollControls />
    </div>
  );
}
