import { Link, useLocation } from "react-router-dom";
import {
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  ConciergeBell,
  DoorOpen,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Tag,
  Sparkles,
  UserRound,
  Users,
  WalletCards,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import CustomerWorkspace from "./CustomerWorkspace";
import AppHeader from "../components/AppHeader";
import UserProfileCard from "../components/UserProfileCard";
import ScrollControls from "../components/ScrollControls";

const navigation = [
  ["/overview", "overview", LayoutDashboard],
  ["/check-in-out", "checkInOut", CalendarCheck],
  ["/bookings", "bookings", CalendarDays],
  ["/customers", "customers", UserRound],
  ["/rooms", "rooms", DoorOpen],
  ["/tasks", "tasks", ClipboardList],
  ["/invoices", "invoices", WalletCards],
  ["/promotions", "promotions", Tag],
  ["/services", "services", ConciergeBell],
] as const;
const adminNavigation = [
  ["/staff", "staff", Users],
  ["/permissions", "permissions", ShieldCheck],
  ["/reports", "reports", ClipboardList],
  ["/settings", "settings", Settings],
] as const;

export default function CustomerPage({ onLogout }: { onLogout: () => void }) {
  const { t } = useTranslation();
  const location = useLocation();
  const [mobile, setMobile] = useState(false);
  return (
    <div className="min-h-screen min-w-0 bg-[#f7f8fc] text-slate-800">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-blue-950 px-4 py-5 text-white transition-transform duration-200 ease-out lg:translate-x-0 ${mobile ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="h-5" />
        <div className="mt-2 px-3">
          <button type="button" className="flex h-11 w-full items-center justify-between rounded-xl border border-blue-300/20 bg-blue-900/70 px-3 text-left text-sm font-semibold text-white shadow-sm shadow-blue-950/20 transition hover:bg-blue-800/80">
            <span className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-300 text-[11px] font-bold text-amber-950">M</span>
              Sen Việt
            </span>
            <ChevronDown size={15} className="text-blue-200" />
          </button>
        </div>
        <nav className="mt-8 min-h-0 flex-1 space-y-1 overflow-y-auto">
          {navigation.map(([href, key, Icon]) => (
            <Link
              key={href}
              to={href}
              onClick={() => setMobile(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${location.pathname === href ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
            >
              <Icon size={17} />
              {t(`navigation.${key}`)}
            </Link>
          ))}
          <p className="mb-2 mt-8 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">
            {t("common.administration")}
          </p>
          {adminNavigation.map(([href, key, Icon]) => (
            <Link
              key={href}
              to={href}
              onClick={() => setMobile(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white"
            >
              <Icon size={17} />
              {t(`navigation.${key}`)}
            </Link>
          ))}
        </nav>
        <UserProfileCard onLogout={onLogout} />
      </aside>
      {mobile && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
          onClick={() => setMobile(false)}
        />
      )}
      <main className="min-w-0 lg:pl-64">
        <AppHeader onMenuClick={() => setMobile(true)} />
        <div className="mx-auto min-w-0 max-w-7xl px-5 py-7 lg:px-9">
          <p className="mb-1 text-sm font-semibold text-blue-600">
            {t("pages.customers.eyebrow")}
          </p>
          <h2 className="text-[28px] font-bold tracking-tight text-slate-900">
            {t("pages.customers.title")}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {t("pages.customers.description")}
          </p>
          <CustomerWorkspace />
        </div>
      </main>
      <ScrollControls />
    </div>
  );
}
