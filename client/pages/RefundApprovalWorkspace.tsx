import {
  AlertCircle,
  Banknote,
  Check,
  Copy,
  ClipboardCheck,
  LoaderCircle,
  RefreshCw,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import BankSelectionField from "../components/BankSelectionField";
import CheckoutRefundApprovalsPanel from "../components/CheckoutRefundApprovalsPanel";
import DatePickerPopover from "../components/DatePickerPopover";
import {
  useApproveBookingRefundMutation,
  useConfirmBookingRefundMutation,
  useGetBookingCancellationsQuery,
  useRejectBookingRefundMutation,
  useSubmitRefundBankDetailsByStaffMutation,
  type BookingCancellation,
  type BookingCancellationStatus,
} from "../services/managementBookingApi";

type CancellationAction = "approve" | "reject" | "confirm" | "bank-details";
type CancellationFilter = "ALL" | BookingCancellationStatus;
type RefundAccountChoice = "saved" | "alternate";

const statusLabels: Record<BookingCancellationStatus, string> = {
  REFUND_BANK_DETAILS_REQUIRED: "Chờ thông tin ngân hàng",
  REFUND_REVIEW_PENDING: "Chờ duyệt hoàn tiền",
  REFUND_APPROVED: "Đã duyệt - chờ chuyển khoản",
  REFUND_REJECTED: "Từ chối hoàn tiền",
  REFUNDED: "Đã hoàn tiền",
  NO_REFUND_REQUIRED: "Không cần hoàn tiền",
};

const statusStyles: Record<BookingCancellationStatus, string> = {
  REFUND_BANK_DETAILS_REQUIRED: "border-amber-200 bg-amber-50 text-amber-800",
  REFUND_REVIEW_PENDING: "border-blue-200 bg-blue-50 text-blue-800",
  REFUND_APPROVED: "border-violet-200 bg-violet-50 text-violet-800",
  REFUND_REJECTED: "border-rose-200 bg-rose-50 text-rose-800",
  REFUNDED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  NO_REFUND_REQUIRED: "border-slate-200 bg-slate-100 text-slate-700",
};

const money = (value: number | undefined) =>
  `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value ?? 0))}đ`;

const dateTime = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("vi-VN");
};

const errorMessage = (error: unknown) => {
  if (!error || typeof error !== "object") return "Đã xảy ra lỗi. Vui lòng thử lại.";
  const apiError = error as {
    data?: unknown;
    error?: string;
    message?: string;
  };
  if (typeof apiError.data === "string") return apiError.data;
  if (apiError.data && typeof apiError.data === "object") {
    const data = apiError.data as { message?: string; result?: { message?: string } };
    if (data.message) return data.message;
    if (data.result?.message) return data.result.message;
  }
  return apiError.message ?? apiError.error ?? "Đã xảy ra lỗi. Vui lòng thử lại.";
};

const actionTitle: Record<CancellationAction, string> = {
  approve: "Duyệt hoàn tiền",
  reject: "Từ chối hoàn tiền",
  confirm: "Xác nhận đã chuyển khoản",
  "bank-details": "Nhập tài khoản nhận hoàn",
};

const actionDescription: Record<CancellationAction, string> = {
  approve: "Đối chiếu chính sách và số tiền hoàn, xác nhận với khách tài khoản nhận tiền rồi mới duyệt.",
  reject: "Yêu cầu hoàn tiền sẽ bị từ chối. Vui lòng ghi rõ lý do.",
  confirm: "Chỉ xác nhận sau khi đã chuyển tiền hoàn cho khách ngoài hệ thống.",
  "bank-details": "Nhập thông tin khách cung cấp. Khách không cần có tài khoản trên website.",
};

