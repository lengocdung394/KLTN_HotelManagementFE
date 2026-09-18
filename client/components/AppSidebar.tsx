import { Link, useLocation } from "react-router-dom";
import { CalendarCheck, CalendarDays, ClipboardList, ConciergeBell, DoorOpen, FileText, LayoutDashboard, LogOut, Settings, ShieldCheck, Tag, UserRound, Users, WalletCards, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "../store/hooks";
import UserProfileCard from "./UserProfileCard";

type AppSidebarProps = {
  mobile: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
  fullName?: string | null;
  position?: string | null;
};

const items = [
  ["/overview", "overview", LayoutDashboard],
  ["/check-in-out", "checkInOut", CalendarCheck],
  ["/customers", "customers", UserRound],
  ["/rooms", "rooms", DoorOpen],
  ["/tasks", "tasks", ClipboardList],
  ["/invoices", "invoices", WalletCards],
  ["/promotions", "promotions", Tag],
  ["/services", "services", ConciergeBell],
] as const;
const adminItems = [
  ["/staff", "staff", Users],
  ["/permissions", "permissions", ShieldCheck],
  ["/reports", "reports", FileText],
  ["/settings", "settings", Settings],
] as const;

export default function AppSidebar({ mobile, onCloseMobile, onLogout, fullName, position }: AppSidebarProps) {
  const { t } = useTranslation();
  const { hotelName } = useAppSelector((state) => state.auth);
  const location = useLocation();
  const [bookingMenuOpen, setBookingMenuOpen] = useState(false);
  const bookingActive = location.pathname === "/bookings" || location.pathname === "/booking-list";
  const branchLabel = hotelName || "Tất cả chi nhánh";

  return <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-blue-950 px-4 py-5 text-white transition-transform duration-200 ease-out lg:transition-none lg:translate-x-0 ${mobile ? "translate-x-0" : "-translate-x-full"}`}>
    <div className="h-5" />
    <div className="mt-2 min-w-0 px-3"><button type="button" className="flex h-11 min-h-11 w-full min-w-0 items-center justify-between overflow-hidden rounded-xl border border-blue-300/20 bg-blue-900/70 px-3 text-left text-sm font-semibold text-white shadow-sm shadow-blue-950/20 transition hover:bg-blue-800/80"><span className="flex w-0 min-w-0 flex-1 items-center gap-2.5"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-300 text-[11px] font-bold text-amber-950">M</span><span className="truncate">{branchLabel}</span></span><ChevronDown size={15} className="ml-2 shrink-0 text-blue-200" /></button></div>
    <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
      <nav className="mt-8 space-y-1">
        {items.slice(0, 2).map(([href, label, Icon]) => <Link key={href} to={href} onClick={onCloseMobile} className={`flex flex-nowrap items-center justify-between whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition ${location.pathname === href ? "bg-blue-600 text-white shadow-lg shadow-violet-950/30" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><span className="flex shrink-0 items-center gap-3"><Icon size={17} />{t(`navigation.${label}`)}</span></Link>)}
        <div className={`rounded-xl ${bookingActive ? "bg-blue-900/50" : ""}`}><div className={`flex items-center rounded-xl text-sm font-medium ${bookingActive ? "text-white" : "text-slate-400"}`}><Link to="/bookings" onClick={onCloseMobile} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 hover:text-white"><CalendarDays size={17} />{location.pathname === "/booking-list" ? "Danh sách booking" : t("navigation.bookings")}</Link><button type="button" onClick={() => setBookingMenuOpen((current) => !current)} className="rounded-lg p-2.5 hover:bg-white/10" aria-label="Mở menu quản lý đặt phòng"><ChevronDown size={15} className={`transition-transform ${bookingMenuOpen ? "rotate-180" : ""}`} /></button></div>{bookingMenuOpen && <div className="space-y-1 pb-2 pl-9 pr-2"><Link to="/bookings" onClick={onCloseMobile} className={`block rounded-lg px-3 py-2 text-sm ${location.pathname === "/bookings" ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>Đặt phòng</Link><Link to="/booking-list" onClick={onCloseMobile} className={`block rounded-lg px-3 py-2 text-sm ${location.pathname === "/booking-list" ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>Danh sách booking</Link></div>}</div>
        {items.slice(2).map(([href, label, Icon]) => <Link key={href} to={href} onClick={onCloseMobile} className={`flex flex-nowrap items-center justify-between whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition ${location.pathname === href ? "bg-blue-600 text-white shadow-lg shadow-violet-950/30" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><span className="flex shrink-0 items-center gap-3"><Icon size={17} />{t(`navigation.${label}`)}</span></Link>)}
      </nav>
      <p className="mb-2 mt-8 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">{t("common.administration")}</p><nav className="space-y-1">{adminItems.map(([href, label, Icon]) => <Link key={href} to={href} onClick={onCloseMobile} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${location.pathname === href ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><Icon size={17} />{t(`navigation.${label}`)}</Link>)}</nav>
    </div>
    <UserProfileCard onLogout={onLogout} fullName={fullName} position={position} />
  </aside>;
}
