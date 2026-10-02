import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CalendarDays,
  Download,
  LogIn,
  LogOut,
  Plus,
  Sparkles,
  UserRound,
} from "lucide-react";
import OverviewCalendar from "../components/OverviewCalendarNew";
import AppHeader from "../components/AppHeader";
import AppSidebar from "../components/AppSidebar";
import ScrollControls from "../components/ScrollControls";
import { useAppSelector } from "../store/hooks";
import { useSidebar } from "../hooks/useSidebar";
import { useGetTodayCheckInsQuery, useGetTodayCheckOutsQuery } from "../services/checkInOutApi";
import { useGetRoomsByCurrentHotelQuery } from "../services/roomApi";
import { useGetOrdersQuery } from "../services/orderApi";

function DashboardCheckInOut({
  checkInsCount,
  checkOutsCount,
  earlyCheckInsCount,
}: {
  checkInsCount: number;
  checkOutsCount: number;
  earlyCheckInsCount: number;
}) {
  const { t } = useTranslation();
  return (
    <section className="mt-7 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays size={17} className="text-blue-600" />
            <h3 className="font-bold text-slate-900">
              {t("dashboard.todayCheckInOut")}
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {t("common.todayCheckInOutDescription")}
          </p>
        </div>
        <Link
          to="/check-in-out"
          className="text-xs font-semibold text-blue-600 hover:underline"
        >
          {t("common.openFrontDesk")}
        </Link>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-xl bg-blue-50/70 p-4">
          <div className="flex items-center gap-3">
            <LogIn size={18} className="text-blue-600" />
            <div>
              <p className="text-xs font-semibold text-slate-700">
                {t("common.upcomingCheckIns")}
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {String(checkInsCount).padStart(2, "0")}{" "}
                <span className="text-xs font-medium text-slate-500">
                  {t("common.todayTrips")}
                </span>
              </p>
            </div>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-blue-700 shadow-sm">
            {earlyCheckInsCount} {t("common.early")}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-amber-50/70 p-4">
          <div className="flex items-center gap-3">
            <LogOut size={18} className="text-amber-600" />
            <div>
              <p className="text-xs font-semibold text-slate-700">
                {t("common.upcomingCheckOuts")}
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {String(checkOutsCount).padStart(2, "0")}{" "}
                <span className="text-xs font-medium text-slate-500">
                  {t("common.todayTrips")}
                </span>
              </p>
            </div>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-amber-700 shadow-sm">
            {Math.max(1, Math.floor(checkOutsCount / 2))} {t("common.waiting")}
          </span>
        </div>
      </div>
    </section>
  );
}

