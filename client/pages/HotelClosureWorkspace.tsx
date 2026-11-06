import { useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, LoaderCircle, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
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

const formatClosureDate = (date: string, language: string) => {
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString(
    language.startsWith("en") ? "en-US" : "vi-VN",
  );
};

export default function HotelClosureWorkspace() {
  const { t, i18n } = useTranslation();
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
    branches.find((branch) => branch.id === hotelId)?.name ?? t("hotelClosure.branchFallback", { id: hotelId })
  ));
  const formatStatus = (status: string | null) => {
    if (!status) return "—";
    const statusKey: Record<string, string> = {
      PENDING: "statusPending",
      CONFIRMED: "statusConfirmed",
      IN_HOUSE: "statusInHouse",
      CHECKED_IN: "statusCheckedIn",
      CHECKED_OUT: "statusCheckedOut",
      CANCELLED: "statusCancelled",
    };
    const key = statusKey[status.toUpperCase()];
    return key ? t(`hotelClosure.${key}`) : status;
  };
  const formatMoney = (amount: number) => new Intl.NumberFormat(i18n.language.startsWith("en") ? "en-US" : "vi-VN", {
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
        title: t("hotelClosure.conflictTitle"),
        description: t("hotelClosure.conflictDescription", {
          title: conflict.title,
          startDate: formatClosureDate(conflict.startDate, i18n.language),
          endDate: formatClosureDate(conflict.endDate, i18n.language),
        }),
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
      toast({
        title: t("hotelClosure.createdTitle"),
        description: t("hotelClosure.createdDescription"),
      });
      setTitle("");
      setDescription("");
      setStartDate("");
      setEndDate("");
      setSelectedHotelIds([]);
      setSelectedId(response.result.id);
    } catch (submitError) {
      toast({
        title: t("hotelClosure.createErrorTitle"),
        description: responseMessage(submitError, t("hotelClosure.createErrorDescription")),
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
              reason: t("hotelClosure.cancellationReason", { title: selectedSchedule.title }),
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
              refundNote: t("hotelClosure.earlyCheckoutRefundNote", { title: selectedSchedule.title }),
            },
          };
      const response = await resolveBooking({
        scheduleId: selectedSchedule.id,
        bookingId,
        data,
      }).unwrap();
      toast({
        title: t("hotelClosure.resolvedTitle"),
        description: t("hotelClosure.resolvedDescription"),
      });
    } catch (resolveError) {
      toast({
        title: t("hotelClosure.resolveErrorTitle"),
        description: responseMessage(resolveError, t("hotelClosure.resolveErrorDescription")),
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
                ? t("hotelClosure.confirmCancelRefundTitle")
                : t("hotelClosure.confirmEarlyCheckoutTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingResolution?.action === "CANCEL_FULL_REFUND"
                ? t("hotelClosure.confirmCancelRefundDescription", { title: selectedSchedule?.title ?? "" })
                : t("hotelClosure.confirmEarlyCheckoutDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingResolution?.action === "CANCEL_FULL_REFUND" && (
          <div className={`rounded-xl border p-4 ${
            pendingRefundMissing ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50"
          }`}>
            <p className="text-sm font-semibold text-slate-800">
              {pendingRefundMissing
                ? t("hotelClosure.refundAmountUnavailable")
                : t("hotelClosure.expectedRefundAmount")}
            </p>
            {!pendingRefundMissing && (
              <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-blue-900">
                {formatMoney(pendingRefundAmount)}
              </p>
            )}
            {!pendingRefundMissing && (
              <p className="mt-1 text-xs text-slate-600">
                {t("hotelClosure.refundBreakdown", {
                  room: formatMoney(pendingResolution.roomRefundAmount ?? 0),
                  services: formatMoney(pendingResolution.serviceRefundAmount ?? 0),
                  penalty: formatMoney(pendingResolution.roomPenaltyAmount ?? 0),
                })}
              </p>
            )}
            {pendingRefundMissing && (
              <p className="mt-1 text-xs text-amber-800">
                {t("hotelClosure.refundAmountMissingWarning")}
              </p>
            )}
          </div>
          )}
          {pendingResolution?.action === "EARLY_CHECKOUT" && (
            <>
              <section className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <h3 className="text-sm font-semibold text-amber-950">{t("hotelClosure.bookingPaymentBeforeCheckout")}</h3>
                <dl className="mt-2 space-y-0 text-sm">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 border-b border-amber-200/70 py-2">
                    <dt className="text-xs leading-5 text-amber-900 sm:text-sm">{t("hotelClosure.expectedBookingTotal")}</dt>
                    <dd className="whitespace-nowrap text-right font-semibold tabular-nums text-slate-900">
                      {pendingResolution.bookingTotalAmount === undefined
                        ? "—"
                        : formatMoney(pendingResolution.bookingTotalAmount)}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 border-b border-amber-200/70 py-2">
                    <dt className="text-xs leading-5 text-amber-900 sm:text-sm">{t("hotelClosure.guestPaid")}</dt>
                    <dd className="whitespace-nowrap text-right font-semibold tabular-nums text-emerald-800">
                      {pendingResolution.paidAmount === undefined
                        ? "—"
                        : formatMoney(pendingResolution.paidAmount)}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 rounded-lg bg-amber-100/70 px-2 py-2">
                    <dt className="text-xs font-bold leading-5 text-amber-950 sm:text-sm">
                      {t("hotelClosure.guestUnpaid")}
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
                <h3 className="text-sm font-semibold text-amber-950">{t("hotelClosure.checkoutRoomServices")}</h3>
                {pendingResolution.services.length === 0 ? (
                  <p className="mt-1 text-xs text-amber-900">{t("hotelClosure.noAffectedRoomServices")}</p>
                ) : (
                  <ul className="mt-2 space-y-2 text-xs text-amber-950">
                    {pendingResolution.services.map((service, index) => (
                      <li key={`${service.roomNumber}-${service.name}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3">
                        <span className="leading-5">
                          {t("hotelClosure.serviceUsageSummary", {
                            roomNumber: service.roomNumber,
                            name: service.name,
                            quantity: service.quantity,
                            usedQuantity: service.usedQuantity,
                          })}
                          {service.refundableQuantity > 0
                            ? ` · ${t("hotelClosure.unusedServiceRefund", { quantity: service.refundableQuantity })}`
                            : ` · ${t("hotelClosure.serviceFullyUsed")}`}
                        </span>
                        <strong className="whitespace-nowrap text-right tabular-nums">{formatMoney(service.refundableAmount)}</strong>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-xs text-amber-900">
                  {t("hotelClosure.unusedServiceCheckoutNote")}
                </p>
              </section>
              <section className="rounded-xl border border-slate-200 bg-white p-3">
                <h3 className="text-sm font-semibold text-slate-900">{t("hotelClosure.earlyCheckoutReconciliation")}</h3>
                <dl className="mt-3 space-y-0 text-sm">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 border-b border-slate-100 py-2">
                    <dt className="text-xs leading-5 text-slate-600 sm:text-sm">
                      {t("hotelClosure.originalRoomAmount", { nights: pendingResolution.originalRoomNights ?? "—" })}
                    </dt>
                    <dd className="whitespace-nowrap text-right font-semibold tabular-nums text-slate-900">
                      {pendingResolution.originalRoomAmount === undefined
                        ? "—"
                        : formatMoney(pendingResolution.originalRoomAmount)}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 border-b border-slate-100 py-2">
                    <dt className="text-xs leading-5 text-slate-600 sm:text-sm">{t("hotelClosure.usedNights")}</dt>
                    <dd className="whitespace-nowrap text-right font-semibold tabular-nums text-slate-900">
                      {pendingResolution.usedRoomNights === undefined || pendingResolution.originalRoomNights === undefined
                        ? "—"
                        : t("hotelClosure.nightsFraction", { used: pendingResolution.usedRoomNights, total: pendingResolution.originalRoomNights })}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 border-b border-slate-100 py-2">
                    <dt className="text-xs leading-5 text-slate-600 sm:text-sm">{t("hotelClosure.roomAmountAfterEarlyCheckout")}</dt>
                    <dd className="whitespace-nowrap text-right font-semibold tabular-nums text-slate-900">
                      {pendingResolution.roomAmountAfterCheckout === undefined
                        ? "—"
                        : formatMoney(pendingResolution.roomAmountAfterCheckout)}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 border-b border-slate-100 py-2">
                    <dt className="text-xs leading-5 text-slate-600 sm:text-sm">{t("hotelClosure.earlyCheckinFee")}</dt>
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
                      {t("hotelClosure.amountDueAfterRecalculation")}
                    </dt>
                    <dd className={`whitespace-nowrap text-right font-bold tabular-nums ${
                      paymentRequired ? "text-rose-800" : "text-emerald-800"
                    }`}>
                      {pendingOutstandingAmount === null ? "—" : formatMoney(pendingOutstandingAmount)}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 border-t border-slate-200 py-2">
                    <dt className="text-xs font-bold leading-5 text-slate-800 sm:text-sm">
                      {t("hotelClosure.totalCostAfterEarlyCheckout")}
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
                    {t("hotelClosure.collectOutstandingBeforeCheckout")}
                  </p>
                )}
                <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">
                    {t("hotelClosure.reconciliationSummary")}
                  </p>
                  <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3">
                    <span className="text-sm font-semibold text-blue-950">
                      {pendingOutstandingAmount !== null && pendingOutstandingAmount > 0
                        ? t("hotelClosure.additionalPaymentDue")
                        : t("hotelClosure.refundToGuest")}
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
                      ? t("hotelClosure.insufficientCalculationData")
                      : pendingOutstandingAmount !== null && pendingOutstandingAmount > 0
                        ? t("hotelClosure.amountDueCalculation", {
                            costs: formatMoney(pendingResolution.projectedTotalAmount),
                            paid: formatMoney(pendingResolution.paidAmount),
                            due: formatMoney(pendingOutstandingAmount),
                          })
                        : t("hotelClosure.refundCalculation", {
                            paid: formatMoney(pendingResolution.paidAmount),
                            costs: formatMoney(pendingResolution.projectedTotalAmount),
                            refund: formatMoney(pendingRefundAmount),
                          })}
                  </p>
                </div>
              </section>
            </>
          )}
          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold text-slate-800">{t("hotelClosure.refundMethod")}</legend>
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
                <span className="block font-semibold text-slate-800">{t("hotelClosure.cashAtHotel")}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{t("hotelClosure.cashRefundDescription")}</span>
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
                <span className="block font-semibold text-slate-800">{t("hotelClosure.bankTransfer")}</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {t("hotelClosure.bankRefundDescription")}
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
                {t("hotelClosure.cashRefundConfirmation", { amount: formatMoney(pendingRefundAmount) })}
              </span>
            </label>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t("hotelClosure.goBack")}</AlertDialogCancel>
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
              {pendingResolution?.action === "CANCEL_FULL_REFUND"
                ? t("hotelClosure.cancelAndRefundFull")
                : t("hotelClosure.earlyCheckout")}
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
            <h1 className="text-2xl font-bold text-slate-900">{t("hotelClosure.title")}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {t("hotelClosure.description")}
            </p>
          </div>
        </header>

        {isSuperAdmin && (
          <form onSubmit={submitSchedule} className="mb-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
            <div className="md:col-span-2">
              <h2 className="font-bold text-slate-900">{t("hotelClosure.createScheduleTitle")}</h2>
              <p className="mt-1 text-sm text-slate-500">{t("hotelClosure.createScheduleDescription")}</p>
            </div>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              {t("hotelClosure.scheduleTitle")}
              <input required maxLength={150} value={title} onChange={(event) => setTitle(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              {t("hotelClosure.scheduleDescription")}
              <input maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              {t("hotelClosure.startDate")}
              <input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              {t("hotelClosure.endDate")}
              <input required type="date" min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            {conflictingSchedules.length > 0 && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 md:col-span-2" role="alert">
                {t("hotelClosure.conflictDescription", {
                  title: conflictingSchedules[0].title,
                  startDate: formatClosureDate(conflictingSchedules[0].startDate, i18n.language),
                  endDate: formatClosureDate(conflictingSchedules[0].endDate, i18n.language),
                })}
              </p>
            )}
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 md:col-span-2">
              <input type="checkbox" checked={allHotels} onChange={(event) => setAllHotels(event.target.checked)} />
              {t("hotelClosure.applyToAllBranches")}
            </label>
            {!allHotels && (
              <fieldset className="grid gap-2 md:col-span-2">
                <legend className="text-sm font-semibold text-slate-700">{t("hotelClosure.notifyBranches")}</legend>
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
                {t("hotelClosure.createAndNotify")}
              </button>
            </div>
          </form>
        )}

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays size={18} className="text-blue-700" />
            <h2 className="font-bold text-slate-900">{t("hotelClosure.announcedSchedules")}</h2>
          </div>
          {isLoading ? (
            <p className="text-sm text-slate-500">{t("hotelClosure.loadingSchedules")}</p>
          ) : error ? (
            <p className="text-sm text-red-600">{t("hotelClosure.loadSchedulesError")}</p>
          ) : schedules.length === 0 ? (
            <p className="text-sm text-slate-500">{t("hotelClosure.noSchedules")}</p>
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
                    <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{t("hotelClosure.scheduleTitle")}</span>
                    <span className="mt-1 block font-semibold text-slate-900">{schedule.title}</span>
                  </span>
                  <span className="grid gap-3 border-b border-slate-200/80 py-3 sm:grid-cols-2">
                    <span>
                      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{t("hotelClosure.startDate")}</span>
                      <span className="mt-1 block text-sm text-slate-700">{formatClosureDate(schedule.startDate, i18n.language)}</span>
                    </span>
                    <span>
                      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{t("hotelClosure.endDate")}</span>
                      <span className="mt-1 block text-sm text-slate-700">{formatClosureDate(schedule.endDate, i18n.language)}</span>
                    </span>
                  </span>
                  {isSuperAdmin && (
                    <span className="pt-3">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{t("hotelClosure.appliedBranches")}</span>
                      <span className="mt-1 block text-sm text-slate-700">
                        {schedule.allHotels
                          ? t("hotelClosure.allBranches")
                          : getScheduleBranchNames(schedule.hotelIds).join(", ") || t("hotelClosure.unknownBranch")}
                      </span>
                    </span>
                  )}
                  {schedule.description && (
                    <span className="mt-3 block border-t border-slate-200/80 pt-3 text-sm text-slate-600">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{t("hotelClosure.scheduleDescription")}</span>
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
                {t("hotelClosure.bookingsToContact")}
                {!isLoadingAffected && (
                  <span
                    aria-label={t("hotelClosure.bookingCount", { count: affectedBookings.length })}
                    className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-100 px-2 text-xs font-bold text-blue-800"
                  >
                    {affectedBookings.length}
                  </span>
                )}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {t("hotelClosure.resolutionDescription")}
              </p>
            </div>
            {isLoadingAffected ? (
              <p className="text-sm text-slate-500">{t("hotelClosure.loadingAffectedBookings")}</p>
            ) : affectedBookings.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                <CheckCircle2 size={17} /> {t("hotelClosure.noBookingsToResolve")}
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
                          <p className="mt-1 text-xs text-slate-500">{t("hotelClosure.statusLabel")}: {formatStatus(booking.bookingStatus)}</p>
                          <ul className="mt-2 space-y-1 text-sm text-slate-600">
                            {booking.roomStays.map((stay) => (
                              <li key={stay.bookingDetailId}>
                                {t("hotelClosure.roomStaySummary", {
                                  roomNumber: stay.roomNumber ?? "—",
                                  checkIn: stay.checkinDate ?? "—",
                                  checkOut: stay.checkoutDate ?? "—",
                                  status: formatStatus(stay.status),
                                })}
                              </li>
                            ))}
                          </ul>
                          {resolved && (
                            <p className="mt-2 text-sm font-medium text-emerald-700">
                              {t("hotelClosure.resolvedLabel")}: {booking.resolutionAction === "CANCEL_FULL_REFUND"
                                ? t("hotelClosure.cancelAndRefundFull")
                                : t("hotelClosure.earlyCheckout")}
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
                                {t("hotelClosure.cancelAndRefundFull")}
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
                                      name: service.name ?? t("hotelClosure.serviceFallback"),
                                      quantity: service.quantity,
                                      usedQuantity: service.usedQuantity,
                                      refundableQuantity: service.refundableQuantity,
                                      refundableAmount: service.refundableAmount,
                                    }))),
                                })}
                                className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                              >
                                {t("hotelClosure.earlyCheckoutUnusedNights")}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {!resolved && booking.bookingStatus === "IN_HOUSE" && !hasCheckedInRooms && (
                        <p className="mt-3 flex items-center gap-2 text-sm text-amber-800">
                          <AlertTriangle size={16} /> {t("hotelClosure.verifyRoomStatus")}
                        </p>
                      )}
                      {!resolved && booking.bookingStatus === "CONFIRMED" && hasCheckedInRooms && (
                        <p className="mt-3 flex items-center gap-2 text-sm text-amber-800">
                          <AlertTriangle size={16} /> {t("hotelClosure.completeCheckinBeforeCheckout")}
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
