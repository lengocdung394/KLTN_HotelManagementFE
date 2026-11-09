import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, LogIn, LogOut, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useGetTodayCheckInsQuery,
  useGetTodayCheckOutsQuery,
  useGetEarlyCheckInsQuery,
  type CheckInOutBookingDetail,
} from "../services/checkInOutApi";
import { useAppSelector } from "../store/hooks";

const localDateString = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const formatDate = (value: string, language: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString(language.toLowerCase().startsWith("en") ? "en-US" : "vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const formatTime = (value: string | undefined, language: string) => {
  if (!value) return "--:--";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString(language.startsWith("en") ? "en-US" : "vi-VN", { hour: "2-digit", minute: "2-digit" });
};

const formatDetailStatus = (status: string | undefined, flow: "check-in" | "check-out", t: (key: string) => string) => {
  if (!status) return flow === "check-in" ? t("dashboard.awaitingCheckIn") : t("dashboard.inHouse");
  const labels: Record<string, string> = {
    PENDING: "awaitingCheckIn",
    CHECKED_IN: "inHouse",
    CHECKED_OUT: "checkedOut",
    CANCELLED: "cancelled",
  };
  const key = labels[status];
  return key ? t(`dashboard.${key}`) : status;
};

function ScheduleList({
  records,
  flow,
  date,
  isLoading,
  isError,
}: {
  records: CheckInOutBookingDetail[];
  flow: "check-in" | "check-out";
  date: string;
  isLoading: boolean;
  isError: boolean;
}) {
  const { t, i18n } = useTranslation();
  const isCheckIn = flow === "check-in";
  const ItemIcon = isCheckIn ? LogIn : LogOut;
  const tone = isCheckIn
    ? { border: "border-blue-100", icon: "bg-blue-50 text-blue-600", time: "text-blue-700" }
    : { border: "border-amber-100", icon: "bg-amber-50 text-amber-600", time: "text-amber-700" };

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-slate-400">{t("dashboard.loadingSchedule")}</p>;
  }
  if (isError) {
    return <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{t("dashboard.scheduleLoadError")}</p>;
  }
  if (records.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">
      {isCheckIn ? t("dashboard.noRoomsAwaitingCheckIn") : t("dashboard.noRoomsAwaitingCheckOut")}
    </p>;
  }

  return (
    <div className="max-h-[350px] space-y-2 overflow-y-auto pr-1">
      {records.map((record, index) => (
        <Link
          key={`${record.bookingDetailId ?? record.bookingId ?? "record"}-${index}`}
          to={`/check-in-out?date=${date}&flow=${flow}`}
          className={`flex items-center gap-3 rounded-xl border ${tone.border} bg-white p-3 transition hover:border-blue-300 hover:shadow-sm`}
        >
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tone.icon}`}>
            <ItemIcon size={17} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <strong className="text-sm text-slate-900">{t("dashboard.roomLabel")} {record.roomNumber ?? "—"}</strong>
              <span className="truncate text-xs text-slate-500">{record.roomName ?? record.roomTypeName ?? t("dashboard.roomFallback")}</span>
            </span>
            <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-slate-600">
              <UserRound size={13} className="shrink-0 text-slate-400" />
              <span className="truncate">{record.nameCustomer ?? t("dashboard.guestFallback")}</span>
              {record.phone && <span className="shrink-0 text-slate-400">· {record.phone}</span>}
            </span>
            <span className="mt-1 block truncate text-[11px] text-slate-400">
              {t("dashboard.bookingLabel")} {record.bookingId ?? "—"} · {formatDetailStatus(record.bookingDetailStatus, flow, t)}
            </span>
          </span>
          <span className={`flex shrink-0 items-center gap-1 text-xs font-bold ${tone.time}`}>
            <Clock3 size={13} />
            {formatTime(isCheckIn ? record.checkInTime : record.checkOutTime, i18n.language)}
          </span>
        </Link>
      ))}
    </div>
  );
}

export default function DashboardCheckInOut() {
  const { t, i18n } = useTranslation();
  const hotelId = useAppSelector((state) => state.auth.hotelId);
  const [selectedDate, setSelectedDate] = useState(() => localDateString(new Date()));
  const [activeTab, setActiveTab] = useState<"arrivals" | "departures" | "early-checkins">("arrivals");
  const checkInQuery = useGetTodayCheckInsQuery(
    { date: selectedDate, status: "PENDING", bookingStatus: "CONFIRMED" },
    { skip: !hotelId },
  );
  const checkOutQuery = useGetTodayCheckOutsQuery(
    { date: selectedDate, status: "CHECKED_IN", bookingStatus: "CONFIRMED" },
    { skip: !hotelId },
  );
  const earlyCheckInsQuery = useGetEarlyCheckInsQuery(
    { date: selectedDate },
    { skip: !hotelId },
  );
  const today = localDateString(new Date());
  const shiftDate = (days: number) => {
    const date = new Date(`${selectedDate}T00:00:00`);
    date.setDate(date.getDate() + days);
    setSelectedDate(localDateString(date));
  };

  return (
    <section className="mt-7 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays size={17} className="text-blue-600" />
            <h3 className="font-bold text-slate-900">{t("dashboard.checkInOutSchedule")}</h3>
          </div>
          <p className="mt-1 text-xs capitalize text-slate-500">{formatDate(selectedDate, i18n.language)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => shiftDate(-1)} aria-label={t("dashboard.previousDay")} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-blue-50 hover:text-blue-600">
            <ChevronLeft size={16} />
          </button>
          <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
            <CalendarDays size={14} className="text-blue-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => event.target.value && setSelectedDate(event.target.value)}
              aria-label={t("dashboard.selectCheckInOutDate")}
              className="min-w-0 bg-transparent outline-none"
            />
          </label>
          <button type="button" onClick={() => shiftDate(1)} aria-label={t("dashboard.nextDay")} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-blue-50 hover:text-blue-600">
            <ChevronRight size={16} />
          </button>
          {selectedDate !== today && (
            <button type="button" onClick={() => setSelectedDate(today)} className="rounded-lg px-2 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">
              {t("common.today")}
            </button>
          )}
        </div>
      </div>

      {!hotelId ? (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{t("dashboard.branchNotFound")}</p>
      ) : (
        <div className="mt-4">
          <div role="tablist" aria-label={t("dashboard.checkInOutTabs")} className="flex flex-wrap gap-2 border-b border-slate-200">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "arrivals"}
              onClick={() => setActiveTab("arrivals")}
              className={`rounded-t-lg px-3 py-2 text-xs font-semibold ${activeTab === "arrivals" ? "border-b-2 border-blue-600 text-blue-700" : "text-slate-500 hover:text-slate-800"}`}
            >
              {t("dashboard.waitingCheckIn")} <span className="ml-1 rounded-full bg-blue-50 px-2 py-0.5">{checkInQuery.currentData?.length ?? 0}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "departures"}
              onClick={() => setActiveTab("departures")}
              className={`rounded-t-lg px-3 py-2 text-xs font-semibold ${activeTab === "departures" ? "border-b-2 border-amber-600 text-amber-700" : "text-slate-500 hover:text-slate-800"}`}
            >
              {t("dashboard.waitingCheckOut")} <span className="ml-1 rounded-full bg-amber-50 px-2 py-0.5">{checkOutQuery.currentData?.length ?? 0}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "early-checkins"}
              onClick={() => setActiveTab("early-checkins")}
              className={`rounded-t-lg px-3 py-2 text-xs font-semibold ${activeTab === "early-checkins" ? "border-b-2 border-emerald-600 text-emerald-700" : "text-slate-500 hover:text-slate-800"}`}
            >
              {t("dashboard.earlyCheckIns")} <span className="ml-1 rounded-full bg-emerald-50 px-2 py-0.5">{earlyCheckInsQuery.currentData?.length ?? 0}</span>
            </button>
          </div>
          <section role="tabpanel" className={`rounded-b-xl rounded-tr-xl p-4 ${activeTab === "arrivals" ? "bg-blue-50/60" : activeTab === "departures" ? "bg-amber-50/60" : "bg-emerald-50/60"}`}>
            {activeTab === "arrivals" && (
              <ScheduleList
                records={checkInQuery.currentData ?? []}
                flow="check-in"
                date={selectedDate}
                isLoading={checkInQuery.isFetching}
                isError={checkInQuery.isError}
              />
            )}
            {activeTab === "departures" && (
              <ScheduleList
                records={checkOutQuery.currentData ?? []}
                flow="check-out"
                date={selectedDate}
                isLoading={checkOutQuery.isFetching}
                isError={checkOutQuery.isError}
              />
            )}
            {activeTab === "early-checkins" && (
              <EarlyCheckInList
                records={earlyCheckInsQuery.currentData ?? []}
                isLoading={earlyCheckInsQuery.isFetching}
                isError={earlyCheckInsQuery.isError}
              />
            )}
          </section>
        </div>
      )}
      <div className="mt-3 flex justify-end">
        <Link to={`/check-in-out?date=${selectedDate}`} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
          {t("dashboard.openFrontDesk")}
        </Link>
      </div>
    </section>
  );
}

function EarlyCheckInList({
  records,
  isLoading,
  isError,
}: {
  records: CheckInOutBookingDetail[];
  isLoading: boolean;
  isError: boolean;
}) {
  const { t, i18n } = useTranslation();
  if (isLoading) {
    return <p className="py-8 text-center text-sm text-slate-400">{t("dashboard.loadingEarlyCheckIns")}</p>;
  }
  if (isError) {
    return <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{t("dashboard.earlyCheckInsLoadError")}</p>;
  }
  if (records.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">{t("dashboard.noEarlyCheckIns")}</p>;
  }

  return (
    <div className="max-h-[350px] space-y-2 overflow-y-auto pr-1">
      {records.map((record, index) => (
        <article key={`${record.bookingDetailId ?? record.bookingId ?? "record"}-${index}`} className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-white p-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
            <LogIn size={17} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2">
              <strong className="text-sm text-slate-900">{t("dashboard.roomLabel")} {record.roomNumber ?? "—"}</strong>
              <span className="truncate text-xs text-slate-500">{record.roomName ?? record.roomTypeName ?? t("dashboard.roomFallback")}</span>
            </span>
            <span className="mt-1 block truncate text-xs text-slate-600">{record.nameCustomer ?? t("dashboard.guestFallback")} · {t("dashboard.bookingLabel")} {record.bookingId ?? "—"}</span>
            <span className="mt-1 block text-[11px] text-slate-400">{t("dashboard.expectedTime")}: {formatTime(record.checkInTime, i18n.language)}</span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block text-xs font-bold text-emerald-700">{t("dashboard.checkedInAt")} {formatTime(record.actualCheckInTime, i18n.language)}</span>
            <span className="mt-1 block text-[11px] text-slate-500">
              {t("dashboard.surcharge")} {new Intl.NumberFormat(i18n.language.startsWith("en") ? "en-US" : "vi-VN", { maximumFractionDigits: 0 }).format(Number(record.earlyCheckInFee ?? 0))}{i18n.language.startsWith("en") ? " VND" : "đ"}
            </span>
          </span>
        </article>
      ))}
    </div>
  );
}
