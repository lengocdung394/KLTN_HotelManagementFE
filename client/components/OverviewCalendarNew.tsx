import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useGetRoomMatrixQuery, type RoomMatrixResponse, type RoomMatrixSchedule } from "../services/bookingApi";
import { useAppSelector } from "../store/hooks";

const localDateString = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const shiftDate = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localDateString(date);
};

const startOfWeek = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  const daysSinceMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - daysSinceMonday);
  return localDateString(date);
};

const formatDate = (value: string, language: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString(language.toLowerCase().startsWith("en") ? "en-US" : "vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const getScheduleStatusForDate = (schedule: RoomMatrixSchedule, date: string) => {
  const roomStatus = schedule.roomStatus?.toUpperCase();
  if (roomStatus === "CANCELLED") return undefined;
  const isInHouse = roomStatus
    ? roomStatus === "CHECKED_IN" || roomStatus === "CHECKED_OUT"
    : schedule.bookingStatus?.toUpperCase() === "IN_HOUSE";

  const checkIn = schedule.checkinTime?.slice(0, 10);
  const checkOut = schedule.checkoutTime?.slice(0, 10);
  if (checkOut && date === checkOut) return "CHECK_OUT";
  if (checkIn && checkOut && date >= checkIn && date < checkOut) {
    return isInHouse ? "IN_HOUSE" : "WAITING";
  }
  if (schedule.occupiedDates?.some((occupiedDate) => occupiedDate.slice(0, 10) === date)) {
    return isInHouse ? "IN_HOUSE" : "WAITING";
  }
  return undefined;
};

const scheduleStatusStyle: Record<string, string> = {
  CHECK_OUT: "bg-amber-100 text-amber-900",
  IN_HOUSE: "bg-emerald-50 text-emerald-800",
  WAITING: "bg-blue-50 text-blue-800",
};

export default function OverviewCalendarNew() {
  const { t, i18n } = useTranslation();
  const hotelId = useAppSelector((state) => state.auth.hotelId);
  const [selectedDate, setSelectedDate] = useState(() => localDateString(new Date()));
  const dateInput = useRef<HTMLInputElement>(null);
  const weekStart = startOfWeek(selectedDate);
  const weekEnd = shiftDate(weekStart, 6);
  const { currentData: rooms, isFetching, isError } = useGetRoomMatrixQuery(
    { startDate: weekStart, endDate: weekEnd },
    { skip: !hotelId },
  );
  const days = useMemo(() => {
    const labels = ["monShort", "tueShort", "wedShort", "thuShort", "friShort", "satShort", "sunShort"];
    return Array.from({ length: 7 }, (_, index) => {
      const date = shiftDate(weekStart, index);
      return {
        date,
        number: new Date(`${date}T00:00:00`).getDate(),
        label: t(`calendar.${labels[index]}`),
      };
    });
  }, [weekStart, t]);
  const bookedRooms = useMemo(
    () => rooms?.filter((room) => room.schedules?.some((schedule) => days.some((day) => getScheduleStatusForDate(schedule, day.date)))) ?? [],
    [rooms, days],
  );
  const bookingMarkers = useMemo(() => {
    const bookings = new Map<string, string>();
    rooms?.forEach((room) => {
      room.schedules?.forEach((schedule) => {
        if (schedule.bookingId && days.some((day) => getScheduleStatusForDate(schedule, day.date))) {
          const bookingId = String(schedule.bookingId);
          const checkIn = schedule.checkinTime?.slice(0, 10) ?? "";
          const current = bookings.get(bookingId);
          if (current === undefined || checkIn < current) bookings.set(bookingId, checkIn);
        }
      });
    });
    return new Map(
      [...bookings.entries()]
        .sort(([bookingIdA, dateA], [bookingIdB, dateB]) => dateA.localeCompare(dateB) || bookingIdA.localeCompare(bookingIdB))
        .map(([bookingId], index) => [bookingId, `#${index + 1}`]),
    );
  }, [rooms, days]);
  const openDatePicker = () => {
    dateInput.current?.showPicker?.();
    dateInput.current?.click();
  };

  return (
    <section className="mt-7 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays size={17} className="text-blue-600" />
            <h3 className="font-bold text-slate-900">{t("calendar.title")}</h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">{t("calendar.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={t("calendar.previousWeek", "Tuần trước")}
            onClick={() => setSelectedDate((date) => shiftDate(date, -7))}
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={openDatePicker}
            className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-700"
          >
            <CalendarDays size={14} className="text-blue-600" />
            {formatDate(selectedDate, i18n.language)}
          </button>
          <input
            ref={dateInput}
            type="date"
            value={selectedDate}
            onChange={(event) => event.target.value && setSelectedDate(event.target.value)}
            aria-label={t("calendar.chooseDate", "Chọn ngày")}
            className="pointer-events-none absolute h-0 w-0 opacity-0"
            tabIndex={-1}
          />
          <button
            type="button"
            aria-label={t("calendar.nextWeek", "Tuần sau")}
            onClick={() => setSelectedDate((date) => shiftDate(date, 7))}
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {!hotelId ? (
        <p className="p-5 text-sm text-amber-700">{t("calendar.branchUnavailable", "Chưa xác định được chi nhánh.")}</p>
      ) : isError ? (
        <p className="p-5 text-sm text-rose-700">{t("calendar.loadError", "Không tải được lịch đặt phòng. Vui lòng thử lại.")}</p>
      ) : isFetching && !rooms ? (
        <p className="p-5 text-sm text-slate-500">{t("common.loading", "Đang tải lịch đặt phòng...")}</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-slate-100 px-5 py-3 text-xs text-slate-600">
              <span className="font-semibold text-slate-500">{t("calendar.legend", "Chú thích")}:</span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-blue-100" />
                {t("calendar.waitingCheckIn", "Đã đặt · chờ check-in")}
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-emerald-100" />
                {t("calendar.inHouse", "Đang lưu trú")}
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-amber-200" />
                {t("calendar.checkOut", "Ngày check-out")}
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-bold text-white">#1</span>
                {t("calendar.sameBookingMarker", "Cùng mã = cùng một booking")}
              </span>
            </div>
            <div className="grid grid-cols-[175px_repeat(7,minmax(90px,1fr))] border-b border-slate-100 bg-slate-50">
              <div className="p-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("calendar.room")}</div>
              {days.map((day) => (
                <div key={day.date} className={`border-l border-slate-100 p-3 text-center ${day.date === selectedDate ? "bg-blue-50" : ""}`}>
                  <p className="text-[10px] font-bold uppercase text-slate-400">{day.label}</p>
                  <p className={`mt-1 text-sm font-bold ${day.date === selectedDate ? "text-blue-700" : "text-slate-700"}`}>{day.number}</p>
                </div>
              ))}
            </div>
            {bookedRooms.map((room) => (
              <div key={room.roomId ?? room.roomNumber} className="grid min-h-[74px] grid-cols-[175px_repeat(7,minmax(90px,1fr))] border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-2.5 px-4">
                  <span className="grid h-8 min-w-8 place-items-center rounded-lg bg-slate-100 px-1 text-[10px] font-bold text-slate-600">
                    {room.roomNumber ?? "—"}
                  </span>
                  <span className="min-w-0">
                    <b className="block truncate text-xs text-slate-800">{room.roomTypeName ?? t("calendar.unknownRoomType", "Chưa rõ loại phòng")}</b>
                    <small className="text-[10px] text-slate-400">{room.schedules?.length ?? 0} {t("calendar.bookingCount", "đặt phòng")}</small>
                  </span>
                </div>
                {days.map((day) => {
                  const entry = room.schedules
                    ?.map((schedule) => ({ schedule, status: getScheduleStatusForDate(schedule, day.date) }))
                    .find((item) => item.status === "CHECK_OUT")
                    ?? room.schedules
                      ?.map((schedule) => ({ schedule, status: getScheduleStatusForDate(schedule, day.date) }))
                      .find((item) => item.status);
                  const schedule = entry?.schedule;
                  const status = entry?.status;
                  const bookingMarker = schedule?.bookingId ? bookingMarkers.get(String(schedule.bookingId)) : undefined;
                  return (
                    <div key={day.date} className={`border-l border-slate-100 p-1.5 ${day.date === selectedDate ? "bg-blue-50/30" : ""}`}>
                      {schedule && status ? (
                        <div
                          title={`${bookingMarker ? `${t("calendar.bookingMarker", "Booking")} ${bookingMarker} · ` : ""}${schedule.customerName ?? t("calendar.guestNotProvided", "Chưa có tên khách")} · ${schedule.bookingId ?? ""}`}
                          className={`flex h-full min-h-12 flex-col justify-center rounded-lg px-2 py-1 text-[10px] font-semibold ${scheduleStatusStyle[status]}`}
                        >
                          <span className="flex min-w-0 items-center gap-1">
                            {bookingMarker && <span className="shrink-0 rounded bg-slate-700 px-1 py-0.5 text-[9px] leading-none text-white">{bookingMarker}</span>}
                            <span className="truncate">{schedule.customerName ?? t("calendar.guestNotProvided", "Chưa có tên khách")}</span>
                          </span>
                          <span className="mt-0.5 truncate opacity-75">
                            {status === "CHECK_OUT"
                              ? t("calendar.checkOut", "Check-out")
                              : status === "IN_HOUSE"
                                ? t("calendar.inHouse", "Đang lưu trú")
                                : t("calendar.waitingCheckIn", "Chờ check-in")}
                          </span>
                        </div>
                      ) : (
                        <div className="h-full min-h-12 rounded-lg bg-emerald-50/50" />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {!bookedRooms.length && !isFetching && (
              <p className="p-6 text-center text-sm text-slate-500">{t("calendar.noBookingsThisWeek", "Không có phòng nào được đặt trong tuần này.")}</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
