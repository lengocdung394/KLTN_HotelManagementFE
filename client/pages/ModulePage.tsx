import { Building2, BriefcaseBusiness, CalendarDays, CalendarPlus, Check, ChevronLeft, ChevronRight, Eye, EyeOff, Mail, Pencil, Search, Sparkles, UserRound, X } from "lucide-react";
import { useLocation} from "react-router-dom";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import BookingWorkspaceNew from "./BookingWorkspace";
import BookingListWorkspace from "./BookingListWorkspace";
import RefundApprovalWorkspace from "./RefundApprovalWorkspace";
import RoomWorkspace from "./RoomWorkspace";
import InvoiceWorkspace from "./InvoiceWorkspace";
import ReportWorkspace from "./ReportWorkspace";
import StaffTabsWorkspace from "./StaffTabsWorkspace";
import PermissionsWorkspace from "./PermissionsWorkspace";
import CheckInOutWorkspace from "./CheckInOutWorkspace";
import PromotionWorkspace from "./PromotionWorkspace";
import ServiceWorkspace from "./ServiceWorkspace";
import CustomerWorkspace from "./CustomerWorkspace";
import HotelRulesWorkspace from "./HotelRulesWorkspace";
import AppHeader from "../components/AppHeader";
import AppSidebar from "../components/AppSidebar";
import EmployeeShiftSessionGuard from "../components/EmployeeShiftSessionGuard";
import ScrollControls from "../components/ScrollControls";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { useSidebar } from "../hooks/useSidebar";
import { logout, updateProfile } from "../store/authSlice";
import type { BookingListItem } from "../services/bookingApi";
import { useUpdateMyProfileMutation } from "../services/employeeApi";
import { useLoginMutation } from "../services/authApi";
import { useGetBookingsByHotelQuery } from "../services/bookingApi";
import { useGetRoomsByCurrentHotelQuery } from "../services/roomApi";
import { bindHotelSocketEvents } from "../lib/socket";
import { baseApi } from "../services/baseApi";
import { localizedText } from "../i18n";