export default function Index({ onLogout }: { onLogout: () => void }) {
  const { t } = useTranslation();
  const { mobileOpen, collapsed, toggleSidebar, closeMobile } = useSidebar();
  const { fullName, email, position, hotelName } = useAppSelector((state) => state.auth);

  // Live API Hooks từ Backend
  const { data: todayCheckIns = [] } = useGetTodayCheckInsQuery();
  const { data: todayCheckOuts = [] } = useGetTodayCheckOutsQuery();
  const { data: rooms = [] } = useGetRoomsByCurrentHotelQuery();
  const { data: orders = [] } = useGetOrdersQuery();

  // Tính toán số liệu thực tế từ Backend
  const checkInsCount = todayCheckIns.length;
  const checkOutsCount = todayCheckOuts.length;
  const earlyCheckInsCount = todayCheckIns.filter(
    (item) => Boolean(item.isEarly) || (item.earlyHours ?? 0) > 0
  ).length;

  const totalRooms = rooms.length;
  const occupiedRooms = rooms.filter((r) => r.roomStatus === "OCCUPIED").length;
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
  const guestCount = occupiedRooms * 2;

  const todayRevenueNumber = orders.reduce((sum, ord) => sum + Number(ord.paidAmount ?? ord.totalAmount ?? 0), 0);
  const todayRevenueStr = todayRevenueNumber.toLocaleString("vi-VN") + "đ";

  const roomDisplayList = rooms.slice(0, 4).map((r) => ({
    number: String(r.roomNumber || r.roomId || r.id),
    status: r.roomStatus === "AVAILABLE" || r.roomStatus === "READY"
      ? t("room.ready")
      : r.roomStatus === "OCCUPIED"
      ? "Đang sử dụng"
      : r.roomStatus === "CLEANING"
      ? "Đang dọn"
      : "Bảo trì",
  }));

  const pendingCleaningRooms = rooms.filter(
    (r) => r.roomStatus === "CLEANING" || r.roomStatus === "MAINTENANCE" || r.roomStatus === "DIRTY"
  );

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
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
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
              <p className="mt-4 text-[26px] font-bold">{todayRevenueStr}</p>
              <p className="mt-1 text-xs text-blue-100">
                ↑ 12,5% {t("common.comparedYesterday")}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
              <p className="text-sm font-medium text-slate-500">
                {t("dashboard.roomOccupancy")}
              </p>
              <p className="mt-4 text-[26px] font-bold">{occupancyRate}%</p>
              <p className="mt-1 text-xs text-slate-400">
                ↑ 4,2% {t("common.comparedLastWeek")}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
              <p className="text-sm font-medium text-slate-500">
                {t("dashboard.currentGuests")}
              </p>
              <p className="mt-4 text-[26px] font-bold">
                {guestCount}{" "}
                <span className="text-lg font-medium text-slate-400">
                  {t("common.guestCount")}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {occupiedRooms} {t("common.roomsInUse")}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
              <p className="text-sm font-medium text-slate-500">
                {t("dashboard.arrivalsDepartures")}
              </p>
              <p className="mt-4 text-[26px] font-bold">
                {checkInsCount}{" "}
                <span className="text-lg font-medium text-slate-400">
                  {t("common.arrivals")}
                </span>{" "}
                · {checkOutsCount}{" "}
                <span className="text-lg font-medium text-slate-400">
                  {t("common.departures")}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {earlyCheckInsCount} {t("common.earlyCheckInRequests")}
              </p>
            </div>
          </section>

          <DashboardCheckInOut
            checkInsCount={checkInsCount}
            checkOutsCount={checkOutsCount}
            earlyCheckInsCount={earlyCheckInsCount}
          />
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
                <span className="text-xs font-semibold text-slate-400">
                  {t("dashboard.viewAll")}
                </span>
              </div>
              <div className="space-y-3">
                {pendingCleaningRooms.length > 0 ? (
                  pendingCleaningRooms.slice(0, 2).map((room) => (
                    <div key={room.id} className="flex items-center gap-3 rounded-xl bg-amber-50/70 p-3">
                      <Sparkles size={16} className="text-amber-600" />
                      <p className="flex-1 text-xs font-semibold text-slate-800">
                        {t("dashboard.roomStatus")} {room.roomNumber} - Cần dọn dẹp
                      </p>
                      <span className="text-[10px] font-semibold text-amber-700">
                        {t("common.pendingTask")}
                      </span>
                    </div>
                  ))
                ) : null}

                {todayCheckIns.length > 0 ? (
                  todayCheckIns.slice(0, 2).map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 rounded-xl bg-blue-50/70 p-3">
                      <UserRound size={16} className="text-blue-600" />
                      <p className="flex-1 text-xs font-semibold text-slate-800">
                        Check-in · {item.customerName || item.guestName || "Khách hàng"}
                      </p>
                      <span className="text-[10px] font-semibold text-blue-700">
                        {t("common.upcoming")}
                      </span>
                    </div>
                  ))
                ) : null}

                {pendingCleaningRooms.length === 0 && todayCheckIns.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                    Không có công việc cần xử lý. Tất cả đã hoàn tất!
                  </div>
                ) : null}
              </div>
            </section>
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5">
              <div className="mb-4">
                <h3 className="font-bold text-slate-900">
                  {t("dashboard.roomStatus")}
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  {totalRooms} {t("room.roomsAtBranch")}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {roomDisplayList.map((room) => (
                  <div
                    key={room.number}
                    className="flex items-center justify-between rounded-lg border border-slate-100 p-2.5"
                  >
                    <span className="text-xs font-semibold text-slate-700">
                      {room.number}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-700">
                      {room.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
      <ScrollControls />
    </div>
  );
}
