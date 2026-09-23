import { Building2, BriefcaseBusiness, CalendarDays, Check, ChevronLeft, ChevronRight, ClipboardList, Eye, EyeOff, Mail, Pencil, Search, UserRound, X, Sparkles } from "lucide-react";
import { useLocation} from "react-router-dom";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import BookingWorkspaceNew from "./BookingWorkspace";
import BookingListWorkspace from "./BookingListWorkspace";
import RoomWorkspace from "./RoomWorkspace";
import InvoiceWorkspace from "./InvoiceWorkspace";
import TaskWorkspace from "./TaskWorkspace";
import ReportWorkspace from "./ReportWorkspace";
import StaffTabsWorkspace from "./StaffTabsWorkspace";
import PermissionsWorkspace from "./PermissionsWorkspace";
import CheckInOutWorkspace from "./CheckInOutWorkspace";
import PromotionWorkspace from "./PromotionWorkspace";
import ServiceWorkspace from "./ServiceWorkspace";
import CustomerWorkspace from "./CustomerWorkspace";
import AppHeader from "../components/AppHeader";
import AppSidebar from "../components/AppSidebar";
import ScrollControls from "../components/ScrollControls";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { updateProfile } from "../store/authSlice";
import type { BookingListItem } from "../services/bookingApi";

