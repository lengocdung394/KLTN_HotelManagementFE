import { useAppDispatch, useAppSelector } from "../store/hooks";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Banknote, Check, Columns3, LoaderCircle, RefreshCw, RotateCcw, Search } from "lucide-react";
import BankSelectionField from "./BankSelectionField";
import ListPagination from "./ListPagination";
import SearchableFilter from "./SearchableFilter";
import { localizedText } from "../i18n";
import { toast } from "@/components/ui/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { subscribeHotelSocketEvents } from "../lib/socket";
import { baseApi } from "../services/baseApi";
import {
  useApproveCheckoutRefundMutation,
  useConfirmCheckoutRefundMutation,
  useGetCheckoutRefundsQuery,
  useLazyGetCheckoutRefundBankDetailsQuery,
  useRequestCheckoutRefundPayoutMutation,
  useUpdateCheckoutRefundBankDetailsMutation,
  type CheckoutRefund,
  type BookingRefundTransferMethod,
} from "../services/managementBookingApi";

const money = (amount: number) => {
  const isEnglish = localStorage.getItem("language") === "en";
  return `${new Intl.NumberFormat(isEnglish ? "en-US" : "vi-VN", { maximumFractionDigits: 0 }).format(Number(amount ?? 0))}${isEnglish ? " VND" : "đ"}`;
};

const dateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  const language = localStorage.getItem("language") === "en" ? "en-US" : "vi-VN";
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(language);
};

const getErrorMessage = (error: unknown) => {
  if (!error || typeof error !== "object") return localizedText("Đã xảy ra lỗi. Vui lòng thử lại.", "Something went wrong. Please try again.");
  const apiError = error as { data?: { message?: string }; error?: string; message?: string };
  return apiError.data?.message ?? apiError.message ?? apiError.error ?? localizedText("Đã xảy ra lỗi. Vui lòng thử lại.", "Something went wrong. Please try again.");
};

const CHECKOUT_REFUND_COLUMNS = [
  { id: "booking", label: ["Mã booking", "Booking ID"], width: 190 },
  { id: "customer", label: ["Khách hàng", "Guest"], width: 175 },
  { id: "channel", label: ["Kênh đặt", "Booking channel"], width: 150 },
  { id: "date", label: ["Ngày yêu cầu", "Request date"], width: 205 },
  { id: "paid", label: ["Đã thu / hóa đơn", "Paid / invoice"], width: 190 },
  { id: "amount", label: ["Chi tiết hoàn", "Refund details"], width: 210 },
  { id: "account", label: ["Hình thức / tài khoản nhận", "Method / recipient account"], width: 220 },
  { id: "refundedAt", label: ["Thời gian hoàn", "Refund time"], width: 180 },
  { id: "refundedBy", label: ["Người hoàn tiền", "Refunded by"], width: 180 },
  { id: "status", label: ["Trạng thái", "Status"], width: 240 },
  { id: "actions", label: ["Thao tác", "Actions"], width: 300 },
] as const;
type CheckoutRefundColumnId = (typeof CHECKOUT_REFUND_COLUMNS)[number]["id"];

