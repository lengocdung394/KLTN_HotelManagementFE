import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Download,
  Plus,
  Sparkles,
  UserRound,
} from "lucide-react";
import OverviewCalendar from "../components/OverviewCalendarNew";
import DashboardCheckInOut from "../components/DashboardCheckInOut";
import { useGetTodayCheckInsQuery, useGetTodayCheckOutsQuery } from "../services/checkInOutApi";
import AppHeader from "../components/AppHeader";
import AppSidebar from "../components/AppSidebar";
import ScrollControls from "../components/ScrollControls";
import { useAppSelector } from "../store/hooks";
import { useSidebar } from "../hooks/useSidebar";

const getLocalDateParam = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};

export default function Index({ onLogout }: { onLogout: () => void }) {
  const { t } = useTranslation();
  const { mobileOpen, collapsed, toggleSidebar, closeMobile } = useSidebar();
  const { fullName, email, position, hotelId } = useAppSelector((state) => state.auth);
  const todayCheckIns = useGetTodayCheckInsQuery(
    { date: getLocalDateParam(), status: "PENDING", bookingStatus: "CONFIRMED" },
    { skip: !hotelId },
  );
  const todayCheckOuts = useGetTodayCheckOutsQuery(
    { date: getLocalDateParam(), status: "CHECKED_IN", bookingStatus: "CONFIRMED" },
    { skip: !hotelId },
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
              <p className="mt-4 text-[26px] font-bold">18.650.000đ</p>
              <p className="mt-1 text-xs text-blue-100">
                ↑ 12,5% {t("common.comparedYesterday")}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
              <p className="text-sm font-medium text-slate-500">
                {t("dashboard.roomOccupancy")}
              </p>
              <p className="mt-4 text-[26px] font-bold">78%</p>
              <p className="mt-1 text-xs text-slate-400">
                ↑ 4,2% {t("common.comparedLastWeek")}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
              <p className="text-sm font-medium text-slate-500">
                {t("dashboard.currentGuests")}
              </p>
              <p className="mt-4 text-[26px] font-bold">
                42{" "}
                <span className="text-lg font-medium text-slate-400">
                  {t("common.guestCount")}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                12 {t("common.roomsInUse")}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
              <p className="text-sm font-medium text-slate-500">
                {t("dashboard.arrivalsDepartures")}
              </p>
              <p className="mt-4 text-[26px] font-bold">
                {todayCheckIns.isLoading ? "—" : todayCheckIns.data?.length ?? 0}{" "}
                <span className="text-lg font-medium text-slate-400">
                  {t("common.arrivals")}
                </span>{" "}
                · {todayCheckOuts.isLoading ? "—" : todayCheckOuts.data?.length ?? 0}{" "}
                <span className="text-lg font-medium text-slate-400">
                  {t("common.departures")}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {todayCheckIns.isError || todayCheckOuts.isError
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
                <span className="text-xs font-semibold text-slate-400">
                  {t("dashboard.viewAll")}
                </span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-xl bg-amber-50/70 p-3">
                  <Sparkles size={16} className="text-amber-600" />
                  <p className="flex-1 text-xs font-semibold text-slate-800">
                    {t("dashboard.roomStatus")} 102
                  </p>
                  <span className="text-[10px] font-semibold text-amber-700">
                    {t("common.pendingTask")}
                  </span>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-blue-50/70 p-3">
                  <UserRound size={16} className="text-blue-600" />
                  <p className="flex-1 text-xs font-semibold text-slate-800">
                    {t("common.earlyCheckInRequests")} · Nguyễn Minh Anh
                  </p>
                  <span className="text-[10px] font-semibold text-blue-700">
                    {t("common.upcoming")}
                  </span>
                </div>
              </div>
            </section>
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5">
              <div className="mb-4">
                <h3 className="font-bold text-slate-900">
                  {t("dashboard.roomStatus")}
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  24 {t("room.roomsAtBranch")}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {["101", "102", "103", "104"].map((room) => (
                  <div
                    key={room}
                    className="flex items-center justify-between rounded-lg border border-slate-100 p-2.5"
                  >
                    <span className="text-xs font-semibold text-slate-700">
                      {room}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-700">
                      {t("room.ready")}
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
