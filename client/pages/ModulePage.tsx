import { Link, useLocation } from "react-router-dom";
import { ArrowDown, CalendarCheck, CalendarDays, ClipboardList, DoorOpen, FileText, LayoutDashboard, LogOut, MoreHorizontal, Settings, ShieldCheck, Sparkles, Tag, UserRound, Users, WalletCards, ChevronDown, Check, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import BookingWorkspaceNew from "./BookingWorkspace";
import RoomWorkspace from "./RoomWorkspace";
import InvoiceWorkspace from "./InvoiceWorkspace";
import TaskWorkspace from "./TaskWorkspace";
import ReportWorkspace from "./ReportWorkspace";
import StaffTabsWorkspace from "./StaffTabsWorkspace";
import PermissionsWorkspace from "./PermissionsWorkspace";
import CheckInOutWorkspace from "./CheckInOutWorkspace";
import PromotionWorkspace from "./PromotionWorkspace";
import CustomerWorkspace from "./CustomerWorkspace";
import AppHeader from "../components/AppHeader";

const items = [
  ["/overview", "overview", LayoutDashboard],
  ["/check-in-out", "checkInOut", CalendarCheck],
  ["/bookings", "bookings", CalendarDays],
  ["/customers", "customers", UserRound],
  ["/rooms", "rooms", DoorOpen],
  ["/tasks", "tasks", ClipboardList],
  ["/invoices", "invoices", WalletCards],
  ["/promotions", "promotions", Tag],
] as const;
const adminItems = [
  ["/staff", "staff", Users],
  ["/permissions", "permissions", ShieldCheck],
  ["/reports", "reports", FileText],
  ["/settings", "settings", Settings],
] as const;
const content: Record<string, { eyebrow: string; title: string; description: string; stats: [string, string][] }> = {
  "/bookings": { eyebrow: "Vận hành lưu trú", title: "Đặt phòng", description: "Quản lý lịch đặt phòng, khách lưu trú và lịch check-in / check-out.", stats: [["Đặt phòng hôm nay", "12"], ["Đang chờ xác nhận", "04"], ["Check-in hôm nay", "08"], ["Doanh thu dự kiến", "18.650.000đ"]] },
  "/customers": { eyebrow: "Quan hệ khách hàng", title: "Quản lý khách hàng", description: "Quản lý hồ sơ, lịch sử lưu trú và chăm sóc khách quay lại.", stats: [["Tổng khách hàng", "04"], ["Khách thân thiết", "02"], ["Khách quay lại tháng này", "12"], ["Chi tiêu trung bình", "5,8tr"]] },
  "/check-in-out": { eyebrow: "Vận hành lễ tân", title: "Check-in / Check-out", description: "Quản lý nhận phòng, trả phòng và trạng thái lưu trú của khách trong ngày.", stats: [["Chờ check-in", "02"], ["Đang lưu trú", "02"], ["Chờ check-out", "02"], ["Đã hoàn tất", "01"]] },
  "/promotions": { eyebrow: "Kinh doanh & chăm sóc khách", title: "Khuyến mãi", description: "Tạo ưu đãi và quản lý mã giảm giá cho khách lưu trú tại Sen Việt.", stats: [["Đang hoạt động", "02"], ["Lượt sử dụng tháng này", "128"], ["Tiết kiệm cho khách", "18,6tr"], ["Sắp hết hạn", "01"]] },
  "/rooms": { eyebrow: "Quản lý tài sản", title: "Phòng", description: "Theo dõi tình trạng phòng, loại phòng và phân công dọn dẹp tại chi nhánh.", stats: [["Tổng số phòng", "24"], ["Sẵn sàng", "16"], ["Đang sử dụng", "05"], ["Bảo trì", "03"]] },
  "/tasks": { eyebrow: "Đội ngũ vận hành", title: "Công việc", description: "Phân công dọn phòng, xử lý yêu cầu và theo dõi tiến độ theo ca.", stats: [["Việc cần làm", "09"], ["Đang xử lý", "04"], ["Đã hoàn tất", "27"]] },
  "/invoices": { eyebrow: "Tài chính chi nhánh", title: "Hoá đơn", description: "Tra cứu hoá đơn, thanh toán và đối soát giao dịch của khách hàng.", stats: [["Doanh thu tháng này", "426,5tr"], ["Đã thanh toán", "38"], ["Chờ thanh toán", "06"], ["Hoàn tiền", "02"]] },
  "/staff": { eyebrow: "Quản trị nhân sự", title: "Nhân viên & ca làm", description: "Quản lý nhân viên, chức vụ, lịch làm việc và phân công trong chi nhánh.", stats: [["Tổng nhân viên", "18"], ["Đang làm việc", "08"], ["Ca hôm nay", "03"], ["Nghỉ phép", "02"]] },
  "/permissions": { eyebrow: "Quản trị hệ thống", title: "Phân quyền", description: "Thiết lập vai trò và quyền truy cập cho từng nhóm nhân viên trong chi nhánh.", stats: [["Vai trò", "04"], ["Nhân viên", "18"], ["Quyền truy cập", "06"], ["Cập nhật gần nhất", "Hôm nay"]] },
  "/reports": { eyebrow: "Phân tích kinh doanh", title: "Báo cáo doanh thu", description: "Theo dõi công suất phòng, ADR, RevPAR và hiệu quả kinh doanh theo thời gian.", stats: [["Doanh thu tháng", "426,5tr"], ["Công suất phòng", "78%"], ["ADR", "1,42tr"], ["RevPAR", "1,11tr"]] },
  "/settings": { eyebrow: "Thiết lập hệ thống", title: "Cài đặt", description: "Cấu hình chi nhánh, loại phòng, thông báo và quyền truy cập tài khoản.", stats: [["Chi nhánh", "Sen Việt"], ["Múi giờ", "GMT+7"], ["Ngôn ngữ", "Tiếng Việt"], ["Vai trò", "Quản lý"]] },
};

const bookingRooms = [
  { id: "101", type: "Deluxe King", beds: "1 giường lớn", size: "28 m²", guests: 2, price: "1.250.000", amenity: "Ban công · Hướng sông", available: true },
  { id: "102", type: "Deluxe Twin", beds: "2 giường đơn", size: "30 m²", guests: 2, price: "1.250.000", amenity: "Bữa sáng · Wifi tốc độ cao", available: true },
  { id: "201", type: "Suite Garden", beds: "1 giường lớn", size: "45 m²", guests: 3, price: "2.450.000", amenity: "Bồn tắm · Vườn riêng", available: true },
  { id: "203", type: "Executive Suite", beds: "1 giường lớn", size: "52 m²", guests: 4, price: "3.100.000", amenity: "Phòng khách · Hướng sông", available: false },
];

function BookingWorkspace() {
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [step, setStep] = useState<"rooms" | "guest" | "success">("rooms");
  const [query, setQuery] = useState("");
  const selected = bookingRooms.find((room) => room.id === selectedRoom);
  const filtered = bookingRooms.filter((room) => `${room.id} ${room.type}`.toLowerCase().includes(query.toLowerCase()));
  if (step === "success") return <section className="mt-6 rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600"><Check size={28} /></div><h3 className="mt-4 text-xl font-bold text-slate-900">Đặt phòng thành công</h3><p className="mx-auto mt-2 max-w-md text-sm text-slate-500">Đặt phòng {selectedRoom} đã được tạo và đang chờ khách check-in.</p><button onClick={() => { setStep("rooms"); setSelectedRoom(null); }} className="mt-6 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white">Tạo đặt phòng khác</button></section>;
  return <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white shadow-sm"><div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${step === "rooms" ? "bg-blue-600 text-white" : "bg-emerald-500 text-white"}`}>{step === "rooms" ? "1" : <Check size={14} />}</span><span className="text-xs font-semibold text-slate-500">Chọn phòng</span><span className="h-px w-8 bg-slate-200" /><span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${step === "guest" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"}`}>2</span><span className="text-xs font-semibold text-slate-500">Thông tin khách</span></div><h3 className="mt-4 text-lg font-bold text-slate-900">{step === "rooms" ? "Chọn phòng cho khách" : "Thông tin đặt phòng"}</h3><p className="mt-1 text-sm text-slate-500">{step === "rooms" ? "Chọn một phòng còn trống để tiếp tục đặt phòng." : `Phòng ${selected?.id} · ${selected?.type}`}</p></div>{step === "guest" && <button onClick={() => setStep("rooms")} className="flex items-center gap-1 text-sm font-semibold text-blue-600"><ChevronLeft size={16} />Đổi phòng</button>}</div>
    {step === "rooms" ? <div className="p-5"><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="relative w-full sm:w-64"><Search size={15} className="absolute left-3 top-3 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm số hoặc loại phòng" className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-violet-400" /></div><div className="flex gap-3 text-[11px] text-slate-500"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />Còn phòng</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-slate-300" />Đã kín</span></div></div><div className="grid gap-3 lg:grid-cols-2">{filtered.map((room) => <button disabled={!room.available} onClick={() => setSelectedRoom(room.id)} key={room.id} className={`relative rounded-xl border p-4 text-left transition ${selectedRoom === room.id ? "border-violet-500 bg-violet-50/60 ring-2 ring-violet-100" : room.available ? "border-slate-200 hover:border-violet-300 hover:bg-violet-50/30" : "cursor-not-allowed border-slate-100 bg-slate-50 opacity-60"}`}><div className="flex items-start justify-between"><div className="flex items-center gap-3"><div className={`grid h-10 w-10 place-items-center rounded-lg text-xs font-bold ${selectedRoom === room.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>{room.id}</div><div><p className="text-sm font-bold text-slate-900">{room.type}</p><p className="mt-0.5 text-xs text-slate-500">{room.beds} · {room.size} · {room.guests} khách</p></div></div>{selectedRoom === room.id && <span className="grid h-6 w-6 place-items-center rounded-full bg-blue-600 text-white"><Check size={14} /></span>}{!room.available && <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500">Đã kín</span>}</div><div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-3"><p className="text-[11px] text-slate-500">{room.amenity}</p><p className="text-sm font-bold text-violet-700">{room.price}đ <span className="font-normal text-slate-400">/ đêm</span></p></div></button>)}</div><div className="mt-5 flex justify-end"><button disabled={!selectedRoom} onClick={() => setStep("guest")} className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">Tiếp tục <ChevronRight size={16} /></button></div></div> : <div className="grid gap-6 p-5 lg:grid-cols-[1fr_280px]"><div><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Tên khách hàng<input autoFocus placeholder="Nguyễn Văn A" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /></label><label className="text-sm font-semibold text-slate-700">Số điện thoại<input placeholder="090 000 0000" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /></label><label className="text-sm font-semibold text-slate-700">Ngày nhận phòng<input type="date" defaultValue="2026-09-08" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-violet-400" /></label><label className="text-sm font-semibold text-slate-700">Ngày trả phòng<input type="date" defaultValue="2026-09-10" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-violet-400" /></label></div><div className="mt-5 grid gap-4 sm:grid-cols-3"><label className="text-sm font-semibold text-slate-700">Người lớn<select defaultValue="2" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal"><option>1</option><option>2</option><option>3</option><option>4</option></select></label><label className="text-sm font-semibold text-slate-700">Trẻ em (6-11 tuổi)<select defaultValue="0" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal"><option>0</option><option>1</option><option>2</option></select></label><label className="text-sm font-semibold text-slate-700">Em bé (0-5 tuổi)<select defaultValue="0" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal"><option>0</option><option>1</option><option>2</option></select></label></div><label className="mt-5 block text-sm font-semibold text-slate-700">Ghi chú<textarea rows={3} placeholder="Yêu cầu đặc biệt của khách..." className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-violet-400" /></label></div><div className="h-fit rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Tóm tắt đặt phòng</p><div className="mt-4 flex items-center justify-between"><p className="text-sm font-bold text-slate-800">Phòng {selected?.id}</p><button onClick={() => setStep("rooms")} className="text-xs font-semibold text-blue-600">Thay đổi</button></div><p className="mt-1 text-xs text-slate-500">{selected?.type} · 2 đêm</p><div className="my-4 border-t border-slate-200" /><div className="flex justify-between text-xs text-slate-500"><span>Tiền phòng</span><span>{selected?.price}đ</span></div><div className="mt-2 flex justify-between text-xs text-slate-500"><span>Phí dịch vụ</span><span>250.000đ</span></div><div className="mt-4 flex justify-between border-t border-slate-200 pt-3 text-sm font-bold text-slate-900"><span>Tổng cộng</span><span className="text-violet-700">2.750.000đ</span></div><button onClick={() => setStep("success")} className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Xác nhận đặt phòng</button></div></div>}
  </section>;
}

