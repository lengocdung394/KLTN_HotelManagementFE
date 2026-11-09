import { Link } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  ConciergeBell,
  Download,
  Plus,
  UserRound,
} from "lucide-react";
import OverviewCalendar from "../components/OverviewCalendarNew";
import DashboardCheckInOut from "../components/DashboardCheckInOut";
import BranchHotelPhotoPanel from "../components/BranchHotelPhotoPanel";
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

const normalizeStatus = (value: unknown) => {
  if (value && typeof value === "object") {
    const status = value as Record<string, unknown>;
    return String(status.code ?? status.name ?? status.status ?? "").trim().toUpperCase();
  }
  return String(value ?? "").trim().toUpperCase();
};

const valueOf = (item: Record<string, unknown>, keys: string[]) =>
  keys.map((key) => item[key]).find((value) => value !== undefined && value !== null && value !== "");

const guestCountOf = (detail: Record<string, unknown>) => {
  const total = valueOf(detail, ["totalGuests", "guestCount", "numGuests", "numberOfGuests", "guestNumber"]);
  const totalGuests = Number(total);
  if (total !== undefined && Number.isFinite(totalGuests) && totalGuests >= 0) return totalGuests;

  const adultValue = valueOf(detail, ["numAdults", "adults", "adultCount", "numberOfAdults"]);
  const childValue = valueOf(detail, ["numChildren", "children", "childCount", "numberOfChildren"]);
  const infantValue = valueOf(detail, ["numInfants", "infants", "infantCount", "numberOfInfants"]);
  const values = [adultValue, childValue, infantValue].filter((value) => value !== undefined);
  if (values.length === 0) return undefined;
  const counts = values.map(Number);
  if (counts.some((count) => !Number.isFinite(count))) return undefined;
  return counts.reduce((totalCount, count) => totalCount + Math.max(0, count), 0);
};

const isCurrentlyCheckedIn = (detail: Record<string, unknown>) => {
  const actualCheckOut = valueOf(detail, [
    "actualCheckOutTime",
    "actualCheckOut",
    "realCheckOutTime",
    "checkOutActualTime",
    "checkedOutAt",
  ]);
  if (actualCheckOut) return false;

  const status = normalizeStatus(valueOf(detail, [
    "bookingDetailStatusType",
    "bookingDetailsStatusType",
    "bookingDetailStatus",
    "bookingStatusType",
    "detailStatus",
    "checkInStatus",
    "checkinStatus",
    "arrivalStatus",
    "status",
  ]));
  if (["CANCELLED", "CANCELED", "CHECKED_OUT", "CHECKED-OUT", "CHECKEDOUT", "COMPLETED"].includes(status)) {
    return false;
  }
  if (["CHECKED_IN", "CHECKED-IN", "CHECKEDIN", "IN_HOUSE", "INHOUSE", "ARRIVED", "IN_PROGRESS"].includes(status)) {
    return true;
  }

  const actualCheckIn = valueOf(detail, [
    "actualCheckInTime",
    "actualCheckIn",
    "realCheckInTime",
    "checkInActualTime",
    "checkedInAt",
  ]);
  return Boolean(actualCheckIn) && !actualCheckOut;
};

