import { useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, LoaderCircle, Wrench } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  useCreateHotelClosureMutation,
  useGetAffectedClosureBookingsQuery,
  useGetHotelClosuresQuery,
  useResolveClosureBookingMutation,
} from "../services/hotelClosureApi";
import { useGetSuperAdminBranchesQuery } from "../services/superAdminApi";
import { useAppSelector } from "../store/hooks";

const responseMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: { message?: string } }).data;
    if (data?.message) return data.message;
  }
  return fallback;
};

const isCheckedIn = (status: string | null) => status === "CHECKED_IN";

const formatClosureDate = (date: string) => {
  const [year, month, day] = date.split("-");
  return year && month && day ? `${day}/${month}/${year}` : date;
};

export default function HotelClosureWorkspace() {
  const { roles } = useAppSelector((state) => state.auth);
  const isSuperAdmin = roles.includes("ROLE_SUPER_ADMIN");
  const [selectedId, setSelectedId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [allHotels, setAllHotels] = useState(true);
  const [selectedHotelIds, setSelectedHotelIds] = useState<number[]>([]);
  const { data: schedulesResponse, isLoading, error } = useGetHotelClosuresQuery();
  const schedules = schedulesResponse?.result ?? [];
  const currentScheduleId = schedules.some((schedule) => schedule.id === selectedId)
    ? selectedId
    : schedules[0]?.id ?? "";
  const { data: branches = [] } = useGetSuperAdminBranchesQuery(undefined, {
    skip: !isSuperAdmin,
  });
  const {
    data: affectedResponse,
    isLoading: isLoadingAffected,
  } = useGetAffectedClosureBookingsQuery(currentScheduleId, {
    skip: isSuperAdmin || !currentScheduleId,
  });
  const [createClosure, createState] = useCreateHotelClosureMutation();
  const [resolveBooking, resolveState] = useResolveClosureBookingMutation();
  const affectedBookings = affectedResponse?.result ?? [];
  const selectedSchedule = useMemo(
    () => schedules.find((schedule) => schedule.id === currentScheduleId),
    [currentScheduleId, schedules],
  );
  const getScheduleBranchNames = (hotelIds: number[]) => hotelIds.map((hotelId) => (
    branches.find((branch) => branch.id === hotelId)?.name ?? `Chi nhánh #${hotelId}`
  ));

  const toggleHotel = (hotelId: number) => {
    setSelectedHotelIds((current) => current.includes(hotelId)
      ? current.filter((id) => id !== hotelId)
      : [...current, hotelId]);
  };

  const submitSchedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const response = await createClosure({
        title: title.trim(),
        description: description.trim(),
        startDate,
        endDate,
        allHotels,
        hotelIds: allHotels ? [] : selectedHotelIds,
      }).unwrap();
      toast({ title: "Đã tạo lịch tạm đóng", description: response.message });
      setTitle("");
      setDescription("");
      setStartDate("");
      setEndDate("");
      setSelectedHotelIds([]);
      setSelectedId(response.result.id);
    } catch (submitError) {
      toast({
        title: "Không thể tạo lịch",
        description: responseMessage(submitError, "Vui lòng kiểm tra thông tin và thử lại."),
        variant: "destructive",
      });
    }
  };

  const handleResolution = async (
    bookingId: string,
    action: "CANCEL_FULL_REFUND" | "EARLY_CHECKOUT",
    detailIds: string[] = [],
  ) => {
    if (!selectedSchedule) return;
    const confirmation = action === "CANCEL_FULL_REFUND"
      ? "Xác nhận hủy booking do khách sạn sửa chữa? Khoản khách đã thanh toán sẽ được hoàn đủ, không áp dụng phí phạt."
      : "Xác nhận checkout sớm các phòng đang lưu trú bị ảnh hưởng? Hệ thống sẽ tính tiền phòng theo các đêm đã sử dụng.";
    if (!window.confirm(confirmation)) return;
    try {
      const data = action === "CANCEL_FULL_REFUND"
        ? {
            action,
            cancellation: {
              reason: `Hủy do khách sạn tạm đóng: ${selectedSchedule.title}`,
              refundMethod: "BANK" as const,
            },
          }
        : {
            action,
            checkout: {
              bookingDetailIds: detailIds,
              surplusRefundMethod: "BANK" as const,
              refundNote: `Hoàn tiền đêm chưa sử dụng do khách sạn tạm đóng: ${selectedSchedule.title}`,
            },
          };
      const response = await resolveBooking({
        scheduleId: selectedSchedule.id,
        bookingId,
        data,
      }).unwrap();
      toast({ title: "Đã ghi nhận xử lý booking", description: response.message });
    } catch (resolveError) {
      toast({
        title: "Không thể xử lý booking",
        description: responseMessage(resolveError, "Vui lòng thử lại hoặc kiểm tra quyền chi nhánh."),
        variant: "destructive",
      });
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
            <Wrench size={21} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Lịch tạm đóng / sửa chữa</h1>
            <p className="mt-1 text-sm text-slate-600">
              Super Admin thông báo lịch; quản lý và nhân viên chi nhánh liên hệ khách, xử lý booking.
            </p>
          </div>
        </header>

        {isSuperAdmin && (
          <form onSubmit={submitSchedule} className="mb-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
            <div className="md:col-span-2">
              <h2 className="font-bold text-slate-900">Tạo và thông báo lịch</h2>
              <p className="mt-1 text-sm text-slate-500">Thông báo được lưu trong hệ thống và gửi đến nhân viên của các chi nhánh được chọn.</p>
            </div>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Tiêu đề
              <input required maxLength={150} value={title} onChange={(event) => setTitle(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Mô tả
              <input maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Ngày bắt đầu
              <input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Ngày kết thúc (bao gồm ngày này)
              <input required type="date" min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 md:col-span-2">
              <input type="checkbox" checked={allHotels} onChange={(event) => setAllHotels(event.target.checked)} />
              Áp dụng cho toàn hệ thống
            </label>
            {!allHotels && (
              <fieldset className="grid gap-2 md:col-span-2">
                <legend className="text-sm font-semibold text-slate-700">Chi nhánh nhận thông báo</legend>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {branches.map((branch) => (
                    <label key={branch.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm">
                      <input type="checkbox" checked={selectedHotelIds.includes(branch.id)} onChange={() => toggleHotel(branch.id)} />
                      {branch.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="md:col-span-2">
              <button disabled={createState.isLoading || (!allHotels && selectedHotelIds.length === 0)} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {createState.isLoading && <LoaderCircle className="animate-spin" size={16} />}
                Tạo và gửi thông báo
              </button>
            </div>
          </form>
        )}

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays size={18} className="text-blue-700" />
            <h2 className="font-bold text-slate-900">Lịch đã thông báo</h2>
          </div>
          {isLoading ? (
            <p className="text-sm text-slate-500">Đang tải lịch...</p>
          ) : error ? (
            <p className="text-sm text-red-600">Không thể tải lịch tạm đóng.</p>
          ) : schedules.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có lịch tạm đóng nào.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {schedules.map((schedule) => (
                <button
                  type="button"
                  key={schedule.id}
                  onClick={() => setSelectedId(schedule.id)}
                  className={`rounded-xl border p-4 text-left transition ${
                    currentScheduleId === schedule.id
                      ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span className="block border-b border-slate-200/80 pb-3">
                    <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Tiêu đề</span>
                    <span className="mt-1 block font-semibold text-slate-900">{schedule.title}</span>
                  </span>
                  <span className="grid gap-3 border-b border-slate-200/80 py-3 sm:grid-cols-2">
                    <span>
                      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Thời gian bắt đầu</span>
                      <span className="mt-1 block text-sm text-slate-700">{formatClosureDate(schedule.startDate)}</span>
                    </span>
                    <span>
                      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Thời gian kết thúc</span>
                      <span className="mt-1 block text-sm text-slate-700">{formatClosureDate(schedule.endDate)}</span>
                    </span>
                  </span>
                  {isSuperAdmin && (
                    <span className="pt-3">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Chi nhánh áp dụng</span>
                      <span className="mt-1 block text-sm text-slate-700">
                        {schedule.allHotels
                          ? "Toàn hệ thống"
                          : getScheduleBranchNames(schedule.hotelIds).join(", ") || "Không xác định chi nhánh"}
                      </span>
                    </span>
                  )}
                  {schedule.description && (
                    <span className="mt-3 block border-t border-slate-200/80 pt-3 text-sm text-slate-600">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Mô tả</span>
                      <span className="mt-1 block">{schedule.description}</span>
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        {!isSuperAdmin && selectedSchedule && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="font-bold text-slate-900">Booking cần liên hệ</h2>
              <p className="mt-1 text-sm text-slate-500">
                Chỉ quản lý hoặc nhân viên chi nhánh có thể chọn một trong hai hướng xử lý.
              </p>
            </div>
            {isLoadingAffected ? (
              <p className="text-sm text-slate-500">Đang tìm booking bị ảnh hưởng...</p>
            ) : affectedBookings.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                <CheckCircle2 size={17} /> Không còn booking cần xử lý cho lịch này.
              </div>
            ) : (
              <div className="space-y-3">
                {affectedBookings.map((booking) => {
                  const checkedInDetails = booking.roomStays
                    .filter((stay) => isCheckedIn(stay.status))
                    .map((stay) => stay.bookingDetailId);
                  const hasCheckedInRooms = checkedInDetails.length > 0;
                  const resolved = Boolean(booking.resolutionAction);
                  return (
                    <article key={booking.bookingId} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{booking.guestName} · {booking.bookingId}</p>
                          <p className="mt-1 text-xs text-slate-500">Trạng thái: {booking.bookingStatus}</p>
                          <ul className="mt-2 space-y-1 text-sm text-slate-600">
                            {booking.roomStays.map((stay) => (
                              <li key={stay.bookingDetailId}>
                                Phòng {stay.roomNumber ?? "—"}: {stay.checkinDate ?? "—"} đến {stay.checkoutDate ?? "—"} ({stay.status ?? "—"})
                              </li>
                            ))}
                          </ul>
                          {resolved && (
                            <p className="mt-2 text-sm font-medium text-emerald-700">
                              Đã xử lý: {booking.resolutionAction === "CANCEL_FULL_REFUND" ? "Hủy và hoàn đủ" : "Checkout sớm"}
                            </p>
                          )}
                        </div>
                        {!resolved && (
                          <div className="flex flex-wrap gap-2">
                            {["PENDING", "CONFIRMED"].includes(booking.bookingStatus) && !hasCheckedInRooms && (
                              <button
                                type="button"
                                disabled={resolveState.isLoading}
                                onClick={() => void handleResolution(booking.bookingId, "CANCEL_FULL_REFUND")}
                                className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                              >
                                Hủy · hoàn đủ
                              </button>
                            )}
                            {booking.bookingStatus === "IN_HOUSE" && hasCheckedInRooms && (
                              <button
                                type="button"
                                disabled={resolveState.isLoading}
                                onClick={() => void handleResolution(booking.bookingId, "EARLY_CHECKOUT", checkedInDetails)}
                                className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                              >
                                Checkout sớm · hoàn đêm chưa dùng
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {!resolved && booking.bookingStatus === "IN_HOUSE" && !hasCheckedInRooms && (
                        <p className="mt-3 flex items-center gap-2 text-sm text-amber-800">
                          <AlertTriangle size={16} /> Cần kiểm tra trạng thái từng phòng với khách sạn.
                        </p>
                      )}
                      {!resolved && booking.bookingStatus === "CONFIRMED" && hasCheckedInRooms && (
                        <p className="mt-3 flex items-center gap-2 text-sm text-amber-800">
                          <AlertTriangle size={16} /> Booking check-in chưa hoàn tất; hãy hoàn tất check-in các phòng bị ảnh hưởng trước khi xử lý checkout sớm.
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
