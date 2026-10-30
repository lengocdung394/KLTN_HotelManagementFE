import { useAppSelector } from "../store/hooks";
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
import { useTranslation } from "react-i18next";
import BankSelectionField from "../components/BankSelectionField";
import CheckoutRefundApprovalsPanel from "../components/CheckoutRefundApprovalsPanel";
import DatePickerPopover from "../components/DatePickerPopover";
import { localizedText } from "../i18n";
import {
  useApproveBookingRefundMutation,
  useGetBookingCancellationsQuery,
  useGetCheckoutRefundsQuery,
  useLazyGetCancellationBankDetailsQuery,
  useRejectBookingRefundMutation,
  useRequestBookingPayoutMutation,
  useSubmitRefundBankDetailsByStaffMutation,
  type BookingChannel,
  type BookingCancellation,
  type BookingCancellationStatus,
  type PayOSPayoutState,
} from "../services/managementBookingApi";

type CancellationAction = "approve" | "reject" | "payout" | "bank-details";
type CancellationFilter = "ALL" | BookingCancellationStatus;
type BookingChannelFilter = "ALL" | BookingChannel;
type RefundAccountChoice = "saved" | "alternate";
type RefundQueue = "overpayment" | "cancellation";

const statusLabels: Record<BookingCancellationStatus, [string, string]> = {
  REFUND_BANK_DETAILS_REQUIRED: ["Chờ thông tin ngân hàng", "Awaiting bank details"],
  REFUND_REVIEW_PENDING: ["Chờ duyệt hoàn tiền", "Refund pending review"],
  REFUND_APPROVED: ["Đã duyệt - chờ chuyển khoản", "Approved - awaiting transfer"],
  PAYOUT_PROCESSING: ["PayOS đang xử lý", "PayOS processing"],
  PAYOUT_FAILED: ["Payout thất bại", "Payout failed"],
  REFUND_REJECTED: ["Từ chối hoàn tiền", "Refund rejected"],
  REFUNDED: ["Đã hoàn tiền", "Refunded"],
  NO_REFUND_REQUIRED: ["Không cần hoàn tiền", "No refund required"],
};

const statusStyles: Record<BookingCancellationStatus, string> = {
  REFUND_BANK_DETAILS_REQUIRED: "border-amber-200 bg-amber-50 text-amber-800",
  REFUND_REVIEW_PENDING: "border-blue-200 bg-blue-50 text-blue-800",
  REFUND_APPROVED: "border-violet-200 bg-violet-50 text-violet-800",
  PAYOUT_PROCESSING: "border-blue-200 bg-blue-50 text-blue-800",
  PAYOUT_FAILED: "border-rose-200 bg-rose-50 text-rose-800",
  REFUND_REJECTED: "border-rose-200 bg-rose-50 text-rose-800",
  REFUNDED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  NO_REFUND_REQUIRED: "border-slate-200 bg-slate-100 text-slate-700",
};

const payoutStateLabels: Record<PayOSPayoutState, [string, string]> = {
  PROCESSING: ["PayOS: Chưa hoàn tất", "PayOS: Not completed"],
  TRANSFERRED: ["PayOS: Đã chuyển", "PayOS: Transferred"],
  FAILED: ["PayOS: Thất bại", "PayOS: Failed"],
  UNKNOWN: ["PayOS: Trạng thái chưa xác định", "PayOS: Unknown state"],
};

const money = (value: number | undefined) =>
  `${new Intl.NumberFormat(localStorage.getItem("language") === "en" ? "en-US" : "vi-VN", { maximumFractionDigits: 0 }).format(Number(value ?? 0))}₫`;

const dateTime = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(localStorage.getItem("language") === "en" ? "en-US" : "vi-VN");
};

const errorMessage = (error: unknown) => {
  if (!error || typeof error !== "object") return localizedText("Đã xảy ra lỗi. Vui lòng thử lại.", "Something went wrong. Please try again.");
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
  return apiError.message ?? apiError.error ?? localizedText("Đã xảy ra lỗi. Vui lòng thử lại.", "Something went wrong. Please try again.");
};

const actionTitle: Record<CancellationAction, [string, string]> = {
  approve: ["Duyệt hoàn tiền", "Approve refund"],
  reject: ["Từ chối hoàn tiền", "Reject refund"],
  payout: ["Gửi payout hoàn tiền", "Send refund payout"],
  "bank-details": ["Nhập tài khoản nhận hoàn", "Enter refund recipient account"],
};

const actionDescription: Record<CancellationAction, [string, string]> = {
  approve: ["Đối chiếu chính sách và số tiền hoàn, xác nhận với khách tài khoản nhận tiền rồi mới duyệt.", "Review the refund policy and amount, confirm the recipient account with the guest, then approve."],
  reject: ["Yêu cầu hoàn tiền sẽ bị từ chối. Vui lòng ghi rõ lý do.", "The refund request will be rejected. Please provide a reason."],
  payout: ["PayOS sẽ nhận lệnh chuyển tiền thật. Chỉ tiếp tục sau khi đã kiểm tra đúng số tiền và tài khoản khách.", "PayOS will receive a real money-transfer request. Continue only after verifying the amount and guest account."],
  "bank-details": ["Nhập thông tin khách cung cấp. Khách không cần có tài khoản trên website.", "Enter the details provided by the guest. The guest does not need a website account."],
};