export default function Index({ onLogout }: { onLogout: () => void }) {
  const { t, i18n } = useTranslation();
  const { mobileOpen, collapsed, toggleSidebar, closeMobile } = useSidebar();
  const dispatch = useAppDispatch();
  const { fullName, email, position, hotelId, hotelName, roles } = useAppSelector((state) => state.auth);
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
  const pendingServiceConfirmations = useMemo(() => bookings.flatMap((booking) => {
    if (String(booking.bookingStatus ?? "").toUpperCase().startsWith("CANCELLED")) return [];
    const bookingId = String(booking.bookingId ?? booking.id ?? "");
    const details = Array.isArray(booking.bookingDetails) ? booking.bookingDetails : [];

    return details.flatMap((detail) => {
      if (String(detail.bookingStatusType ?? detail.bookingDetailStatus ?? detail.status ?? "").toUpperCase() === "CANCELLED") return [];
      const serviceList = [
        detail.bookingServiceResponsForHotels,
        detail.bookingServiceResponseForHotel,
        detail.bookingServiceResponsesForHotels,
        detail.bookingServiceDetails,
        detail.services,
      ].find(Array.isArray);
      if (!Array.isArray(serviceList)) return [];

      return serviceList.flatMap((service) => {
        if (!service || typeof service !== "object") return [];
        const serviceRecord = service as Record<string, unknown>;
        if (serviceRecord.cancelled === true || Boolean(serviceRecord.cancelledAt)) return [];
        const quantity = Math.max(0, Number(serviceRecord.quantity ?? 1) || 0);
        const rawUsedQuantity = serviceRecord.usedQuantity ?? serviceRecord.quantityUsed;
        const parsedUsedQuantity = Number(rawUsedQuantity);
        const usedQuantity = rawUsedQuantity !== undefined && rawUsedQuantity !== null && Number.isFinite(parsedUsedQuantity)
          ? Math.min(Math.max(parsedUsedQuantity, 0), quantity)
          : serviceRecord.used === true || typeof serviceRecord.usedAt === "string"
            ? quantity
            : 0;
        const remainingQuantity = quantity - usedQuantity;
        if (remainingQuantity <= 0) return [];

        return [{
          key: `${bookingId}-${String(detail.bookingDetailId ?? detail.id ?? "")}-${String(serviceRecord.bookingServiceDetailId ?? serviceRecord.id ?? serviceRecord.name ?? "")}`,
          bookingId,
          customerName: String(booking.customerName ?? detail.customerName ?? detail.nameCustomer ?? "—"),
          roomNumber: String(detail.roomNumber ?? detail.roomName ?? "—"),
          serviceName: String(serviceRecord.name ?? serviceRecord.serviceName ?? t("dashboard.serviceFallback")),
          quantity: remainingQuantity,
        }];
      });
    });
  }), [bookings, t]);
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
  const currentGuestCountResult = bookings.reduce((result, booking) => {
    const bookingStatus = normalizeStatus(booking.bookingStatus ?? booking.status);
    if (bookingStatus.startsWith("CANCEL") || ["CANCELED", "REFUNDED", "REJECTED"].includes(bookingStatus)) return result;
    const details = Array.isArray(booking.bookingDetails) ? booking.bookingDetails : [];
    return details.reduce((current, detail) => {
      if (!isCurrentlyCheckedIn(detail)) return current;
      const count = guestCountOf(detail);
      return count === undefined
        ? { ...current, incomplete: true, checkedInDetails: current.checkedInDetails + 1 }
        : { ...current, count: current.count + count, checkedInDetails: current.checkedInDetails + 1 };
    }, result);
  }, { count: 0, incomplete: false, checkedInDetails: 0 });
  const currentGuestCount = currentGuestCountResult.incomplete
    || (occupiedRooms > 0 && currentGuestCountResult.checkedInDetails === 0)
    ? undefined
    : currentGuestCountResult.count;
  const formatTaskStatus = (status: string) => status === "NEEDS_ASSIGNMENT"
    ? t("common.pendingTask")
    : status === "REASSIGNED" ? t("dashboard.taskReassigned") : t("dashboard.taskAssigned");
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
        <BranchHotelPhotoPanel hotelId={hotelId} hotelName={hotelName} />
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
                {reportLoading
                  ? "—"
                  : reportError
                    ? t("dashboard.error")
                    : `${new Intl.NumberFormat(i18n.language.startsWith("en") ? "en-US" : "vi-VN", { maximumFractionDigits: 0 }).format(Number(dailyReport?.netCashReceived ?? 0))}${i18n.language.startsWith("en") ? " VND" : "đ"}`}
              </p>
              <p className="mt-1 text-xs text-blue-100">
                {reportError ? t("dashboard.revenueLoadError") : t("dashboard.netRevenueDescription")}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
              <p className="text-sm font-medium text-slate-500">
                {t("dashboard.roomOccupancy")}
              </p>
              <p className="mt-4 text-[26px] font-bold">
                {roomsLoading ? "—" : roomsError ? t("dashboard.error") : `${occupancyRate}%`}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {roomsError ? t("dashboard.roomStatusLoadError") : t("dashboard.roomsAvailableForOccupancy", { occupied: occupiedRooms, available: roomsAvailableForOccupancy })}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
              <p className="text-sm font-medium text-slate-500">
                {t("dashboard.currentGuests")}
              </p>
              <p className="mt-4 text-[26px] font-bold">
                {bookingsLoading || roomsLoading ? "—" : bookingsError || roomsError ? t("dashboard.error") : currentGuestCount ?? "—"}{" "}
                <span className="text-lg font-medium text-slate-400">
                  {t("common.guestCount")}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {bookingsError
                  ? t("dashboard.guestCountLoadError")
                  : roomsError
                    ? t("dashboard.roomStatusLoadError")
                    : `${occupiedRooms} ${t("common.roomsInUse")}`}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
              <p className="text-sm font-medium text-slate-500">
                {t("dashboard.arrivalsDepartures")}
              </p>
              <p className="mt-4 text-[26px] font-bold">
                {summaryLoading ? "—" : summaryError ? t("dashboard.error") : todaySummary?.waitingCheckIn ?? 0}{" "}
                <span className="text-lg font-medium text-slate-400">
                  {t("common.arrivals")}
                </span>
                {" · "}{summaryLoading ? "—" : summaryError ? t("dashboard.error") : todaySummary?.waitingCheckOut ?? 0}{" "}
                <span className="text-lg font-medium text-slate-400">
                  {t("common.departures")}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {summaryError
                  ? t("dashboard.checkInOutLoadError")
                  : t("dashboard.roomsAwaitingToday")}
              </p>
            </div>
          </section>
          <DashboardCheckInOut />
          <section className="mt-7 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <ConciergeBell size={17} className="text-blue-600" />
                  <h3 className="font-bold text-slate-900">{t("dashboard.servicesToConfirm")}</h3>
                  {!bookingsLoading && !bookingsError && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                      {pendingServiceConfirmations.length}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-400">{t("dashboard.servicesToConfirmDescription")}</p>
              </div>
              <Link
                to="/services/usage"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                {t("dashboard.confirmServices")}
                <ArrowRight size={14} />
              </Link>
            </div>
            {bookingsLoading ? (
              <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">{t("dashboard.loadingServicesToConfirm")}</p>
            ) : bookingsError ? (
              <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{t("dashboard.servicesToConfirmError")}</p>
            ) : pendingServiceConfirmations.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">{t("dashboard.noServicesToConfirm")}</p>
            ) : (
              <div className="space-y-2">
                {pendingServiceConfirmations.slice(0, 5).map((service) => (
                  <Link
                    key={service.key}
                    to="/services/usage"
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 transition hover:border-blue-200 hover:bg-blue-50/60"
                  >
                    <span className="flex min-w-0 flex-1 items-start gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600">
                        <ConciergeBell size={16} />
                      </span>
                      <span className="min-w-0">
                        <strong className="block truncate text-sm text-slate-800">{service.serviceName}</strong>
                        <span className="mt-1 block truncate text-xs text-slate-500">
                          {t("dashboard.serviceBooking", { bookingId: service.bookingId })}
                          {" · "}{service.customerName}
                          {" · "}{t("dashboard.serviceRoom", { room: service.roomNumber })}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      {t("dashboard.serviceQuantityToConfirm", { count: service.quantity })}
                    </span>
                  </Link>
                ))}
                {pendingServiceConfirmations.length > 5 && (
                  <p className="pt-1 text-center text-xs text-slate-500">
                    {t("dashboard.moreServicesToConfirm", { count: pendingServiceConfirmations.length - 5 })}
                  </p>
                )}
              </div>
            )}
          </section>
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
                  <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">{t("dashboard.loadingTasks")}</p>
                ) : tasksError ? (
                  <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{t("dashboard.tasksLoadError")}</p>
                ) : activeHousekeepingTasks.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">{t("dashboard.noTasks")}</p>
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
                  {roomsLoading ? t("dashboard.loading") : roomsError ? t("dashboard.roomStatusLoadError") : `${rooms.length} ${t("room.roomsAtBranch")}`}
                </p>
              </div>
              {roomsError ? (
                <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{t("dashboard.roomStatusLoadError")}</p>
              ) : roomsLoading ? (
                <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">{t("dashboard.loadingRoomStatus")}</p>
              ) : rooms.length === 0 ? (
                <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">{t("dashboard.noRooms")}</p>
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
