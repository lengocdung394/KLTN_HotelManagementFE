import { useState } from "react";
import { AlertCircle, Banknote, Check, Clock3, LoaderCircle, RefreshCw, Save } from "lucide-react";
import BankSelectionField from "./BankSelectionField";
import {
  useApproveCheckoutRefundMutation,
  useConfirmCheckoutRefundMutation,
  useGetCheckoutRefundsQuery,
  useUpdateCheckoutRefundBankDetailsMutation,
  type CheckoutRefund,
} from "../services/managementBookingApi";

const money = (amount: number) =>
  `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(amount ?? 0))}đ`;

const dateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("vi-VN");
};

const getErrorMessage = (error: unknown) => {
  if (!error || typeof error !== "object") return "Đã xảy ra lỗi. Vui lòng thử lại.";
  const apiError = error as { data?: { message?: string }; error?: string; message?: string };
  return apiError.data?.message ?? apiError.message ?? apiError.error ?? "Đã xảy ra lỗi. Vui lòng thử lại.";
};

export default function CheckoutRefundApprovalsPanel() {
  const { data: refunds = [], isLoading, isFetching, isError, error, refetch } = useGetCheckoutRefundsQuery();
  const pending = refunds.filter((refund) => refund.status === "PENDING");
  const approved = refunds.filter((refund) => refund.status === "APPROVED");
  const refunded = refunds.filter((refund) => refund.status === "REFUNDED");

  return (
    <section className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-amber-100 bg-amber-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800">
            <Banknote size={20} />
          </span>
          <div>
            <h3 className="font-bold text-slate-900">Hoàn khoản thu dư khi check-out</h3>
            <p className="mt-1 text-sm text-slate-600">
              Quản lý đối chiếu và chuyển khoản thủ công trong 1–3 ngày; khoản tiền mặt đã hoàn được ghi nhận tại quầy.
            </p>
            <p className="mt-2 text-xs font-medium text-slate-500">
              {pending.length} chờ xử lý · {approved.length} chờ chuyển khoản · {refunded.length} đã hoàn
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
          Làm mới
        </button>
      </header>
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
          <LoaderCircle size={18} className="animate-spin" /> Đang tải yêu cầu hoàn dư...
        </div>
      ) : isError ? (
        <div className="p-6 text-center">
          <p className="text-sm font-semibold text-rose-700">Không tải được yêu cầu hoàn dư</p>
          <p className="mt-1 text-sm text-slate-500">{getErrorMessage(error)}</p>
        </div>
      ) : refunds.length === 0 ? (
        <p className="p-8 text-center text-sm text-slate-500">Chưa có yêu cầu hoàn dư qua ngân hàng.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {refunds.map((refund) => <CheckoutRefundCard key={refund.id} refund={refund} />)}
        </div>
      )}
    </section>
  );
}