export default function RefundApprovalWorkspace() {
  useTranslation();
  const roles = useAppSelector((state) => state.auth.roles);
  const canApproveRefund = roles.includes("ROLE_MANAGER") || roles.includes("ROLE_SUPER_ADMIN") || roles.includes("ROLE_ADMIN");
  const { data: cancellations = [], isLoading, isFetching, isError, error, refetch } =
    useGetBookingCancellationsQuery();
  const { data: surplusRefunds = [] } = useGetCheckoutRefundsQuery();
  const [approveRefund, { isLoading: isApproving }] = useApproveBookingRefundMutation();
  const [rejectRefund, { isLoading: isRejecting }] = useRejectBookingRefundMutation();
  const [requestPayout, { isLoading: isRequestingPayout }] = useRequestBookingPayoutMutation();
  const [loadBankDetails, { isFetching: isLoadingBankDetails, reset: resetBankDetailsQuery }] = useLazyGetCancellationBankDetailsQuery();
  const [submitBankDetails, { isLoading: isSavingBankDetails }] = useSubmitRefundBankDetailsByStaffMutation();
  const [filter, setFilter] = useState<CancellationFilter>("ALL");
  const [channelFilter, setChannelFilter] = useState<BookingChannelFilter>("ALL");
  const [activeQueue, setActiveQueue] = useState<RefundQueue>("overpayment");
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
      setCopyError(localizedText("Không thể sao chép. Vui lòng kiểm tra quyền clipboard của trình duyệt.", "Could not copy. Check your browser's clipboard permissions."));
    }
  };

  const counts = useMemo(() => {
    const reviewPending = cancellations.filter((item) => item.status === "REFUND_REVIEW_PENDING").length;
    const needsBankDetails = cancellations.filter((item) => item.status === "REFUND_BANK_DETAILS_REQUIRED").length;
    const checkoutPending = surplusRefunds.filter((item) => item.status === "PENDING").length;
    const processing = cancellations.filter((item) => item.status === "REFUND_APPROVED").length
      + cancellations.filter((item) => item.status === "PAYOUT_PROCESSING").length
      + surplusRefunds.filter((item) => item.status === "APPROVED").length;
    const refunded = cancellations.filter((item) => item.status === "REFUNDED").length
      + surplusRefunds.filter((item) => item.status === "REFUNDED").length;
    const totalRefunded = cancellations
      .filter((item) => item.status === "REFUNDED")
      .reduce((total, item) => total + Number(item.refundAmount ?? 0), 0)
      + surplusRefunds
        .filter((item) => item.status === "REFUNDED")
        .reduce((total, item) => total + Number(item.refundAmount ?? 0), 0);

    return {
      reviewPending,
      needsBankDetails,
      checkoutPending,
      processing,
      refunded,
      totalRefunded,
    };
  }, [cancellations, surplusRefunds]);

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
    const byChannel = channelFilter === "ALL"
      ? byStatus
      : byStatus.filter((item) => item.bookingChannel === channelFilter);
    const filtered = selectedRequestDate
      ? byChannel.filter((item) => {
          if (Number(item.refundAmount) <= 0 || !item.requestedAt) return false;
          const date = new Date(item.requestedAt);
          if (Number.isNaN(date.getTime())) return false;
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
          return key === selectedRequestDate;
        })
      : byChannel;
    return [...filtered].sort((first, second) =>
      new Date(second.requestedAt ?? 0).getTime() - new Date(first.requestedAt ?? 0).getTime(),
    );
  }, [cancellations, channelFilter, filter, selectedRequestDate]);

  const isSubmitting = isApproving || isRejecting || isRequestingPayout || isSavingBankDetails || isLoadingBankDetails;
  const pendingTotal = counts.reviewPending + counts.needsBankDetails + counts.checkoutPending;

  const openAction = (cancellation: BookingCancellation, action: CancellationAction) => {
    resetBankDetailsQuery();
    setActiveCancellation(cancellation);
    setActiveAction(action);
    setActionNote("");
    setBankDetails({ bankName: "", bankCode: "", bankAccountName: "", bankAccountNumber: "" });
    setRefundEmail(cancellation.refundEmail ?? "");
    setRefundAccountChoice(cancellation.hasRefundBankDetails ? "saved" : "alternate");
    setRefundAmountVerified(false);
    setRefundAccountConfirmed(false);
    setActionError("");
    if ((action === "approve" || action === "payout") && cancellation.hasRefundBankDetails) {
      void loadBankDetails(cancellation.id)
        .unwrap()
        .then(setBankDetails)
        .catch((loadError: unknown) => setActionError(errorMessage(loadError)));
    }
  };

  const closeAction = () => {
    if (isSubmitting) return;
    resetBankDetailsQuery();
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
      setActionError(localizedText("Vui lòng nhập lý do từ chối hoàn tiền.", "Enter a reason for rejecting the refund."));
      return;
    }
    if (activeAction === "bank-details"
      && refundEmail.trim()
      && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(refundEmail.trim())) {
      setActionError(localizedText("Vui lòng nhập email khách hàng hợp lệ.", "Enter a valid guest email address."));
      return;
    }
    if (activeAction === "approve") {
      if (!refundAmountVerified) {
        setActionError(localizedText("Vui lòng đối chiếu và xác nhận số tiền hoàn trước khi duyệt.", "Verify and confirm the refund amount before approving."));
        return;
      }
      if (!refundAccountConfirmed) {
        setActionError(localizedText("Vui lòng xác nhận đã thống nhất tài khoản nhận hoàn với khách hàng.", "Confirm that the refund recipient account has been agreed with the guest."));
        return;
      }
      if (!bankDetails.bankName.trim()
        || !/^[0-9]{6}$/.test(bankDetails.bankCode.trim())
        || !bankDetails.bankAccountName.trim()
        || !/^[0-9]{6,50}$/.test(bankDetails.bankAccountNumber.trim())) {
        setActionError(localizedText("Vui lòng nhập ngân hàng, tên chủ tài khoản và số tài khoản hợp lệ (6–50 chữ số).", "Enter a valid bank, account holder name, and account number (6–50 digits)."));
        return;
      }
    }
    if (activeAction === "payout") {
      if (!refundAmountVerified || !refundAccountConfirmed) {
        setActionError(localizedText("Xác nhận lại số tiền và tài khoản nhận trước khi gửi lệnh payout.", "Confirm the refund amount and recipient account before sending the payout."));
        return;
      }
      if (!bankDetails.bankName.trim()
        || !/^[0-9]{6}$/.test(bankDetails.bankCode.trim())
        || !bankDetails.bankAccountName.trim()
        || !/^[0-9]{6,50}$/.test(bankDetails.bankAccountNumber.trim())) {
        setActionError(localizedText("Không có thông tin tài khoản hợp lệ để gửi payout.", "Valid recipient account details are not available for payout."));
        return;
      }
    }
    if (activeAction === "bank-details"
      && (!bankDetails.bankName.trim()
        || !/^[0-9]{6}$/.test(bankDetails.bankCode.trim())
        || !bankDetails.bankAccountName.trim()
        || !/^[0-9]{6,50}$/.test(bankDetails.bankAccountNumber.trim()))) {
      setActionError(localizedText("Vui lòng chọn ngân hàng hỗ trợ payout, nhập tên chủ tài khoản và số tài khoản hợp lệ (6–50 chữ số).", "Select a bank supported for payouts and enter a valid account holder and account number (6–50 digits)."));
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
        setFeedback(localizedText(`Đã lưu tài khoản nhận hoàn cho booking ${activeCancellation.bookingId}; yêu cầu đang chờ duyệt.`, `Refund recipient account saved for booking ${activeCancellation.bookingId}; the request is pending review.`));
      } else if (activeAction === "approve") {
        if (refundAccountChoice === "alternate" || !activeCancellation.hasRefundBankDetails) {
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
        setFeedback(localizedText(`Đã duyệt yêu cầu hoàn ${money(activeCancellation.refundAmount)} cho booking ${activeCancellation.bookingId}. Quản lý phụ trách gửi và theo dõi payout qua PayOS.`, `Refund of ${money(activeCancellation.refundAmount)} approved for booking ${activeCancellation.bookingId}. The manager handles and tracks the PayOS payout.`));
      } else if (activeAction === "reject") {
        await rejectRefund({
          cancellationId: activeCancellation.id,
          note: actionNote.trim(),
        }).unwrap();
        setFeedback(localizedText(`Đã từ chối yêu cầu hoàn tiền của booking ${activeCancellation.bookingId}.`, `Refund request for booking ${activeCancellation.bookingId} was rejected.`));
      } else if (activeAction === "payout") {
        const result = await requestPayout({ cancellationId: activeCancellation.id }).unwrap();
        const payoutStatus = result.result?.status;
        setFeedback(payoutStatus === "REFUNDED"
          ? localizedText(`PayOS xác nhận đã hoàn ${money(activeCancellation.refundAmount)} cho booking ${activeCancellation.bookingId}.`, `PayOS confirmed the ${money(activeCancellation.refundAmount)} refund for booking ${activeCancellation.bookingId}.`)
          : payoutStatus === "PAYOUT_FAILED"
          ? localizedText(`PayOS báo payout thất bại cho booking ${activeCancellation.bookingId}. Kiểm tra tài khoản và thử lại.`, `PayOS reported a failed payout for booking ${activeCancellation.bookingId}. Review the account and try again.`)
          : localizedText(`Payout cho booking ${activeCancellation.bookingId} đang được PayOS xử lý.`, `The payout for booking ${activeCancellation.bookingId} is being processed by PayOS.`));
      }
      resetBankDetailsQuery();
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
    { value: "ALL", label: localizedText("Tất cả", "All") },
    { value: "REFUND_REVIEW_PENDING", label: localizedText("Chờ duyệt", "Pending review") },
    { value: "REFUND_BANK_DETAILS_REQUIRED", label: localizedText("Chờ thông tin ngân hàng", "Awaiting bank details") },
    { value: "REFUND_APPROVED", label: localizedText("Chờ chuyển khoản", "Awaiting transfer") },
    { value: "PAYOUT_PROCESSING", label: localizedText("PayOS đang xử lý", "PayOS processing") },
    { value: "PAYOUT_FAILED", label: localizedText("Payout thất bại", "Payout failed") },
    { value: "REFUNDED", label: localizedText("Đã hoàn", "Refunded") },
    { value: "REFUND_REJECTED", label: localizedText("Đã từ chối", "Rejected") },
    { value: "NO_REFUND_REQUIRED", label: localizedText("Không cần hoàn", "No refund required") },
  ];

  return (
    <section className="mt-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={localizedText("Chờ xử lý hoàn tiền", "Refunds pending action")}
          value={String(pendingTotal)}
          detail={`${counts.reviewPending + counts.needsBankDetails} ${localizedText("hoàn do hủy booking", "booking cancellation refunds")} · ${counts.checkoutPending} ${localizedText("hoàn dư sau checkout", "checkout surplus refunds")}`}
          tone="violet"
        />
        <StatCard label={localizedText("Đang xử lý hoàn tiền", "Refunds in progress")} value={String(counts.processing)} tone="blue" />
        <StatCard label={localizedText("Đã hoàn tiền", "Refunded")} value={String(counts.refunded)} tone="green" />
        <StatCard label={localizedText("Tổng tiền đã hoàn", "Total refunded")} value={money(counts.totalRefunded)} tone="slate" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label={localizedText("Loại yêu cầu hoàn tiền", "Refund request type")}>
        {([
          {
            value: "overpayment" as const,
            icon: Banknote,
            title: localizedText("Hoàn tiền sau khi checkout dư", "Checkout surplus refund"),
            description: localizedText("Hoàn khoản thanh toán thừa khi checkout booking", "Refund overpayment after booking checkout"),
            count: counts.checkoutPending,
            tone: "amber",
          },
          {
            value: "cancellation" as const,
            icon: ClipboardCheck,
            title: localizedText("Hoàn tiền hủy booking", "Booking cancellation refund"),
            description: localizedText("Duyệt hoàn tiền khi hủy toàn bộ booking", "Review refunds for canceled bookings"),
            count: counts.reviewPending + counts.needsBankDetails,
            tone: "blue",
          },
        ]).map((queue) => {
          const Icon = queue.icon;
          const selected = activeQueue === queue.value;

          return (
            <button
              key={queue.value}
              type="button"
              aria-pressed={selected}
              onClick={() => setActiveQueue(queue.value)}
              className={`flex min-w-0 items-center gap-3 rounded-xl border p-4 text-left transition ${
                selected
                  ? queue.tone === "amber"
                    ? "border-amber-300 bg-amber-50 shadow-sm"
                    : "border-blue-300 bg-blue-50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                queue.tone === "amber" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
              }`}>
                <Icon size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-900">{queue.title}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{queue.description}</span>
              </span>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                selected
                  ? queue.tone === "amber" ? "bg-amber-200 text-amber-900" : "bg-blue-200 text-blue-900"
                  : "bg-slate-100 text-slate-600"
              }`}>
                {queue.count} {localizedText("chờ xử lý", "pending")}
              </span>
            </button>
          );
        })}
      </div>

      {activeQueue === "overpayment" ? (
        <CheckoutRefundApprovalsPanel />
      ) : (
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
              <ClipboardCheck size={20} />
            </span>
            <div>
              <h3 className="font-bold text-slate-900">{localizedText("Hoàn tiền do hủy booking", "Booking cancellation refunds")}</h3>
              <p className="mt-1 text-sm text-slate-500">
                {localizedText("Theo dõi và duyệt khoản hoàn khi booking bị hủy; đây không phải khoản hoàn do hủy riêng một phòng.", "Review refunds when a booking is canceled; this does not cover cancellation of an individual room.")}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  {localizedText("Ngày có yêu cầu", "Request dates")}
                </span>
                <DatePickerPopover
                  value={selectedRequestDate ? new Date(`${selectedRequestDate}T00:00:00`) : undefined}
                  onChange={(date) => setSelectedRequestDate(date
                    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
                    : null)}
                  highlightDates={refundRequestDates}
                  placeholder={localizedText("Chọn ngày", "Select date")}
                  label={localizedText("Lịch yêu cầu", "Request calendar")}
                />
                {selectedRequestDate && (
                  <button
                    type="button"
                    onClick={() => setSelectedRequestDate(null)}
                    className="rounded-lg px-2 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                  >
                    {localizedText("Tất cả ngày", "All dates")}
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
            {localizedText("Làm mới", "Refresh")}
          </button>
        </div>

        {feedback && (
          <div className="mx-5 mt-4 flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <span>{feedback}</span>
            <button type="button" onClick={() => setFeedback("")} aria-label={localizedText("Đóng thông báo", "Dismiss notification")}>
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

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500">
            <LoaderCircle size={18} className="animate-spin" /> {localizedText("Đang tải yêu cầu hoàn tiền...", "Loading refund requests...")}
          </div>
        ) : isError ? (
          <div className="p-8 text-center">
            <AlertCircle size={24} className="mx-auto text-rose-500" />
            <p className="mt-3 text-sm font-semibold text-slate-800">{localizedText("Không tải được danh sách yêu cầu hoàn tiền", "Could not load refund requests")}</p>
            <p className="mt-1 text-sm text-slate-500">{errorMessage(error)}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              {localizedText("Thử lại", "Try again")}
            </button>
          </div>
        ) : visibleCancellations.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardCheck size={28} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">
              {selectedRequestDate
                ? localizedText("Không có yêu cầu hoàn tiền phù hợp trong ngày đã chọn", "No refund requests match the selected date")
                : filter === "ALL" ? localizedText("Chưa có yêu cầu hủy cần xử lý", "There are no cancellation requests to review") : localizedText("Không có yêu cầu ở trạng thái này", "No requests in this status")}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {localizedText("Yêu cầu hoàn tiền có thể cần tải lại sau khi nhân viên hủy booking.", "Refresh after a staff member cancels a booking to see new refund requests.")}
            </p>
          </div>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <table className="w-[max(900px,100%)] table-fixed text-left text-sm">
              <thead className="bg-blue-50 text-[11px] uppercase tracking-wide text-blue-800">
                <tr>
                  <th className="w-[23%] px-3 py-3">{localizedText("Booking / khách", "Booking / guest")}</th>
                  <th className="w-[13%] px-3 py-3">{localizedText("Ngày yêu cầu", "Request date")}</th>
                  <th className="w-[21%] px-3 py-3">{localizedText("Tài khoản nhận", "Recipient account")}</th>
                  <th className="w-[18%] px-3 py-3">{localizedText("Chi tiết hoàn", "Refund details")}</th>
                  <th className="w-[25%] px-3 py-3">{localizedText("Trạng thái / thao tác", "Status / actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleCancellations.map((cancellation) => (
                  <tr key={cancellation.id} className="align-top transition-colors hover:bg-slate-50/70">
                    <td className="px-3 py-4">
                      <p className="break-words font-semibold text-blue-700">{cancellation.bookingId}</p>
                      {cancellation.bookingChannel && (
                          <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            cancellation.bookingChannel === "ONLINE" ? "bg-sky-50 text-sky-700" : "bg-violet-50 text-violet-700"
                          }`}>
                            {cancellation.bookingChannel === "ONLINE" ? "Online" : localizedText("Tại quầy", "Front desk")}
                          </span>
                      )}
                      <div className="mt-2 flex min-w-0 items-center gap-1">
                        <p className="truncate font-medium text-slate-800">{cancellation.customerName || localizedText("Khách hàng", "Guest")}</p>
                        {cancellation.customerName && (
                          <CopyValueButton
                            label={localizedText("tên khách hàng", "guest name")}
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
                        <p className="mt-2 line-clamp-2 text-xs leading-4 text-slate-500" title={cancellation.reason}>
                          {localizedText("Lý do:", "Reason:")} {cancellation.reason}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-4 text-xs leading-5 text-slate-600">{dateTime(cancellation.requestedAt)}</td>
                    <td className="px-3 py-4">
                      {cancellation.refundMethod === "CASH" ? (
                        <span className="inline-flex rounded-lg bg-emerald-50 px-2.5 py-2 text-xs font-semibold text-emerald-700">
                          {localizedText("Hoàn tiền mặt tại khách sạn", "Cash refund at hotel")}
                        </span>
                      ) : cancellation.hasRefundBankDetails ? (
                        <div className="space-y-2">
                          <span className="inline-flex rounded-lg bg-blue-50 px-2.5 py-2 text-xs font-semibold text-blue-700">
                            {localizedText("Thông tin tài khoản đã được mã hóa", "Recipient details are encrypted")}
                          </span>
                          {cancellation.refundEmail && (
                            <p className="truncate border-t border-slate-100 pt-2 text-xs text-slate-500" title={cancellation.refundEmail}>{cancellation.refundEmail}</p>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex rounded-lg bg-amber-50 px-2.5 py-2 text-xs leading-4 text-amber-700">
                          {cancellation.status === "NO_REFUND_REQUIRED"
                            ? localizedText("Không cần tài khoản nhận", "No recipient account needed")
                            : localizedText("Chưa có thông tin ngân hàng", "Bank details not provided")}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-4">
                      <p className="text-base font-bold tabular-nums text-slate-900">{money(cancellation.refundAmount)}</p>
                      <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-slate-400">{localizedText("Tổng tiền hoàn", "Total refund")}</p>
                      {Number(cancellation.refundAmount ?? 0) > 0 ? (
                        <div className="space-y-1 border-t border-slate-100 pt-2 text-xs">
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-500">{localizedText("Phòng (trước phạt)", "Room (before penalty)")}</span>
                            <span className="whitespace-nowrap tabular-nums text-slate-700">
                              {money(Number(cancellation.roomRefundAmount ?? 0) + Number(cancellation.roomPenaltyAmount ?? 0))}
                            </span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-500">{localizedText("Dịch vụ", "Services")}</span>
                            <span className="whitespace-nowrap tabular-nums text-slate-700">{money(cancellation.serviceRefundAmount)}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="border-t border-slate-100 pt-2 text-xs text-slate-500">
                          {localizedText("Không phát sinh tiền hoàn", "No refund due")}
                        </p>
                      )}
                      {Number(cancellation.roomPenaltyAmount) > 0 && (
                        <div className="mt-1 flex justify-between gap-2 border-t border-slate-100 pt-1 text-xs">
                          <span className="text-rose-600">{localizedText("Phạt phòng", "Room penalty")}</span>
                          <span className="whitespace-nowrap tabular-nums text-rose-600">{money(cancellation.roomPenaltyAmount)}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-4">
                      <span className={`inline-flex max-w-full whitespace-normal break-words rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[cancellation.status]}`}>
                        {cancellation.status === "NO_REFUND_REQUIRED"
                          ? localizedText("Không hoàn", "No refund")
                          : localizedText(...statusLabels[cancellation.status])}
                      </span>
                      {cancellation.payoutState && (
                        <span className="mt-1 inline-flex max-w-full whitespace-normal break-words rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                          {localizedText(...payoutStateLabels[cancellation.payoutState])}
                        </span>
                      )}
                      {cancellation.reviewNote && (
                        <p className="mt-2 line-clamp-2 text-xs leading-4 text-slate-500" title={cancellation.reviewNote}>
                          {localizedText("Ghi chú:", "Note:")} {cancellation.reviewNote}
                        </p>
                      )}
                      {cancellation.payoutError && (
                        <p className="mt-2 line-clamp-2 text-xs leading-4 text-rose-700" title={cancellation.payoutError}>
                          {cancellation.payoutError}
                        </p>
                      )}
                      <div className="mt-3 flex flex-col items-start gap-2">
                        {canApproveRefund && cancellation.status === "REFUND_REVIEW_PENDING" && (
                          <>
                            <button
                              type="button"
                              onClick={() => openAction(cancellation, "approve")}
                              className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                            >
                              <Check size={14} /> {localizedText("Duyệt", "Approve")}
                            </button>
                            <button
                              type="button"
                              onClick={() => openAction(cancellation, "reject")}
                              className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                            >
                              <X size={14} /> {localizedText("Từ chối", "Reject")}
                            </button>
                          </>
                        )}
                        {canApproveRefund && (cancellation.status === "REFUND_APPROVED"
                          || cancellation.status === "PAYOUT_PROCESSING") && (
                          <button
                            type="button"
                            onClick={() => openAction(cancellation, "payout")}
                            className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                          >
                            <Banknote size={14} />
                            {cancellation.status === "PAYOUT_PROCESSING"
                              ? localizedText("Cập nhật trạng thái payout", "Refresh payout status")
                              : localizedText("Gửi payout", "Send payout")}
                          </button>
                        )}
                        {(cancellation.status === "REFUND_BANK_DETAILS_REQUIRED"
                          || cancellation.status === "PAYOUT_FAILED") && (
                          <button
                            type="button"
                            onClick={() => openAction(cancellation, "bank-details")}
                            className="inline-flex whitespace-nowrap rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50"
                          >
                            {cancellation.status === "PAYOUT_FAILED"
                              ? localizedText("Cập nhật tài khoản để thử lại", "Update account to retry")
                              : localizedText("Nhập thông tin ngân hàng", "Enter bank details")}
                          </button>
                        )}
                        {!canApproveRefund && Number(cancellation.refundAmount) > 0 && (
                          <p className="text-xs text-slate-500">
                            {cancellation.status === "REFUND_REVIEW_PENDING"
                              ? localizedText("Chờ quản lý quyết định duyệt hoặc từ chối hoàn tiền.", "Awaiting the manager's refund approval or rejection.")
                              : cancellation.status === "REFUND_APPROVED" || cancellation.status === "PAYOUT_PROCESSING"
                                ? localizedText("Quản lý phụ trách gửi và theo dõi lệnh chuyển khoản.", "The manager handles and tracks the bank transfer.")
                                : null}
                          </p>
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
      )}

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
                  {localizedText(...actionTitle[activeAction])} · {activeCancellation.bookingId}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{localizedText(...actionDescription[activeAction])}</p>
              </div>
              <button
                type="button"
                onClick={closeAction}
                disabled={isSubmitting}
                aria-label={localizedText("Đóng", "Close")}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">{localizedText("Khách hàng", "Guest")}</span>
                <div className="flex items-center gap-1.5 text-right font-semibold text-slate-800">
                  <span>{activeCancellation.customerName || "—"}</span>
                  {activeCancellation.customerName && (
                    <CopyValueButton
                      label={localizedText("tên khách hàng", "guest name")}
                      value={activeCancellation.customerName}
                      copied={copiedField === `${activeCancellation.id}:customer`}
                      onCopy={() => void copyValue(activeCancellation.customerName!, `${activeCancellation.id}:customer`)}
                    />
                  )}
                </div>
              </div>
              <div className="mt-2 flex justify-between gap-3">
                <span className="text-slate-500">{localizedText("Số tiền hoàn", "Refund amount")}</span>
                <span className="font-bold text-blue-700">{money(activeCancellation.refundAmount)}</span>
              </div>
              {activeAction === "payout" && (
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <p className="font-semibold text-slate-700">{localizedText("Tài khoản nhận tiền", "Recipient account")}</p>
                  {bankDetails.bankAccountNumber ? (
                  <div className="mt-2 space-y-1 text-slate-600">
                    {[
                      [localizedText("Ngân hàng", "Bank"), bankDetails.bankName],
                      [localizedText("Mã BIN", "Bank BIN"), bankDetails.bankCode],
                      [localizedText("Chủ tài khoản", "Account holder"), bankDetails.bankAccountName],
                      [localizedText("Số tài khoản", "Account number"), bankDetails.bankAccountNumber],
                    ].map(([label, value]) => (
                      <div key={label}><span>{label}: </span><strong>{value}</strong></div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-amber-700">
                    {isLoadingBankDetails
                      ? localizedText("Đang tải tài khoản đã mã hóa...", "Loading encrypted account details...")
                      : localizedText("Chưa có thông tin ngân hàng.", "No bank details available.")}
                  </p>
                )}
                </div>
              )}
            </div>

            {(activeAction === "approve" || activeAction === "payout") && (
              <>
                <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                  <h4 className="font-semibold text-slate-900">{localizedText("Đối chiếu chi tiết tiền hoàn", "Refund breakdown")}</h4>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-600">{localizedText("Tổng tiền khách đã thanh toán", "Total paid by guest")}</dt>
                      <dd className="font-medium text-slate-900">{money(activeCancellation.paidAmount)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-600">{localizedText("Tiền phòng trước phạt", "Room amount before penalty")}</dt>
                      <dd className="font-medium text-slate-900">
                        {money(Number(activeCancellation.roomRefundAmount ?? 0) + Number(activeCancellation.roomPenaltyAmount ?? 0))}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-600">{localizedText("Phạt hủy phòng", "Room cancellation penalty")}</dt>
                      <dd className="font-medium text-rose-700">−{money(activeCancellation.roomPenaltyAmount)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-600">{localizedText("Tiền phòng hoàn sau phạt", "Room refund after penalty")}</dt>
                      <dd className="font-medium text-slate-900">{money(activeCancellation.roomRefundAmount)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-600">{localizedText("Tiền dịch vụ hoàn", "Service refund")}</dt>
                      <dd className="font-medium text-slate-900">{money(activeCancellation.serviceRefundAmount)}</dd>
                    </div>
                    <div className="flex justify-between gap-3 border-t border-blue-200 pt-2">
                      <dt className="font-semibold text-slate-800">{localizedText("Tổng tiền chuyển lại", "Total refund")}</dt>
                      <dd className="font-bold text-blue-700">{money(activeCancellation.refundAmount)}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs leading-5 text-slate-600">
                    {localizedText("Chính sách:", "Policy:")} {activeCancellation.refundPolicy || localizedText("Không có thông tin", "Not available")}
                    {typeof activeCancellation.hoursBeforeCheckIn === "number"
                      ? localizedText(` · Yêu cầu trước giờ nhận phòng ${activeCancellation.hoursBeforeCheckIn} giờ`, ` · Requested ${activeCancellation.hoursBeforeCheckIn} hours before check-in`)
                      : ""}
                  </p>
                  <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={refundAmountVerified}
                      onChange={(event) => setRefundAmountVerified(event.target.checked)}
                      className="mt-0.5 accent-blue-600"
                    />
                    <span>{localizedText("Tôi đã đối chiếu chính sách, số tiền đã thanh toán và xác nhận số tiền hoàn khớp thực tế.", "I have reviewed the policy and payment, and verified that the refund amount is correct.")}</span>
                  </label>
                </div>

                {activeAction === "approve" ? (
                  <div className="mt-4 space-y-3">
                    <div>
                      <h4 className="font-semibold text-slate-900">{localizedText("Tài khoản thụ hưởng", "Recipient account")}</h4>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {localizedText("Thông tin được giải mã chỉ trong bước duyệt để nhân viên đối chiếu; danh sách hoàn tiền không chứa dữ liệu tài khoản.", "Details are decrypted only during review; the refund list does not contain account data.")}
                      </p>
                    </div>
                    {bankDetails.bankName && bankDetails.bankAccountName && bankDetails.bankAccountNumber && (
                      <label className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3">
                        <input
                          type="radio"
                          name="refund-account-choice"
                          checked={refundAccountChoice === "saved"}
                          onChange={() => setRefundAccountChoice("saved")}
                          className="mt-1 accent-blue-600"
                        />
                        <span className="min-w-0 text-sm">
                          <span className="block font-semibold text-slate-800">{localizedText("Tài khoản đã lưu", "Saved account")}</span>
                          <span className="mt-1 block break-words text-slate-600">
                            {bankDetails.bankName} · {bankDetails.bankAccountName} · {bankDetails.bankAccountNumber}
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
                      <span className="text-sm font-semibold text-slate-800">{localizedText("Nhập tài khoản khác", "Enter another account")}</span>
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
                          {localizedText("Tên chủ tài khoản *", "Account holder name *")}
                          <input
                            value={bankDetails.bankAccountName}
                            onChange={(event) => setBankDetails((current) => ({ ...current, bankAccountName: event.target.value }))}
                            maxLength={120}
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400"
                          />
                        </label>
                        <label className="text-sm font-semibold text-slate-700">
                          {localizedText("Số tài khoản *", "Account number *")}
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
                      <span>{localizedText("Tôi đã xác nhận với khách hàng rằng đây là tài khoản nhận tiền hoàn.", "I have confirmed with the guest that this is the refund recipient account.")}</span>
                    </label>
                  </div>
                ) : (
                  <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={refundAccountConfirmed}
                      onChange={(event) => setRefundAccountConfirmed(event.target.checked)}
                      className="mt-0.5 accent-blue-600"
                    />
                    <span>{localizedText("Tôi xác nhận số tiền và tài khoản nhận trên chính xác, đồng ý gửi lệnh chuyển tiền thật đến PayOS.", "I confirm the amount and recipient account above are correct and authorize sending a real transfer request to PayOS.")}</span>
                  </label>
                )}
              </>
            )}

            {activeAction === "bank-details" ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                  {localizedText("Email nhận thông báo (không bắt buộc)", "Notification email (optional)")}
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
                  {localizedText("Tên chủ tài khoản *", "Account holder name *")}
                  <input
                    value={bankDetails.bankAccountName}
                    onChange={(event) => setBankDetails((current) => ({ ...current, bankAccountName: event.target.value }))}
                    maxLength={120}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  {localizedText("Số tài khoản *", "Account number *")}
                  <input
                    inputMode="numeric"
                    value={bankDetails.bankAccountNumber}
                    onChange={(event) => setBankDetails((current) => ({ ...current, bankAccountNumber: event.target.value }))}
                    maxLength={50}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400"
                  />
                </label>
              </div>
            ) : activeAction === "reject" ? (
              <label className="mt-4 block text-sm font-semibold text-slate-700">
                {localizedText("Lý do từ chối (bắt buộc)", "Reason for rejection (required)")}
                <textarea
                  rows={3}
                  maxLength={500}
                  value={actionNote}
                  onChange={(event) => setActionNote(event.target.value)}
                  placeholder={localizedText("Nhập lý do...", "Enter a reason...")}
                  className="mt-2 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:border-blue-400"
                />
              </label>
            ) : null}

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
                {localizedText("Đóng", "Close")}
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
                {isSubmitting ? localizedText("Đang xử lý...", "Processing...") : localizedText(...actionTitle[activeAction])}
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
  value,
  copied,
  onCopy,
}: {
  label: string;
  value?: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={copied ? `${localizedText("Đã sao chép", "Copied")} ${label}` : `${localizedText("Sao chép", "Copy")} ${label}`}
      title={copied ? localizedText("Đã sao chép", "Copied") : `${localizedText("Sao chép", "Copy")} ${label}`}
      className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold text-blue-700 hover:bg-blue-50"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? localizedText("Đã copy", "Copied") : "Copy"}
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
    <div className={`rounded-xl border p-3 shadow-sm sm:p-4 ${toneClasses[tone]}`}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="mt-1.5 text-xl font-bold">{value}</p>
      {detail && <p className="mt-1 text-[11px] opacity-75">{detail}</p>}
    </div>
  );
}
