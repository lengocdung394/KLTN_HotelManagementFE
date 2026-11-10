import { useAppSelector } from "../store/hooks";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Banknote, Check, Columns3, LoaderCircle, RefreshCw, RotateCcw, Save, Search } from "lucide-react";
import BankSelectionField from "./BankSelectionField";
import ListPagination from "./ListPagination";
import SearchableFilter from "./SearchableFilter";
import { localizedText } from "../i18n";
import { toast } from "@/components/ui/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  useApproveCheckoutRefundMutation,
  useConfirmCheckoutRefundMutation,
  useGetCheckoutRefundsQuery,
  useUpdateCheckoutRefundBankDetailsMutation,
  type CheckoutRefund,
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
  { id: "customer", label: ["Khách hàng", "Guest"], width: 200 },
  { id: "channel", label: ["Kênh đặt", "Booking channel"], width: 220 },
  { id: "date", label: ["Ngày yêu cầu", "Request date"], width: 170 },
  { id: "paid", label: ["Đã thu / hóa đơn", "Paid / invoice"], width: 190 },
  { id: "amount", label: ["Số tiền hoàn", "Refund amount"], width: 160 },
  { id: "method", label: ["Kênh hoàn tiền", "Refund method"], width: 165 },
  { id: "account", label: ["Hình thức / tài khoản", "Method / account"], width: 250 },
  { id: "refundedAt", label: ["Thời gian hoàn", "Refund time"], width: 180 },
  { id: "refundedBy", label: ["Người hoàn tiền", "Refunded by"], width: 180 },
  { id: "status", label: ["Trạng thái / thao tác", "Status / actions"], width: 290 },
] as const;
type CheckoutRefundColumnId = (typeof CHECKOUT_REFUND_COLUMNS)[number]["id"];

