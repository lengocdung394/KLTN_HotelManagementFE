import { Link, useLocation } from "react-router-dom";
import {
  Bot,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  ConciergeBell,
  DoorOpen,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Tag,
  UserRound,
  Users,
  WalletCards,
  ChevronDown,
  PanelLeftClose,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "../store/hooks";
import { isEmployeePortalUser } from "../lib/employeeRoles";
import { localizedText } from "../i18n";
import { useGetHotelHousekeepingTasksQuery } from "../services/shiftApi";
import { useGetCheckInOutSummaryQuery } from "../services/checkInOutApi";
import {
  useGetBookingCancellationsQuery,
  useGetCheckoutRefundsQuery,
} from "../services/managementBookingApi";
import UserProfileCard from "./UserProfileCard";

type AppSidebarProps = {
  mobile: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
  fullName?: string | null;
  position?: string | null;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

const items = [
  ["/overview", "overview", LayoutDashboard],
  ["/check-in-out", "checkInOut", CalendarCheck],
  ["/customers", "customers", UserRound],
  ["/rooms", "rooms", DoorOpen],
  ["/invoices", "invoices", WalletCards],
  ["/reports", "reports", FileText],
  ["/promotions", "promotions", Tag],
  ["/services", "services", ConciergeBell],
] as const;
const adminItems = [
  ["/staff", "staff", Users],
  ["/permissions", "permissions", ShieldCheck],
  ["/settings", "settings", Settings],
] as const;
const sidebarOrder: Record<string, string> = {
  "/overview": "order-1",
  "/bookings": "order-2",
  "/check-in-out": "order-3",
  "/rooms": "order-4",
  "/services": "order-5",
  "/customers": "order-6",
  "/invoices": "order-7",
  "/refund-approvals": "order-8",
  "/reports": "order-9",
  "/promotions": "order-10",
  "/hotel-rules": "order-11",
};

export default function AppSidebar({
  mobile,
  onCloseMobile,
  onLogout,
  fullName,
  position,
  collapsed,
  onToggleCollapse,
}: AppSidebarProps) {
  const { t } = useTranslation();
  const { hotelId, hotelName, roles } = useAppSelector((state) => state.auth);
  const isEmployee = isEmployeePortalUser(roles);
  const canManageHousekeepingTasks = roles.includes("ROLE_MANAGER") || roles.includes("ROLE_ADMIN");
  const canViewHousekeepingTasks = canManageHousekeepingTasks || isEmployee;
  const today = new Date();
  const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const { data: checkInOutSummary } = useGetCheckInOutSummaryQuery(
    { date: todayDate },
    { skip: !hotelId, pollingInterval: 30000 },
  );
  const pendingCheckInOutCount =
    (checkInOutSummary?.waitingCheckIn ?? 0) + (checkInOutSummary?.waitingCheckOut ?? 0);
  const { data: housekeepingTasks = [] } = useGetHotelHousekeepingTasksQuery(undefined, {
    skip: !canViewHousekeepingTasks,
    pollingInterval: 30000,
  });
  const pendingHousekeepingTaskCount = housekeepingTasks.filter((task) => task.status === "NEEDS_ASSIGNMENT").length;
  const canApproveRefunds = roles.includes("ROLE_MANAGER")
    || roles.includes("ROLE_SUPER_ADMIN")
    || roles.includes("ROLE_ADMIN");
  const { data: bookingCancellations = [] } = useGetBookingCancellationsQuery(undefined, {
    skip: !canApproveRefunds,
    pollingInterval: 30000,
  });
  const { data: checkoutRefunds = [] } = useGetCheckoutRefundsQuery(undefined, {
    skip: !canApproveRefunds,
    pollingInterval: 30000,
  });
  const pendingRefundApprovalCount =
    bookingCancellations.filter((item) =>
      item.status === "REFUND_REVIEW_PENDING" || item.status === "REFUND_BANK_DETAILS_REQUIRED",
    ).length
    + checkoutRefunds.filter((item) => item.status === "PENDING").length;
  const location = useLocation();
  const [bookingMenuOpen, setBookingMenuOpen] = useState(
    () =>
      location.pathname === "/bookings" ||
      location.pathname === "/booking-list",
  );
  const [roomsMenuOpen, setRoomsMenuOpen] = useState(
    () => location.pathname === "/rooms",
  );
  const [servicesMenuOpen, setServicesMenuOpen] = useState(() =>
    location.pathname.startsWith("/services"),
  );
  const [staffMenuOpen, setStaffMenuOpen] = useState(
    () => location.pathname === "/staff",
  );
  const bookingActive =
    location.pathname === "/bookings" || location.pathname === "/booking-list";
  const roomsActive = location.pathname === "/rooms";
  const servicesActive = location.pathname.startsWith("/services");
  const staffActive = location.pathname === "/staff";
  const canManageServices = roles.includes("ROLE_MANAGER");
  const canViewServiceCatalog = canManageServices
    || roles.includes("ROLE_ADMIN")
    || isEmployee;
  const currentRoomTab = new URLSearchParams(location.search).get("tab");
  const currentStaffTab =
    new URLSearchParams(location.search).get("tab") ?? "today";
  const branchLabel = hotelName || t("common.allBranches", "Tất cả chi nhánh");

  useEffect(() => {
    const isBookingRoute =
      location.pathname === "/bookings" ||
      location.pathname === "/booking-list";
    const isRoomRoute = location.pathname === "/rooms";
    const isServicesRoute = location.pathname.startsWith("/services");

    setBookingMenuOpen(isBookingRoute);
    setRoomsMenuOpen(isRoomRoute);
    setServicesMenuOpen(isServicesRoute);
    setStaffMenuOpen(location.pathname === "/staff");
  }, [location.pathname]);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-blue-950 px-4 py-5 text-white transition-transform duration-300 ease-in-out ${mobile ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "lg:-translate-x-full" : "lg:translate-x-0"}`}
    >
      <div className="h-5" />
      <div className="mt-2 min-w-0 px-3">
        <div className="flex h-11 min-h-11 w-full min-w-0 items-center justify-between overflow-hidden rounded-xl border border-blue-300/20 bg-blue-900/70 px-3 text-left text-sm font-semibold text-white shadow-sm shadow-blue-950/20">
          <span className="flex w-0 min-w-0 flex-1 items-center gap-2.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-300 text-[11px] font-bold text-amber-950">
              M
            </span>
            <span className="truncate" title={branchLabel}>
              {branchLabel}
            </span>
          </span>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden rounded-lg p-1 text-blue-200 hover:bg-white/10 hover:text-white lg:block"
              title={t("navigation.collapseMenu", "Thu gọn menu")}
              aria-label={t("navigation.collapseMenu", "Thu gọn menu")}
            >
              <PanelLeftClose size={16} />
            </button>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        <nav className="mt-8 flex flex-col gap-1">
          {items.slice(0, 2).map(([href, label, Icon]) => (
            <Link
              key={href}
              to={href}
              onClick={onCloseMobile}
              className={`${sidebarOrder[href]} flex flex-nowrap items-center justify-between whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition ${location.pathname === href ? "bg-blue-600 text-white shadow-lg shadow-violet-950/30" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
            >
              <span className="flex shrink-0 items-center gap-3 whitespace-nowrap">
                <Icon size={17} />
                {t(`navigation.${label}`)}
              </span>
              {href === "/check-in-out" && pendingCheckInOutCount > 0 && (
                <span className="shrink-0 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold leading-4 text-white" aria-label={`${pendingCheckInOutCount} ${t("navigation.checkInOut")}`}>
                  {pendingCheckInOutCount}
                </span>
              )}
            </Link>
          ))}
          <div
            className={`order-2 rounded-xl ${bookingActive ? "bg-blue-900/50" : ""}`}
          >
            <div
              className={`flex items-center rounded-xl text-sm font-medium ${bookingActive ? "text-white" : "text-slate-400"}`}
            >
              <Link
                to="/bookings"
                onClick={onCloseMobile}
                className="flex min-w-0 flex-1 items-center gap-3 whitespace-nowrap px-3 py-2.5 hover:text-white"
              >
                <CalendarDays size={17} />
                {t("navigation.bookings", "Quản lý đặt phòng")}
              </Link>
              <button
                type="button"
                onClick={() => setBookingMenuOpen((current) => !current)}
                className="rounded-lg p-2.5 hover:bg-white/10"
                aria-label={t("navigation.bookings", "Quản lý đặt phòng")}
              >
                <ChevronDown
                  size={15}
                  className={`transition-transform ${bookingMenuOpen ? "rotate-180" : ""}`}
                />
              </button>
            </div>
            {bookingMenuOpen && (
              <div className="space-y-1 pb-2 pl-9 pr-2">
                <Link
                  to="/bookings"
                  onClick={onCloseMobile}
                  className={`block rounded-lg px-3 py-2 text-sm whitespace-nowrap ${location.pathname === "/bookings" ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
                >
                  {t("navigation.bookingSubmenu", "Đặt phòng")}
                </Link>
                <Link
                  to="/booking-list"
                  onClick={onCloseMobile}
                  className={`block rounded-lg px-3 py-2 text-sm whitespace-nowrap ${location.pathname === "/booking-list" ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
                >
                  {t("navigation.bookingList", "Danh sách booking")}
                </Link>
              </div>
            )}
          </div>
          <Link
            to="/refund-approvals"
            onClick={onCloseMobile}
            className={`order-8 flex items-center justify-between gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition ${location.pathname === "/refund-approvals" ? "bg-blue-600 text-white shadow-lg shadow-violet-950/30" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
          >
            <span className="flex items-center gap-3">
              <ClipboardCheck size={17} />
              {t("navigation.refundApprovals", "Phê duyệt hoàn tiền")}
            </span>
            {pendingRefundApprovalCount > 0 && (
              <span className="shrink-0 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold leading-4 text-white" aria-label={`${pendingRefundApprovalCount} ${t("navigation.refundApprovals", "Phê duyệt hoàn tiền")}`}>
                {pendingRefundApprovalCount}
              </span>
            )}
          </Link>
          <Link
            to="/hotel-rules"
            onClick={onCloseMobile}
            className={`order-10 flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition ${location.pathname === "/hotel-rules" ? "bg-blue-600 text-white shadow-lg shadow-violet-950/30" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
          >
            <ClipboardList size={17} />
            {t("navigation.hotelRules", "Nội quy khách sạn")}
          </Link>
          <div className={`order-4 rounded-xl ${roomsActive ? "bg-blue-900/50" : ""}`}>
            <div
              className={`flex items-center rounded-xl text-sm font-medium ${roomsActive ? "text-white" : "text-slate-400"}`}
            >
              <Link
                to="/rooms?tab=rooms"
                onClick={onCloseMobile}
                className="flex min-w-0 flex-1 items-center gap-3 whitespace-nowrap px-3 py-2.5 hover:text-white"
              >
                <DoorOpen size={17} />
                {t("navigation.rooms", "Quản lý phòng")}
              </Link>
              <button
                type="button"
                onClick={() => setRoomsMenuOpen((current) => !current)}
                className="rounded-lg p-2.5 hover:bg-white/10"
                aria-label={t("navigation.rooms", "Quản lý phòng")}
              >
                <ChevronDown
                  size={15}
                  className={`transition-transform ${roomsMenuOpen ? "rotate-180" : ""}`}
                />
              </button>
            </div>
            {roomsMenuOpen && (
              <div className="space-y-1 pb-2 pl-9 pr-2">
                <Link
                  to="/rooms?tab=rooms"
                  onClick={onCloseMobile}
                  className={`block rounded-lg px-3 py-2 text-sm whitespace-nowrap ${location.pathname === "/rooms" && currentRoomTab !== "pricing" ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
                >
                  {t("navigation.roomList", "Quản lý danh sách phòng")}
                </Link>
                {!isEmployee && (
                  <Link
                    to="/rooms?tab=pricing"
                    onClick={onCloseMobile}
                    className={`block rounded-lg px-3 py-2 text-sm whitespace-nowrap ${location.pathname === "/rooms" && currentRoomTab === "pricing" ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
                  >
                    {t("navigation.pricingConfig", "Quản lý cấu hình giá")}
                  </Link>
                )}
              </div>
            )}
          </div>
          {items
            .slice(2)
            .filter(
              ([href]) =>
                href !== "/rooms"
                && href !== "/services"
                && !(isEmployee && href === "/reports"),
            )
            .map(([href, label, Icon]) => (
              <Link
                key={href}
                to={href}
                onClick={onCloseMobile}
                className={`${sidebarOrder[href]} flex flex-nowrap items-center justify-between whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition ${location.pathname === href ? "bg-blue-600 text-white shadow-lg shadow-violet-950/30" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
              >
                <span className="flex shrink-0 items-center gap-3 whitespace-nowrap">
                  <Icon size={17} />
                  {t(`navigation.${label}`)}
                </span>
              </Link>
            ))}
          <div
            className={`order-5 rounded-xl ${servicesActive ? "bg-blue-900/50" : ""}`}
          >
            <div
              className={`flex items-center rounded-xl text-sm font-medium ${servicesActive ? "text-white" : "text-slate-400"}`}
            >
              <Link
                to="/services/usage"
                onClick={onCloseMobile}
                className="flex min-w-0 flex-1 items-center gap-3 whitespace-nowrap px-3 py-2.5 hover:text-white"
              >
                <ConciergeBell size={17} />
                {t("navigation.services", "Dịch vụ")}
              </Link>
              <button
                type="button"
                onClick={() => setServicesMenuOpen((current) => !current)}
                className="rounded-lg p-2.5 hover:bg-white/10"
                aria-label={t("navigation.services", "Dịch vụ")}
              >
                <ChevronDown
                  size={15}
                  className={`transition-transform ${servicesMenuOpen ? "rotate-180" : ""}`}
                />
              </button>
            </div>
            {servicesMenuOpen && (
              <div className="space-y-1 pb-2 pl-6 pr-2">
                <Link
                  to="/services/usage"
                  onClick={onCloseMobile}
                  className={`block whitespace-normal break-words rounded-lg px-3 py-2 text-left text-sm leading-4 ${location.pathname === "/services/usage" ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
                >
                  {t("navigation.serviceUsage", "Thao tác dịch vụ khách hàng")}
                </Link>
                {canViewServiceCatalog && (
                  <Link
                    to="/services/catalog"
                    onClick={onCloseMobile}
                    className={`block whitespace-normal break-words rounded-lg px-3 py-2 text-left text-sm leading-4 ${location.pathname === "/services/catalog" ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
                  >
                    {isEmployee
                      ? localizedText("Danh sách dịch vụ", "Service list")
                      : t("navigation.serviceCatalog", "Quản lý danh mục dịch vụ")}
                  </Link>
                )}
              </div>
            )}
          </div>
        </nav>
        <p className="mb-2 mt-8 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">
          {t("common.administration")}
        </p>
        <nav className="space-y-1">
          {isEmployee ? (
            <>
              <Link
                to="/staff?tab=today"
                onClick={onCloseMobile}
                className={`flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition ${location.pathname === "/staff" && currentStaffTab === "today" ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
              >
                <CalendarDays size={17} />
                {t("staff.todayShifts")}
              </Link>
              <Link
                to="/staff?tab=tasks"
                onClick={onCloseMobile}
                className={`flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition ${location.pathname === "/staff" && currentStaffTab === "tasks" ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
              >
                <ClipboardList size={17} />
                {t("staff.housekeepingAssignment")}
                {pendingHousekeepingTaskCount > 0 && (
                  <span
                    className="ml-auto rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold leading-4 text-white"
                    aria-label={`${pendingHousekeepingTaskCount} ${t("staff.housekeepingAssignment")}`}
                  >
                    {pendingHousekeepingTaskCount}
                  </span>
                )}
              </Link>
              <Link
                to="/settings"
                onClick={onCloseMobile}
                className={`flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition ${location.pathname === "/settings" ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
              >
                <Settings size={17} />
                {t("navigation.settings")}
              </Link>
            </>
          ) : (
            adminItems
              .filter(([href]) => href !== "/staff")
              .map(([href, label, Icon]) => (
                <Link
                  key={href}
                  to={href}
                  onClick={onCloseMobile}
                  className={`flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition ${location.pathname === href ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
                >
                  <Icon size={17} />
                  {t(`navigation.${label}`)}
                </Link>
              ))
          )}
          {!isEmployee && (
            <div
              className={`rounded-xl ${staffActive ? "bg-blue-900/50" : ""}`}
            >
              <div
                className={`flex items-center rounded-xl text-sm font-medium ${staffActive ? "text-white" : "text-slate-400"}`}
              >
                <Link
                  to="/staff?tab=today"
                  onClick={onCloseMobile}
                  className="flex min-w-0 flex-1 items-center gap-3 whitespace-nowrap px-3 py-2.5 hover:text-white"
                >
                  <Users size={17} />
                  {t("navigation.staff", "Nhân viên & ca làm")}
                </Link>
                <button
                  type="button"
                  onClick={() => setStaffMenuOpen((current) => !current)}
                  className="rounded-lg p-2.5 hover:bg-white/10"
                  aria-label={t("navigation.staff", "Nhân viên & ca làm")}
                >
                  <ChevronDown
                    size={15}
                    className={`transition-transform ${staffMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>
              </div>
              {staffMenuOpen && (
                <div className="space-y-1 pb-2 pl-9 pr-2">
                  <Link
                    to="/staff?tab=today"
                    onClick={onCloseMobile}
                    className={`block rounded-lg px-3 py-2 text-sm whitespace-nowrap ${staffActive && currentStaffTab === "today" ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
                  >
                    {t("staff.todayShifts")}
                  </Link>
                  <Link
                    to="/staff?tab=employees"
                    onClick={onCloseMobile}
                    className={`block rounded-lg px-3 py-2 text-sm whitespace-nowrap ${staffActive && currentStaffTab === "employees" ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
                  >
                    {t("staff.employeeList")}
                  </Link>
                  {roles.includes("ROLE_MANAGER") && (
                    <Link
                      to="/staff?tab=shifts"
                      onClick={onCloseMobile}
                      className={`block rounded-lg px-3 py-2 text-sm whitespace-nowrap ${staffActive && currentStaffTab === "shifts" ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
                    >
                      {t("staff.assignShifts")}
                    </Link>
                  )}
                  {(roles.includes("ROLE_MANAGER") ||
                    roles.includes("ROLE_ADMIN")) && (
                    <Link
                      to="/staff?tab=tasks"
                      onClick={onCloseMobile}
                      className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap ${staffActive && currentStaffTab === "tasks" ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
                    >
                      {t("staff.assignTasks")}
                      {pendingHousekeepingTaskCount > 0 && (
                        <span
                          className="shrink-0 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold leading-4 text-white"
                          aria-label={`${pendingHousekeepingTaskCount} ${t("staff.assignTasks")}`}
                          title={localizedText(
                            `${pendingHousekeepingTaskCount} phòng đang chờ phân công`,
                            `${pendingHousekeepingTaskCount} rooms awaiting assignment`,
                          )}
                        >
                          {pendingHousekeepingTaskCount}
                        </span>
                      )}
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
          {(roles.includes("ROLE_ADMIN") || roles.includes("ROLE_MANAGER") || roles.includes("ROLE_SUPER_ADMIN")) && (
            <Link
              to="/ai-cms"
              onClick={onCloseMobile}
              className={`mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                location.pathname === "/ai-cms"
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Bot className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{localizedText("Cấu hình AI & Playground", "AI CMS & Playground")}</span>}
            </Link>
          )}
        </nav>
      </div>
      <UserProfileCard
        onLogout={onLogout}
        fullName={fullName}
        position={position}
      />
    </aside>
  );
}