function LanguageSettings() {
  const { t } = useTranslation();
  const currentLanguage = i18n.language.startsWith("en") ? "en" : "vi";

  const changeLanguage = (language: "en" | "vi") => {
    void i18n.changeLanguage(language);
    localStorage.setItem("language", language);
  };

  return <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-bold text-slate-900">{t("settings.languageTitle", "Ngôn ngữ")}</h3><p className="mt-1 text-sm text-slate-500">{t("settings.languageDescription", "Chọn ngôn ngữ hiển thị cho giao diện.")}</p></div><div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1" role="group" aria-label={t("settings.languageTitle", "Ngôn ngữ")}><button type="button" onClick={() => changeLanguage("vi")} className={`rounded-md px-3 py-2 text-sm font-semibold transition ${currentLanguage === "vi" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>Tiếng Việt</button><button type="button" onClick={() => changeLanguage("en")} className={`rounded-md px-3 py-2 text-sm font-semibold transition ${currentLanguage === "en" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>English</button></div></div></section>;
}

export default function ModulePage({ path: routePath, onLogout }: { path: string; onLogout: () => void }) {
  const { t } = useTranslation();
  const [mobile, setMobile] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(true);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const location = useLocation();
  const path = ({
    "/bookings": "/dat-phong",
    "/promotions": "/khuyen-mai",
    "/rooms": "/phong",
    "/invoices": "/hoa-don",
    "/tasks": "/cong-viec",
    "/staff": "/nhan-vien",
    "/permissions": "/phan-quyen",
    "/reports": "/bao-cao",
    "/settings": "/settings",
  } as Record<string, string>)[routePath] || routePath;
  const basePage = content[routePath] || content["/bookings"];
  const pageKey = ({
    "/overview": "bookings",
    "/check-in-out": "checkInOut",
    "/bookings": "bookings",
    "/customers": "customers",
    "/rooms": "rooms",
    "/tasks": "tasks",
    "/invoices": "invoices",
    "/promotions": "promotions",
    "/staff": "staff",
    "/permissions": "permissions",
    "/reports": "reports",
    "/settings": "settings",
  } as Record<string, string>)[routePath] || "bookings";
  const page = {
    ...basePage,
    eyebrow: t(`pages.${pageKey}.eyebrow`, basePage.eyebrow),
    title: t(`pages.${pageKey}.title`, basePage.title),
    description: t(`pages.${pageKey}.description`, basePage.description),
    stats: basePage.stats.map(([label, value], index) => [t(`pages.${pageKey}.stats.${index}`, label), value] as [string, string]),
  };
  useEffect(() => {
    const updateScrollVisibility = () => {
      setShowScrollBottom(document.documentElement.scrollHeight - window.innerHeight - window.scrollY > 160);
    };
    window.addEventListener("scroll", updateScrollVisibility, { passive: true });
    window.addEventListener("resize", updateScrollVisibility);
    updateScrollVisibility();
    return () => {
      window.removeEventListener("scroll", updateScrollVisibility);
      window.removeEventListener("resize", updateScrollVisibility);
    };
  }, []);
  return <div className="min-h-screen min-w-0 bg-[#f7f8fc] text-slate-800">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-61 flex-col bg-blue-950 px-4 py-5 text-white transition-transform duration-200 ease-out lg:transition-none lg:translate-x-0 ${mobile ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="h-5" />
      <div className="mt-2 px-3"><p className="mb-2 text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">{t("common.workspace")}</p><button className="flex w-full items-center justify-between rounded-xl bg-white/10 px-3 py-2.5 text-left text-sm font-medium"><span className="flex items-center gap-2.5"><span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-400 text-[11px] font-bold">M</span>Sen Việt</span><ChevronDown size={15} className="text-slate-400" /></button></div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        <nav className="mt-8 space-y-1">{items.map(([href, label, Icon]) => <Link key={href} to={href} onClick={() => setMobile(false)} className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition ${location.pathname === href ? "bg-blue-600 text-white shadow-lg shadow-violet-950/30" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><span className="flex items-center gap-3"><Icon size={17} />{t(`navigation.${label}`)}</span>{href === "/bookings" && <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px]">12</span>}</Link>)}</nav>
        <p className="mb-2 mt-8 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">{t("common.administration")}</p><nav className="space-y-1">{adminItems.map(([href, label, Icon]) => <Link key={href} to={href} onClick={() => setMobile(false)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${location.pathname === href ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><Icon size={17} />{t(`navigation.${label}`)}</Link>)}</nav>
      </div>
      <div className="mt-4 shrink-0 rounded-xl border border-white/10 bg-white/5 p-3"><div className="flex items-center gap-2.5"><div className="grid h-8 w-8 place-items-center rounded-full bg-[#f6c8a4] text-xs font-bold text-[#6f3c25]">LT</div><div className="min-w-0"><p className="truncate text-xs font-semibold">Linh Trần</p><p className="text-[10px] text-slate-400">{t("settings.manager")}</p></div><button type="button" onClick={onLogout} aria-label={t("auth.logout", "Log out")} title={t("auth.logout", "Log out")} className="ml-auto rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"><LogOut size={15} /></button></div></div>
    </aside>
    {mobile && <div className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" onClick={() => setMobile(false)} />}
    <main className="min-w-0 lg:pl-61"><AppHeader onMenuClick={() => setMobile(true)} />
      <div className="mx-auto min-w-0 max-w-7xl px-5 py-7 lg:px-9"><p className="mb-1 text-sm font-semibold text-blue-600">{page.eyebrow}</p><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h2 className="text-[28px] font-bold tracking-[-.03em] text-slate-900">{page.title}</h2>{path !== "/nhan-vien" && <p className="mt-2 max-w-xl text-sm text-slate-500">{page.description}</p>}</div>{path !== "/nhan-vien" && <button onClick={() => path === "/dat-phong" && setBookingOpen(true)} className="flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700"><Sparkles size={16} />{path === "/dat-phong" ? t("common.newBookingEyebrow") : t("common.newAction")}</button>}</div>
        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{page.stats.map(([label, value], i) => <div key={label} className={`rounded-2xl border border-slate-200/80 p-5 shadow-sm ${i === 0 ? "bg-[#28233f] text-white" : "bg-white"}`}><p className={`text-sm font-medium ${i === 0 ? "text-blue-200" : "text-slate-500"}`}>{label}</p><p className="mt-4 text-2xl font-bold tracking-tight">{value}</p><p className={`mt-1 text-xs ${i === 0 ? "text-blue-200" : "text-slate-400"}`}>Cập nhật hôm nay</p></div>)}</section>
        {path === "/settings" ? <LanguageSettings /> : path === "/check-in-out" ? <CheckInOutWorkspace /> : path === "/khuyen-mai" ? <PromotionWorkspace /> : path === "/phong" ? <RoomWorkspace /> : path === "/hoa-don" ? <InvoiceWorkspace /> : path === "/cong-viec" ? <TaskWorkspace /> : path === "/bao-cao" ? <ReportWorkspace /> : path === "/nhan-vien" ? <StaffTabsWorkspace /> : path === "/phan-quyen" ? <PermissionsWorkspace /> : path === "/dat-phong" ? (bookingOpen ? <BookingWorkspaceNew /> : <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-violet-50 text-blue-600"><CalendarDays size={20} /></div><div><h3 className="font-bold text-slate-900">Lịch đặt phòng hôm nay</h3><p className="mt-1 text-sm text-slate-500">12 đặt phòng · 8 khách đến · 5 khách rời đi</p></div></div><button onClick={() => setBookingOpen(true)} className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"><Sparkles size={16} />Đặt phòng mới</button></div><div className="mt-6 grid gap-3 md:grid-cols-3"><div className="rounded-xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs font-bold text-slate-800">Hôm nay · 14/10</p><p className="mt-2 text-2xl font-bold text-slate-900">08 <span className="text-xs font-medium text-slate-400">check-in</span></p></div><div className="rounded-xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs font-bold text-slate-800">Đang chờ xác nhận</p><p className="mt-2 text-2xl font-bold text-amber-600">04 <span className="text-xs font-medium text-slate-400">đặt phòng</span></p></div><div className="rounded-xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs font-bold text-slate-800">Sẵn sàng đón khách</p><p className="mt-2 text-2xl font-bold text-emerald-600">16 <span className="text-xs font-medium text-slate-400">phòng</span></p></div></div></section>) : <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-violet-50 text-blue-600"><ClipboardList size={20} /></div><div><h3 className="font-bold text-slate-900">Không gian {page.title.toLowerCase()}</h3><p className="mt-1 text-sm text-slate-500">Các công cụ chi tiết cho {page.title.toLowerCase()} sẽ được hiển thị tại đây.</p></div></div><div className="mt-6 grid gap-3 md:grid-cols-3"><div className="rounded-xl border border-dashed border-slate-200 p-4"><p className="text-xs font-bold text-slate-800">Danh sách & bộ lọc</p><p className="mt-1 text-xs text-slate-400">Tra cứu nhanh dữ liệu theo chi nhánh.</p></div><div className="rounded-xl border border-dashed border-slate-200 p-4"><p className="text-xs font-bold text-slate-800">Theo dõi trạng thái</p><p className="mt-1 text-xs text-slate-400">Cập nhật tiến độ theo thời gian thực.</p></div><div className="rounded-xl border border-dashed border-slate-200 p-4"><p className="text-xs font-bold text-slate-800">Báo cáo & hành động</p><p className="mt-1 text-xs text-slate-400">Xuất dữ liệu hoặc thực hiện thao tác mới.</p></div></div></section>}
        {showScrollBottom && <button type="button" onClick={() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" })} aria-label="Cuộn xuống cuối trang" title="Cuộn xuống cuối trang" className="fixed bottom-6 right-6 z-30 grid h-11 w-11 place-items-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700"><ArrowDown size={19} /></button>}
      </div></main>
  </div>;
}