const content: Record<string, { eyebrow: string; title: string; description: string; stats: [string, string][] }> = {
  "/bookings": { eyebrow: "Vận hành lưu trú", title: "Quản lý đặt phòng", description: "Quản lý lịch đặt phòng, khách lưu trú và lịch check-in / check-out.", stats: [["Đặt phòng hôm nay", "12"], ["Đang chờ xác nhận", "04"], ["Check-in hôm nay", "08"], ["Doanh thu dự kiến", "18.650.000đ"]] },
  "/booking-list": { eyebrow: "Vận hành lưu trú", title: "Danh sách booking", description: "Tra cứu và theo dõi toàn bộ đơn đặt phòng của chi nhánh.", stats: [["Tổng booking", "12"], ["Chờ xác nhận", "04"], ["Đang lưu trú", "02"], ["Đã hoàn tất", "06"]] },
  "/refund-approvals": { eyebrow: "Tài chính chi nhánh", title: "Phê duyệt hoàn tiền", description: "Theo dõi khoản thu dư khi check-out, xác nhận hoàn tiền mặt tại quầy và xử lý yêu cầu hoàn qua ngân hàng.", stats: [["Chờ duyệt", "—"], ["Đang xử lý", "—"], ["Đã hoàn tiền", "—"], ["Tổng tiền hoàn", "—"]] },
  "/hotel-rules": { eyebrow: "Vận hành lưu trú", title: "Nội quy khách sạn", description: "Tra cứu quy định đặt phòng, check-in / check-out, hủy booking và sử dụng dịch vụ.", stats: [] },
  "/customers": { eyebrow: "Quan hệ khách hàng", title: "Quản lý khách hàng", description: "Quản lý hồ sơ, lịch sử lưu trú và chăm sóc khách quay lại.", stats: [["Tổng khách hàng", "04"], ["Khách thân thiết", "02"], ["Khách quay lại tháng này", "12"], ["Chi tiêu trung bình", "5,8tr"]] },
  "/check-in-out": { eyebrow: "Vận hành lễ tân", title: "Check-in / Check-out", description: "Quản lý nhận phòng, trả phòng và trạng thái lưu trú của khách trong ngày.", stats: [["Chờ check-in", "02"], ["Đang lưu trú", "02"], ["Chờ check-out", "02"], ["Đã hoàn tất", "01"]] },
  "/promotions": { eyebrow: "Kinh doanh & chăm sóc khách", title: "Khuyến mãi", description: "Tạo ưu đãi và quản lý mã giảm giá cho khách lưu trú tại chi nhánh.", stats: [] },
  "/services/usage": { eyebrow: "Vận hành lưu trú", title: "Thao tác dịch vụ khách hàng", description: "Theo dõi dịch vụ đã đặt và xác nhận sau khi khách sử dụng.", stats: [] },
  "/services/catalog": { eyebrow: "Quản lý danh mục", title: "Quản lý danh mục dịch vụ", description: "Thêm, chỉnh sửa và quản lý trạng thái các dịch vụ của khách sạn.", stats: [] },
  "/rooms": { eyebrow: "Quản lý tài sản", title: "Quản lý phòng", description: "Theo dõi tình trạng phòng, loại phòng và phân công dọn dẹp tại chi nhánh.", stats: [["Tổng số phòng", "24"], ["Sẵn sàng", "16"], ["Đang sử dụng", "05"], ["Bảo trì", "03"]] },
  "/invoices": { eyebrow: "Tài chính chi nhánh", title: "Hoá đơn", description: "Tra cứu hoá đơn, thanh toán và đối soát giao dịch của khách hàng.", stats: [] },
  "/staff": { eyebrow: "Quản trị nhân sự", title: "Nhân viên & ca làm", description: "Quản lý nhân viên, chức vụ, lịch làm việc và phân công trong chi nhánh.", stats: [["Tổng nhân viên", "18"], ["Ca hôm nay", "03"]] },
  "/permissions": { eyebrow: "Quản trị hệ thống", title: "Phân quyền", description: "Thiết lập vai trò và quyền truy cập cho từng nhóm nhân viên trong chi nhánh.", stats: [["Vai trò", "04"], ["Nhân viên", "18"], ["Quyền truy cập", "06"], ["Cập nhật gần nhất", "Hôm nay"]] },
  "/reports": { eyebrow: "Phân tích kinh doanh", title: "Báo cáo doanh thu", description: "Theo dõi doanh thu dịch vụ, hiệu quả khuyến mãi và trạng thái phòng theo thời gian.", stats: [] },
  "/settings": { eyebrow: "Thiết lập hệ thống", title: "Cài đặt", description: "Cấu hình chi nhánh, loại phòng, thông báo và quyền truy cập tài khoản.", stats: [["Chi nhánh", ""], ["Múi giờ", "GMT+7"], ["Ngôn ngữ", "Tiếng Việt"], ["Vai trò", "Quản lý"]] },
};

const bookingRooms = [
  { id: "101", type: "Deluxe King", beds: "1 giường lớn", size: "28 m²", guests: 2, price: "1.250.000", amenity: "Ban công · Hướng sông", available: true },
  { id: "102", type: "Deluxe Twin", beds: "2 giường đơn", size: "30 m²", guests: 2, price: "1.250.000", amenity: "Bữa sáng · Wifi tốc độ cao", available: true },
  { id: "201", type: "Suite Garden", beds: "1 giường lớn", size: "45 m²", guests: 3, price: "2.450.000", amenity: "Bồn tắm · Vườn riêng", available: true },
  { id: "203", type: "Executive Suite", beds: "1 giường lớn", size: "52 m²", guests: 4, price: "3.100.000", amenity: "Phòng khách · Hướng sông", available: false },
];

