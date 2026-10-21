import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Banknote, Check, Clock3, LoaderCircle, RefreshCw, Save } from "lucide-react";
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
  const cashRefunds = visibleRefunds.filter((refund) => refund.refundMethod === "CASH");
  const onlineRefunds = visibleRefunds.filter((refund) => refund.refundMethod !== "CASH");
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
              {localizedText("Tách riêng với hoàn do hủy phòng. Chọn kênh đặt phòng và phương thức hoàn tiền bên dưới.", "Separate from room cancellation refunds. Choose the booking channel and refund method below.")}
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
        <div>
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
            <div className="divide-y divide-slate-100">
              {cashRefunds.length > 0 && (
                <section>
                  <header className="border-b border-emerald-100 bg-emerald-50/60 px-5 py-3">
                    <h4 className="font-semibold text-emerald-900">{localizedText("Hoàn tiền mặt tại quầy", "Cash refunds at front desk")}</h4>
                    <p className="mt-0.5 text-xs text-emerald-800">
                      {localizedText("Nhân viên xác nhận tại đây sau khi đã giao tiền trực tiếp cho khách.", "Staff confirm here after handing the cash directly to the guest.")}
                    </p>
                  </header>
                  {cashRefunds.map((refund) => <CheckoutRefundCard key={refund.id} refund={refund} />)}
                </section>
              )}
              {onlineRefunds.length > 0 && (
                <section>
                  <header className="border-b border-blue-100 bg-blue-50/60 px-5 py-3">
                    <h4 className="font-semibold text-blue-900">{localizedText("Hoàn tiền online", "Online refunds")}</h4>
                    <p className="mt-0.5 text-xs text-blue-800">
                      {localizedText("Duyệt thông tin hoàn, sau đó xác nhận chuyển khoản hoặc giao dịch ví điện tử.", "Review refund details, then confirm the bank transfer or e-wallet transaction.")}
                    </p>
                  </header>
                  {onlineRefunds.map((refund) => <CheckoutRefundCard key={refund.id} refund={refund} />)}
                </section>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function CheckoutRefundCard({ refund }: { refund: CheckoutRefund }) {
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
    if (refund.refundMethod !== "CASH" && !note.trim()) {
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

  return (
    <article className="p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-blue-700">Booking {refund.bookingId}</span>
            {refund.bookingChannel && (
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                refund.bookingChannel === "ONLINE"
                  ? "bg-sky-50 text-sky-700"
                  : "bg-violet-50 text-violet-700"
              }`}>
                {refund.bookingChannel === "ONLINE"
                  ? localizedText("Đặt online", "Online booking")
                  : localizedText("Đặt tại quầy", "Front-desk booking")}
              </span>
            )}
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
              {localizedText("Thanh toán dư", "Guest overpayment")}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              refund.status === "PENDING"
                ? "bg-amber-100 text-amber-800"
                : refund.status === "APPROVED"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-emerald-100 text-emerald-800"
            }`}>
              {refund.status === "PENDING"
                ? refund.refundMethod === "CASH" ? localizedText("Chờ xác nhận tiền mặt", "Cash confirmation pending") : localizedText("Chờ duyệt", "Pending review")
                : refund.status === "APPROVED" ? localizedText("Chờ chuyển khoản", "Awaiting transfer") : localizedText("Đã hoàn", "Refunded")}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              refund.refundMethod === "CASH"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-blue-100 text-blue-800"
            }`}>
              {refund.refundMethod === "CASH"
                ? localizedText("Hoàn tiền mặt tại quầy", "Cash at front desk")
                : refund.refundMethod === "EWALLET"
                  ? localizedText("Hoàn qua ví điện tử", "E-wallet refund")
                  : localizedText("Hoàn qua ngân hàng", "Bank transfer")}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-700">
            {refund.customerName || localizedText("Khách hàng", "Guest")}{refund.customerPhone ? ` · ${refund.customerPhone}` : ""}
            {" · "}{dateTime(refund.requestedAt)}
          </p>
          <div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-3">
            <p><span className="text-slate-500">{localizedText("Đã thu:", "Collected:")}</span> <strong>{money(refund.paidAmount)}</strong></p>
            <p><span className="text-slate-500">{localizedText("Hóa đơn cuối:", "Final invoice:")}</span> <strong>{money(refund.finalAmount)}</strong></p>
            <p><span className="text-slate-500">{localizedText("Cần hoàn:", "Refund due:")}</span> <strong className="text-blue-700">{money(refund.refundAmount)}</strong></p>
          </div>
          {refund.status !== "REFUNDED" && !isCashRefund && (
            <div className="mt-3">
              {editingBank ? (
                <div className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
                  <BankSelectionField
                    bankName={bank.bankName}
                    bankCode={bank.bankCode}
                    onChange={(bankName, bankCode) => setBank((current) => ({ ...current, bankName, bankCode }))}
                  />
                  <label className="text-sm font-semibold text-slate-700">
                    {localizedText("Tên chủ tài khoản *", "Account holder name *")}
                    <input
                      value={bank.bankAccountName}
                      onChange={(event) => setBank((current) => ({ ...current, bankAccountName: event.target.value }))}
                      maxLength={120}
                      className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal"
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    {localizedText("Số tài khoản *", "Account number *")}
                    <input
                      inputMode="numeric"
                      value={bank.bankAccountNumber}
                      onChange={(event) => setBank((current) => ({ ...current, bankAccountNumber: event.target.value }))}
                      maxLength={50}
                      className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal"
                    />
                  </label>
                  <div className="flex items-end gap-2">
                    <button type="button" onClick={() => void saveBank()} disabled={isWorking} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
                      <Save size={14} /> {localizedText("Lưu tài khoản", "Save account")}
                    </button>
                    <button type="button" onClick={() => setEditingBank(false)} disabled={isWorking} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-500">
                      {localizedText("Hủy", "Cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  {hasBankAccount ? (
                    <span className="text-slate-700">
                      {refund.bankName} · {refund.bankAccountName} · <span className="font-mono">{refund.bankAccountNumber}</span>
                    </span>
                  ) : (
                    <span className="font-medium text-amber-700">{localizedText("Chưa có tài khoản ngân hàng hợp lệ.", "No valid bank account is available.")}</span>
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
                      className="font-semibold text-blue-700 hover:underline"
                    >
                      {hasBankAccount ? localizedText("Sửa tài khoản", "Edit account") : localizedText("Nhập tài khoản", "Enter account")}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {refund.status === "PENDING" && (
            !isCashRefund ? <div className="mt-3 space-y-2">
              <label className="flex items-start gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={amountConfirmed} onChange={(event) => setAmountConfirmed(event.target.checked)} className="mt-0.5 accent-blue-600" />
                {localizedText("Tôi đã đối chiếu số tiền thu và khoản hoàn dư.", "I have verified the collected amount and refund amount.")}
              </label>
              <label className="flex items-start gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={customerConfirmed} onChange={(event) => setCustomerConfirmed(event.target.checked)} className="mt-0.5 accent-blue-600" />
                {localizedText("Tôi đã xác nhận tài khoản nhận với khách hàng.", "I have confirmed the recipient account with the guest.")}
              </label>
            </div> : (
              <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-amber-700">
                <Clock3 size={14} /> {localizedText("Chờ nhân viên xác nhận đã giao tiền mặt trực tiếp cho khách.", "Awaiting staff confirmation that cash was handed directly to the guest.")}
              </p>
            )
          )}
          {refund.status === "APPROVED" && (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-blue-700">
              <Clock3 size={14} /> {localizedText("Quản lý đã duyệt. Chuyển khoản thủ công và ghi nhận giao dịch trong 1–3 ngày.", "Approved by a manager. Complete the bank transfer and record it within 1–3 days.")}
            </p>
          )}
          {refund.status === "REFUNDED" && refund.refundMethod === "CASH" && (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <Check size={14} /> {localizedText("Đã hoàn tiền mặt trực tiếp cho khách khi check-out.", "Cash was refunded directly to the guest at check-out.")}
            </p>
          )}
          {refund.status === "REFUNDED" && refund.refundedAt && (
            <p className="mt-2 text-xs text-emerald-700">{localizedText("Đã ghi nhận hoàn", "Refund recorded")} {dateTime(refund.refundedAt)}{refund.note ? ` · ${refund.note}` : ""}</p>
          )}
        </div>
        <div className="flex w-full flex-col gap-2 lg:w-72">
          {refund.status !== "REFUNDED" && (
            <label className="text-xs font-semibold text-slate-600">
              {refund.status === "APPROVED" ? localizedText("Mã giao dịch chuyển khoản *", "Bank transfer reference *") : localizedText("Ghi chú (không bắt buộc)", "Note (optional)")}
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                placeholder={refund.status === "APPROVED" ? localizedText("Nhập mã giao dịch ngân hàng...", "Enter bank transfer reference...") : isCashRefund ? localizedText("Ví dụ: đã giao tiền cho khách tại quầy...", "Example: cash handed to the guest at the front desk...") : localizedText("Nhập ghi chú...", "Enter a note...")}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal"
              />
            </label>
          )}
          {refund.status === "PENDING" && (
            isCashRefund ? (
              <button
                type="button"
                onClick={() => void completeRefund()}
                disabled={isWorking}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-50"
              >
                {isConfirming ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />} {localizedText("Xác nhận đã hoàn tiền mặt", "Confirm cash refund")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void approve()}
                disabled={!hasBankAccount || !amountConfirmed || !customerConfirmed || isWorking}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isApproving ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />} {localizedText("Duyệt hoàn ngân hàng", "Approve bank refund")}
              </button>
            )
          )}
          {refund.status === "APPROVED" && (
            <button
              type="button"
              onClick={() => void completeRefund()}
              disabled={!note.trim() || isWorking}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isConfirming ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />} {localizedText("Xác nhận đã chuyển", "Confirm transfer")}
            </button>
          )}
        </div>
      </div>
      {errorMessage && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle size={15} className="mt-0.5 shrink-0" /> {errorMessage}
        </p>
      )}
    </article>
  );
}
