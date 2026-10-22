import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Banknote, Check, LoaderCircle, RefreshCw, Save } from "lucide-react";
import BankSelectionField from "./BankSelectionField";
import { localizedText } from "../i18n";
import {
  useApproveCheckoutRefundMutation,
  useConfirmCheckoutRefundMutation,
  useGetCheckoutRefundsQuery,
  useUpdateCheckoutRefundBankDetailsMutation,
  type CheckoutRefund,
} from "../services/managementBookingApi";

const money = (amount: number) =>
  `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(amount ?? 0))}₫`;

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

export default function CheckoutRefundApprovalsPanel() {
  useTranslation();
  const { data: refunds = [], isLoading, isFetching, isError, error, refetch } = useGetCheckoutRefundsQuery();
  const [channelFilter, setChannelFilter] = useState<"ALL" | "ONLINE" | "OFFLINE">("ALL");
  const pending = refunds.filter((refund) => refund.status === "PENDING");
  const approved = refunds.filter((refund) => refund.status === "APPROVED");
  const refunded = refunds.filter((refund) => refund.status === "REFUNDED");
  const visibleRefunds = channelFilter === "ALL"
    ? refunds
    : refunds.filter((refund) => refund.bookingChannel === channelFilter);
  const pendingCashRefunds = refunds.filter((refund) => refund.refundMethod === "CASH" && refund.status === "PENDING");

  return (
    <section className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-amber-100 bg-amber-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800">
            <Banknote size={20} />
          </span>
          <div>
            <h3 className="font-bold text-slate-900">{localizedText("Hoàn tiền do khách thanh toán dư", "Refunds for guest overpayment")}</h3>
            <p className="mt-1 text-sm text-slate-600">
              {localizedText("Theo dõi từng khoản hoàn theo booking, số tiền, hình thức và trạng thái.", "Review each refund by booking, amount, method, and status.")}
            </p>
            <p className="mt-2 text-xs font-medium text-slate-500">
              {pendingCashRefunds.length} {localizedText("chờ xác nhận tiền mặt", "cash refunds to confirm")} · {pending.length - pendingCashRefunds.length} {localizedText("chờ duyệt hoàn online", "online refunds to review")} · {approved.length} {localizedText("chờ hoàn online", "awaiting online refund")} · {refunded.length} {localizedText("đã hoàn", "refunded")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-amber-50 disabled:opacity-60"
        >
          <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
          {localizedText("Làm mới", "Refresh")}
        </button>
      </header>
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
          <LoaderCircle size={18} className="animate-spin" /> {localizedText("Đang tải yêu cầu hoàn dư...", "Loading refund requests...")}
        </div>
      ) : isError ? (
        <div className="p-6 text-center">
          <p className="text-sm font-semibold text-rose-700">{localizedText("Không tải được yêu cầu hoàn dư", "Could not load refund requests")}</p>
          <p className="mt-1 text-sm text-slate-500">{getErrorMessage(error)}</p>
        </div>
      ) : refunds.length === 0 ? (
        <p className="p-8 text-center text-sm text-slate-500">{localizedText("Chưa có khoản hoàn dư nào.", "There are no surplus refunds.")}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
            <span className="mr-1 text-xs font-semibold text-slate-500">{localizedText("Kênh đặt:", "Booking channel:")}</span>
            {([
              ["ALL", localizedText("Tất cả", "All")],
              ["ONLINE", localizedText("Online", "Online")],
              ["OFFLINE", localizedText("Tại quầy / Offline", "Front desk / Offline")],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setChannelFilter(value)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  channelFilter === value
                    ? "bg-violet-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {visibleRefunds.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              {localizedText("Không có khoản hoàn nào thuộc kênh đặt phòng này.", "There are no refunds for this booking channel.")}
            </p>
          ) : (
            <div className="max-w-full overflow-x-auto">
              <table className="w-full min-w-[1240px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-[230px] px-4 py-3">{localizedText("Booking / khách hàng", "Booking / guest")}</th>
                    <th className="w-[150px] px-4 py-3">{localizedText("Ngày yêu cầu", "Request date")}</th>
                    <th className="w-[190px] px-4 py-3">{localizedText("Đã thu / hóa đơn", "Paid / invoice")}</th>
                    <th className="w-[150px] px-4 py-3 text-right">{localizedText("Cần hoàn", "Refund due")}</th>
                    <th className="w-[250px] px-4 py-3">{localizedText("Hình thức / tài khoản", "Method / account")}</th>
                    <th className="w-[270px] px-4 py-3">{localizedText("Trạng thái / thao tác", "Status / actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleRefunds.map((refund) => <CheckoutRefundRow key={refund.id} refund={refund} />)}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function CheckoutRefundRow({ refund }: { refund: CheckoutRefund }) {
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
      <td className="px-4 py-4">
        <p className="font-semibold text-blue-700">Booking {refund.bookingId}</p>
        <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
          refund.bookingChannel === "ONLINE" ? "bg-sky-50 text-sky-700" : "bg-violet-50 text-violet-700"
        }`}>
          {refund.bookingChannel === "ONLINE"
            ? localizedText("Đặt online", "Online booking")
            : localizedText("Đặt tại quầy", "Front-desk booking")}
        </span>
        <p className="mt-2 font-medium text-slate-800">{refund.customerName || localizedText("Khách hàng", "Guest")}</p>
        {refund.customerPhone && <p className="mt-0.5 text-xs text-slate-500">{refund.customerPhone}</p>}
      </td>
      <td className="px-4 py-4 text-slate-600">{dateTime(refund.requestedAt)}</td>
      <td className="space-y-1 px-4 py-4">
        <p><span className="text-xs text-slate-500">{localizedText("Đã thu", "Paid")}</span><br /><strong>{money(refund.paidAmount)}</strong></p>
        <p><span className="text-xs text-slate-500">{localizedText("Hóa đơn cuối", "Final invoice")}</span><br /><strong>{money(refund.finalAmount)}</strong></p>
      </td>
      <td className="px-4 py-4 text-right">
        <strong className="text-base text-blue-700">{money(refund.refundAmount)}</strong>
        <span className={`mt-2 block text-xs font-semibold ${isCashRefund ? "text-emerald-700" : "text-indigo-700"}`}>
          {isCashRefund
            ? localizedText("Tiền mặt tại quầy", "Cash at front desk")
            : refund.refundMethod === "EWALLET" ? localizedText("Ví điện tử", "E-wallet") : localizedText("Chuyển khoản", "Bank transfer")}
        </span>
      </td>
      <td className="px-4 py-4">
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
      </td>
      <td className="px-4 py-4">
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
                <button type="button" onClick={() => void completeRefund()} disabled={isWorking} className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 py-2 text-xs font-semibold text-white disabled:opacity-50">
                  {isConfirming ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />}
                  {localizedText("Xác nhận đã hoàn tiền mặt", "Confirm cash refund")}
                </button>
              ) : (
                <button type="button" onClick={() => void approve()} disabled={!hasBankAccount || !amountConfirmed || !customerConfirmed || isWorking} className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-blue-600 px-2 py-2 text-xs font-semibold text-white disabled:opacity-50">
                  {isApproving ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />}
                  {localizedText("Duyệt hoàn", "Approve refund")}
                </button>
              )
            )}
            {refund.status === "APPROVED" && (
              <button type="button" onClick={() => void completeRefund()} disabled={!note.trim() || isWorking} className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 py-2 text-xs font-semibold text-white disabled:opacity-50">
                {isConfirming ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />}
                {localizedText("Xác nhận đã chuyển", "Confirm transfer")}
              </button>
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
      </td>
    </tr>
  );
}