const content: Record<string, { eyebrow: string; title: string; description: string; stats: [string, string][] }> = {
  "/bookings": { eyebrow: "Vận hành lưu trú", title: "Đặt phòng", description: "Quản lý lịch đặt phòng, khách lưu trú và lịch check-in / check-out.", stats: [["Đặt phòng hôm nay", "12"], ["Đang chờ xác nhận", "04"], ["Check-in hôm nay", "08"], ["Doanh thu dự kiến", "18.650.000đ"]] },
  "/booking-list": { eyebrow: "Vận hành lưu trú", title: "Danh sách booking", description: "Tra cứu và theo dõi toàn bộ đơn đặt phòng của chi nhánh.", stats: [["Tổng booking", "12"], ["Chờ xác nhận", "04"], ["Đang lưu trú", "02"], ["Đã hoàn tất", "06"]] },
  "/customers": { eyebrow: "Quan hệ khách hàng", title: "Quản lý khách hàng", description: "Quản lý hồ sơ, lịch sử lưu trú và chăm sóc khách quay lại.", stats: [["Tổng khách hàng", "04"], ["Khách thân thiết", "02"], ["Khách quay lại tháng này", "12"], ["Chi tiêu trung bình", "5,8tr"]] },
  "/check-in-out": { eyebrow: "Vận hành lễ tân", title: "Check-in / Check-out", description: "Quản lý nhận phòng, trả phòng và trạng thái lưu trú của khách trong ngày.", stats: [["Chờ check-in", "02"], ["Đang lưu trú", "02"], ["Chờ check-out", "02"], ["Đã hoàn tất", "01"]] },
  "/promotions": { eyebrow: "Kinh doanh & chăm sóc khách", title: "Khuyến mãi", description: "Tạo ưu đãi và quản lý mã giảm giá cho khách lưu trú tại chi nhánh.", stats: [["Đang hoạt động", "02"], ["Lượt sử dụng tháng này", "128"], ["Tiết kiệm cho khách", "18,6tr"], ["Sắp hết hạn", "01"]] },
  "/services": { eyebrow: "Vận hành lưu trú", title: "Dịch vụ", description: "Quản lý các dịch vụ bổ sung dành cho khách lưu trú.", stats: [["Dịch vụ đang bán", "06"], ["Đã sử dụng hôm nay", "18"], ["Doanh thu dịch vụ", "4,8tr"]] },
  "/rooms": { eyebrow: "Quản lý tài sản", title: "Phòng", description: "Theo dõi tình trạng phòng, loại phòng và phân công dọn dẹp tại chi nhánh.", stats: [["Tổng số phòng", "24"], ["Sẵn sàng", "16"], ["Đang sử dụng", "05"], ["Bảo trì", "03"]] },
  "/tasks": { eyebrow: "Đội ngũ vận hành", title: "Công việc", description: "Phân công dọn phòng, xử lý yêu cầu và theo dõi tiến độ theo ca.", stats: [["Việc cần làm", "09"], ["Đang xử lý", "04"], ["Đã hoàn tất", "27"]] },
  "/invoices": { eyebrow: "Tài chính chi nhánh", title: "Hoá đơn", description: "Tra cứu hoá đơn, thanh toán và đối soát giao dịch của khách hàng.", stats: [["Doanh thu tháng này", "426,5tr"], ["Đã thanh toán", "38"], ["Chờ thanh toán", "06"], ["Hoàn tiền", "02"]] },
  "/staff": { eyebrow: "Quản trị nhân sự", title: "Nhân viên & ca làm", description: "Quản lý nhân viên, chức vụ, lịch làm việc và phân công trong chi nhánh.", stats: [["Tổng nhân viên", "18"], ["Đang làm việc", "08"], ["Ca hôm nay", "03"], ["Nghỉ phép", "02"]] },
  "/permissions": { eyebrow: "Quản trị hệ thống", title: "Phân quyền", description: "Thiết lập vai trò và quyền truy cập cho từng nhóm nhân viên trong chi nhánh.", stats: [["Vai trò", "04"], ["Nhân viên", "18"], ["Quyền truy cập", "06"], ["Cập nhật gần nhất", "Hôm nay"]] },
  "/reports": { eyebrow: "Phân tích kinh doanh", title: "Báo cáo doanh thu", description: "Theo dõi công suất phòng, ADR, RevPAR và hiệu quả kinh doanh theo thời gian.", stats: [["Doanh thu tháng", "426,5tr"], ["Công suất phòng", "78%"], ["ADR", "1,42tr"], ["RevPAR", "1,11tr"]] },
  "/settings": { eyebrow: "Thiết lập hệ thống", title: "Cài đặt", description: "Cấu hình chi nhánh, loại phòng, thông báo và quyền truy cập tài khoản.", stats: [["Chi nhánh", ""], ["Múi giờ", "GMT+7"], ["Ngôn ngữ", "Tiếng Việt"], ["Vai trò", "Quản lý"]] },
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
  const { fullName, email, position, hotelName } = useAppSelector((state) => state.auth);

  const changeLanguage = (language: "en" | "vi") => {
    void i18n.changeLanguage(language);
    localStorage.setItem("language", language);
  };

  return <><PersonalInfoSettings fullName={fullName} email={email} position={position} hotelName={hotelName} /><PasswordGate /><AccountSettings email={email} /><section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-bold text-slate-900">{t("settings.languageTitle", "Ngôn ngữ")}</h3><p className="mt-1 text-sm text-slate-500">{t("settings.languageDescription", "Chọn ngôn ngữ hiển thị cho giao diện.")}</p></div><div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1" role="group" aria-label={t("settings.languageTitle", "Ngôn ngữ")}><button type="button" onClick={() => changeLanguage("vi")} className={`rounded-md px-3 py-2 text-sm font-semibold transition ${currentLanguage === "vi" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>Tiếng Việt</button><button type="button" onClick={() => changeLanguage("en")} className={`rounded-md px-3 py-2 text-sm font-semibold transition ${currentLanguage === "en" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>English</button></div></div></section></>;
}

function AccountSettings({ email }: { email: string | null }) {
  const [visible, setVisible] = useState(false);
  const [accountName, setAccountName] = useState(() => localStorage.getItem("accountName") || email || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState("");
  const passwordsMismatch = Boolean(confirmPassword) && password !== confirmPassword;

  useEffect(() => {
    const handleProfileEditing = (event: Event) => setVisible(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener("profile-editing", handleProfileEditing);
    return () => window.removeEventListener("profile-editing", handleProfileEditing);
  }, []);

  const saveAccount = () => {
    if (!accountName.trim() || !password || passwordsMismatch) return;
    localStorage.setItem("accountName", accountName.trim());
    setPassword("");
    setConfirmPassword("");
    setMessage("Đã cập nhật thông tin tài khoản.");
    window.setTimeout(() => setMessage(""), 2500);
  };

  return <section className={`${visible ? "mt-4" : "hidden"} rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm`}><div className="border-b border-slate-100 pb-4"><h3 className="font-bold text-slate-900">Thông tin tài khoản</h3><p className="mt-1 text-sm text-slate-500">Quản lý tên tài khoản và mật khẩu đăng nhập.</p></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="block"><span className="text-sm font-medium text-slate-700">Tên account <b className="text-red-500">*</b></span><input value={accountName} onChange={(event) => setAccountName(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label><div /><label className="block"><span className="text-sm font-medium text-slate-700">Mật khẩu mới <b className="text-red-500">*</b></span><span className="relative mt-1 block"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 px-3 pr-10 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /><button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400" aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label><label className="block"><span className="text-sm font-medium text-slate-700">Nhập lại mật khẩu <b className="text-red-500">*</b></span><span className="relative mt-1 block"><input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={`h-10 w-full rounded-lg border px-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-blue-100 ${passwordsMismatch ? "border-red-300 focus:border-red-400" : "border-slate-200 focus:border-blue-400"}`} /><button type="button" onClick={() => setShowConfirmPassword((current) => !current)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400" aria-label={showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>{showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>{passwordsMismatch && <span className="mt-1 block text-xs text-red-500">Mật khẩu nhập lại không khớp.</span>}</label></div><div className="mt-5 flex items-center justify-between gap-3"><span className="text-xs font-medium text-emerald-600">{message}</span><button type="button" onClick={saveAccount} disabled={!accountName.trim() || !password || passwordsMismatch} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Lưu tài khoản</button></div></section>;
}

function PersonalInfoSettingsLegacy({ fullName, email, position, hotelName }: { fullName: string | null; email: string | null; position: string | null; hotelName: string | null }) {
  const dispatch = useAppDispatch();
  const [isEditing, setIsEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    avatar: localStorage.getItem("profileAvatar") || "",
    fullName: fullName || "",
    position: position || "",
    email: email || "",
    identityNumber: localStorage.getItem("profileIdentityNumber") || "",
    phone: localStorage.getItem("profilePhone") || "",
    address: localStorage.getItem("profileAddress") || "",
  });
  const displayName = form.fullName.trim() || form.email.trim() || "Người dùng";
  const initials = displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const fields = [[UserRound, "Họ và tên", form.fullName], [Mail, "Email", form.email], [BriefcaseBusiness, "Chức vụ", form.position], [Building2, "Khách sạn", hotelName]] as const;
  const editableFields = [["fullName", "Họ và tên", form.fullName], ["position", "Chức vụ", form.position], ["email", "Email", form.email], ["identityNumber", "CCCD", form.identityNumber], ["phone", "Số điện thoại", form.phone]] as const;
  const profileFieldInputClass = "mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
  const updateField = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const saveProfile = () => {
    if (!form.fullName.trim() || !form.email.trim()) return;
    dispatch(updateProfile({ fullName: form.fullName.trim(), email: form.email.trim(), position: form.position.trim() }));
    localStorage.setItem("profileAvatar", form.avatar);
    localStorage.setItem("profileIdentityNumber", form.identityNumber.trim());
    localStorage.setItem("profilePhone", form.phone.trim());
    localStorage.setItem("profileAddress", form.address.trim());
    setIsEditing(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };
  const cancelEditing = () => {
    setForm({ avatar: localStorage.getItem("profileAvatar") || "", fullName: fullName || "", position: position || "", email: email || "", identityNumber: localStorage.getItem("profileIdentityNumber") || "", phone: localStorage.getItem("profilePhone") || "", address: localStorage.getItem("profileAddress") || "" });
    setIsEditing(false);
  };

  return <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">{initials}</div><div className="min-w-0"><h3 className="font-bold text-slate-900">Thông tin cá nhân</h3><p className="mt-1 truncate text-sm text-slate-500" title={displayName}>{displayName}</p></div></div>{!isEditing ? <button type="button" onClick={() => setIsEditing(true)} className="flex w-fit items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-600"><Pencil size={15} />Chỉnh sửa</button> : <div className="flex gap-2"><button type="button" onClick={cancelEditing} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600"><X size={15} />Hủy</button><button type="button" onClick={saveProfile} disabled={!form.fullName.trim() || !form.email.trim()} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Check size={15} />Lưu</button></div>}</div>{isEditing ? <div className="mt-5 grid gap-4 sm:grid-cols-2">{[["fullName", "Họ và tên", form.fullName], ["email", "Email", form.email], ["position", "Chức vụ", form.position]].map(([field, label, value]) => <label key={field} className="block"><span className="text-xs font-medium text-slate-500">{label}</span><input value={value} onChange={(event) => updateField(field as "fullName" | "email" | "position", event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>)}<div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3"><Building2 size={17} className="shrink-0 text-slate-400" /><div className="min-w-0"><p className="text-xs font-medium text-slate-500">Khách sạn</p><p className="mt-1 truncate text-sm font-semibold text-slate-700" title={hotelName || "Chưa cập nhật"}>{hotelName || "Chưa cập nhật"}</p></div></div></div> : <div className="mt-5 grid gap-4 sm:grid-cols-2">{fields.map(([Icon, label, value]) => <div key={label} className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3"><Icon size={17} className="mt-0.5 shrink-0 text-blue-600" /><div className="min-w-0"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 truncate text-sm font-semibold text-slate-800" title={value || "Chưa cập nhật"}>{value?.trim() || "Chưa cập nhật"}</p></div></div>)}</div>}{saved && <p className="mt-4 text-xs font-medium text-emerald-600">Đã cập nhật thông tin cá nhân.</p>}</section>;
}

function PasswordGate() {
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const showGate = () => {
      setVisible(true);
      setPassword("");
      setError("");
    };
    const hideGate = () => setVisible(false);
    window.addEventListener("profile-password-required", showGate);
    window.addEventListener("profile-password-result", hideGate);
    return () => {
      window.removeEventListener("profile-password-required", showGate);
      window.removeEventListener("profile-password-result", hideGate);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [visible]);

  const verifyPassword = () => {
    const savedPassword = sessionStorage.getItem("accountPassword");
    if (!savedPassword) {
      setError("Phiên đăng nhập chưa được xác thực lại. Vui lòng đăng xuất và đăng nhập lại.");
      return;
    }
    const isCorrect = password === savedPassword;
    if (!isCorrect) {
      setError("Mật khẩu không chính xác.");
      return;
    }
    window.dispatchEvent(new CustomEvent("profile-password-result", { detail: true }));
  };
  const closeGate = () => window.dispatchEvent(new CustomEvent("profile-password-result", { detail: false }));

  if (!visible) return null;
  return <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm"><button type="button" onClick={closeGate} className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700" aria-label="Đóng"><X size={17} /></button><h3 className="font-bold text-slate-900">Xác thực mật khẩu</h3><p className="mt-1 text-sm text-slate-600">Nhập mật khẩu hiện tại để mở form chỉnh sửa thông tin.</p><div className="mt-4 flex max-w-xl flex-col gap-3 sm:flex-row"><div className="relative min-w-0 flex-1"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} placeholder="Nhập mật khẩu hiện tại" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 pr-10 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /><button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400" aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div><button type="button" onClick={verifyPassword} disabled={!password} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Xác nhận</button></div>{error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}</section>;
}

function PersonalInfoSettings({ fullName, email, position, hotelName }: { fullName: string | null; email: string | null; position: string | null; hotelName: string | null }) {
  const dispatch = useAppDispatch();
  const [editing, setEditingState] = useState(false);
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    avatar: localStorage.getItem("profileAvatar") || "",
    fullName: fullName || "",
    position: position || "",
    email: email || "",
    identityNumber: localStorage.getItem("profileIdentityNumber") || "",
    phone: localStorage.getItem("profilePhone") || "",
    address: localStorage.getItem("profileAddress") || "",
  });
  const setEditing = (value: boolean) => {
    if (value) {
      window.dispatchEvent(new Event("profile-password-required"));
      return;
    }
    setEditingState(false);
    setPasswordVerified(false);
  };
  useEffect(() => {
    const handlePasswordResult = (event: Event) => {
      const correct = (event as CustomEvent<boolean>).detail;
      if (correct) {
        setPasswordVerified(true);
        setEditingState(true);
      }
      else setEditing(false);
    };
    window.addEventListener("profile-password-result", handlePasswordResult);
    if (editing && !passwordVerified) {
      window.dispatchEvent(new Event("profile-password-required"));
    }
    window.dispatchEvent(new CustomEvent("profile-editing", { detail: editing && passwordVerified }));
    return () => window.removeEventListener("profile-password-result", handlePasswordResult);
  }, [editing, passwordVerified]);
  const displayName = form.fullName.trim() || form.email.trim() || "Người dùng";
  const initials = displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const update = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const cancel = () => {
    setForm({ avatar: localStorage.getItem("profileAvatar") || "", fullName: fullName || "", position: position || "", email: email || "", identityNumber: localStorage.getItem("profileIdentityNumber") || "", phone: localStorage.getItem("profilePhone") || "", address: localStorage.getItem("profileAddress") || "" });
    setEditing(false);
    setPasswordVerified(false);
  };
  const save = () => {
    if (!form.fullName.trim() || !form.email.trim()) return;
    dispatch(updateProfile({ fullName: form.fullName.trim(), email: form.email.trim(), position: form.position.trim() }));
    localStorage.setItem("profileAvatar", form.avatar);
    localStorage.setItem("profileIdentityNumber", form.identityNumber.trim());
    localStorage.setItem("profilePhone", form.phone.trim());
    localStorage.setItem("profileAddress", form.address.trim());
    setEditing(false);
    setPasswordVerified(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };
  const displayFields = [[UserRound, "Họ và tên", form.fullName], [Mail, "Email", form.email], [BriefcaseBusiness, "Chức vụ", form.position], [Building2, "Khách sạn", hotelName]] as const;
  const editFields = [["fullName", "Họ và tên", form.fullName], ["position", "Chức vụ", form.position], ["email", "Email", form.email], ["identityNumber", "CCCD", form.identityNumber], ["phone", "Số điện thoại", form.phone]] as const;

  return <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">{initials}</div><div className="min-w-0"><h3 className="font-bold text-slate-900">Thông tin cá nhân</h3><p className="mt-1 truncate text-sm text-slate-500" title={displayName}>{displayName}</p></div></div>{editing ? <div className="flex gap-2"><button type="button" onClick={cancel} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600"><X size={15} />Hủy</button><button type="button" onClick={save} disabled={!form.fullName.trim() || !form.email.trim()} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Check size={15} />Lưu</button></div> : <button type="button" onClick={() => setEditing(true)} className="flex w-fit items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600"><Pencil size={15} />Chỉnh sửa</button>}</div>{editing ? <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2 block"><span className="text-xs font-medium text-slate-500">Ảnh nhân viên</span><input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => update("avatar", String(reader.result)); reader.readAsDataURL(file); }} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>{editFields.map(([field, label, value]) => <label key={field} className="block"><span className="text-xs font-medium text-slate-500">{label}</span><input value={value} onChange={(event) => update(field, event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>)}<label className="sm:col-span-2 block"><span className="text-xs font-medium text-slate-500">Địa chỉ</span><textarea value={form.address} onChange={(event) => update("address", event.target.value)} className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label><div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3"><Building2 size={17} className="shrink-0 text-slate-400" /><div><p className="text-xs font-medium text-slate-500">Khách sạn</p><p className="mt-1 text-sm font-semibold text-slate-700">{hotelName || "Chưa cập nhật"}</p></div></div></div> : <div className="mt-5 grid gap-4 sm:grid-cols-2">{displayFields.map(([Icon, label, value]) => <div key={label} className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3"><Icon size={17} className="mt-0.5 shrink-0 text-blue-600" /><div className="min-w-0"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 truncate text-sm font-semibold text-slate-800" title={value || "Chưa cập nhật"}>{value?.trim() || "Chưa cập nhật"}</p></div></div>)}</div>}{saved && <p className="mt-4 text-xs font-medium text-emerald-600">Đã cập nhật thông tin cá nhân.</p>}</section>;
}

export default function ModulePage({ path: routePath, onLogout }: { path: string; onLogout: () => void }) {
  const { t } = useTranslation();
  const location = useLocation();
  const { hotelName, fullName, email, position } = useAppSelector((state) => state.auth);
  const branchLabel = hotelName || "Tất cả chi nhánh";
  const [mobile, setMobile] = useState(false);
  const editBooking = (location.state as { editBooking?: BookingListItem } | null)?.editBooking;
  const [bookingOpen, setBookingOpen] = useState(Boolean(editBooking));
  const [bookingMenuOpen, setBookingMenuOpen] = useState(false);
  useEffect(() => {
    if (editBooking) setBookingOpen(true);
  }, [editBooking]);
  const path = ({
    "/bookings": "/dat-phong",
    "/booking-list": "/danh-sach-booking",
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
    "/booking-list": "bookingList",
    "/customers": "customers",
    "/rooms": "rooms",
    "/tasks": "tasks",
    "/invoices": "invoices",
    "/promotions": "promotions",
    "/services": "services",
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
    stats: basePage.stats.map(([label, value], index) => [t(`pages.${pageKey}.stats.${index}`, label), routePath === "/settings" && index === 0 ? branchLabel : value] as [string, string]),
  };
  return <div className="min-h-screen min-w-0 bg-[#f7f8fc] text-slate-800">
    <AppSidebar mobile={mobile} onCloseMobile={() => setMobile(false)} onLogout={onLogout} fullName={fullName || email} position={position} />
    {mobile && <div className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" onClick={() => setMobile(false)} />}
    <main className="min-w-0 lg:pl-64"><AppHeader onMenuClick={() => setMobile(true)} />
        <div className="mx-auto min-w-0 max-w-7xl px-5 py-7 lg:px-9"><p className="mb-1 text-sm font-semibold text-blue-600">{page.eyebrow}</p><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h2 className="text-[28px] font-bold tracking-[-.03em] text-slate-900">{page.title}</h2>{path !== "/nhan-vien" && <p className="mt-2 max-w-xl text-sm text-slate-500">{page.description}</p>}</div>{path !== "/nhan-vien" && <button onClick={() => path === "/dat-phong" && setBookingOpen(true)} className="flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700"><Sparkles size={16} />{path === "/dat-phong" ? t("common.newBookingEyebrow") : t("common.newAction")}</button>}</div>
        {path !== "/dat-phong" && <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{page.stats.map(([label, value], i) => <div key={label} className={`rounded-2xl border border-slate-200/80 p-5 shadow-sm ${i === 0 ? "bg-[#28233f] text-white" : "bg-white"}`}><p className={`text-sm font-medium ${i === 0 ? "text-blue-200" : "text-slate-500"}`}>{label}</p><p className="mt-4 text-2xl font-bold tracking-tight">{value}</p><p className={`mt-1 text-xs ${i === 0 ? "text-blue-200" : "text-slate-400"}`}>Cập nhật hôm nay</p></div>)}</section>}
        {path === "/settings" ? <LanguageSettings /> : path === "/check-in-out" ? <CheckInOutWorkspace /> : path === "/services" ? <ServiceWorkspace /> : path === "/khuyen-mai" ? <PromotionWorkspace /> : path === "/phong" ? <RoomWorkspace /> : path === "/hoa-don" ? <InvoiceWorkspace /> : path === "/cong-viec" ? <TaskWorkspace /> : path === "/bao-cao" ? <ReportWorkspace /> : path === "/nhan-vien" ? <StaffTabsWorkspace /> : path === "/phan-quyen" ? <PermissionsWorkspace /> : path === "/danh-sach-booking" ? <BookingListWorkspace /> : path === "/dat-phong" ? (bookingOpen ? <BookingWorkspaceNew /> : <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-violet-50 text-blue-600"><CalendarDays size={20} /></div><div><h3 className="font-bold text-slate-900">Lịch đặt phòng hôm nay</h3><p className="mt-1 text-sm text-slate-500">12 đặt phòng · 8 khách đến · 5 khách rời đi</p></div></div><button onClick={() => setBookingOpen(true)} className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"><Sparkles size={16} />Đặt phòng mới</button></div><div className="mt-6 grid gap-3 md:grid-cols-3"><div className="rounded-xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs font-bold text-slate-800">Hôm nay · 14/10</p><p className="mt-2 text-2xl font-bold text-slate-900">08 <span className="text-xs font-medium text-slate-400">check-in</span></p></div><div className="rounded-xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs font-bold text-slate-800">Đang chờ xác nhận</p><p className="mt-2 text-2xl font-bold text-amber-600">04 <span className="text-xs font-medium text-slate-400">đặt phòng</span></p></div><div className="rounded-xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs font-bold text-slate-800">Sẵn sàng đón khách</p><p className="mt-2 text-2xl font-bold text-emerald-600">16 <span className="text-xs font-medium text-slate-400">phòng</span></p></div></div></section>) : <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-violet-50 text-blue-600"><ClipboardList size={20} /></div><div><h3 className="font-bold text-slate-900">Không gian {page.title.toLowerCase()}</h3><p className="mt-1 text-sm text-slate-500">Các công cụ chi tiết cho {page.title.toLowerCase()} sẽ được hiển thị tại đây.</p></div></div><div className="mt-6 grid gap-3 md:grid-cols-3"><div className="rounded-xl border border-dashed border-slate-200 p-4"><p className="text-xs font-bold text-slate-800">Danh sách & bộ lọc</p><p className="mt-1 text-xs text-slate-400">Tra cứu nhanh dữ liệu theo chi nhánh.</p></div><div className="rounded-xl border border-dashed border-slate-200 p-4"><p className="text-xs font-bold text-slate-800">Theo dõi trạng thái</p><p className="mt-1 text-xs text-slate-400">Cập nhật tiến độ theo thời gian thực.</p></div><div className="rounded-xl border border-dashed border-slate-200 p-4"><p className="text-xs font-bold text-slate-800">Báo cáo & hành động</p><p className="mt-1 text-xs text-slate-400">Xuất dữ liệu hoặc thực hiện thao tác mới.</p></div></div></section>}
        <ScrollControls />
      </div></main>
  </div>;
}