function CheckoutRefundCard({ refund }: { refund: CheckoutRefund }) {
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
  const hasBankAccount = Boolean(
    refund.bankName?.trim()
    && refund.bankAccountName?.trim()
    && /^[0-9]{6,50}$/.test(refund.bankAccountNumber?.trim() ?? ""),
  );

  const saveBank = async () => {
    if (!bank.bankName.trim() || !bank.bankAccountName.trim() || !/^[0-9]{6,50}$/.test(bank.bankAccountNumber.trim())) {
      setErrorMessage("Vui lòng nhập ngân hàng, tên chủ tài khoản và số tài khoản hợp lệ.");
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
      setErrorMessage("Cần xác nhận số tiền và xác nhận đã hỏi khách về tài khoản nhận.");
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
    if (!note.trim()) {
      setErrorMessage("Nhập mã giao dịch hoặc ghi chú chuyển khoản để hoàn tất.");
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
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              refund.status === "PENDING"
                ? "bg-amber-100 text-amber-800"
                : refund.status === "APPROVED"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-emerald-100 text-emerald-800"
            }`}>
              {refund.status === "PENDING" ? "Chờ duyệt" : refund.status === "APPROVED" ? "Chờ chuyển khoản" : "Đã hoàn"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-700">
            {refund.customerName || "Khách hàng"}{refund.customerPhone ? ` · ${refund.customerPhone}` : ""}
            {" · "}{dateTime(refund.requestedAt)}
          </p>
          <div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-3">
            <p><span className="text-slate-500">Đã thu:</span> <strong>{money(refund.paidAmount)}</strong></p>
            <p><span className="text-slate-500">Hóa đơn cuối:</span> <strong>{money(refund.finalAmount)}</strong></p>
            <p><span className="text-slate-500">Cần hoàn:</span> <strong className="text-blue-700">{money(refund.refundAmount)}</strong></p>
          </div>
          {refund.status !== "REFUNDED" && (
            <div className="mt-3">
              {editingBank ? (
                <div className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
                  <BankSelectionField
                    bankName={bank.bankName}
                    bankCode={bank.bankCode}
                    onChange={(bankName, bankCode) => setBank((current) => ({ ...current, bankName, bankCode }))}
                  />
                  <label className="text-sm font-semibold text-slate-700">
                    Tên chủ tài khoản *
                    <input
                      value={bank.bankAccountName}
                      onChange={(event) => setBank((current) => ({ ...current, bankAccountName: event.target.value }))}
                      maxLength={120}
                      className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal"
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Số tài khoản *
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
                      <Save size={14} /> Lưu tài khoản
                    </button>
                    <button type="button" onClick={() => setEditingBank(false)} disabled={isWorking} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-500">
                      Hủy
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
                    <span className="font-medium text-amber-700">Chưa có tài khoản ngân hàng hợp lệ.</span>
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
                      {hasBankAccount ? "Sửa tài khoản" : "Nhập tài khoản"}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {refund.status === "PENDING" && (
            <div className="mt-3 space-y-2">
              <label className="flex items-start gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={amountConfirmed} onChange={(event) => setAmountConfirmed(event.target.checked)} className="mt-0.5 accent-blue-600" />
                Tôi đã đối chiếu số tiền thu và khoản hoàn dư.
              </label>
              <label className="flex items-start gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={customerConfirmed} onChange={(event) => setCustomerConfirmed(event.target.checked)} className="mt-0.5 accent-blue-600" />
                Tôi đã xác nhận tài khoản nhận với khách hàng.
              </label>
            </div>
          )}
          {refund.status === "APPROVED" && (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-blue-700">
              <Clock3 size={14} /> Quản lý đã duyệt. Chuyển khoản thủ công và ghi nhận giao dịch trong 1–3 ngày.
            </p>
          )}
          {refund.status === "REFUNDED" && refund.refundedAt && (
            <p className="mt-2 text-xs text-emerald-700">Đã ghi nhận hoàn {dateTime(refund.refundedAt)}{refund.note ? ` · ${refund.note}` : ""}</p>
          )}
        </div>
        <div className="flex w-full flex-col gap-2 lg:w-72">
          {refund.status !== "REFUNDED" && (
            <label className="text-xs font-semibold text-slate-600">
              {refund.status === "APPROVED" ? "Mã giao dịch chuyển khoản *" : "Ghi chú (không bắt buộc)"}
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                placeholder={refund.status === "APPROVED" ? "Nhập mã giao dịch ngân hàng..." : "Nhập ghi chú..."}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal"
              />
            </label>
          )}
          {refund.status === "PENDING" && (
            <button
              type="button"
              onClick={() => void approve()}
              disabled={!hasBankAccount || !amountConfirmed || !customerConfirmed || isWorking}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isApproving ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />} Duyệt hoàn ngân hàng
            </button>
          )}
          {refund.status === "APPROVED" && (
            <button
              type="button"
              onClick={() => void completeRefund()}
              disabled={!note.trim() || isWorking}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isConfirming ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />} Xác nhận đã chuyển
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
