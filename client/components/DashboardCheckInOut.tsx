import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, LogIn, LogOut, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useGetTodayCheckInsQuery,
  useGetTodayCheckOutsQuery,
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

const formatTime = (value?: string) => {
  if (!value) return "--:--";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
};

const formatDetailStatus = (status: string | undefined, flow: "check-in" | "check-out") => {
  if (!status) return flow === "check-in" ? "Chờ check-in" : "Đang lưu trú";
  const labels: Record<string, string> = {
    PENDING: "Chờ check-in",
    CHECKED_IN: "Đang lưu trú",
    CHECKED_OUT: "Đã check-out",
    CANCELLED: "Đã hủy",
  };
  return labels[status] ?? status;
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
  const isCheckIn = flow === "check-in";
  const ItemIcon = isCheckIn ? LogIn : LogOut;
  const tone = isCheckIn
    ? { border: "border-blue-100", icon: "bg-blue-50 text-blue-600", time: "text-blue-700" }
    : { border: "border-amber-100", icon: "bg-amber-50 text-amber-600", time: "text-amber-700" };

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-slate-400">Đang tải lịch...</p>;
  }
  if (isError) {
    return <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">Không tải được lịch. Vui lòng thử tải lại.</p>;
  }
  if (records.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">
      {isCheckIn ? "Không có phòng chờ check-in trong ngày này." : "Không có phòng chờ check-out trong ngày này."}
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
              <strong className="text-sm text-slate-900">Phòng {record.roomNumber ?? "—"}</strong>
              <span className="truncate text-xs text-slate-500">{record.roomName ?? record.roomTypeName ?? "Phòng"}</span>
            </span>
            <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-slate-600">
              <UserRound size={13} className="shrink-0 text-slate-400" />
              <span className="truncate">{record.nameCustomer ?? "Chưa cập nhật khách"}</span>
              {record.phone && <span className="shrink-0 text-slate-400">· {record.phone}</span>}
            </span>
            <span className="mt-1 block truncate text-[11px] text-slate-400">
              Booking {record.bookingId ?? "—"} · {formatDetailStatus(record.bookingDetailStatus, flow)}
            </span>
          </span>
          <span className={`flex shrink-0 items-center gap-1 text-xs font-bold ${tone.time}`}>
            <Clock3 size={13} />
            {formatTime(isCheckIn ? record.checkInTime : record.checkOutTime)}
          </span>
        </Link>
      ))}
    </div>
  );
}

export default function DashboardCheckInOut() {
  const { i18n } = useTranslation();
  const hotelId = useAppSelector((state) => state.auth.hotelId);
  const [selectedDate, setSelectedDate] = useState(() => localDateString(new Date()));
  const checkInQuery = useGetTodayCheckInsQuery(
    { date: selectedDate, status: "PENDING", bookingStatus: "CONFIRMED" },
    { skip: !hotelId },
  );
  const checkOutQuery = useGetTodayCheckOutsQuery(
    { date: selectedDate, status: "CHECKED_IN", bookingStatus: "CONFIRMED" },
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
            <h3 className="font-bold text-slate-900">Lịch check-in / check-out</h3>
          </div>
          <p className="mt-1 text-xs capitalize text-slate-500">{formatDate(selectedDate, i18n.language)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => shiftDate(-1)} aria-label="Ngày trước" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-blue-50 hover:text-blue-600">
            <ChevronLeft size={16} />
          </button>
          <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
            <CalendarDays size={14} className="text-blue-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => event.target.value && setSelectedDate(event.target.value)}
              aria-label="Chọn ngày check-in/check-out"
              className="min-w-0 bg-transparent outline-none"
            />
          </label>
          <button type="button" onClick={() => shiftDate(1)} aria-label="Ngày sau" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-blue-50 hover:text-blue-600">
            <ChevronRight size={16} />
          </button>
          {selectedDate !== today && (
            <button type="button" onClick={() => setSelectedDate(today)} className="rounded-lg px-2 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">
              Hôm nay
            </button>
          )}
        </div>
      </div>

      {!hotelId ? (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Chưa xác định được chi nhánh cho tài khoản này.</p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl bg-blue-50/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800">Khách chờ check-in</h4>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-blue-700">
                {checkInQuery.currentData?.length ?? 0} phòng
              </span>
            </div>
            <ScheduleList
              records={checkInQuery.currentData ?? []}
              flow="check-in"
              date={selectedDate}
              isLoading={checkInQuery.isFetching}
              isError={checkInQuery.isError}
            />
          </section>
          <section className="rounded-xl bg-amber-50/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800">Khách chờ check-out</h4>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-amber-700">
                {checkOutQuery.currentData?.length ?? 0} phòng
              </span>
            </div>
            <ScheduleList
              records={checkOutQuery.currentData ?? []}
              flow="check-out"
              date={selectedDate}
              isLoading={checkOutQuery.isFetching}
              isError={checkOutQuery.isError}
            />
          </section>
        </div>
      )}
      <div className="mt-3 flex justify-end">
        <Link to={`/check-in-out?date=${selectedDate}`} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
          Mở quầy lễ tân
        </Link>
      </div>
    </section>
  );
}