export default function RefundApprovalWorkspace() {
  const { data: cancellations = [], isLoading, isFetching, isError, error, refetch } =
    useGetBookingCancellationsQuery();
  const [approveRefund, { isLoading: isApproving }] = useApproveBookingRefundMutation();
  const [rejectRefund, { isLoading: isRejecting }] = useRejectBookingRefundMutation();
  const [confirmRefund, { isLoading: isConfirming }] = useConfirmBookingRefundMutation();
  const [submitBankDetails, { isLoading: isSavingBankDetails }] = useSubmitRefundBankDetailsByStaffMutation();
  const [filter, setFilter] = useState<CancellationFilter>("ALL");
  const [selectedRequestDate, setSelectedRequestDate] = useState<string | null>(null);
  const [activeCancellation, setActiveCancellation] = useState<BookingCancellation | null>(null);
  const [activeAction, setActiveAction] = useState<CancellationAction | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [bankDetails, setBankDetails] = useState({
    bankName: "",
    bankCode: "",
    bankAccountName: "",
    bankAccountNumber: "",
  });
  const [refundAccountChoice, setRefundAccountChoice] = useState<RefundAccountChoice>("saved");
  const [refundAmountVerified, setRefundAmountVerified] = useState(false);
  const [refundAccountConfirmed, setRefundAccountConfirmed] = useState(false);
  const [refundEmail, setRefundEmail] = useState("");
  const [actionError, setActionError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [copyError, setCopyError] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyValue = async (value: string, field: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setCopyError("");
      window.setTimeout(() => {
        setCopiedField((current) => current === field ? null : current);
      }, 1500);
    } catch {
      setCopyError("Không thể sao chép. Vui lòng kiểm tra quyền clipboard của trình duyệt.");
    }
  };

  const counts = useMemo(() => ({
    reviewPending: cancellations.filter((item) => item.status === "REFUND_REVIEW_PENDING").length,
    needsBankDetails: cancellations.filter((item) => item.status === "REFUND_BANK_DETAILS_REQUIRED").length,
    processing: cancellations.filter((item) => item.status === "REFUND_APPROVED").length,
    refunded: cancellations.filter((item) => item.status === "REFUNDED").length,
    totalRefunded: cancellations
      .filter((item) => item.status === "REFUNDED")
      .reduce((total, item) => total + Number(item.refundAmount ?? 0), 0),
  }), [cancellations]);

  const refundRequestsByDate = useMemo(() => {
    const requestCounts = new Map<string, number>();
    cancellations.forEach((item) => {
      if (Number(item.refundAmount) <= 0 || !item.requestedAt) return;
      const date = new Date(item.requestedAt);
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      requestCounts.set(key, (requestCounts.get(key) ?? 0) + 1);
    });
    return requestCounts;
  }, [cancellations]);
  const refundRequestDates = useMemo(() => Array.from(refundRequestsByDate.keys()), [refundRequestsByDate]);

  const visibleCancellations = useMemo(() => {
    const byStatus = filter === "ALL"
      ? cancellations
      : cancellations.filter((item) => item.status === filter);
    const filtered = selectedRequestDate
      ? byStatus.filter((item) => {
          if (Number(item.refundAmount) <= 0 || !item.requestedAt) return false;
          const date = new Date(item.requestedAt);
          if (Number.isNaN(date.getTime())) return false;
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
          return key === selectedRequestDate;
        })
      : byStatus;
    return [...filtered].sort((first, second) =>
      new Date(second.requestedAt ?? 0).getTime() - new Date(first.requestedAt ?? 0).getTime(),
    );
  }, [cancellations, filter, selectedRequestDate]);

  const isSubmitting = isApproving || isRejecting || isConfirming || isSavingBankDetails;
  const pendingTotal = counts.reviewPending + counts.needsBankDetails;

  const openAction = (cancellation: BookingCancellation, action: CancellationAction) => {
    setActiveCancellation(cancellation);
    setActiveAction(action);
    setActionNote("");
    setBankDetails({
      bankName: cancellation.bankName ?? "",
      bankCode: cancellation.bankCode ?? "",
      bankAccountName: cancellation.bankAccountName ?? "",
      bankAccountNumber: cancellation.bankAccountNumber ?? "",
    });
    setRefundEmail(cancellation.refundEmail ?? "");
    const hasSavedAccount = Boolean(
      cancellation.bankName?.trim()
      && cancellation.bankAccountName?.trim()
      && cancellation.bankAccountNumber?.trim(),
    );
    setRefundAccountChoice(hasSavedAccount ? "saved" : "alternate");
    setRefundAmountVerified(false);
    setRefundAccountConfirmed(false);
    setActionError("");
  };

  const closeAction = () => {
    if (isSubmitting) return;
    setActiveCancellation(null);
    setActiveAction(null);
    setActionNote("");
    setBankDetails({ bankName: "", bankCode: "", bankAccountName: "", bankAccountNumber: "" });
    setRefundEmail("");
    setActionError("");
  };

  const submitAction = async () => {
    if (!activeCancellation || !activeAction) return;
    if (activeAction === "reject" && !actionNote.trim()) {
      setActionError("Vui lòng nhập lý do từ chối hoàn tiền.");
      return;
    }
    if (activeAction === "bank-details"
      && refundEmail.trim()
      && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(refundEmail.trim())) {
      setActionError("Vui lòng nhập email khách hàng hợp lệ.");
      return;
    }
    if (activeAction === "approve") {
      if (!refundAmountVerified) {
        setActionError("Vui lòng đối chiếu và xác nhận số tiền hoàn trước khi duyệt.");
        return;
      }
      if (!refundAccountConfirmed) {
        setActionError("Vui lòng xác nhận đã thống nhất tài khoản nhận hoàn với khách hàng.");
        return;
      }
      if (refundAccountChoice === "saved"
        && (!activeCancellation.bankName?.trim()
          || !activeCancellation.bankAccountName?.trim()
          || !/^[0-9]{6,50}$/.test(activeCancellation.bankAccountNumber?.trim() ?? ""))) {
        setActionError("Tài khoản đã lưu chưa đầy đủ. Vui lòng nhập tài khoản nhận hoàn khác.");
        return;
      }
      if (refundAccountChoice === "alternate"
        && (!bankDetails.bankName.trim()
          || !bankDetails.bankAccountName.trim()
          || !/^[0-9]{6,50}$/.test(bankDetails.bankAccountNumber.trim()))) {
        setActionError("Vui lòng nhập ngân hàng, tên chủ tài khoản và số tài khoản hợp lệ (6–50 chữ số).");
        return;
      }
    }
    if (activeAction === "bank-details"
      && (!bankDetails.bankName.trim()
        || !bankDetails.bankAccountName.trim()
        || !/^[0-9]{6,50}$/.test(bankDetails.bankAccountNumber.trim()))) {
      setActionError("Vui lòng nhập tên ngân hàng, tên chủ tài khoản và số tài khoản hợp lệ (6–50 chữ số).");
      return;
    }
    setActionError("");
    try {
      if (activeAction === "bank-details") {
        await submitBankDetails({
          cancellationId: activeCancellation.id,
          request: {
            bankName: bankDetails.bankName.trim(),
            bankCode: bankDetails.bankCode.trim() || undefined,
            bankAccountName: bankDetails.bankAccountName.trim(),
            bankAccountNumber: bankDetails.bankAccountNumber.trim(),
            ...(refundEmail.trim() ? { refundEmail: refundEmail.trim() } : {}),
          },
        }).unwrap();
        setFeedback(`Đã lưu tài khoản nhận hoàn cho booking ${activeCancellation.bookingId}; yêu cầu đang chờ duyệt.`);
      } else if (activeAction === "approve") {
        if (refundAccountChoice === "alternate") {
          await submitBankDetails({
            cancellationId: activeCancellation.id,
            request: {
              bankName: bankDetails.bankName.trim(),
              bankCode: bankDetails.bankCode.trim() || undefined,
              bankAccountName: bankDetails.bankAccountName.trim(),
              bankAccountNumber: bankDetails.bankAccountNumber.trim(),
              ...(refundEmail.trim() ? { refundEmail: refundEmail.trim() } : {}),
            },
          }).unwrap();
        }
        await approveRefund({
          cancellationId: activeCancellation.id,
          note: actionNote.trim() || undefined,
          refundAmountVerified,
          refundAccountConfirmed,
        }).unwrap();
        setFeedback(`Đã duyệt hoàn ${money(activeCancellation.refundAmount)} cho booking ${activeCancellation.bookingId}; hãy chuyển khoản đúng tài khoản đã xác nhận với khách.`);
      } else if (activeAction === "reject") {
        await rejectRefund({
          cancellationId: activeCancellation.id,
          note: actionNote.trim(),
        }).unwrap();
        setFeedback(`Đã từ chối yêu cầu hoàn tiền của booking ${activeCancellation.bookingId}.`);
      } else {
        await confirmRefund({
          cancellationId: activeCancellation.id,
          note: actionNote.trim() || undefined,
        }).unwrap();
        setFeedback(`Đã ghi nhận hoàn tiền cho booking ${activeCancellation.bookingId}.`);
      }
      setActiveCancellation(null);
      setActiveAction(null);
      setActionNote("");
      setBankDetails({ bankName: "", bankCode: "", bankAccountName: "", bankAccountNumber: "" });
      setRefundEmail("");
      setRefundAmountVerified(false);
      setRefundAccountConfirmed(false);
    } catch (submitError: unknown) {
      setActionError(errorMessage(submitError));
    }
  };

  const filters: { value: CancellationFilter; label: string }[] = [
    { value: "ALL", label: "Tất cả" },
    { value: "REFUND_REVIEW_PENDING", label: "Chờ duyệt" },
    { value: "REFUND_BANK_DETAILS_REQUIRED", label: "Chờ thông tin ngân hàng" },
    { value: "REFUND_APPROVED", label: "Chờ chuyển khoản" },
    { value: "REFUNDED", label: "Đã hoàn" },
    { value: "REFUND_REJECTED", label: "Đã từ chối" },
    { value: "NO_REFUND_REQUIRED", label: "Không cần hoàn" },
  ];

  return (
    <section className="mt-6 space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Chờ xử lý hoàn tiền"
          value={String(pendingTotal)}
          detail={`${counts.reviewPending} chờ duyệt · ${counts.needsBankDetails} chờ thông tin ngân hàng`}
          tone="violet"
        />
        <StatCard label="Đang xử lý chuyển khoản" value={String(counts.processing)} tone="blue" />
        <StatCard label="Đã hoàn tiền" value={String(counts.refunded)} tone="green" />
        <StatCard label="Tổng tiền đã hoàn" value={money(counts.totalRefunded)} tone="slate" />
      </div>

      <CheckoutRefundApprovalsPanel />

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
              <ClipboardCheck size={20} />
            </span>
            <div>
              <h3 className="font-bold text-slate-900">Yêu cầu hủy và hoàn tiền</h3>
              <p className="mt-1 text-sm text-slate-500">
                Booking được hủy bởi khách hoặc nhân viên sẽ hiển thị tại đây nếu có tiền cần hoàn.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  Ngày có yêu cầu
                </span>
                <DatePickerPopover
                  value={selectedRequestDate ? new Date(`${selectedRequestDate}T00:00:00`) : undefined}
                  onChange={(date) => setSelectedRequestDate(date
                    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
                    : null)}
                  highlightDates={refundRequestDates}
                  placeholder="Chọn ngày"
                  label="Lịch yêu cầu"
                />
                {selectedRequestDate && (
                  <button
                    type="button"
                    onClick={() => setSelectedRequestDate(null)}
                    className="rounded-lg px-2 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                  >
                    Tất cả ngày
                  </button>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
            Làm mới
          </button>
        </div>

        {feedback && (
          <div className="mx-5 mt-4 flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <span>{feedback}</span>
            <button type="button" onClick={() => setFeedback("")} aria-label="Đóng thông báo">
              <X size={16} />
            </button>
          </div>
        )}
        {copyError && (
          <p role="alert" className="mx-5 mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {copyError}
          </p>
        )}

        <div className="flex gap-2 overflow-x-auto border-b border-slate-100 px-5 py-3">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                filter === item.value
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {item.label}
              {item.value === "REFUND_REVIEW_PENDING" && counts.reviewPending > 0 && (
                <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5">{counts.reviewPending}</span>
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500">
            <LoaderCircle size={18} className="animate-spin" /> Đang tải yêu cầu hoàn tiền...
          </div>
        ) : isError ? (
          <div className="p-8 text-center">
            <AlertCircle size={24} className="mx-auto text-rose-500" />
            <p className="mt-3 text-sm font-semibold text-slate-800">Không tải được danh sách yêu cầu hoàn tiền</p>
            <p className="mt-1 text-sm text-slate-500">{errorMessage(error)}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Thử lại
            </button>
          </div>
        ) : visibleCancellations.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardCheck size={28} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">
              {selectedRequestDate
                ? "Không có yêu cầu hoàn tiền phù hợp trong ngày đã chọn"
                : filter === "ALL" ? "Chưa có yêu cầu hủy cần xử lý" : "Không có yêu cầu ở trạng thái này"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Yêu cầu hoàn tiền có thể cần tải lại sau khi nhân viên hủy booking.
            </p>
          </div>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[1380px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="w-[220px] px-4 py-3">Booking / khách hàng</th>
                  <th className="w-[170px] px-4 py-3">Ngày yêu cầu</th>
                  <th className="w-[300px] px-4 py-3">Tài khoản nhận hoàn</th>
                  <th className="w-[240px] px-4 py-3 text-right">Tiền hoàn</th>
                  <th className="w-[210px] px-4 py-3">Trạng thái</th>
                  <th className="w-[220px] px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleCancellations.map((cancellation) => (
                  <tr key={cancellation.id} className="align-top hover:bg-slate-50/70">
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-blue-700">{cancellation.bookingId}</p>
                        {cancellation.bookingChannel && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            cancellation.bookingChannel === "ONLINE"
                              ? "bg-sky-50 text-sky-700"
                              : "bg-violet-50 text-violet-700"
                          }`}>
                            {cancellation.bookingChannel}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <p className="text-slate-800">{cancellation.customerName || "Khách hàng"}</p>
                        {cancellation.customerName && (
                          <CopyValueButton
                            label="tên khách hàng"
                            value={cancellation.customerName}
                            copied={copiedField === `${cancellation.id}:customer`}
                            onCopy={() => void copyValue(cancellation.customerName!, `${cancellation.id}:customer`)}
                          />
                        )}
                      </div>
                      {cancellation.customerPhone && (
                        <p className="mt-0.5 text-xs text-slate-500">{cancellation.customerPhone}</p>
                      )}
                      {cancellation.reason && (
                        <p className="mt-2 max-w-xs text-xs text-slate-500">Lý do: {cancellation.reason}</p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-slate-600">{dateTime(cancellation.requestedAt)}</td>
                    <td className="px-4 py-4">
                      {cancellation.bankAccountNumber ? (
                        <div className="space-y-1">
                          {[
                            ["Ngân hàng", cancellation.bankName, "bank"],
                            ["Chủ tài khoản", cancellation.bankAccountName, "name"],
                            ["Số tài khoản", cancellation.bankAccountNumber, "number"],
                          ].map(([label, value, field]) => value && (
                            <div key={field} className="flex items-center gap-1.5">
                              <span className={`min-w-0 truncate ${field === "number" ? "font-mono text-xs text-slate-500" : field === "name" ? "text-slate-700" : "font-semibold text-slate-800"}`}>
                                {value}
                              </span>
                              <CopyValueButton
                                label={label}
                                value={value}
                                copied={copiedField === `${cancellation.id}:${field}`}
                                onCopy={() => void copyValue(value, `${cancellation.id}:${field}`)}
                              />
                            </div>
                          ))}
                          {cancellation.refundEmail && (
                            <p className="pt-1 text-xs text-slate-500">Email: {cancellation.refundEmail}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-amber-700">Khách chưa cung cấp thông tin</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <p className="font-bold text-slate-900">{money(cancellation.refundAmount)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Phòng (trước phạt) {money(
                          Number(cancellation.roomRefundAmount ?? 0)
                          + Number(cancellation.roomPenaltyAmount ?? 0),
                        )} · Dịch vụ hoàn {money(cancellation.serviceRefundAmount)}
                      </p>
                      {Number(cancellation.roomPenaltyAmount) > 0 && (
                        <p className="mt-1 text-xs text-rose-600">Phạt phòng {money(cancellation.roomPenaltyAmount)}</p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[cancellation.status]}`}>
                        {statusLabels[cancellation.status]}
                      </span>
                      {cancellation.reviewNote && (
                        <p className="mt-2 max-w-xs text-xs text-slate-500">Ghi chú: {cancellation.reviewNote}</p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <div className="flex min-w-max justify-end gap-2">
                        {cancellation.status === "REFUND_REVIEW_PENDING" && (
                          <>
                            <button
                              type="button"
                              onClick={() => openAction(cancellation, "approve")}
                              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                            >
                              <Check size={14} /> Duyệt
                            </button>
                            <button
                              type="button"
                              onClick={() => openAction(cancellation, "reject")}
                              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                            >
                              <X size={14} /> Từ chối
                            </button>
                          </>
                        )}
                        {cancellation.status === "REFUND_APPROVED" && (
                          <button
                            type="button"
                            onClick={() => openAction(cancellation, "confirm")}
                            className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                          >
                            <Banknote size={14} /> Xác nhận đã chuyển
                          </button>
                        )}
                        {cancellation.status === "REFUND_BANK_DETAILS_REQUIRED" && (
                          <button
                            type="button"
                            onClick={() => openAction(cancellation, "bank-details")}
                            className="inline-flex shrink-0 whitespace-nowrap rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50"
                          >
                            Nhập thông tin ngân hàng
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {activeCancellation && activeAction && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="refund-action-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="refund-action-title" className="text-lg font-bold text-slate-900">
                  {actionTitle[activeAction]} · {activeCancellation.bookingId}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{actionDescription[activeAction]}</p>
              </div>
              <button
                type="button"
                onClick={closeAction}
                disabled={isSubmitting}
                aria-label="Đóng"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Khách hàng</span>
                <div className="flex items-center gap-1.5 text-right font-semibold text-slate-800">
                  <span>{activeCancellation.customerName || "—"}</span>
                  {activeCancellation.customerName && (
                    <CopyValueButton
                      label="tên khách hàng"
                      value={activeCancellation.customerName}
                      copied={copiedField === `${activeCancellation.id}:customer`}
                      onCopy={() => void copyValue(activeCancellation.customerName!, `${activeCancellation.id}:customer`)}
                    />
                  )}
                </div>
              </div>
              <div className="mt-2 flex justify-between gap-3">
                <span className="text-slate-500">Số tiền hoàn</span>
                <span className="font-bold text-blue-700">{money(activeCancellation.refundAmount)}</span>
              </div>
              {activeAction !== "approve" && (
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <p className="font-semibold text-slate-700">Tài khoản nhận tiền</p>
                  {activeCancellation.bankAccountNumber ? (
                  <div className="mt-2 space-y-1">
                    {[
                      ["Ngân hàng", activeCancellation.bankName, "bank"],
                      ["Chủ tài khoản", activeCancellation.bankAccountName, "name"],
                      ["Số tài khoản", activeCancellation.bankAccountNumber, "number"],
                    ].map(([label, value, field]) => value && (
                      <div key={field} className="flex items-center justify-between gap-2 text-slate-600">
                        <span>{label}: <strong>{value}</strong></span>
                        <CopyValueButton
                          label={label}
                          value={value}
                          copied={copiedField === `${activeCancellation.id}:${field}`}
                          onCopy={() => void copyValue(value, `${activeCancellation.id}:${field}`)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-amber-700">Chưa có thông tin ngân hàng.</p>
                )}
                </div>
              )}
            </div>

            {activeAction === "approve" && (
              <>
                <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                  <h4 className="font-semibold text-slate-900">Đối chiếu chi tiết tiền hoàn</h4>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-600">Tổng tiền khách đã thanh toán</dt>
                      <dd className="font-medium text-slate-900">{money(activeCancellation.paidAmount)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-600">Tiền phòng trước phạt</dt>
                      <dd className="font-medium text-slate-900">
                        {money(Number(activeCancellation.roomRefundAmount ?? 0) + Number(activeCancellation.roomPenaltyAmount ?? 0))}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-600">Phạt hủy phòng</dt>
                      <dd className="font-medium text-rose-700">−{money(activeCancellation.roomPenaltyAmount)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-600">Tiền phòng hoàn sau phạt</dt>
                      <dd className="font-medium text-slate-900">{money(activeCancellation.roomRefundAmount)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-600">Tiền dịch vụ hoàn</dt>
                      <dd className="font-medium text-slate-900">{money(activeCancellation.serviceRefundAmount)}</dd>
                    </div>
                    <div className="flex justify-between gap-3 border-t border-blue-200 pt-2">
                      <dt className="font-semibold text-slate-800">Tổng tiền chuyển lại</dt>
                      <dd className="font-bold text-blue-700">{money(activeCancellation.refundAmount)}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs leading-5 text-slate-600">
                    Chính sách: {activeCancellation.refundPolicy || "Không có thông tin"}
                    {typeof activeCancellation.hoursBeforeCheckIn === "number"
                      ? ` · Yêu cầu trước giờ nhận phòng ${activeCancellation.hoursBeforeCheckIn} giờ`
                      : ""}
                  </p>
                  <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={refundAmountVerified}
                      onChange={(event) => setRefundAmountVerified(event.target.checked)}
                      className="mt-0.5 accent-blue-600"
                    />
                    <span>Tôi đã đối chiếu chính sách, số tiền đã thanh toán và xác nhận số tiền hoàn khớp thực tế.</span>
                  </label>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <h4 className="font-semibold text-slate-900">Tài khoản thụ hưởng</h4>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Dùng tài khoản khách đã cung cấp/tự lấy từ giao dịch thanh toán nếu có, hoặc nhập tài khoản khác theo xác nhận của khách.
                    </p>
                  </div>
                  {activeCancellation.bankName
                    && activeCancellation.bankAccountName
                    && activeCancellation.bankAccountNumber && (
                    <label className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3">
                      <input
                        type="radio"
                        name="refund-account-choice"
                        checked={refundAccountChoice === "saved"}
                        onChange={() => setRefundAccountChoice("saved")}
                        className="mt-1 accent-blue-600"
                      />
                      <span className="min-w-0 text-sm">
                        <span className="block font-semibold text-slate-800">Tài khoản đã lưu</span>
                        <span className="mt-1 block break-words text-slate-600">
                          {activeCancellation.bankName} · {activeCancellation.bankAccountName} · {activeCancellation.bankAccountNumber}
                        </span>
                      </span>
                    </label>
                  )}
                  <label className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3">
                    <input
                      type="radio"
                      name="refund-account-choice"
                      checked={refundAccountChoice === "alternate"}
                      onChange={() => {
                        setRefundAccountChoice("alternate");
                        setBankDetails({ bankName: "", bankCode: "", bankAccountName: "", bankAccountNumber: "" });
                      }}
                      className="mt-1 accent-blue-600"
                    />
                    <span className="text-sm font-semibold text-slate-800">Nhập tài khoản khác</span>
                  </label>
                  {refundAccountChoice === "alternate" && (
                    <div className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
                      <BankSelectionField
                        bankName={bankDetails.bankName}
                        bankCode={bankDetails.bankCode}
                        onChange={(bankName, bankCode) =>
                          setBankDetails((current) => ({ ...current, bankName, bankCode }))
                        }
                      />
                      <label className="text-sm font-semibold text-slate-700">
                        Tên chủ tài khoản *
                        <input
                          value={bankDetails.bankAccountName}
                          onChange={(event) => setBankDetails((current) => ({ ...current, bankAccountName: event.target.value }))}
                          maxLength={120}
                          className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400"
                        />
                      </label>
                      <label className="text-sm font-semibold text-slate-700">
                        Số tài khoản *
                        <input
                          inputMode="numeric"
                          value={bankDetails.bankAccountNumber}
                          onChange={(event) => setBankDetails((current) => ({ ...current, bankAccountNumber: event.target.value }))}
                          maxLength={50}
                          className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400"
                        />
                      </label>
                    </div>
                  )}
                  <label className="flex items-start gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={refundAccountConfirmed}
                      onChange={(event) => setRefundAccountConfirmed(event.target.checked)}
                      className="mt-0.5 accent-blue-600"
                    />
                    <span>Tôi đã xác nhận với khách hàng rằng đây là tài khoản nhận tiền hoàn.</span>
                  </label>
                </div>
              </>
            )}

            {activeAction === "bank-details" ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                  Email nhận thông báo (không bắt buộc)
                  <input
                    type="email"
                    value={refundEmail}
                    onChange={(event) => setRefundEmail(event.target.value)}
                    maxLength={254}
                    placeholder="email@example.com"
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400"
                  />
                </label>
                <BankSelectionField
                  bankName={bankDetails.bankName}
                  bankCode={bankDetails.bankCode}
                  onChange={(bankName, bankCode) =>
                    setBankDetails((current) => ({ ...current, bankName, bankCode }))
                  }
                />
                <label className="text-sm font-semibold text-slate-700">
                  Tên chủ tài khoản *
                  <input
                    value={bankDetails.bankAccountName}
                    onChange={(event) => setBankDetails((current) => ({ ...current, bankAccountName: event.target.value }))}
                    maxLength={120}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Số tài khoản *
                  <input
                    inputMode="numeric"
                    value={bankDetails.bankAccountNumber}
                    onChange={(event) => setBankDetails((current) => ({ ...current, bankAccountNumber: event.target.value }))}
                    maxLength={50}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400"
                  />
                </label>
              </div>
            ) : (
              <label className="mt-4 block text-sm font-semibold text-slate-700">
                {activeAction === "reject" ? "Lý do từ chối (bắt buộc)" : "Ghi chú / mã giao dịch (không bắt buộc)"}
                <textarea
                  rows={3}
                  maxLength={500}
                  value={actionNote}
                  onChange={(event) => setActionNote(event.target.value)}
                  placeholder={activeAction === "confirm" ? "Nhập mã giao dịch chuyển khoản nếu có..." : "Nhập ghi chú..."}
                  className="mt-2 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:border-blue-400"
                />
              </label>
            )}

            {actionError && (
              <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{actionError}</span>
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeAction}
                disabled={isSubmitting}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => void submitAction()}
                disabled={isSubmitting}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60 ${
                  activeAction === "reject" ? "bg-rose-600 hover:bg-rose-700" : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {isSubmitting && <LoaderCircle size={15} className="animate-spin" />}
                {isSubmitting ? "Đang xử lý..." : actionTitle[activeAction]}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function CopyValueButton({
  label,
  copied,
  onCopy,
}: {
  label: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={copied ? `Đã sao chép ${label}` : `Sao chép ${label}`}
      title={copied ? "Đã sao chép" : `Sao chép ${label}`}
      className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold text-blue-700 hover:bg-blue-50"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Đã copy" : "Copy"}
    </button>
  );
}

function StatCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: string;
  tone: "violet" | "blue" | "green" | "slate";
}) {
  const toneClasses = {
    violet: "border-violet-200 bg-violet-50 text-violet-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    slate: "border-slate-200 bg-white text-slate-800",
  };

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${toneClasses[tone]}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="mt-3 text-2xl font-bold">{value}</p>
      {detail && <p className="mt-1 text-xs opacity-75">{detail}</p>}
    </div>
  );
}
