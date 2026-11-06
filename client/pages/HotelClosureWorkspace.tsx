import { useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, LoaderCircle, Wrench } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const [pendingResolution, setPendingResolution] = useState<{
    bookingId: string;
    action: "CANCEL_FULL_REFUND" | "EARLY_CHECKOUT";
    detailIds: string[];
    refundMethod: "CASH" | "BANK" | null;
    refundAmount: number | undefined;
    roomRefundAmount: number | undefined;
    serviceRefundAmount: number | undefined;
    roomPenaltyAmount: number | undefined;
    refundPolicy: string | undefined;
    cashRefundConfirmed: boolean;
    originalRoomAmount: number | undefined;
    originalRoomNights: number | undefined;
    usedRoomNights: number | undefined;
    roomAmountAfterCheckout: number | undefined;
    earlyCheckInFeeAmount: number | undefined;
    bookingTotalAmount: number | undefined;
    paidAmount: number | undefined;
    projectedTotalAmount: number | undefined;
    unpaidBeforeCheckoutAmount: number | undefined;
    outstandingAmount: number | undefined;
    services: {
      roomNumber: string;
      name: string;
      quantity: number;
      usedQuantity: number;
      refundableQuantity: number;
      refundableAmount: number;
    }[];
  } | null>(null);
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
  const conflictingSchedules = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return [];
    return schedules.filter((schedule) => {
      if (schedule.active === false) return false;
      const datesOverlap = schedule.startDate <= endDate && schedule.endDate >= startDate;
      if (!datesOverlap) return false;
      if (allHotels || schedule.allHotels) return true;
      return schedule.hotelIds.some((hotelId) => selectedHotelIds.includes(hotelId));
    });
  }, [allHotels, endDate, schedules, selectedHotelIds, startDate]);
  const getScheduleBranchNames = (hotelIds: number[]) => hotelIds.map((hotelId) => (
    branches.find((branch) => branch.id === hotelId)?.name ?? `Chi nhánh #${hotelId}`
  ));
  const formatMoney = (amount: number) => new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
  const pendingRefundAmount = typeof pendingResolution?.refundAmount === "number"
    && Number.isFinite(pendingResolution.refundAmount)
    ? pendingResolution.refundAmount
    : null;
  const pendingRefundMissing = pendingRefundAmount === null;
  const pendingHasRefund = pendingRefundAmount !== null && pendingRefundAmount > 0;
  const cashConfirmationMissing = pendingHasRefund
    && pendingResolution?.refundMethod === "CASH"
    && !pendingResolution.cashRefundConfirmed;
  const pendingOutstandingAmount = typeof pendingResolution?.outstandingAmount === "number"
    && Number.isFinite(pendingResolution.outstandingAmount)
    ? pendingResolution.outstandingAmount
    : null;
  const paymentRequired = pendingResolution?.action === "EARLY_CHECKOUT"
    && pendingOutstandingAmount !== null
    && pendingOutstandingAmount > 0;

  const toggleHotel = (hotelId: number) => {
    setSelectedHotelIds((current) => current.includes(hotelId)
      ? current.filter((id) => id !== hotelId)
      : [...current, hotelId]);
  };

  const submitSchedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (conflictingSchedules.length > 0) {
      const conflict = conflictingSchedules[0];
      toast({
        title: "Lịch tạm đóng bị trùng ngày",
        description: `"${conflict.title}" (${formatClosureDate(conflict.startDate)} - ${formatClosureDate(conflict.endDate)}) đã áp dụng cho ít nhất một chi nhánh được chọn.`,
        variant: "destructive",
      });
      return;
    }
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
    refundMethod: "CASH" | "BANK",
    detailIds: string[] = [],
    refundDetails?: {
      amount: number;
      roomAmount: number;
      serviceAmount: number;
      roomPenaltyAmount: number;
      refundPolicy: string;
      cashRefundConfirmed: boolean;
    },
  ) => {
    if (!selectedSchedule) return;
    try {
      const data = action === "CANCEL_FULL_REFUND"
        ? {
            action,
            cancellation: {
              reason: `Hủy do khách sạn tạm đóng: ${selectedSchedule.title}`,
              refundMethod,
              ...(refundDetails ? {
                cashRefundConfirmed: refundDetails.cashRefundConfirmed,
                confirmedRefundAmount: refundDetails.amount,
                confirmedRoomRefundAmount: refundDetails.roomAmount,
                confirmedServiceRefundAmount: refundDetails.serviceAmount,
                confirmedRoomPenaltyAmount: refundDetails.roomPenaltyAmount,
                confirmedRefundPolicy: refundDetails.refundPolicy,
              } : {}),
            },
          }
        : {
            action,
            checkout: {
              bookingDetailIds: detailIds,
              surplusRefundMethod: refundMethod,
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
      <AlertDialog
        open={pendingResolution !== null}
        onOpenChange={(open) => {
          if (!open) setPendingResolution(null);
        }}
      >
        <AlertDialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-slate-200">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingResolution?.action === "CANCEL_FULL_REFUND"
                ? "Xác nhận hủy và hoàn tiền"
                : "Xác nhận checkout sớm"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingResolution?.action === "CANCEL_FULL_REFUND"
                ? "Hủy booking do khách sạn sửa chữa? Khoản khách đã thanh toán sẽ được hoàn đủ, không áp dụng phí phạt."
                : "Checkout sớm các phòng đang lưu trú bị ảnh hưởng? Hệ thống sẽ tính tiền phòng theo các đêm đã sử dụng."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingResolution?.action === "CANCEL_FULL_REFUND" && (
          <div className={`rounded-xl border p-4 ${
            pendingRefundMissing ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50"
          }`}>
            <p className="text-sm font-semibold text-slate-800">
              {pendingRefundMissing
                ? "Chưa tải được số tiền hoàn dự kiến."
                : "Số tiền dự kiến hoàn"}
            </p>
            {!pendingRefundMissing && (
              <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-blue-900">
                {formatMoney(pendingRefundAmount)}
              </p>
            )}
            {!pendingRefundMissing && (
              <p className="mt-1 text-xs text-slate-600">
                Tiền phòng {formatMoney(pendingResolution.roomRefundAmount ?? 0)}
                {" · "}dịch vụ {formatMoney(pendingResolution.serviceRefundAmount ?? 0)}
                {" · "}phạt {formatMoney(pendingResolution.roomPenaltyAmount ?? 0)}
              </p>
            )}
            {pendingRefundMissing && (
              <p className="mt-1 text-xs text-amber-800">
                Không xác nhận được khi chưa có số tiền từ máy chủ. Hãy tải lại lịch hoặc thử lại sau.
              </p>
            )}
          </div>
          )}
          {pendingResolution?.action === "EARLY_CHECKOUT" && (
            <>
              <section className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <h3 className="text-sm font-semibold text-amber-950">Thanh toán booking trước checkout</h3>
                <dl className="mt-2 space-y-0 text-sm">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 border-b border-amber-200/70 py-2">
                    <dt className="text-xs leading-5 text-amber-900 sm:text-sm">Tổng tiền booking dự kiến</dt>
                    <dd className="whitespace-nowrap text-right font-semibold tabular-nums text-slate-900">
                      {pendingResolution.bookingTotalAmount === undefined
                        ? "—"
                        : formatMoney(pendingResolution.bookingTotalAmount)}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 border-b border-amber-200/70 py-2">
                    <dt className="text-xs leading-5 text-amber-900 sm:text-sm">Khách đã thanh toán</dt>
                    <dd className="whitespace-nowrap text-right font-semibold tabular-nums text-emerald-800">
                      {pendingResolution.paidAmount === undefined
                        ? "—"
                        : formatMoney(pendingResolution.paidAmount)}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 rounded-lg bg-amber-100/70 px-2 py-2">
                    <dt className="text-xs font-bold leading-5 text-amber-950 sm:text-sm">
                      Khách chưa thanh toán
                    </dt>
                    <dd className="whitespace-nowrap text-right font-bold tabular-nums text-amber-900">
                      {pendingResolution.unpaidBeforeCheckoutAmount === undefined
                        ? "—"
                        : formatMoney(pendingResolution.unpaidBeforeCheckoutAmount)}
                    </dd>
                  </div>
                </dl>
              </section>
              <section className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <h3 className="text-sm font-semibold text-amber-950">Dịch vụ của các phòng checkout</h3>
                {pendingResolution.services.length === 0 ? (
                  <p className="mt-1 text-xs text-amber-900">Không có dịch vụ phát sinh cho các phòng bị ảnh hưởng.</p>
                ) : (
                  <ul className="mt-2 space-y-2 text-xs text-amber-950">
                    {pendingResolution.services.map((service, index) => (
                      <li key={`${service.roomNumber}-${service.name}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3">
                        <span className="leading-5">
                          Phòng {service.roomNumber} · {service.name} × {service.quantity}
                          {" · "}đã dùng {service.usedQuantity}
                          {service.refundableQuantity > 0
                            ? ` · hoàn ${service.refundableQuantity} chưa dùng`
                            : " · đã sử dụng"}
                        </span>
                        <strong className="whitespace-nowrap text-right tabular-nums">{formatMoney(service.refundableAmount)}</strong>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-xs text-amber-900">
                  Dịch vụ chưa dùng sẽ được hủy khi checkout và giá trị này được tính vào kết quả đối soát bên dưới.
                </p>
              </section>
              <section className="rounded-xl border border-slate-200 bg-white p-3">
                <h3 className="text-sm font-semibold text-slate-900">Đối soát checkout sớm</h3>
                <dl className="mt-3 space-y-0 text-sm">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 border-b border-slate-100 py-2">
                    <dt className="text-xs leading-5 text-slate-600 sm:text-sm">
                      Tiền phòng ban đầu của phòng checkout ({pendingResolution.originalRoomNights ?? "—"} đêm)
                    </dt>
                    <dd className="whitespace-nowrap text-right font-semibold tabular-nums text-slate-900">
                      {pendingResolution.originalRoomAmount === undefined
                        ? "—"
                        : formatMoney(pendingResolution.originalRoomAmount)}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 border-b border-slate-100 py-2">
                    <dt className="text-xs leading-5 text-slate-600 sm:text-sm">Số đêm tính đã ở</dt>
                    <dd className="whitespace-nowrap text-right font-semibold tabular-nums text-slate-900">
                      {pendingResolution.usedRoomNights === undefined || pendingResolution.originalRoomNights === undefined
                        ? "—"
                        : `${pendingResolution.usedRoomNights} / ${pendingResolution.originalRoomNights} đêm`}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 border-b border-slate-100 py-2">
                    <dt className="text-xs leading-5 text-slate-600 sm:text-sm">Tiền phòng sau checkout sớm</dt>
                    <dd className="whitespace-nowrap text-right font-semibold tabular-nums text-slate-900">
                      {pendingResolution.roomAmountAfterCheckout === undefined
                        ? "—"
                        : formatMoney(pendingResolution.roomAmountAfterCheckout)}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 border-b border-slate-100 py-2">
                    <dt className="text-xs leading-5 text-slate-600 sm:text-sm">Phí check-in sớm</dt>
                    <dd className="whitespace-nowrap text-right font-semibold tabular-nums text-slate-900">
                      {pendingResolution.earlyCheckInFeeAmount === undefined
                        ? "—"
                        : formatMoney(pendingResolution.earlyCheckInFeeAmount)}
                    </dd>
                  </div>
                  <div className={`-mx-1 mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 rounded-lg px-2 py-2 ${
                    paymentRequired ? "bg-rose-50" : "bg-emerald-50"
                  }`}>
                    <dt className={`text-xs font-bold leading-5 sm:text-sm ${
                      paymentRequired ? "text-rose-800" : "text-emerald-800"
                    }`}>
                      Còn phải thu sau khi tính lại
                    </dt>
                    <dd className={`whitespace-nowrap text-right font-bold tabular-nums ${
                      paymentRequired ? "text-rose-800" : "text-emerald-800"
                    }`}>
                      {pendingOutstandingAmount === null ? "—" : formatMoney(pendingOutstandingAmount)}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 border-t border-slate-200 py-2">
                    <dt className="text-xs font-bold leading-5 text-slate-800 sm:text-sm">
                      Tổng chi phí sau checkout sớm
                    </dt>
                    <dd className="whitespace-nowrap text-right text-base font-bold tabular-nums text-slate-900">
                      {pendingResolution.projectedTotalAmount === undefined
                        ? "—"
                        : formatMoney(pendingResolution.projectedTotalAmount)}
                    </dd>
                  </div>
                </dl>
                {paymentRequired && (
                  <p className="mt-2 rounded-lg bg-rose-50 p-2 text-xs font-medium text-rose-800">
                    Cần thu khoản còn nợ này trước khi xác nhận checkout.
                  </p>
                )}
                <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">
                    Tổng kết đối soát
                  </p>
                  <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3">
                    <span className="text-sm font-semibold text-blue-950">
                      {pendingOutstandingAmount !== null && pendingOutstandingAmount > 0
                        ? "Khách cần thanh toán thêm"
                        : "Số tiền hoàn lại khách"}
                    </span>
                    <strong className="whitespace-nowrap text-right text-lg font-bold tabular-nums text-blue-950">
                      {pendingRefundMissing
                        ? "—"
                        : pendingOutstandingAmount !== null && pendingOutstandingAmount > 0
                          ? formatMoney(pendingOutstandingAmount)
                          : formatMoney(pendingRefundAmount)}
                    </strong>
                  </div>
                  <p className="mt-2 border-t border-blue-200 pt-2 text-xs leading-5 text-blue-900">
                    {pendingRefundMissing
                      || pendingResolution.paidAmount === undefined
                      || pendingResolution.projectedTotalAmount === undefined
                      ? "Chưa đủ dữ liệu để giải thích phép tính."
                      : pendingOutstandingAmount !== null && pendingOutstandingAmount > 0
                        ? `${formatMoney(pendingResolution.projectedTotalAmount)} chi phí sau checkout − ${formatMoney(pendingResolution.paidAmount)} đã thanh toán = ${formatMoney(pendingOutstandingAmount)} cần thu thêm.`
                        : `${formatMoney(pendingResolution.paidAmount)} đã thanh toán − ${formatMoney(pendingResolution.projectedTotalAmount)} chi phí sau checkout = ${formatMoney(pendingRefundAmount)} hoàn lại.`}
                  </p>
                </div>
              </section>
            </>
          )}
          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold text-slate-800">Phương thức hoàn tiền</legend>
            <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm text-slate-700 ${
              pendingResolution?.refundMethod === "CASH" ? "border-emerald-400 bg-emerald-50" : "border-slate-200"
            }`}>
              <input
                type="radio"
                name="closure-refund-method"
                checked={pendingResolution?.refundMethod === "CASH"}
                onChange={() => setPendingResolution((current) => current
                  ? { ...current, refundMethod: "CASH" }
                  : current)}
                className="accent-emerald-600"
              />
              <span>
                <span className="block font-semibold text-slate-800">Tiền mặt tại khách sạn</span>
                <span className="mt-0.5 block text-xs text-slate-500">Hoàn trực tiếp cho khách tại quầy.</span>
              </span>
            </label>
            <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm text-slate-700 ${
              pendingResolution?.refundMethod === "BANK" ? "border-blue-400 bg-blue-50" : "border-slate-200"
            }`}>
              <input
                type="radio"
                name="closure-refund-method"
                checked={pendingResolution?.refundMethod === "BANK"}
                onChange={() => setPendingResolution((current) => current
                  ? { ...current, refundMethod: "BANK" }
                  : current)}
                className="accent-blue-600"
              />
              <span>
                <span className="block font-semibold text-slate-800">Chuyển khoản ngân hàng</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Chuyển vào tài khoản khách; nếu thiếu thông tin, bổ sung tại mục Phê duyệt hoàn tiền.
                </span>
              </span>
            </label>
          </fieldset>
          {pendingHasRefund && pendingResolution?.refundMethod === "CASH" && (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
              <input
                type="checkbox"
                checked={pendingResolution.cashRefundConfirmed}
                onChange={(event) => setPendingResolution((current) => current
                  ? { ...current, cashRefundConfirmed: event.target.checked }
                  : current)}
                className="mt-0.5 accent-emerald-600"
              />
              <span>
                Xác nhận đã giao đúng số tiền {formatMoney(pendingRefundAmount)} cho khách.
              </span>
            </label>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Quay lại</AlertDialogCancel>
            <AlertDialogAction
              disabled={resolveState.isLoading || pendingRefundMissing
                || paymentRequired
                || (pendingHasRefund && !pendingResolution?.refundMethod)
                || cashConfirmationMissing}
              onClick={() => {
                if (pendingResolution && !pendingRefundMissing
                  && (!pendingHasRefund || pendingResolution.refundMethod)) {
                  void handleResolution(
                    pendingResolution.bookingId,
                    pendingResolution.action,
                    pendingResolution.refundMethod ?? "BANK",
                    pendingResolution.detailIds,
                    pendingResolution.action === "CANCEL_FULL_REFUND"
                      ? {
                          amount: pendingResolution.refundAmount ?? 0,
                          roomAmount: pendingResolution.roomRefundAmount ?? 0,
                          serviceAmount: pendingResolution.serviceRefundAmount ?? 0,
                          roomPenaltyAmount: pendingResolution.roomPenaltyAmount ?? 0,
                          refundPolicy: pendingResolution.refundPolicy ?? "",
                          cashRefundConfirmed: pendingResolution.cashRefundConfirmed,
                        }
                      : undefined,
                  );
                }
              }}
              className={pendingResolution?.action === "CANCEL_FULL_REFUND"
                ? "bg-rose-700 text-white hover:bg-rose-800"
                : "bg-amber-600 text-white hover:bg-amber-700"}
            >
              {resolveState.isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              {pendingResolution?.action === "CANCEL_FULL_REFUND" ? "Hủy và hoàn đủ" : "Checkout sớm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
            {conflictingSchedules.length > 0 && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 md:col-span-2" role="alert">
                Không thể tạo lịch trùng ngày: “{conflictingSchedules[0].title}”
                {" "}({formatClosureDate(conflictingSchedules[0].startDate)} - {formatClosureDate(conflictingSchedules[0].endDate)})
                {" "}đã áp dụng cho ít nhất một chi nhánh được chọn. Vui lòng chọn ngày khác hoặc thay đổi chi nhánh.
              </p>
            )}
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
              <button disabled={createState.isLoading || conflictingSchedules.length > 0 || (!allHotels && selectedHotelIds.length === 0)} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
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
              <h2 className="flex items-center gap-2 font-bold text-slate-900">
                Booking cần liên hệ
                {!isLoadingAffected && (
                  <span
                    aria-label={`${affectedBookings.length} booking`}
                    className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-100 px-2 text-xs font-bold text-blue-800"
                  >
                    {affectedBookings.length}
                  </span>
                )}
              </h2>
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
                                onClick={() => setPendingResolution({
                                  bookingId: booking.bookingId,
                                  action: "CANCEL_FULL_REFUND",
                                  detailIds: [],
                                  refundMethod: null,
                                  refundAmount: booking.cancellationRefundAmount,
                                  roomRefundAmount: booking.cancellationRoomRefundAmount,
                                  serviceRefundAmount: booking.cancellationServiceRefundAmount,
                                  roomPenaltyAmount: booking.cancellationRoomPenaltyAmount,
                                  refundPolicy: booking.cancellationRefundPolicy,
                                  cashRefundConfirmed: false,
                                  originalRoomAmount: undefined,
                                  originalRoomNights: undefined,
                                  usedRoomNights: undefined,
                                  roomAmountAfterCheckout: undefined,
                                  earlyCheckInFeeAmount: undefined,
                                  bookingTotalAmount: undefined,
                                  paidAmount: undefined,
                                  projectedTotalAmount: undefined,
                                  unpaidBeforeCheckoutAmount: undefined,
                                  outstandingAmount: undefined,
                                  services: [],
                                })}
                                className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                              >
                                Hủy · hoàn đủ
                              </button>
                            )}
                            {booking.bookingStatus === "IN_HOUSE" && hasCheckedInRooms && (
                              <button
                                type="button"
                                disabled={resolveState.isLoading}
                                onClick={() => setPendingResolution({
                                  bookingId: booking.bookingId,
                                  action: "EARLY_CHECKOUT",
                                  detailIds: checkedInDetails,
                                  refundMethod: null,
                                  refundAmount: booking.earlyCheckoutRefundAmount,
                                  roomRefundAmount: undefined,
                                  serviceRefundAmount: undefined,
                                  roomPenaltyAmount: undefined,
                                  refundPolicy: undefined,
                                  cashRefundConfirmed: false,
                                  originalRoomAmount: booking.earlyCheckoutOriginalRoomAmount,
                                  originalRoomNights: booking.earlyCheckoutOriginalRoomNights,
                                  usedRoomNights: booking.earlyCheckoutUsedRoomNights,
                                  roomAmountAfterCheckout: booking.earlyCheckoutRoomAmount,
                                  earlyCheckInFeeAmount: booking.earlyCheckoutEarlyCheckInFeeAmount,
                                  bookingTotalAmount: booking.earlyCheckoutBookingTotalAmount,
                                  paidAmount: booking.earlyCheckoutPaidAmount,
                                  projectedTotalAmount: booking.earlyCheckoutProjectedTotalAmount,
                                  unpaidBeforeCheckoutAmount: booking.earlyCheckoutUnpaidBeforeCheckoutAmount,
                                  outstandingAmount: booking.earlyCheckoutOutstandingAmount,
                                  services: booking.roomStays
                                    .filter((stay) => checkedInDetails.includes(stay.bookingDetailId))
                                    .flatMap((stay) => (stay.services ?? []).map((service) => ({
                                      roomNumber: stay.roomNumber ?? "—",
                                      name: service.name ?? "Dịch vụ",
                                      quantity: service.quantity,
                                      usedQuantity: service.usedQuantity,
                                      refundableQuantity: service.refundableQuantity,
                                      refundableAmount: service.refundableAmount,
                                    }))),
                                })}
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