const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const valueDateKey = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : localDateKey(date);
};
const normalizedStatus = (value: unknown) => {
  if (value && typeof value === "object") {
    const status = value as Record<string, unknown>;
    return String(status.code ?? status.name ?? status.status ?? "").trim().toUpperCase();
  }
  return String(value ?? "").trim().toUpperCase();
};
const isActiveBooking = (booking: BookingListItem) => {
  const status = normalizedStatus(booking.bookingStatus ?? booking.status);
  return !["CANCELLED", "CANCELED", "REFUNDED", "REJECTED"].includes(status);
};
const isCancelledDetail = (detail: Record<string, unknown>) =>
  ["CANCELLED", "CANCELED"].includes(normalizedStatus(detail.bookingStatusType ?? detail.bookingDetailStatus ?? detail.status));
const isCheckedInDetail = (detail: Record<string, unknown>) =>
  ["CHECKED_IN", "CHECKED-IN", "CHECKEDIN", "CHECKED_OUT", "CHECKED-OUT", "CHECKEDOUT", "ĐÃ CHECK-IN", "ĐÃ TRẢ PHÒNG"]
    .includes(normalizedStatus(detail.bookingStatusType ?? detail.bookingDetailStatusType ?? detail.bookingDetailStatus ?? detail.status));

function BookingOverview({ onNewBooking }: { onNewBooking: () => void }) {
  const dispatch = useAppDispatch();
  const hotelId = useAppSelector((state) => state.auth.hotelId);
  const { data: bookings = [], isLoading: bookingsLoading, isError: bookingsError } = useGetBookingsByHotelQuery(
    Number(hotelId),
    { skip: !hotelId || Number.isNaN(Number(hotelId)) },
  );
  const { data: rooms = [], isLoading: roomsLoading, isError: roomsError } = useGetRoomsByCurrentHotelQuery();

  useEffect(() => {
    if (!hotelId) return;
    return bindHotelSocketEvents({
      onRoomMatrixUpdated: () => dispatch(baseApi.util.invalidateTags(["Booking", "Room"])),
      onNewBookingNotification: () => dispatch(baseApi.util.invalidateTags(["Booking", "Room"])),
      onBookingStateUpdated: () => dispatch(baseApi.util.invalidateTags(["Booking", "Room"])),
      onCustomerBookingUpdated: () => dispatch(baseApi.util.invalidateTags(["Booking", "Room"])),
      onRoomCreated: () => dispatch(baseApi.util.invalidateTags(["Room"])),
      onRoomUpdated: () => dispatch(baseApi.util.invalidateTags(["Room"])),
    });
  }, [dispatch, hotelId]);

  const today = localDateKey(new Date());
  const todayArrivals = bookings
    .filter(isActiveBooking)
    .flatMap((booking) => booking.bookingDetails ?? [])
    .filter((detail) => !isCancelledDetail(detail)
      && isCheckedInDetail(detail)
      && valueDateKey(detail.actualCheckInTime ?? detail.actualCheckinTime ?? detail.checkInActualTime) === today).length;
  const pendingBookings = bookings.filter((booking) => {
    const status = normalizedStatus(booking.bookingStatus);
    return status === "PENDING" || status.includes("WAITING") || status.includes("CHỜ");
  }).length;
  const readyRooms = rooms.filter((room) => {
    const status = normalizedStatus(room.roomStatus ?? room.status);
    return status === "READY" || status === "AVAILABLE" || status === "SẴN SÀNG";
  }).length;
  const isLoading = bookingsLoading || roomsLoading;
  const hasError = bookingsError || roomsError;
  const metric = (value: number) => isLoading ? "…" : hasError ? "—" : String(value).padStart(2, "0");
  const todayLabel = new Date().toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });

  return (
    <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-600"><CalendarDays size={20} /></div>
          <div>
            <h3 className="font-bold text-slate-900">{localizedText("Lịch đặt phòng hôm nay", "Today's booking schedule")}</h3>
            {hasError && <p role="alert" className="mt-1 text-sm text-rose-600">{localizedText("Không tải được số liệu đặt phòng hoặc phòng.", "Could not load booking or room data.")}</p>}
          </div>
        </div>
        <button type="button" onClick={onNewBooking} className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700">
          <CalendarPlus size={16} />{localizedText("Đặt phòng mới", "New booking")}
        </button>
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-bold text-slate-800">{localizedText(`Hôm nay · ${todayLabel}`, `Today · ${todayLabel}`)}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{metric(todayArrivals)} <span className="text-xs font-medium text-slate-400">{localizedText("check-in", "check-in")}</span></p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-bold text-slate-800">{localizedText("Đang chờ xác nhận", "Awaiting confirmation")}</p>
          <p className="mt-2 text-2xl font-bold text-amber-600">{metric(pendingBookings)} <span className="text-xs font-medium text-slate-400">{localizedText("đặt phòng", "bookings")}</span></p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-bold text-slate-800">{localizedText("Sẵn sàng đón khách", "Ready for guests")}</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{metric(readyRooms)} <span className="text-xs font-medium text-slate-400">{localizedText("phòng", "rooms")}</span></p>
        </div>
      </div>
    </section>
  );
}

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