export default function CheckoutRefundApprovalsPanel() {
  useTranslation();
  const { data: refunds = [], isLoading, isFetching, isError, error, refetch } = useGetCheckoutRefundsQuery();
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
    method: true,
    account: true,
    refundedAt: true,
    refundedBy: true,
    status: true,
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const pending = refunds.filter((refund) => refund.status === "PENDING");
  const approved = refunds.filter((refund) => refund.status === "APPROVED");
  const refunded = refunds.filter((refund) => refund.status === "REFUNDED");
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
  const visibleRefunds = refunds.filter((refund) => {
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
  const pendingCashRefunds = refunds.filter((refund) => refund.refundMethod === "CASH" && refund.status === "PENDING");
  const hasActiveFilters = Boolean(searchQuery.trim()) || statusFilter !== "ALL";
  const shownColumns = CHECKOUT_REFUND_COLUMNS.filter((column) => visibleColumns[column.id]);
  const isListLoading = isLoading || isFetching || isManuallyRefreshing;

  const refreshOrResetFilters = async () => {
    if (isListLoading) return;
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
              {pendingCashRefunds.length} {localizedText("chờ xác nhận tiền mặt", "cash refunds to confirm")} · {pending.length - pendingCashRefunds.length} {localizedText("chờ duyệt hoàn online", "online refunds to review")} · {approved.length} {localizedText("chờ hoàn online", "awaiting online refund")} · {refunded.length} {localizedText("đã hoàn", "refunded")}
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
            { value: "PENDING", label: localizedText("Chờ xử lý", "Pending") },
            { value: "APPROVED", label: localizedText("Chờ chuyển khoản", "Awaiting transfer") },
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
                  method: true,
                  account: true,
                  refundedAt: true,
                  refundedBy: true,
                  status: true,
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
            disabled={isListLoading}
            aria-label={hasActiveFilters
              ? localizedText("Xóa bộ lọc", "Reset filters")
              : localizedText("Tải lại danh sách hoàn dư", "Reload surplus refunds")}
            title={hasActiveFilters
              ? localizedText("Xóa bộ lọc", "Reset filters")
              : localizedText("Tải lại danh sách hoàn dư", "Reload surplus refunds")}
            aria-busy={isListLoading}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
          >
            {isListLoading
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
      ) : refunds.length === 0 ? (
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
                <table className="table-fixed text-left text-sm" style={{ width: `max(100%, ${shownColumns.reduce((width, column) => width + column.width, 0)}px)` }}>
                <colgroup>
                  {shownColumns.map((column) => <col key={column.id} style={{ width: `${column.width}px` }} />)}
                </colgroup>
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {shownColumns.map((column) => <th key={column.id} className={`px-4 py-3 ${column.id === "amount" ? "text-right" : ""}`}>{localizedText(column.label[0], column.label[1])}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedRefunds.map((refund) => <CheckoutRefundRow key={refund.id} refund={refund} visibleColumns={visibleColumns} />)}
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
}: {
  refund: CheckoutRefund;
  visibleColumns: Record<CheckoutRefundColumnId, boolean>;
}) {
  const roles = useAppSelector((state) => state.auth.roles);
  const canApproveRefund = roles.includes("ROLE_MANAGER") || roles.includes("ROLE_SUPER_ADMIN") || roles.includes("ROLE_ADMIN");
  const canConfirmCashRefund = canApproveRefund || roles.includes("ROLE_RECEPTIONIST") || roles.includes("ROLE_STAFF") || roles.includes("ROLE_EMPLOYEE");
  useTranslation();
  const [updateBankDetails, { isLoading: isSaving }] = useUpdateCheckoutRefundBankDetailsMutation();
  const [approveRefund, { isLoading: isApproving }] = useApproveCheckoutRefundMutation();
  const [confirmRefund, { isLoading: isConfirming }] = useConfirmCheckoutRefundMutation();
  const [editingBank, setEditingBank] = useState(false);
  const [bank, setBank] = useState({
    bankName: refund.bankName ?? "",
    bankCode: refund.bankCode ?? "",
    bankAccountName: refund.bankAccountName ?? "",
    bankAccountNumber: refund.bankAccountNumber ?? "",
  });
  const [amountConfirmed, setAmountConfirmed] = useState(false);
  const [customerConfirmed, setCustomerConfirmed] = useState(false);
  const [note, setNote] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const isWorking = isSaving || isApproving || isConfirming;
  const isCashRefund = refund.refundMethod === "CASH";
  const hasBankAccount = Boolean(
    refund.bankName?.trim()
    && refund.bankAccountName?.trim()
    && /^[0-9]{6,50}$/.test(refund.bankAccountNumber?.trim() ?? ""),
  );

  const saveBank = async () => {
    if (!bank.bankName.trim() || !bank.bankAccountName.trim() || !/^[0-9]{6,50}$/.test(bank.bankAccountNumber.trim())) {
      setErrorMessage(localizedText("Vui lòng nhập ngân hàng, tên chủ tài khoản và số tài khoản hợp lệ.", "Enter a valid bank, account holder name, and account number."));
      return;
    }
    setErrorMessage("");
    try {
      await updateBankDetails({
        refundId: refund.id,
        request: {
          bankName: bank.bankName.trim(),
          bankCode: bank.bankCode.trim() || undefined,
          bankAccountName: bank.bankAccountName.trim(),
          bankAccountNumber: bank.bankAccountNumber.trim(),
        },
      }).unwrap();
      setEditingBank(false);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  const approve = async () => {
    if (!amountConfirmed || !customerConfirmed) {
      setErrorMessage(localizedText("Cần xác nhận số tiền và xác nhận đã hỏi khách về tài khoản nhận.", "Confirm the refund amount and that the recipient account has been verified with the guest."));
      return;
    }
    setErrorMessage("");
    try {
      await approveRefund({ refundId: refund.id, note: note.trim() || undefined }).unwrap();
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  const completeRefund = async () => {
    if (!isCashRefund && !note.trim()) {
      setErrorMessage(localizedText("Nhập mã giao dịch hoặc ghi chú chuyển khoản để hoàn tất.", "Enter the transfer reference or a note to complete the refund."));
      return;
    }
    setErrorMessage("");
    try {
      await confirmRefund({ refundId: refund.id, note: note.trim() }).unwrap();
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  const status = refund.status === "PENDING"
    ? isCashRefund ? localizedText("Chờ xác nhận tiền mặt", "Cash confirmation pending") : localizedText("Chờ duyệt", "Pending review")
    : refund.status === "APPROVED" ? localizedText("Chờ chuyển khoản", "Awaiting transfer") : localizedText("Đã hoàn", "Refunded");

  return (
    <tr className="align-top hover:bg-slate-50/70">
      {visibleColumns.booking && <td className="px-4 py-4">
        <p className="break-all font-semibold text-blue-700">{refund.bookingId}</p>
      </td>}
      {visibleColumns.customer && <td className="px-4 py-4">
        <p className="font-medium text-slate-800">{refund.customerName || localizedText("Khách hàng", "Guest")}</p>
        {refund.customerPhone && <p className="mt-1 text-xs text-slate-500">{refund.customerPhone}</p>}
      </td>}
      {visibleColumns.channel && <td className="px-4 py-4">
        <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
          refund.bookingChannel === "ONLINE" ? "bg-sky-50 text-sky-700" : "bg-violet-50 text-violet-700"
        }`}>
          {refund.bookingChannel === "ONLINE"
            ? localizedText("Đặt online", "Online booking")
            : refund.bookingChannel === "OFFLINE"
              ? localizedText("Đặt tại quầy", "Front-desk booking")
              : "—"}
        </span>
      </td>}
      {visibleColumns.date && <td className="px-4 py-4 text-slate-600">{dateTime(refund.requestedAt)}</td>}
      {visibleColumns.paid && <td className="space-y-1 px-4 py-4">
        <p><span className="text-xs text-slate-500">{localizedText("Đã thu", "Paid")}</span><br /><strong>{money(refund.paidAmount)}</strong></p>
        <p><span className="text-xs text-slate-500">{localizedText("Hóa đơn cuối", "Final invoice")}</span><br /><strong>{money(refund.finalAmount)}</strong></p>
      </td>}
      {visibleColumns.amount && <td className="px-4 py-4 text-right">
        <strong className="text-base text-blue-700">{money(refund.refundAmount)}</strong>
      </td>}
      {visibleColumns.method && <td className="px-4 py-4">
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
          isCashRefund ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700"
        }`}>
          {isCashRefund
            ? localizedText("Tiền mặt", "Cash")
            : refund.refundMethod === "EWALLET" ? localizedText("Ví điện tử", "E-wallet") : localizedText("Chuyển khoản", "Bank transfer")}
        </span>
      </td>}
      {visibleColumns.account && <td className="px-4 py-4">
        {isCashRefund ? (
          <span className="text-sm text-slate-600">{localizedText("Hoàn trực tiếp cho khách", "Refund directly to guest")}</span>
        ) : editingBank ? (
          <div className="space-y-2">
            <BankSelectionField
              bankName={bank.bankName}
              bankCode={bank.bankCode}
              onChange={(bankName, bankCode) => setBank((current) => ({ ...current, bankName, bankCode }))}
            />
            <input
              aria-label={localizedText("Tên chủ tài khoản", "Account holder name")}
              value={bank.bankAccountName}
              onChange={(event) => setBank((current) => ({ ...current, bankAccountName: event.target.value }))}
              maxLength={120}
              placeholder={localizedText("Tên chủ tài khoản", "Account holder name")}
              className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs"
            />
            <input
              aria-label={localizedText("Số tài khoản", "Account number")}
              inputMode="numeric"
              value={bank.bankAccountNumber}
              onChange={(event) => setBank((current) => ({ ...current, bankAccountNumber: event.target.value }))}
              maxLength={50}
              placeholder={localizedText("Số tài khoản", "Account number")}
              className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => void saveBank()} disabled={isWorking} className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                <Save size={13} className="mr-1 inline" />{localizedText("Lưu", "Save")}
              </button>
              <button type="button" onClick={() => setEditingBank(false)} disabled={isWorking} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500">
                {localizedText("Hủy", "Cancel")}
              </button>
            </div>
          </div>
        ) : (
          <>
            {hasBankAccount ? (
              <div className="text-xs text-slate-700">
                <p className="font-semibold">{refund.bankName}</p>
                <p>{refund.bankAccountName}</p>
                <p className="font-mono">{refund.bankAccountNumber}</p>
              </div>
            ) : (
              <p className="text-xs font-medium text-amber-700">{localizedText("Chưa có tài khoản hợp lệ", "No valid bank account")}</p>
            )}
            {refund.status === "PENDING" && (
              <button
                type="button"
                onClick={() => {
                  setBank({
                    bankName: refund.bankName ?? "",
                    bankCode: refund.bankCode ?? "",
                    bankAccountName: refund.bankAccountName ?? "",
                    bankAccountNumber: refund.bankAccountNumber ?? "",
                  });
                  setEditingBank(true);
                }}
                className="mt-2 text-xs font-semibold text-blue-700 hover:underline"
              >
                {hasBankAccount ? localizedText("Sửa tài khoản", "Edit account") : localizedText("Nhập tài khoản", "Enter account")}
              </button>
            )}
          </>
        )}
      </td>}
      {visibleColumns.refundedAt && <td className="px-4 py-4 text-slate-600">
        {refund.status === "REFUNDED" ? dateTime(refund.refundedAt) : "—"}
      </td>}
      {visibleColumns.refundedBy && <td className="px-4 py-4 text-slate-700">
        {refund.status === "REFUNDED" ? refund.refundedBy || "—" : "—"}
      </td>}
      {visibleColumns.status && <td className="px-4 py-4">
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
          refund.status === "PENDING"
            ? "bg-amber-100 text-amber-800"
            : refund.status === "APPROVED" ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"
        }`}>
          {status}
        </span>
        {refund.status !== "REFUNDED" && (
          <div className="mt-2 space-y-2">
            {!isCashRefund && refund.status === "PENDING" && (
              <>
                <label className="flex items-start gap-1.5 text-[11px] text-slate-600">
                  <input type="checkbox" checked={amountConfirmed} onChange={(event) => setAmountConfirmed(event.target.checked)} className="mt-0.5 accent-blue-600" />
                  {localizedText("Đã đối chiếu số tiền", "Amount verified")}
                </label>
                <label className="flex items-start gap-1.5 text-[11px] text-slate-600">
                  <input type="checkbox" checked={customerConfirmed} onChange={(event) => setCustomerConfirmed(event.target.checked)} className="mt-0.5 accent-blue-600" />
                  {localizedText("Đã xác nhận với khách", "Confirmed with guest")}
                </label>
              </>
            )}
            <input
              aria-label={refund.status === "APPROVED" ? localizedText("Mã giao dịch chuyển khoản", "Bank transfer reference") : localizedText("Ghi chú", "Note")}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={500}
              placeholder={refund.status === "APPROVED"
                ? localizedText("Mã giao dịch *", "Transfer reference *")
                : localizedText("Ghi chú (không bắt buộc)", "Note (optional)")}
              className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs"
            />
            {refund.status === "PENDING" && (
              isCashRefund ? (
                canConfirmCashRefund ? (
                  <button type="button" onClick={() => void completeRefund()} disabled={isWorking} className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 py-2 text-xs font-semibold text-white disabled:opacity-50">
                    {isConfirming ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />}
                    {localizedText("Xác nhận đã hoàn tiền mặt", "Confirm cash refund")}
                  </button>
                ) : null
              ) : (
                canApproveRefund ? (
                  <button type="button" onClick={() => void approve()} disabled={!hasBankAccount || !amountConfirmed || !customerConfirmed || isWorking} className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-blue-600 px-2 py-2 text-xs font-semibold text-white disabled:opacity-50">
                    {isApproving ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />}
                    {localizedText("Duyệt hoàn", "Approve refund")}
                  </button>
                ) : (
                  <p className="rounded-lg bg-amber-50 px-2 py-2 text-xs text-amber-800">
                    {localizedText("Chờ quản lý quyết định duyệt hoàn.", "Awaiting manager's refund decision.")}
                  </p>
                )
              )
            )}
            {refund.status === "APPROVED" && (
              canApproveRefund ? (
                <button type="button" onClick={() => void completeRefund()} disabled={!note.trim() || isWorking} className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 py-2 text-xs font-semibold text-white disabled:opacity-50">
                  {isConfirming ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />}
                  {localizedText("Xác nhận đã chuyển", "Confirm transfer")}
                </button>
              ) : (
                <p className="rounded-lg bg-blue-50 px-2 py-2 text-xs text-blue-800">
                  {localizedText("Đã duyệt; chờ quản lý xác nhận chuyển khoản.", "Approved; awaiting manager confirmation of the transfer.")}
                </p>
              )
            )}
          </div>
        )}
        {refund.status === "REFUNDED" && (
          <p className="mt-2 text-xs text-emerald-700">
            {refund.refundedAt ? `${localizedText("Đã hoàn", "Refunded")} ${dateTime(refund.refundedAt)}` : localizedText("Đã hoàn tiền", "Refund completed")}
            {refund.note ? ` · ${refund.note}` : ""}
          </p>
        )}
        {errorMessage && (
          <p role="alert" className="mt-2 flex items-start gap-1 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />{errorMessage}
          </p>
        )}
      </td>}
    </tr>
  );
}
