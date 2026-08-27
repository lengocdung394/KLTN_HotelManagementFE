import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CalendarDays,
  ClipboardList,
  DoorOpen,
  Download,
  FileText,
  LayoutDashboard,
  LogIn,
  LogOut,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  Tag,
  UserRound,
  Users,
  WalletCards,
} from "lucide-react";
import { useState } from "react";
import OverviewCalendar from "../components/OverviewCalendarNew";
import AppHeader from "../components/AppHeader";

const navigation = [
  ["/overview", "overview", LayoutDashboard],
  ["/check-in-out", "checkInOut", LogIn],
  ["/bookings", "bookings", CalendarDays],
  ["/customers", "customers", UserRound],
  ["/rooms", "rooms", DoorOpen],
  ["/tasks", "tasks", ClipboardList],
  ["/invoices", "invoices", WalletCards],
  ["/promotions", "promotions", Tag],
] as const;
const rooms = ["101", "102", "103", "104"];

function DashboardCheckInOut() {
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
          className="text-xs font-semibold text-blue-600"
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
                08{" "}
                <span className="text-xs font-medium text-slate-500">
                  {t("common.todayTrips")}
                </span>
              </p>
            </div>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-blue-700">
            3 {t("common.early")}
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
                05{" "}
                <span className="text-xs font-medium text-slate-500">
                  {t("common.todayTrips")}
                </span>
              </p>
            </div>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-amber-700">
            2 {t("common.waiting")}
          </span>
        </div>
      </div>
    </section>
  );
}

export default function Index({ onLogout }: { onLogout: () => void }) {
  const { t } = useTranslation();
  const location = useLocation();
  const [mobile, setMobile] = useState(false);
  const navItems = navigation.map(([path, key, Icon]) => ({
    path,
    label: t(`navigation.${key}`),
    Icon,
  }));
  return (
    <div className="min-h-screen min-w-0 bg-[#f7f8fc] text-slate-800">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[244px] flex-col bg-blue-950 px-4 py-5 text-white transition-transform lg:translate-x-0 ${mobile ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="h-5" />
        <div className="mt-2 px-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">
            {t("common.workspace")}
          </p>
          <div className="flex items-center gap-2.5 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-medium">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-400 text-[11px] font-bold">
              M
            </span>
            Sen Việt
          </div>
        </div>
        <nav className="mt-8 flex-1 space-y-1 overflow-y-auto">
          {navItems.map(({ path, label, Icon }) => (
            <Link
              key={path}
              to={path}
              onClick={() => setMobile(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${location.pathname === path ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
            >
              <Icon size={17} />
              {label}
              {path === "/bookings" && (
                <span className="ml-auto rounded-md bg-white/10 px-1.5 py-0.5 text-[10px]">
                  12
                </span>
              )}
            </Link>
          ))}
          <p className="mb-2 mt-8 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">
            {t("common.administration")}
          </p>
          <Link
            to="/staff"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400"
          >
            <Users size={17} />
            {t("navigation.staff")}
          </Link>
          <Link
            to="/permissions"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400"
          >
            <ShieldCheck size={17} />
            {t("navigation.permissions")}
          </Link>
          <Link
            to="/reports"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400"
          >
            <FileText size={17} />
            {t("navigation.reports")}
          </Link>
          <Link
            to="/settings"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400"
          >
            <Settings size={17} />
            {t("navigation.settings")}
          </Link>
        </nav>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-[#f6c8a4] text-xs font-bold text-[#6f3c25]">
              LT
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">Linh Trần</p>
              <p className="text-[10px] text-slate-400">
                {t("common.branchManager")}
              </p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              aria-label={t("auth.logout")}
              className="ml-auto text-slate-400"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
      {mobile && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
          onClick={() => setMobile(false)}
        />
      )}
      <main className="min-w-0 lg:pl-[244px]">
        <AppHeader onMenuClick={() => setMobile(true)} />
        <div className="mx-auto min-w-0 max-w-[1280px] px-5 py-7 lg:px-9">
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
                8{" "}
                <span className="text-lg font-medium text-slate-400">
                  {t("common.arrivals")}
                </span>{" "}
                · 5{" "}
                <span className="text-lg font-medium text-slate-400">
                  {t("common.departures")}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                3 {t("common.earlyCheckInRequests")}
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
                  to="/tasks"
                  className="text-xs font-semibold text-blue-600"
                >
                  {t("dashboard.viewAll")}
                </Link>
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
                {rooms.map((room) => (
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
    </div>
  );
}