function LanguageSettings({ onLogout }: { onLogout: () => void }) {
  const { t } = useTranslation();
  const currentLanguage = i18n.language.startsWith("en") ? "en" : "vi";
  const { fullName, email, position, hotelName } = useAppSelector((state) => state.auth);

  const changeLanguage = (language: "en" | "vi") => {
    void i18n.changeLanguage(language);
    localStorage.setItem("language", language);
  };

  return <><PersonalInfoSettings fullName={fullName} email={email} position={position} hotelName={hotelName} onLogout={onLogout} /><PasswordGate /><section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-bold text-slate-900">{t("settings.languageTitle", "Ngôn ngữ")}</h3><p className="mt-1 text-sm text-slate-500">{t("settings.languageDescription", "Chọn ngôn ngữ hiển thị cho giao diện.")}</p></div><div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1" role="group" aria-label={t("settings.languageTitle", "Ngôn ngữ")}><button type="button" onClick={() => changeLanguage("vi")} className={`rounded-md px-3 py-2 text-sm font-semibold transition ${currentLanguage === "vi" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>Tiếng Việt</button><button type="button" onClick={() => changeLanguage("en")} className={`rounded-md px-3 py-2 text-sm font-semibold transition ${currentLanguage === "en" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>English</button></div></div></section></>;
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
  const email = useAppSelector((state) => state.auth.email);
  const [login, { isLoading }] = useLoginMutation();

  useEffect(() => {
    sessionStorage.removeItem("accountPassword");
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

  const verifyPassword = async () => {
    if (!email) {
      setError(localizedText("Không tìm thấy email tài khoản. Vui lòng đăng nhập lại.", "Account email not found. Please sign in again."));
      return;
    }
    try {
      await login({ email, password }).unwrap();
      window.dispatchEvent(new CustomEvent("profile-password-result", { detail: password }));
    } catch (err: any) {
      setError(err?.data?.message ?? localizedText("Mật khẩu không chính xác.", "Incorrect password."));
    }
  };
  const closeGate = () => window.dispatchEvent(new CustomEvent("profile-password-result", { detail: false }));

  if (!visible) return null;
  return <section className="password-gate mt-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm"><button type="button" onClick={closeGate} className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700" aria-label={localizedText("Đóng", "Close")}><X size={17} /></button><h3 className="font-bold text-slate-900">{localizedText("Xác thực mật khẩu", "Verify password")}</h3><p className="mt-1 text-sm text-slate-600">{localizedText("Nhập mật khẩu hiện tại để mở form chỉnh sửa thông tin.", "Enter your current password to edit your profile.")}</p><div className="mt-4 flex max-w-xl flex-col gap-3 sm:flex-row"><div className="relative min-w-0 flex-1"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} placeholder={localizedText("Nhập mật khẩu hiện tại", "Enter current password")} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 pr-10 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /><button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400" aria-label={showPassword ? localizedText("Ẩn mật khẩu", "Hide password") : localizedText("Hiện mật khẩu", "Show password")}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div><button type="button" onClick={() => void verifyPassword()} disabled={!password || isLoading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{isLoading ? localizedText("Đang xác thực...", "Verifying...") : localizedText("Xác nhận", "Confirm")}</button></div>{error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}</section>;
}

function PersonalInfoSettings({ fullName, email, position, hotelName, onLogout }: { fullName: string | null; email: string | null; position: string | null; hotelName: string | null; onLogout: () => void }) {
  const dispatch = useAppDispatch();
  const [updateMyProfile, { isLoading: isSaving }] = useUpdateMyProfileMutation();
  const [editing, setEditingState] = useState(false);
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [saved, setSaved] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saveError, setSaveError] = useState("");
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
      const result = (event as CustomEvent<string | false>).detail;
      if (typeof result === "string" && result) {
        setCurrentPassword(result);
        setPasswordVerified(true);
        setEditingState(true);
      }
      else setEditing(false);
    };
    window.addEventListener("profile-password-result", handlePasswordResult);
    if (editing && !passwordVerified) {
      window.dispatchEvent(new Event("profile-password-required"));
    }
    return () => window.removeEventListener("profile-password-result", handlePasswordResult);
  }, [editing, passwordVerified]);
  const displayName = form.fullName.trim() || form.email.trim() || localizedText("Người dùng", "User");
  const initials = displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const update = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const cancel = () => {
    setForm({ avatar: localStorage.getItem("profileAvatar") || "", fullName: fullName || "", position: position || "", email: email || "", identityNumber: localStorage.getItem("profileIdentityNumber") || "", phone: localStorage.getItem("profilePhone") || "", address: localStorage.getItem("profileAddress") || "" });
    setNewPassword("");
    setConfirmPassword("");
    setCurrentPassword("");
    setSaveError("");
    setEditing(false);
    setPasswordVerified(false);
  };
  const save = async () => {
    setSaveError("");
    if (!form.fullName.trim() || !form.email.trim()) {
      setSaveError(localizedText("Vui lòng nhập họ tên và email.", "Please enter your name and email."));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setSaveError(localizedText("Vui lòng nhập email hợp lệ.", "Please enter a valid email address."));
      return;
    }
    if (newPassword && newPassword.length < 8) {
      setSaveError(localizedText("Mật khẩu mới cần có ít nhất 8 ký tự.", "The new password must be at least 8 characters."));
      return;
    }
    if (newPassword !== confirmPassword) {
      setSaveError(localizedText("Mật khẩu xác nhận không khớp.", "The password confirmation does not match."));
      return;
    }
    try {
      const emailChanged = form.email.trim() !== (email || "").trim();
      const passwordChanged = Boolean(newPassword);
      const updatedProfile = await updateMyProfile({
        currentPassword,
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        cccd: form.identityNumber.trim(),
        address: form.address.trim(),
        position: form.position.trim(),
        ...(newPassword ? { newPassword, confirmPassword } : {}),
      }).unwrap();
      localStorage.setItem("profileAvatar", form.avatar);
      localStorage.setItem("profileIdentityNumber", form.identityNumber.trim());
      localStorage.setItem("profilePhone", form.phone.trim());
      localStorage.setItem("profileAddress", form.address.trim());
      localStorage.setItem("accountName", form.email.trim());
      if (emailChanged || passwordChanged) {
        sessionStorage.setItem("credentials-updated", "true");
        dispatch(logout());
        onLogout();
        return;
      }
      dispatch(updateProfile({
        fullName: updatedProfile.fullName,
        email: updatedProfile.email,
        position: updatedProfile.position,
      }));
      setNewPassword("");
      setConfirmPassword("");
      setCurrentPassword("");
      setEditing(false);
      setPasswordVerified(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setSaveError(err?.data?.message ?? localizedText("Không thể cập nhật thông tin. Vui lòng thử lại.", "Could not update your information. Please try again."));
    }
  };
  const displayFields = [[UserRound, localizedText("Họ và tên", "Full name"), form.fullName], [Mail, "Email", form.email], [BriefcaseBusiness, localizedText("Chức vụ", "Position"), form.position], [Building2, localizedText("Khách sạn", "Hotel"), hotelName]] as const;
  const editFields = [["fullName", localizedText("Họ và tên", "Full name"), form.fullName], ["position", localizedText("Chức vụ", "Position"), form.position], ["email", "Email", form.email], ["identityNumber", localizedText("CCCD", "ID number"), form.identityNumber], ["phone", localizedText("Số điện thoại", "Phone number"), form.phone]] as const;

  return (
    <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">{initials}</div>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900">{localizedText("Thông tin cá nhân", "Personal information")}</h3>
            <p className="mt-1 truncate text-sm text-slate-500" title={displayName}>{displayName}</p>
          </div>
        </div>
        {editing ? (
          <button type="button" onClick={cancel} className="flex w-fit items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600"><X size={15} />{localizedText("Hủy", "Cancel")}</button>
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="flex w-fit items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600"><Pencil size={15} />{localizedText("Chỉnh sửa", "Edit")}</button>
        )}
      </div>
      {editing ? (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2 block">
              <span className="text-xs font-medium text-slate-500">{localizedText("Ảnh nhân viên", "Employee photo")}</span>
              <input type="file" accept="image/*" onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => update("avatar", String(reader.result));
                reader.readAsDataURL(file);
              }} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </label>
            {editFields.map(([field, label, value]) => (
              <label key={field} className="block">
                <span className="text-xs font-medium text-slate-500">{label}</span>
                <input
                  type={field === "email" ? "email" : "text"}
                  required={field === "email" || field === "fullName"}
                  value={value}
                  onChange={(event) => update(field, event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            ))}
            <label className="sm:col-span-2 block">
              <span className="text-xs font-medium text-slate-500">{localizedText("Địa chỉ", "Address")}</span>
              <textarea value={form.address} onChange={(event) => update("address", event.target.value)} className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <Building2 size={17} className="shrink-0 text-slate-400" />
              <div><p className="text-xs font-medium text-slate-500">{localizedText("Khách sạn", "Hotel")}</p><p className="mt-1 text-sm font-semibold text-slate-700">{hotelName || localizedText("Chưa cập nhật", "Not provided")}</p></div>
            </div>
          </div>
          <div className="mt-7 border-t border-slate-100 pt-5">
            <h4 className="text-sm font-bold text-slate-900">{localizedText("Thông tin tài khoản", "Account information")}</h4>
            <p className="mt-1 text-xs text-slate-500">{localizedText("Email đăng nhập luôn đồng bộ với email cá nhân bên trên.", "The sign-in email is always synchronized with the personal email above.")}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-slate-500">{localizedText("Email đăng nhập", "Sign-in email")}</span>
                <input type="email" required value={form.email} onChange={(event) => update("email", event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
              </label>
              <div className="hidden sm:block" />
              <label className="block">
                <span className="text-xs font-medium text-slate-500">{localizedText("Mật khẩu mới", "New password")}</span>
                <span className="relative mt-1 block">
                  <input type={showNewPassword ? "text" : "password"} autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setSaveError(""); }} placeholder={localizedText("Để trống nếu không đổi mật khẩu", "Leave blank to keep the current password")} className="h-10 w-full rounded-lg border border-slate-200 px-3 pr-10 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                  <button type="button" onClick={() => setShowNewPassword((current) => !current)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400" aria-label={showNewPassword ? localizedText("Ẩn mật khẩu", "Hide password") : localizedText("Hiện mật khẩu", "Show password")}>{showNewPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                </span>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">{localizedText("Nhập lại mật khẩu", "Confirm password")}</span>
                <span className="relative mt-1 block">
                  <input type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setSaveError(""); }} className={`h-10 w-full rounded-lg border px-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-blue-100 ${confirmPassword && confirmPassword !== newPassword ? "border-red-300 focus:border-red-400" : "border-slate-200 focus:border-blue-400"}`} />
                  <button type="button" onClick={() => setShowConfirmPassword((current) => !current)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400" aria-label={showConfirmPassword ? localizedText("Ẩn mật khẩu", "Hide password") : localizedText("Hiện mật khẩu", "Show password")}>{showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                </span>
              </label>
            </div>
            {saveError && <p role="alert" className="mt-4 text-xs font-medium text-red-600">{saveError}</p>}
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => void save()} disabled={isSaving || !form.fullName.trim() || !form.email.trim()} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Check size={15} />{isSaving ? localizedText("Đang lưu...", "Saving...") : localizedText("Lưu tất cả thay đổi", "Save all changes")}</button>
            </div>
          </div>
        </>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {displayFields.map(([Icon, label, value]) => (
            <div key={label} className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <Icon size={17} className="mt-0.5 shrink-0 text-blue-600" />
              <div className="min-w-0"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 truncate text-sm font-semibold text-slate-800" title={value || localizedText("Chưa cập nhật", "Not provided")}>{value?.trim() || localizedText("Chưa cập nhật", "Not provided")}</p></div>
            </div>
          ))}
        </div>
      )}
      {saved && <p role="status" className="mt-4 text-xs font-medium text-emerald-600">{localizedText("Đã cập nhật thông tin cá nhân và tài khoản.", "Personal and account information updated.")}</p>}
    </section>
  );
}

export default function ModulePage({ path: routePath, onLogout }: { path: string; onLogout: () => void }) {
  const { t } = useTranslation();
  const location = useLocation();
  const { mobileOpen, collapsed, toggleSidebar, closeMobile } = useSidebar();
  const { hotelName, fullName, email, position } = useAppSelector((state) => state.auth);
  const branchLabel = hotelName || localizedText("Tất cả chi nhánh", "All branches");
  const editBooking = (location.state as { editBooking?: BookingListItem } | null)?.editBooking;
  const [bookingOpen, setBookingOpen] = useState(Boolean(editBooking));
  const [bookingMenuOpen, setBookingMenuOpen] = useState(false);
  useEffect(() => {
    if (editBooking) setBookingOpen(true);
  }, [editBooking]);
  const path = ({
    "/bookings": "/dat-phong",
    "/booking-list": "/danh-sach-booking",
    "/refund-approvals": "/phe-duyet-hoan-tien",
    "/promotions": "/khuyen-mai",
    "/rooms": "/phong",
    "/invoices": "/hoa-don",
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
    "/refund-approvals": "refundApprovals",
    "/hotel-rules": "hotelRules",
    "/customers": "customers",
    "/rooms": "rooms",
    "/invoices": "invoices",
    "/promotions": "promotions",
    "/services/usage": "serviceUsage",
    "/services/catalog": "serviceCatalog",
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
    stats: basePage.stats.map(([label, value], index) => [
      t(`pages.${pageKey}.stats.${index}`, label),
      routePath === "/settings" && index === 0
        ? branchLabel
        : routePath === "/settings" && index === 2
          ? localizedText("Tiếng Việt", "English")
          : routePath === "/settings" && index === 3
            ? position === "Quản lý" || position === "Manager"
              ? localizedText("Quản lý", "Manager")
              : position ?? value
            : value,
    ] as [string, string]),
  };
  return <div className="min-h-screen min-w-0 bg-[#f7f8fc] text-slate-800">
    <EmployeeShiftSessionGuard onLogout={onLogout} />
    <AppSidebar
      mobile={mobileOpen}
      onCloseMobile={closeMobile}
      onLogout={onLogout}
      fullName={fullName || email}
      position={position}
      collapsed={collapsed}
      onToggleCollapse={toggleSidebar}
    />
    {mobileOpen && <div className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" onClick={closeMobile} />}
    <main className={`min-w-0 transition-[padding] duration-300 ease-in-out ${collapsed ? "lg:pl-0" : "lg:pl-72"}`}>
      <AppHeader onMenuClick={toggleSidebar} collapsed={collapsed} />
        <div className={`mx-auto min-w-0 px-4 py-6 sm:px-6 lg:px-8 transition-[max-width] duration-300 ease-in-out ${collapsed ? "max-w-[1650px]" : "max-w-7xl"}`}><p className="mb-1 text-sm font-semibold text-blue-600">{page.eyebrow}</p><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h2 className="text-[28px] font-bold tracking-[-.03em] text-slate-900">{page.title}</h2>{path !== "/nhan-vien" && <p className="mt-2 max-w-xl text-sm text-slate-500">{page.description}</p>}</div>{path !== "/dat-phong" && path !== "/nhan-vien" && path !== "/phe-duyet-hoan-tien" && path !== "/hotel-rules" && !routePath.startsWith("/services/") && routePath !== "/invoices" && routePath !== "/promotions" && <button onClick={() => path === "/dat-phong" && setBookingOpen(true)} className="flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700"><Sparkles size={16} />{t("common.newAction")}</button>}</div>
        {path !== "/dat-phong" && path !== "/phe-duyet-hoan-tien" && path !== "/hotel-rules" && routePath !== "/check-in-out" && routePath !== "/invoices" && routePath !== "/promotions" && !routePath.startsWith("/services/") && <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{page.stats.map(([label, value], i) => <div key={label} className={`rounded-xl border border-slate-200/80 p-4 shadow-sm ${i === 0 ? "bg-[#28233f] text-white" : "bg-white"}`}><p className={`text-xs font-medium ${i === 0 ? "text-blue-200" : "text-slate-500"}`}>{label}</p><p className="mt-2 text-xl font-bold tracking-tight">{value}</p><p className={`mt-1 text-[11px] ${i === 0 ? "text-blue-200" : "text-slate-400"}`}>{localizedText("Cập nhật hôm nay", "Updated today")}</p></div>)}</section>}
        {path === "/hotel-rules" ? <HotelRulesWorkspace /> : path === "/settings" ? <LanguageSettings onLogout={onLogout} /> : path === "/phe-duyet-hoan-tien" ? <RefundApprovalWorkspace /> : path === "/check-in-out" ? <CheckInOutWorkspace /> : routePath.startsWith("/services/") ? <ServiceWorkspace mode={routePath === "/services/usage" ? "usage" : "catalog"} /> : path === "/khuyen-mai" ? <PromotionWorkspace /> : path === "/phong" ? <RoomWorkspace /> : path === "/hoa-don" ? <InvoiceWorkspace /> : path === "/bao-cao" ? <ReportWorkspace /> : path === "/nhan-vien" ? <StaffTabsWorkspace /> : path === "/phan-quyen" ? <PermissionsWorkspace /> : path === "/danh-sach-booking" ? <BookingListWorkspace /> : path === "/dat-phong" ? (bookingOpen ? <BookingWorkspaceNew /> : <BookingOverview onNewBooking={() => setBookingOpen(true)} />) : <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-violet-50 text-blue-600"><CalendarDays size={20} /></div><div><h3 className="font-bold text-slate-900">Không gian {page.title.toLowerCase()}</h3><p className="mt-1 text-sm text-slate-500">Các công cụ chi tiết cho {page.title.toLowerCase()} sẽ được hiển thị tại đây.</p></div></div><div className="mt-6 grid gap-3 md:grid-cols-3"><div className="rounded-xl border border-dashed border-slate-200 p-4"><p className="text-xs font-bold text-slate-800">Danh sách & bộ lọc</p><p className="mt-1 text-xs text-slate-400">Tra cứu nhanh dữ liệu theo chi nhánh.</p></div><div className="rounded-xl border border-dashed border-slate-200 p-4"><p className="text-xs font-bold text-slate-800">Theo dõi trạng thái</p><p className="mt-1 text-xs text-slate-500">Theo dõi tiến độ theo thời gian thực.</p></div><div className="rounded-xl border border-dashed border-slate-200 p-4"><p className="text-xs font-bold text-slate-800">Báo cáo & hành động mới.</p></div></div></section>}
        <ScrollControls />
      </div></main>
  </div>;
}