export default function CheckoutRefundApprovalsPanel({
  hotelId,
  bookingIds,
  isBranchBookingsReady = true,
}: {
  hotelId?: number;
  bookingIds?: readonly string[];
  isBranchBookingsReady?: boolean;
}) {
  const dispatch = useAppDispatch();
  useTranslation();
  const { data: refunds = [], isLoading, isFetching, isError, error, refetch } = useGetCheckoutRefundsQuery(hotelId);
  const branchBookingIdSet = new Set(bookingIds ?? []);
  const branchRefunds = hotelId === undefined
    ? refunds
    : isBranchBookingsReady
      ? refunds.filter((refund) => branchBookingIdSet.has(String(refund.bookingId).trim()))
      : [];
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | CheckoutRefund["status"]>("ALL");
  const [isManuallyRefreshing, setIsManuallyRefreshing] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<CheckoutRefundColumnId, boolean>>({
    booking: true,
    customer: true,
    channel: true,
    date: true,
    paid: true,
    amount: true,
    account: true,
    refundedAt: true,
    refundedBy: true,
    status: true,
    actions: true,
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const pending = branchRefunds.filter((refund) => refund.status === "PENDING");
  const approved = branchRefunds.filter((refund) => refund.status === "APPROVED");
  const processing = branchRefunds.filter((refund) => refund.status === "PAYOUT_PROCESSING");
  const failed = branchRefunds.filter((refund) => refund.status === "PAYOUT_FAILED");
  const refunded = branchRefunds.filter((refund) => refund.status === "REFUNDED");
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
  const visibleRefunds = branchRefunds.filter((refund) => {
    if (statusFilter !== "ALL" && refund.status !== statusFilter) return false;
    if (!normalizedSearch) return true;
    return [
      refund.bookingId,
      refund.customerName,
      refund.customerPhone,
      refund.bookingChannel,
      refund.refundMethod,
      refund.status,
      refund.refundedBy,
      refund.note,
    ].some((value) => value?.toLocaleLowerCase().includes(normalizedSearch));
  });
  const totalPages = Math.max(1, Math.ceil(visibleRefunds.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRefunds = visibleRefunds.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pendingCashRefunds = branchRefunds.filter((refund) => refund.refundMethod === "CASH" && refund.status === "PENDING");
  const hasActiveFilters = Boolean(searchQuery.trim()) || statusFilter !== "ALL";
  const shownColumns = CHECKOUT_REFUND_COLUMNS.filter((column) => visibleColumns[column.id]);
  const isListLoading = isLoading || isManuallyRefreshing;
  const isListRefreshing = isFetching || isManuallyRefreshing;

  useEffect(
    () => subscribeHotelSocketEvents(
      ["room_update", "booking_state_updated", "new_booking_notification", "notification_created"],
      () => dispatch(baseApi.util.invalidateTags(["CheckoutRefund"])),
    ),
    [dispatch],
  );

  const refreshOrResetFilters = async () => {
    if (isListRefreshing) return;
    const refreshStartedAt = Date.now();
    setIsManuallyRefreshing(true);
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
    if (hasActiveFilters) {
      setSearchQuery("");
      setStatusFilter("ALL");
      setPage(1);
    }
    try {
      await refetch().unwrap();
    } catch {
      toast({
        variant: "destructive",
        title: localizedText("Không thể tải lại danh sách hoàn dư", "Could not reload surplus refunds"),
      });
    } finally {
      const remainingLoadingTime = 2000 - (Date.now() - refreshStartedAt);
      if (remainingLoadingTime > 0) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, remainingLoadingTime));
      }
      setIsManuallyRefreshing(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [pageSize, searchQuery, statusFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <section className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-amber-100 bg-amber-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800">
            <Banknote size={20} />
          </span>
          <div>
            <h3 className="font-bold text-slate-900">{localizedText("Hoàn tiền sau khi checkout dư", "Checkout surplus refund")}</h3>
            <p className="mt-1 text-sm text-slate-600">
              {localizedText("Theo dõi khoản thanh toán dư sau khi toàn bộ booking checkout, theo số tiền, hình thức và trạng thái hoàn.", "Track overpayments after every room in the booking has checked out, including the amount, method, and refund status.")}
            </p>
            <p className="mt-2 text-xs font-medium text-slate-500">
              {pendingCashRefunds.length} {localizedText("chờ xác nhận tiền mặt", "cash refunds to confirm")} · {pending.length - pendingCashRefunds.length} {localizedText("chờ duyệt hoàn online", "online refunds to review")} · {approved.length} {localizedText("chờ chuyển khoản", "awaiting transfer")} · {processing.length} {localizedText("đang xử lý PayOS", "PayOS processing")} · {failed.length} {localizedText("payout lỗi", "payout failed")} · {refunded.length} {localizedText("đã hoàn", "refunded")}
            </p>
          </div>
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
        <label className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={localizedText("Tìm mã booking, khách hàng...", "Search booking ID or guest...")}
            aria-label={localizedText("Tìm khoản hoàn tiền", "Search refunds")}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <SearchableFilter
          value={statusFilter}
          options={[
            { value: "ALL", label: localizedText("Tất cả trạng thái", "All statuses") },
            { value: "PENDING", label: localizedText("Chờ duyệt hoàn tiền", "Refund pending review") },
            { value: "APPROVED", label: localizedText("Đã duyệt - chờ chuyển khoản", "Approved - awaiting transfer") },
            { value: "PAYOUT_PROCESSING", label: localizedText("PayOS đang xử lý", "PayOS processing") },
            { value: "PAYOUT_FAILED", label: localizedText("Payout thất bại", "Payout failed") },
            { value: "REFUNDED", label: localizedText("Đã hoàn", "Refunded") },
          ]}
          onChange={(value) => setStatusFilter(value as typeof statusFilter)}
          ariaLabel={localizedText("Lọc theo trạng thái", "Filter by status")}
          searchPlaceholder={localizedText("Tìm trạng thái...", "Search statuses...")}
          emptyMessage={localizedText("Không tìm thấy trạng thái.", "No statuses found.")}
          className="w-full sm:w-52"
        />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={localizedText("Tùy chỉnh cột", "Customize columns")}
                className="flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Columns3 size={16} />
                {localizedText("Cột", "Columns")}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-60 p-2">
              <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {localizedText("Hiển thị cột", "Show columns")}
              </p>
              {CHECKOUT_REFUND_COLUMNS.map((column) => {
                const isLastVisibleColumn = shownColumns.length === 1 && visibleColumns[column.id];
                return (
                  <label key={column.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={visibleColumns[column.id]}
                      disabled={isLastVisibleColumn}
                      onChange={(event) => {
                        setVisibleColumns((current) => ({ ...current, [column.id]: event.target.checked }));
                      }}
                      className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                    />
                    {localizedText(column.label[0], column.label[1])}
                  </label>
                );
              })}
              <button
                type="button"
                onClick={() => setVisibleColumns({
                  booking: true,
                  customer: true,
                  channel: true,
                  date: true,
                  paid: true,
                  amount: true,
                  account: true,
                  refundedAt: true,
                  refundedBy: true,
                  status: true,
                  actions: true,
                })}
                className="mt-1 w-full rounded-md border-t border-slate-100 px-2 pt-2 text-left text-xs font-semibold text-blue-700 hover:text-blue-800"
              >
                {localizedText("Hiện tất cả cột", "Show all columns")}
              </button>
            </PopoverContent>
          </Popover>
          <button
            type="button"
            onClick={() => void refreshOrResetFilters()}
            disabled={isListRefreshing}
            aria-label={hasActiveFilters
              ? localizedText("Xóa bộ lọc", "Reset filters")
              : localizedText("Tải lại danh sách hoàn dư", "Reload surplus refunds")}
            title={hasActiveFilters
              ? localizedText("Xóa bộ lọc", "Reset filters")
              : localizedText("Tải lại danh sách hoàn dư", "Reload surplus refunds")}
            aria-busy={isListRefreshing}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
          >
            {isListRefreshing
              ? <RefreshCw size={16} className="animate-spin" />
              : hasActiveFilters
              ? <RotateCcw size={15} />
              : <RefreshCw size={16} />}
          </button>
        </div>
      </div>
      {isListLoading ? (
        <div role="status" aria-live="polite" className="mx-5 my-4 flex min-h-48 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-8 text-sm text-blue-700">
          <RefreshCw size={17} className="animate-spin" />
          <span>{localizedText("Đang tải yêu cầu hoàn dư...", "Loading refund requests...")}</span>
        </div>
      ) : isError ? (
        <div role="alert" className="p-6 text-center">
          <p className="text-sm font-semibold text-rose-700">{localizedText("Không tải được yêu cầu hoàn dư", "Could not load refund requests")}</p>
          <p className="mt-1 text-sm text-slate-500">{getErrorMessage(error)}</p>
          <button type="button" onClick={() => void refetch()} className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            {localizedText("Thử lại", "Try again")}
          </button>
        </div>
      ) : branchRefunds.length === 0 ? (
        <p className="p-8 text-center text-sm text-slate-500">{localizedText("Chưa có khoản hoàn dư nào.", "There are no surplus refunds.")}</p>
      ) : (
        <>
          {visibleRefunds.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              {localizedText("Không tìm thấy khoản hoàn tiền phù hợp.", "No matching refunds found.")}
            </p>
          ) : (
            <>
              <div className="max-w-full overflow-x-auto">
                <table className="table-fixed text-left text-sm" style={{ width: `max(100%, ${shownColumns.reduce((width, column) => width + column.width, 64)}px)` }}>
                <colgroup>
                  <col style={{ width: "64px" }} />
                  {shownColumns.map((column) => <col key={column.id} style={{ width: `${column.width}px` }} />)}
                </colgroup>
                <thead className="bg-blue-50 text-[11px] uppercase tracking-wide text-blue-800">
                  <tr>
                    <th scope="col" className="whitespace-nowrap px-3 py-3">{localizedText("STT", "No.")}</th>
                    {shownColumns.map((column) => <th key={column.id} className="px-3 py-3">{localizedText(column.label[0], column.label[1])}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedRefunds.map((refund, index) => <CheckoutRefundRow key={refund.id} refund={refund} visibleColumns={visibleColumns} serialNumber={(safePage - 1) * pageSize + index + 1} />)}
                </tbody>
                </table>
              </div>
              <ListPagination totalItems={visibleRefunds.length} page={safePage} pageSize={pageSize} mode="table" onPageChange={setPage} onPageSizeChange={setPageSize} />
            </>
          )}
        </>
      )}
    </section>
  );
}

function CheckoutRefundRow({
  refund,
  visibleColumns,
  serialNumber,
}: {
  refund: CheckoutRefund;
  visibleColumns: Record<CheckoutRefundColumnId, boolean>;
  serialNumber: number;
}) {
  const roles = useAppSelector((state) => state.auth.roles);
  const canApproveRefund = roles.includes("ROLE_MANAGER") || roles.includes("ROLE_SUPER_ADMIN") || roles.includes("ROLE_ADMIN");
  const canConfirmCashRefund = canApproveRefund || roles.includes("ROLE_RECEPTIONIST") || roles.includes("ROLE_STAFF") || roles.includes("ROLE_EMPLOYEE");
  useTranslation();
  const [updateBankDetails, { isLoading: isSaving }] = useUpdateCheckoutRefundBankDetailsMutation();
  const [approveRefund, { isLoading: isApproving }] = useApproveCheckoutRefundMutation();
  const [confirmRefund, { isLoading: isConfirming }] = useConfirmCheckoutRefundMutation();
  const [loadBankDetails, { isLoading: isLoadingBankDetails, reset: resetBankDetails }] = useLazyGetCheckoutRefundBankDetailsQuery();
  const [requestPayout, { isLoading: isRequestingPayout }] = useRequestCheckoutRefundPayoutMutation();
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [isManualConfirmDialogOpen, setIsManualConfirmDialogOpen] = useState(false);
  const [refundAccountChoice, setRefundAccountChoice] = useState<"saved" | "alternate">("saved");
  const [savedBank, setSavedBank] = useState({
    bankName: "",
    bankCode: "",
    bankAccountName: "",
    bankAccountNumber: "",
  });
  const [bank, setBank] = useState({
    bankName: "",
    bankCode: "",
    bankAccountName: "",
    bankAccountNumber: "",
  });
  const [amountConfirmed, setAmountConfirmed] = useState(false);
  const [customerConfirmed, setCustomerConfirmed] = useState(false);
  const [refundTransferMethod, setRefundTransferMethod] = useState<BookingRefundTransferMethod>("PAYOS");
  const [refundCompletedConfirmed, setRefundCompletedConfirmed] = useState(false);
  const [note, setNote] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const isWorking = isSaving || isApproving || isConfirming || isRequestingPayout || isLoadingBankDetails;
  const isCashRefund = refund.refundMethod === "CASH";
  const isPayOSRefund = refund.refundTransferMethod === "PAYOS";
  const hasBankAccount = Boolean(refund.hasBankDetails);
  const selectedBank = refundAccountChoice === "saved" ? savedBank : bank;
  const hasSelectedBankAccount = Boolean(
    selectedBank.bankName.trim()
    && selectedBank.bankAccountName.trim()
    && /^[0-9]{6,50}$/.test(selectedBank.bankAccountNumber.trim()),
  );
  const hasSelectedPayOSBankAccount = hasSelectedBankAccount && /^[0-9]{6}$/.test(selectedBank.bankCode.trim());

  const openApprovalDialog = async () => {
    setSavedBank({ bankName: "", bankCode: "", bankAccountName: "", bankAccountNumber: "" });
    setBank({ bankName: "", bankCode: "", bankAccountName: "", bankAccountNumber: "" });
    setRefundAccountChoice(hasBankAccount ? "saved" : "alternate");
    setAmountConfirmed(false);
    setCustomerConfirmed(false);
    setRefundTransferMethod("PAYOS");
    setErrorMessage("");
    setIsApprovalDialogOpen(true);
    if (hasBankAccount) {
      try {
        setSavedBank(await loadBankDetails(refund.id).unwrap());
      } catch (error: unknown) {
        setRefundAccountChoice("alternate");
        setErrorMessage(getErrorMessage(error));
      }
    }
  };

  const closeApprovalDialog = () => {
    setIsApprovalDialogOpen(false);
    setSavedBank({ bankName: "", bankCode: "", bankAccountName: "", bankAccountNumber: "" });
    setBank({ bankName: "", bankCode: "", bankAccountName: "", bankAccountNumber: "" });
    resetBankDetails();
  };

  const openManualConfirmDialog = () => {
    setNote("");
    setRefundCompletedConfirmed(false);
    setErrorMessage("");
    setIsManualConfirmDialogOpen(true);
  };

  const closeManualConfirmDialog = () => {
    if (isConfirming) return;
    setIsManualConfirmDialogOpen(false);
    setNote("");
    setRefundCompletedConfirmed(false);
    setErrorMessage("");
  };

  const approve = async () => {
    if (!amountConfirmed || !customerConfirmed) {
      setErrorMessage(localizedText("Cần xác nhận số tiền và xác nhận đã hỏi khách về tài khoản nhận.", "Confirm the refund amount and that the recipient account has been verified with the guest."));
      return;
    }
    if (!hasSelectedBankAccount || (refundTransferMethod === "PAYOS" && !hasSelectedPayOSBankAccount)) {
      setErrorMessage(refundTransferMethod === "PAYOS"
        ? localizedText("Tài khoản cần có ngân hàng hỗ trợ PayOS, mã BIN, tên chủ tài khoản và số tài khoản hợp lệ.", "The recipient account needs a PayOS-supported bank, BIN, account holder, and valid account number.")
        : localizedText("Vui lòng nhập tài khoản nhận tiền hợp lệ.", "Enter valid recipient account details."));
      return;
    }
    setErrorMessage("");
    try {
      if (refundAccountChoice === "alternate") {
        await updateBankDetails({
          refundId: refund.id,
          request: {
            bankName: selectedBank.bankName.trim(),
            bankCode: selectedBank.bankCode.trim() || undefined,
            bankAccountName: selectedBank.bankAccountName.trim(),
            bankAccountNumber: selectedBank.bankAccountNumber.trim(),
          },
        }).unwrap();
      }
      await approveRefund({
        refundId: refund.id,
        note: note.trim() || undefined,
        refundTransferMethod,
      }).unwrap();
      closeApprovalDialog();
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  const completeRefund = async () => {
    if (!isCashRefund && !refundCompletedConfirmed) {
      setErrorMessage(localizedText("Xác nhận khoản chuyển khoản đã hoàn tất trước khi ghi nhận.", "Confirm the bank transfer has completed before recording it."));
      return;
    }
    if (note.trim().length > 120) {
      setErrorMessage(localizedText("Mã giao dịch không được vượt quá 120 ký tự.", "The transaction reference must be 120 characters or fewer."));
      return;
    }
    setErrorMessage("");
    try {
      await confirmRefund({
        refundId: refund.id,
        note: note.trim() || undefined,
        refundCompletedConfirmed: isCashRefund ? undefined : true,
      }).unwrap();
      if (!isCashRefund) closeManualConfirmDialog();
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  const sendPayOSRefund = async () => {
    setErrorMessage("");
    try {
      await requestPayout({ refundId: refund.id }).unwrap();
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  const status = refund.status === "PENDING"
    ? isCashRefund ? localizedText("Chờ xác nhận tiền mặt", "Cash confirmation pending") : localizedText("Chờ duyệt hoàn tiền", "Refund pending review")
    : refund.status === "APPROVED" ? localizedText("Đã duyệt - chờ chuyển khoản", "Approved - awaiting transfer")
      : refund.status === "PAYOUT_PROCESSING" ? localizedText("PayOS đang xử lý", "PayOS processing")
        : refund.status === "PAYOUT_FAILED" ? localizedText("Payout thất bại", "Payout failed")
          : localizedText("Đã hoàn tiền", "Refunded");

  return (
    <>
    <tr className="align-top hover:bg-slate-50/70">
      <td className="whitespace-nowrap px-3 py-4 tabular-nums text-slate-500">{serialNumber}</td>
      {visibleColumns.booking && <td className="px-3 py-4">
        <p className="whitespace-nowrap font-semibold text-blue-700">{refund.bookingId}</p>
      </td>}
      {visibleColumns.customer && <td className="px-3 py-4">
        <p className="font-medium text-slate-800">{refund.customerName || localizedText("Khách hàng", "Guest")}</p>
        {refund.customerPhone && <p className="mt-0.5 whitespace-nowrap text-xs text-slate-500">{refund.customerPhone}</p>}
      </td>}
      {visibleColumns.channel && <td className="px-3 py-4">
        <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-semibold ${
          refund.bookingChannel === "ONLINE" ? "bg-sky-50 text-sky-700" : "bg-violet-50 text-violet-700"
        }`}>
          {refund.bookingChannel === "ONLINE"
            ? localizedText("Đặt online", "Online booking")
            : refund.bookingChannel === "OFFLINE"
              ? localizedText("Đặt tại quầy", "Front-desk booking")
              : "—"}
        </span>
      </td>}
      {visibleColumns.date && <td className="whitespace-nowrap px-3 py-4 text-xs leading-5 text-slate-600">{dateTime(refund.requestedAt)}</td>}
      {visibleColumns.paid && <td className="space-y-1 px-3 py-4">
        <p><span className="text-xs text-slate-500">{localizedText("Đã thu", "Paid")}</span><br /><strong>{money(refund.paidAmount)}</strong></p>
        <p><span className="text-xs text-slate-500">{localizedText("Hóa đơn cuối", "Final invoice")}</span><br /><strong>{money(refund.finalAmount)}</strong></p>
      </td>}
      {visibleColumns.amount && <td className="px-3 py-4">
        <p className="text-base font-bold tabular-nums text-slate-900">{money(refund.refundAmount)}</p>
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-slate-400">{localizedText("Tổng tiền hoàn", "Total refund")}</p>
      </td>}
      {visibleColumns.account && <td className="px-3 py-4">
        {isCashRefund ? (
          <span className="inline-flex rounded-lg bg-emerald-50 px-2.5 py-2 text-xs font-semibold text-emerald-700">
            {localizedText("Hoàn tiền mặt tại khách sạn", "Cash refund at hotel")}
          </span>
        ) : refund.status === "REFUNDED" ? (
          <div className="space-y-2">
            <span className="inline-flex rounded-lg bg-emerald-50 px-2.5 py-2 text-xs font-semibold text-emerald-700">
              {localizedText("Đã hoàn qua ngân hàng", "Refunded by bank transfer")}
            </span>
            {refund.refundTransferMethod && (
              <span className="block text-xs font-medium text-slate-600">
                {refund.refundTransferMethod === "MANUAL_BANK"
                  ? localizedText("Chuyển khoản thủ công", "Manual bank transfer")
                  : localizedText("Tự động qua PayOS", "Automatic via PayOS")}
              </span>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <span className={`inline-flex rounded-lg px-2.5 py-2 text-xs font-semibold ${
              hasBankAccount ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
            }`}>
              {hasBankAccount
                ? localizedText("Thông tin tài khoản đã được mã hóa", "Recipient details are encrypted")
                : localizedText("Chưa có thông tin ngân hàng", "Bank details not provided")}
            </span>
            {refund.refundTransferMethod && (
              <span className="block text-xs font-medium text-slate-600">
                {refund.refundTransferMethod === "MANUAL_BANK"
                  ? localizedText("Chuyển khoản thủ công", "Manual bank transfer")
                  : localizedText("Tự động qua PayOS", "Automatic via PayOS")}
              </span>
            )}
          </div>
        )}
      </td>}
      {visibleColumns.refundedAt && <td className="px-3 py-4 text-slate-600">
        {refund.status === "REFUNDED" ? dateTime(refund.refundedAt) : "—"}
      </td>}
      {visibleColumns.refundedBy && <td className="px-3 py-4 text-slate-700">
        {refund.status === "REFUNDED" ? refund.refundedBy || "—" : "—"}
      </td>}
      {visibleColumns.status && <td className="px-4 py-4">
        <span className={`inline-flex max-w-full whitespace-normal break-words rounded-full border px-3 py-2 text-xs font-semibold ${
          refund.status === "PENDING"
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : refund.status === "PAYOUT_FAILED" ? "border-rose-200 bg-rose-50 text-rose-800"
              : refund.status === "REFUNDED" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : refund.status === "APPROVED" ? "border-violet-200 bg-violet-50 text-violet-800"
                  : "border-blue-200 bg-blue-50 text-blue-800"
        }`}>
          {status}
        </span>
        {refund.payoutState && (
          <span className="mt-1 inline-flex max-w-full whitespace-normal break-words rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">
            {refund.payoutState === "PROCESSING"
              ? localizedText("PayOS: Chưa hoàn tất", "PayOS: Not completed")
              : refund.payoutState === "TRANSFERRED"
                ? localizedText("PayOS: Đã chuyển", "PayOS: Transferred")
                : refund.payoutState === "FAILED"
                  ? localizedText("PayOS: Thất bại", "PayOS: Failed")
                  : localizedText("PayOS: Trạng thái chưa xác định", "PayOS: Unknown state")}
          </span>
        )}
        {refund.payoutReference && (
          <p className="mt-2 break-all text-xs text-slate-600">
            {localizedText("Mã payout:", "Payout reference:")} {refund.payoutReference}
          </p>
        )}
        {refund.note && (
          <p className="mt-2 line-clamp-2 text-xs leading-4 text-slate-500" title={refund.note}>
            {localizedText("Ghi chú:", "Note:")} {refund.note}
          </p>
        )}
        {refund.payoutError && (
          <p className="mt-2 line-clamp-2 text-xs leading-4 text-rose-700" title={refund.payoutError}>{refund.payoutError}</p>
        )}
      </td>}
      {visibleColumns.actions && <td className="border-l border-slate-200 px-4 py-4">
        <div className="flex min-w-0 flex-col items-start gap-2">
        {refund.status !== "REFUNDED" && (
          <div className="w-full space-y-2">
            {refund.status === "PENDING" && isCashRefund && canConfirmCashRefund && (
              <button type="button" onClick={() => void completeRefund()} disabled={isWorking} className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 py-2 text-xs font-semibold text-white disabled:opacity-50">
                {isConfirming ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />}
                {localizedText("Xác nhận đã hoàn tiền mặt", "Confirm cash refund")}
              </button>
            )}
            {refund.status === "PENDING" && !isCashRefund && canApproveRefund && (
              <button
                type="button"
                onClick={openApprovalDialog}
                className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-blue-600 px-2 py-2 text-xs font-semibold text-white"
              >
                <Check size={13} />
                {localizedText("Duyệt hoàn", "Approve refund")}
              </button>
            )}
            {refund.status === "PENDING" && !isCashRefund && !canApproveRefund && (
              <p className="rounded-lg bg-amber-50 px-2 py-2 text-xs text-amber-800">
                {localizedText("Chờ quản lý quyết định duyệt hoàn.", "Awaiting manager's refund decision.")}
              </p>
            )}
            {(refund.status === "APPROVED" || refund.status === "PAYOUT_PROCESSING" || refund.status === "PAYOUT_FAILED") && (
              isPayOSRefund ? (
                canApproveRefund ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void sendPayOSRefund()}
                      disabled={isWorking || (refund.status !== "PAYOUT_PROCESSING" && !hasBankAccount)}
                      className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-blue-600 px-2 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {isRequestingPayout ? <LoaderCircle size={13} className="animate-spin" /> : <Banknote size={13} />}
                      {refund.status === "PAYOUT_PROCESSING"
                        ? localizedText("Cập nhật trạng thái PayOS", "Refresh PayOS status")
                        : refund.status === "PAYOUT_FAILED"
                          ? localizedText("Thử gửi payout lại", "Retry payout")
                          : localizedText("Gửi payout qua PayOS", "Send PayOS payout")}
                    </button>
                  </>
                ) : (
                  <p className="rounded-lg bg-blue-50 px-2 py-2 text-xs text-blue-800">
                    {localizedText("Đã duyệt; PayOS đang xử lý khoản hoàn.", "Approved; PayOS is processing the refund.")}
                  </p>
                )
              ) : canApproveRefund ? (
                <>
                  {refund.status === "APPROVED" && (
                    <button
                      type="button"
                      onClick={openManualConfirmDialog}
                      disabled={isWorking}
                      className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      <Check size={13} />
                      {localizedText("Xác nhận hoàn tiền thủ công", "Confirm manual refund")}
                      </button>
                  )}
                  {refund.status !== "APPROVED" && (
                    <p className="rounded-lg bg-amber-50 px-2 py-2 text-xs text-amber-800">
                      {localizedText("Chuyển khoản thủ công chưa được xác nhận hoàn tất.", "Manual bank transfer has not been confirmed.")}
                    </p>
                  )}
                </>
              ) : (
                <p className="rounded-lg bg-blue-50 px-2 py-2 text-xs text-blue-800">
                  {localizedText("Đã duyệt; chờ quản lý hoàn tất chuyển khoản.", "Approved; awaiting manager to complete the transfer.")}
                </p>
              )
            )}
          </div>
        )}
        {errorMessage && (
          <p role="alert" className="flex items-start gap-1 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />{errorMessage}
          </p>
        )}
        </div>
      </td>}
    </tr>
    <Dialog
      open={isApprovalDialogOpen}
      onOpenChange={(open) => {
        if (!isWorking) {
          if (open) setIsApprovalDialogOpen(true);
          else closeApprovalDialog();
          if (!open) setErrorMessage("");
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{localizedText("Duyệt hoàn tiền checkout", "Approve checkout refund")} · {refund.bookingId}</DialogTitle>
          <DialogDescription>
            {localizedText("Đối chiếu khoản dư, xác nhận tài khoản nhận và chọn phương thức chuyển tiền.", "Review the surplus, verify the recipient account, and select how to transfer the refund.")}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">{localizedText("Khách hàng", "Guest")}</span>
            <span className="text-right font-semibold text-slate-800">{refund.customerName || "—"}</span>
          </div>
          <div className="mt-2 flex justify-between gap-3">
            <span className="text-slate-500">{localizedText("Đã thanh toán", "Paid amount")}</span>
            <span className="font-medium text-slate-800">{money(refund.paidAmount)}</span>
          </div>
          <div className="mt-2 flex justify-between gap-3">
            <span className="text-slate-500">{localizedText("Hóa đơn cuối", "Final invoice")}</span>
            <span className="font-medium text-slate-800">{money(refund.finalAmount)}</span>
          </div>
          <div className="mt-2 flex justify-between gap-3 border-t border-slate-200 pt-2">
            <span className="font-semibold text-slate-800">{localizedText("Số tiền hoàn", "Refund amount")}</span>
            <span className="font-bold text-blue-700">{money(refund.refundAmount)}</span>
          </div>
          <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={amountConfirmed}
              onChange={(event) => setAmountConfirmed(event.target.checked)}
              className="mt-0.5 accent-blue-600"
            />
            <span>{localizedText("Tôi đã đối chiếu số tiền đã thanh toán và hóa đơn cuối, xác nhận số tiền hoàn là chính xác.", "I reviewed the paid amount and final invoice and confirm the refund amount is correct.")}</span>
          </label>
        </div>

        <div className="mt-4 space-y-4">
          <fieldset className="space-y-2">
            <legend className="font-semibold text-slate-900">{localizedText("Phương thức chuyển tiền", "Transfer method")}</legend>
            <label className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3">
              <input
                type="radio"
                name={`checkout-refund-transfer-${refund.id}`}
                checked={refundTransferMethod === "PAYOS"}
                onChange={() => setRefundTransferMethod("PAYOS")}
                className="mt-1 accent-blue-600"
              />
              <span className="text-sm">
                <span className="block font-semibold text-slate-800">{localizedText("Tự động qua PayOS", "Automatic via PayOS")}</span>
                <span className="mt-1 block text-xs text-slate-500">{localizedText("Hệ thống gửi lệnh chuyển tiền và theo dõi trạng thái payout.", "PayOS sends the transfer and tracks its payout status.")}</span>
              </span>
            </label>
            <label className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3">
              <input
                type="radio"
                name={`checkout-refund-transfer-${refund.id}`}
                checked={refundTransferMethod === "MANUAL_BANK"}
                onChange={() => setRefundTransferMethod("MANUAL_BANK")}
                className="mt-1 accent-blue-600"
              />
              <span className="text-sm">
                <span className="block font-semibold text-slate-800">{localizedText("Chuyển khoản thủ công", "Manual bank transfer")}</span>
                <span className="mt-1 block text-xs text-slate-500">{localizedText("Nhân viên tự chuyển khoản ngoài hệ thống, sau đó xác nhận giao dịch tại đây.", "Staff transfers outside the system, then confirms the transaction here.")}</span>
              </span>
            </label>
          </fieldset>

          <div>
            <h4 className="font-semibold text-slate-900">{localizedText("Tài khoản thụ hưởng", "Recipient account")}</h4>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {localizedText("Xác nhận tài khoản với khách trước khi duyệt hoàn.", "Verify the recipient account with the guest before approving the refund.")}
            </p>
            {hasBankAccount && (
              <label className="mt-3 flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3">
                <input
                  type="radio"
                  name={`checkout-refund-account-${refund.id}`}
                  checked={refundAccountChoice === "saved"}
                  onChange={() => setRefundAccountChoice("saved")}
                  className="mt-1 accent-blue-600"
                />
                <span className="min-w-0 text-sm">
                  <span className="block font-semibold text-slate-800">{localizedText("Tài khoản đã lưu", "Saved account")}</span>
                  <span className="mt-1 block break-words text-slate-600">
                    {isLoadingBankDetails
                      ? localizedText("Đang tải thông tin đã mã hóa...", "Loading encrypted account details...")
                      : `${savedBank.bankName} · ${savedBank.bankAccountName} · ${savedBank.bankAccountNumber}`}
                  </span>
                </span>
              </label>
            )}
            <label className="mt-2 flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3">
              <input
                type="radio"
                name={`checkout-refund-account-${refund.id}`}
                checked={refundAccountChoice === "alternate"}
                onChange={() => setRefundAccountChoice("alternate")}
                className="mt-1 accent-blue-600"
              />
              <span className="text-sm font-semibold text-slate-800">
                {hasBankAccount ? localizedText("Nhập tài khoản khác", "Enter another account") : localizedText("Nhập tài khoản nhận tiền", "Enter recipient account")}
              </span>
            </label>
            {refundAccountChoice === "alternate" && (
              <div className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
                <BankSelectionField
                  bankName={bank.bankName}
                  bankCode={bank.bankCode}
                  requireBankCode={refundTransferMethod === "PAYOS"}
                  onChange={(bankName, bankCode) => setBank((current) => ({ ...current, bankName, bankCode }))}
                />
                <label className="text-sm font-semibold text-slate-700">
                  {localizedText("Tên chủ tài khoản", "Account holder name")} <span className="text-rose-600" aria-hidden="true">*</span>
                  <input
                    value={bank.bankAccountName}
                    onChange={(event) => setBank((current) => ({ ...current, bankAccountName: event.target.value }))}
                    maxLength={120}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  {localizedText("Số tài khoản", "Account number")} <span className="text-rose-600" aria-hidden="true">*</span>
                  <input
                    inputMode="numeric"
                    value={bank.bankAccountNumber}
                    onChange={(event) => setBank((current) => ({ ...current, bankAccountNumber: event.target.value }))}
                    maxLength={50}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400"
                  />
                </label>
              </div>
            )}
            {refundTransferMethod === "PAYOS" && !hasSelectedPayOSBankAccount && (
              <p className="mt-2 text-xs text-amber-700">
                {localizedText("PayOS yêu cầu ngân hàng hỗ trợ và mã BIN hợp lệ. Nếu tài khoản không hỗ trợ, hãy chọn chuyển khoản thủ công.", "PayOS requires a supported bank and valid BIN. If the account is unsupported, choose manual bank transfer.")}
              </p>
            )}
          </div>

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={customerConfirmed}
              onChange={(event) => setCustomerConfirmed(event.target.checked)}
              className="mt-0.5 accent-blue-600"
            />
            <span>{localizedText("Tôi đã xác nhận với khách hàng đây là tài khoản nhận tiền hoàn.", "I confirmed with the guest that this is the correct refund recipient account.")}</span>
          </label>
        </div>

        {errorMessage && (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {errorMessage}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={closeApprovalDialog}
            disabled={isWorking}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            {localizedText("Đóng", "Close")}
          </button>
          <button
            type="button"
            onClick={() => void approve()}
            disabled={!amountConfirmed || !customerConfirmed || !hasSelectedBankAccount || (refundTransferMethod === "PAYOS" && !hasSelectedPayOSBankAccount) || isWorking}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
          >
            {isWorking && <LoaderCircle size={15} className="animate-spin" />}
            {isWorking ? localizedText("Đang xử lý...", "Processing...") : localizedText("Duyệt hoàn tiền", "Approve refund")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog
      open={isManualConfirmDialogOpen}
      onOpenChange={(open) => {
        if (open) setIsManualConfirmDialogOpen(true);
        else closeManualConfirmDialog();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{localizedText("Xác nhận hoàn tiền thủ công", "Confirm manual refund")} · {refund.bookingId}</DialogTitle>
          <DialogDescription>
            {localizedText("Xác nhận đã hoàn tiền bên ngoài hệ thống. Mã giao dịch có thể nhập để đối soát, không bắt buộc.", "Confirm that the refund was completed outside the system. A transaction reference is optional.")}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">{localizedText("Khách hàng", "Guest")}</span>
            <span className="text-right font-semibold text-slate-800">{refund.customerName || "—"}</span>
          </div>
          <div className="mt-2 flex justify-between gap-3">
            <span className="text-slate-500">{localizedText("Số tiền hoàn", "Refund amount")}</span>
            <span className="font-bold text-blue-700">{money(refund.refundAmount)}</span>
          </div>
        </div>

        <div className="mt-1 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
          <p className="text-sm leading-5 text-emerald-800">
            {localizedText("Thao tác này chỉ ghi nhận khoản hoàn đã chuyển bên ngoài hệ thống; không gửi lệnh qua PayOS.", "This only records a refund transferred outside the system; it does not send a PayOS payout.")}
          </p>
          <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={refundCompletedConfirmed}
              onChange={(event) => setRefundCompletedConfirmed(event.target.checked)}
              className="mt-0.5 accent-emerald-600"
            />
            <span>{localizedText("Tôi xác nhận khoản hoàn tiền này đã được chuyển cho khách.", "I confirm this refund has been transferred to the guest.")}</span>
          </label>
          <label className="mt-3 block text-sm font-semibold text-slate-700">
            {localizedText("Mã giao dịch (không bắt buộc)", "Transaction reference (optional)")}
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={120}
              placeholder={localizedText("Nhập mã giao dịch nếu có", "Enter a transaction reference if available")}
              className="mt-1 h-10 w-full rounded-lg border border-emerald-200 bg-white px-3 text-sm font-normal outline-none focus:border-emerald-400"
            />
          </label>
        </div>

        {errorMessage && (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {errorMessage}
          </p>
        )}
        <div className="mt-2 flex justify-end gap-3">
          <button
            type="button"
            onClick={closeManualConfirmDialog}
            disabled={isConfirming}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            {localizedText("Đóng", "Close")}
          </button>
          <button
            type="button"
            onClick={() => void completeRefund()}
            disabled={!refundCompletedConfirmed || isConfirming}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isConfirming && <LoaderCircle size={15} className="animate-spin" />}
            {isConfirming ? localizedText("Đang xử lý...", "Processing...") : localizedText("Xác nhận hoàn tiền thủ công", "Confirm manual refund")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
