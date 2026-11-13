import { useAppSelector } from "../store/hooks";
import {
  AlertCircle,
  Banknote,
  Check,
  ClipboardCheck,
  Columns3,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import BankSelectionField from "../components/BankSelectionField";
import CheckoutRefundApprovalsPanel from "../components/CheckoutRefundApprovalsPanel";
import DatePickerPopover from "../components/DatePickerPopover";
import ListPagination from "../components/ListPagination";
import FilterResultStatus from "../components/FilterResultStatus";
import SearchableFilter from "../components/SearchableFilter";
import { localizedText } from "../i18n";
import { toast } from "@/components/ui/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { useGetSuperAdminBranchDetailsQuery } from "../services/superAdminApi";
import {
  useApproveBookingRefundMutation,
  useConfirmBookingRefundMutation,
  useGetBookingCancellationsQuery,
  useGetCheckoutRefundsQuery,
  useLazyGetCancellationBankDetailsQuery,
  useRejectBookingRefundMutation,
  useRequestBookingPayoutMutation,
  useSubmitRefundBankDetailsByStaffMutation,
  type BookingChannel,
  type BookingCancellation,
  type BookingCancellationStatus,
  type BookingRefundTransferMethod,
  type PayOSPayoutState,
} from "../services/managementBookingApi";

type BranchOption = { id: number; name: string };
type Props = {
  branches?: BranchOption[];
};

type CancellationAction = "approve" | "reject" | "payout" | "manual-confirm" | "bank-details";
type CancellationFilter = "ALL" | BookingCancellationStatus;
type BookingChannelFilter = "ALL" | BookingChannel;
type RefundAccountChoice = "saved" | "alternate";
type RefundQueue = "overpayment" | "cancellation";
const CANCELLATION_TABLE_COLUMNS = [
  { id: "booking", label: ["Mã booking", "Booking ID"], width: 190 },
  { id: "customer", label: ["Khách hàng", "Guest"], width: 175 },
  { id: "channel", label: ["Kênh đặt", "Booking channel"], width: 150 },
  { id: "date", label: ["Ngày yêu cầu", "Request date"], width: 205 },
  { id: "reason", label: ["Lý do", "Reason"], width: 190 },
  { id: "account", label: ["Hình thức / tài khoản nhận", "Method / recipient account"], width: 220 },
  { id: "amount", label: ["Chi tiết hoàn", "Refund details"], width: 210 },
  { id: "refundedBy", label: ["Người hoàn tiền", "Refunded by"], width: 180 },
  { id: "status", label: ["Trạng thái", "Status"], width: 240 },
  { id: "actions", label: ["Thao tác", "Actions"], width: 300 },
] as const;
type CancellationTableColumnId = (typeof CANCELLATION_TABLE_COLUMNS)[number]["id"];

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

const money = (value: number | undefined) => {
  const isEnglish = localStorage.getItem("language") === "en";
  return `${new Intl.NumberFormat(isEnglish ? "en-US" : "vi-VN", { maximumFractionDigits: 0 }).format(Number(value ?? 0))}${isEnglish ? " VND" : "đ"}`;
};

const dateTime = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(localStorage.getItem("language") === "en" ? "en-US" : "vi-VN");
};

const normalizeBookingId = (value: string | null | undefined) => value?.trim().toLocaleUpperCase() ?? "";

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
  "manual-confirm": ["Xác nhận hoàn tiền thủ công", "Confirm manual refund"],
  "bank-details": ["Nhập tài khoản nhận hoàn", "Enter refund recipient account"],
};

const actionDescription: Record<CancellationAction, [string, string]> = {
  approve: ["Đối chiếu chính sách và số tiền hoàn, xác nhận với khách tài khoản nhận tiền rồi mới duyệt.", "Review the refund policy and amount, confirm the recipient account with the guest, then approve."],
  reject: ["Yêu cầu hoàn tiền sẽ bị từ chối. Vui lòng ghi rõ lý do.", "The refund request will be rejected. Please provide a reason."],
  payout: ["PayOS sẽ nhận lệnh chuyển tiền thật. Chỉ tiếp tục sau khi đã kiểm tra đúng số tiền và tài khoản khách.", "PayOS will receive a real money-transfer request. Continue only after verifying the amount and guest account."],
  "manual-confirm": ["Xác nhận đã hoàn tiền bên ngoài hệ thống. Mã giao dịch có thể nhập để đối soát, không bắt buộc.", "Confirm that the refund was completed outside the system. A transaction reference is optional."],
  "bank-details": ["Nhập thông tin khách cung cấp. Khách không cần có tài khoản trên website.", "Enter the details provided by the guest. The guest does not need a website account."],
};

export default function RefundApprovalWorkspace({ branches }: Props) {
  useTranslation();
  const roles = useAppSelector((state) => state.auth.roles);
  const canApproveRefund = roles.includes("ROLE_MANAGER") || roles.includes("ROLE_SUPER_ADMIN") || roles.includes("ROLE_ADMIN");
  const [selectedBranchId, setSelectedBranchId] = useState<number | undefined>();
  const {
    currentData: branchDetails,
    isLoading: isBranchBookingsLoading,
    isError: isBranchBookingsError,
  } = useGetSuperAdminBranchDetailsQuery(selectedBranchId ?? 0, {
    skip: selectedBranchId === undefined,
  });
  const { data: cancellations = [], isLoading, isFetching, isError, error, refetch } =
    useGetBookingCancellationsQuery(selectedBranchId);
  const { data: surplusRefunds = [] } = useGetCheckoutRefundsQuery(selectedBranchId);
  const branchBookingIds = useMemo(
    () => new Set((branchDetails?.bookings ?? [])
      .map((booking) => normalizeBookingId(booking.bookingId))
      .filter(Boolean)),
    [branchDetails],
  );
  const branchCancellations = useMemo(
    () => selectedBranchId === undefined
      ? cancellations
      : cancellations.filter((item) => branchBookingIds.has(normalizeBookingId(item.bookingId))),
    [branchBookingIds, cancellations, selectedBranchId],
  );
  const branchSurplusRefunds = useMemo(
    () => selectedBranchId === undefined
      ? surplusRefunds
      : surplusRefunds.filter((item) => branchBookingIds.has(normalizeBookingId(item.bookingId))),
    [branchBookingIds, selectedBranchId, surplusRefunds],
  );
  const [approveRefund, { isLoading: isApproving }] = useApproveBookingRefundMutation();
  const [confirmBookingRefund, { isLoading: isConfirmingManualRefund }] = useConfirmBookingRefundMutation();
  const [rejectRefund, { isLoading: isRejecting }] = useRejectBookingRefundMutation();
  const [requestPayout, { isLoading: isRequestingPayout }] = useRequestBookingPayoutMutation();
  const [loadBankDetails, { isFetching: isLoadingBankDetails, reset: resetBankDetailsQuery }] = useLazyGetCancellationBankDetailsQuery();
  const [submitBankDetails, { isLoading: isSavingBankDetails }] = useSubmitRefundBankDetailsByStaffMutation();
  const [filter, setFilter] = useState<CancellationFilter>("ALL");
  const [channelFilter, setChannelFilter] = useState<BookingChannelFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isManuallyRefreshing, setIsManuallyRefreshing] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<CancellationTableColumnId, boolean>>({
    booking: true,
    customer: true,
    channel: true,
    date: true,
    reason: true,
    account: true,
    amount: true,
    refundedBy: true,
    status: true,
    actions: true,
  });
  const [activeQueue, setActiveQueue] = useState<RefundQueue>("overpayment");
  const [selectedRequestDate, setSelectedRequestDate] = useState<string | null>(null);
  const [cancellationPage, setCancellationPage] = useState(1);
  const [cancellationPageSize, setCancellationPageSize] = useState(10);
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
  const [refundTransferMethod, setRefundTransferMethod] = useState<BookingRefundTransferMethod>("PAYOS");
  const [refundAmountVerified, setRefundAmountVerified] = useState(false);
  const [refundAccountConfirmed, setRefundAccountConfirmed] = useState(false);
  const [refundCompletedConfirmed, setRefundCompletedConfirmed] = useState(false);
  const [refundEmail, setRefundEmail] = useState("");
  const [actionError, setActionError] = useState("");
  const [feedback, setFeedback] = useState("");

  const counts = useMemo(() => {
    const reviewPending = branchCancellations.filter((item) => item.status === "REFUND_REVIEW_PENDING").length;
    const needsBankDetails = branchCancellations.filter((item) => item.status === "REFUND_BANK_DETAILS_REQUIRED").length;
    const checkoutPending = branchSurplusRefunds.filter((item) => item.status === "PENDING").length;
    const checkoutFailed = branchSurplusRefunds.filter((item) => item.status === "PAYOUT_FAILED").length;

    return {
      reviewPending,
      needsBankDetails,
      checkoutPending,
      checkoutFailed,
    };
  }, [branchCancellations, branchSurplusRefunds]);

  const refundRequestsByDate = useMemo(() => {
    const requestCounts = new Map<string, number>();
    branchCancellations.forEach((item) => {
      if (Number(item.refundAmount) <= 0 || !item.requestedAt) return;
      const date = new Date(item.requestedAt);
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      requestCounts.set(key, (requestCounts.get(key) ?? 0) + 1);
    });
    return requestCounts;
  }, [branchCancellations]);
  const refundRequestDates = useMemo(() => Array.from(refundRequestsByDate.keys()), [refundRequestsByDate]);

  const visibleCancellations = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const byStatus = filter === "ALL"
      ? branchCancellations
      : branchCancellations.filter((item) => item.status === filter);
    const byChannel = channelFilter === "ALL"
      ? byStatus
      : byStatus.filter((item) => item.bookingChannel === channelFilter);
    const byDate = selectedRequestDate
      ? byChannel.filter((item) => {
          if (Number(item.refundAmount) <= 0 || !item.requestedAt) return false;
          const date = new Date(item.requestedAt);
          if (Number.isNaN(date.getTime())) return false;
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
          return key === selectedRequestDate;
        })
      : byChannel;
    const filtered = normalizedQuery
      ? byDate.filter((item) => [
          item.bookingId,
          item.customerName,
          item.customerPhone,
          item.reason,
        ].some((value) =>
          (value ?? "").toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(normalizedQuery),
        ))
      : byDate;
    return [...filtered].sort((first, second) =>
      new Date(second.requestedAt ?? 0).getTime() - new Date(first.requestedAt ?? 0).getTime(),
    );
  }, [branchCancellations, channelFilter, filter, searchQuery, selectedRequestDate]);
  const cancellationTotalPages = Math.max(1, Math.ceil(visibleCancellations.length / cancellationPageSize));
  const safeCancellationPage = Math.min(cancellationPage, cancellationTotalPages);
  const paginatedCancellations = visibleCancellations.slice(
    (safeCancellationPage - 1) * cancellationPageSize,
    safeCancellationPage * cancellationPageSize,
  );
  const hasActiveFilters = Boolean(searchQuery.trim() || filter !== "ALL" || channelFilter !== "ALL" || selectedRequestDate);
  const shownColumns = CANCELLATION_TABLE_COLUMNS.filter((column) => visibleColumns[column.id]);
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
      setFilter("ALL");
      setChannelFilter("ALL");
      setSelectedRequestDate(null);
      setCancellationPage(1);
    }
    try {
      await refetch().unwrap();
    } catch {
      toast({
        variant: "destructive",
        title: localizedText("Không thể tải lại danh sách yêu cầu hoàn tiền", "Could not reload refund requests"),
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
    setCancellationPage(1);
  }, [filter, channelFilter, searchQuery, selectedRequestDate, selectedBranchId, cancellationPageSize]);

  useEffect(() => {
    if (cancellationPage > cancellationTotalPages) setCancellationPage(cancellationTotalPages);
  }, [cancellationPage, cancellationTotalPages]);

  const isSubmitting = isApproving || isConfirmingManualRefund || isRejecting || isRequestingPayout || isSavingBankDetails || isLoadingBankDetails;


  const openAction = (cancellation: BookingCancellation, action: CancellationAction) => {
    resetBankDetailsQuery();
    setActiveCancellation(cancellation);
    setActiveAction(action);
    setActionNote("");
    setBankDetails({ bankName: "", bankCode: "", bankAccountName: "", bankAccountNumber: "" });
    setRefundEmail(cancellation.refundEmail ?? "");
    setRefundAccountChoice(cancellation.hasRefundBankDetails ? "saved" : "alternate");
    setRefundTransferMethod("PAYOS");
    setRefundAmountVerified(false);
    setRefundAccountConfirmed(false);
    setRefundCompletedConfirmed(false);
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
    setRefundCompletedConfirmed(false);
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
    if (activeAction === "manual-confirm") {
      if (!refundCompletedConfirmed) {
        setActionError(localizedText("Vui lòng xác nhận khoản hoàn tiền đã được chuyển cho khách.", "Confirm that the refund has already been transferred to the guest."));
        return;
      }
      if (actionNote.trim().length > 120) {
        setActionError(localizedText("Mã giao dịch không được vượt quá 120 ký tự.", "The transaction reference must be 120 characters or fewer."));
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
          refundTransferMethod,
        }).unwrap();
        setFeedback(refundTransferMethod === "PAYOS"
          ? localizedText(`Đã duyệt hoàn tiền cho booking ${activeCancellation.bookingId}. Có thể gửi lệnh tự động qua PayOS.`, `Refund for booking ${activeCancellation.bookingId} approved. The automatic PayOS payout can now be sent.`)
          : localizedText(`Đã duyệt hoàn tiền cho booking ${activeCancellation.bookingId}. Hãy chuyển khoản bên ngoài rồi xác nhận giao dịch trên hệ thống.`, `Refund for booking ${activeCancellation.bookingId} approved. Transfer externally, then confirm the transaction in the system.`));
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
      } else if (activeAction === "manual-confirm") {
        await confirmBookingRefund({
          cancellationId: activeCancellation.id,
          transactionReference: actionNote.trim() || undefined,
          refundCompletedConfirmed,
        }).unwrap();
        setFeedback(localizedText(`Đã ghi nhận chuyển khoản hoàn ${money(activeCancellation.refundAmount)} cho booking ${activeCancellation.bookingId}.`, `Manual refund transfer of ${money(activeCancellation.refundAmount)} for booking ${activeCancellation.bookingId} was recorded.`));
      }
      resetBankDetailsQuery();
      setActiveCancellation(null);
      setActiveAction(null);
      setActionNote("");
      setBankDetails({ bankName: "", bankCode: "", bankAccountName: "", bankAccountNumber: "" });
      setRefundEmail("");
      setRefundAmountVerified(false);
      setRefundAccountConfirmed(false);
      setRefundCompletedConfirmed(false);
    } catch (submitError: unknown) {
      setActionError(errorMessage(submitError));
    }
  };

  const filters: { value: CancellationFilter; label: string }[] = [
    { value: "ALL", label: localizedText("Tất cả trạng thái", "All statuses") },
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
      {branches && (
        <label className="flex w-full max-w-sm flex-col gap-1.5 text-sm font-semibold text-slate-700">
          {localizedText("Lọc theo chi nhánh", "Filter by branch")}
          <select
            value={selectedBranchId ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              setSelectedBranchId(value ? Number(value) : undefined);
              setSelectedRequestDate(null);
            }}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">{localizedText("Tất cả chi nhánh", "All branches")}</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
        </label>
      )}
      {selectedBranchId !== undefined && isBranchBookingsError && (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {localizedText(
            "Không thể tải dữ liệu booking của chi nhánh để đối chiếu khoản hoàn tiền. Vui lòng thử lại.",
            "Could not load this branch's booking records to match refund requests. Please try again.",
          )}
        </p>
      )}
      {selectedBranchId !== undefined && isBranchBookingsLoading && (
        <p role="status" className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {localizedText("Đang tải booking của chi nhánh để lọc khoản hoàn tiền...", "Loading this branch's bookings to filter refund requests...")}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label={localizedText("Loại yêu cầu hoàn tiền", "Refund request type")}>
        {([
          {
            value: "overpayment" as const,
            icon: Banknote,
            title: localizedText("Hoàn tiền sau khi checkout dư", "Checkout surplus refund"),
            description: localizedText("Hoàn khoản thanh toán thừa khi checkout booking", "Refund overpayment after booking checkout"),
            count: counts.checkoutPending + counts.checkoutFailed,
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
        <CheckoutRefundApprovalsPanel
          hotelId={selectedBranchId}
          bookingIds={selectedBranchId === undefined ? undefined : [...branchBookingIds]}
          isBranchBookingsReady={selectedBranchId === undefined || (!isBranchBookingsLoading && !isBranchBookingsError)}
        />
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
            </div>
          </div>
        </div>

        {feedback && (
          <div className="mx-5 mt-4 flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <span>{feedback}</span>
            <button type="button" onClick={() => setFeedback("")} aria-label={localizedText("Đóng thông báo", "Dismiss notification")}>
              <X size={16} />
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3 xl:flex-nowrap">
          <label className="relative min-w-[220px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={localizedText("Tìm mã booking, khách hàng...", "Search booking ID or guest...")}
              aria-label={localizedText("Tìm mã booking hoặc khách hàng", "Search booking ID or guest")}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <SearchableFilter
              value={filter}
              options={filters.map((item) => ({
                value: item.value,
                label: item.value === "REFUND_REVIEW_PENDING" && counts.reviewPending > 0
                  ? `${item.label} (${counts.reviewPending})`
                  : item.label,
              }))}
              onChange={(value) => setFilter(value as CancellationFilter)}
              ariaLabel={localizedText("Lọc theo trạng thái hoàn tiền", "Filter by refund status")}
              searchPlaceholder={localizedText("Tìm trạng thái...", "Search statuses...")}
              emptyMessage={localizedText("Không tìm thấy trạng thái.", "No statuses found.")}
              className="w-56"
          />
          <SearchableFilter
            value={channelFilter}
            options={[
              { value: "ALL", label: localizedText("Tất cả kênh", "All channels") },
              { value: "ONLINE", label: localizedText("Online", "Online") },
              { value: "OFFLINE", label: localizedText("Tại quầy / Offline", "Front desk / Offline") },
            ]}
            onChange={(value) => setChannelFilter(value as BookingChannelFilter)}
            ariaLabel={localizedText("Lọc theo kênh đặt", "Filter by booking channel")}
            searchPlaceholder={localizedText("Tìm kênh đặt...", "Search booking channels...")}
            emptyMessage={localizedText("Không tìm thấy kênh đặt.", "No booking channels found.")}
            className="w-52"
          />
          <DatePickerPopover
            value={selectedRequestDate ? new Date(`${selectedRequestDate}T00:00:00`) : undefined}
            onChange={(date) => setSelectedRequestDate(date
              ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
              : null)}
            highlightDates={refundRequestDates}
            placeholder={localizedText("Tất cả phạm vi", "All date ranges")}
            buttonClassName="flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:text-blue-600"
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
                {CANCELLATION_TABLE_COLUMNS.map((column) => {
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
                    reason: true,
                    account: true,
                    amount: true,
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
              disabled={isListLoading}
              aria-label={hasActiveFilters
                ? localizedText("Xóa bộ lọc", "Reset filters")
                : localizedText("Tải lại danh sách yêu cầu hoàn tiền", "Reload refund requests")}
              title={hasActiveFilters
                ? localizedText("Xóa bộ lọc", "Reset filters")
                : localizedText("Tải lại danh sách yêu cầu hoàn tiền", "Reload refund requests")}
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
            <span>{localizedText("Đang tải yêu cầu hoàn tiền...", "Loading refund requests...")}</span>
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
          <FilterResultStatus filterKey={JSON.stringify([filter, channelFilter, selectedRequestDate, searchQuery])}><div className="p-12 text-center">
            <ClipboardCheck size={28} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">
              {selectedRequestDate || channelFilter !== "ALL" || searchQuery.trim()
                ? localizedText("Không có yêu cầu phù hợp với bộ lọc", "No requests match these filters")
                : filter === "ALL" ? localizedText("Chưa có yêu cầu hủy cần xử lý", "There are no cancellation requests to review") : localizedText("Không có yêu cầu ở trạng thái này", "No requests in this status")}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {localizedText("Yêu cầu hoàn tiền có thể cần tải lại sau khi nhân viên hủy booking.", "Refresh after a staff member cancels a booking to see new refund requests.")}
            </p>
          </div></FilterResultStatus>
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
                {paginatedCancellations.map((cancellation, index) => (
                  <tr key={cancellation.id} className="align-top transition-colors hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-3 py-4 tabular-nums text-slate-500">{(safeCancellationPage - 1) * cancellationPageSize + index + 1}</td>
                    {visibleColumns.booking && <td className="px-3 py-4">
                      <p className="whitespace-nowrap font-semibold text-blue-700">{cancellation.bookingId}</p>
                    </td>}
                    {visibleColumns.customer && <td className="px-3 py-4">
                      <p className="whitespace-nowrap font-medium text-slate-800">{cancellation.customerName || localizedText("Khách hàng", "Guest")}</p>
                      {cancellation.customerPhone && (
                        <p className="mt-0.5 whitespace-nowrap text-xs text-slate-500">{cancellation.customerPhone}</p>
                      )}
                    </td>}
                    {visibleColumns.channel && <td className="px-3 py-4">
                      {cancellation.bookingChannel ? (
                        <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-semibold ${
                          cancellation.bookingChannel === "ONLINE" ? "bg-sky-50 text-sky-700" : "bg-violet-50 text-violet-700"
                        }`}>
                          {cancellation.bookingChannel === "ONLINE" ? "Online" : localizedText("Tại quầy", "Front desk")}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>}
                    {visibleColumns.date && <td className="whitespace-nowrap px-3 py-4 text-xs leading-5 text-slate-600">{dateTime(cancellation.requestedAt)}</td>}
                    {visibleColumns.reason && <td className="px-3 py-4">
                      {cancellation.reason ? (
                        <p className="line-clamp-3 break-words text-xs leading-4 text-slate-600" title={cancellation.reason}>
                          {cancellation.reason}
                        </p>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>}
                    {visibleColumns.account && <td className="px-3 py-4">
                      {cancellation.refundMethod === "CASH" ? (
                        <span className="inline-flex rounded-lg bg-emerald-50 px-2.5 py-2 text-xs font-semibold text-emerald-700">
                          {localizedText("Hoàn tiền mặt tại khách sạn", "Cash refund at hotel")}
                        </span>
                      ) : cancellation.status === "REFUNDED" ? (
                        <div className="space-y-1">
                          <span className="inline-flex rounded-lg bg-emerald-50 px-2.5 py-2 text-xs font-semibold text-emerald-700">
                            {localizedText("Đã hoàn qua ngân hàng", "Refunded by bank transfer")}
                          </span>
                          {cancellation.refundTransferMethod && (
                            <span className="block text-xs font-medium text-slate-600">
                              {cancellation.refundTransferMethod === "MANUAL_BANK"
                                ? localizedText("Chuyển khoản thủ công", "Manual bank transfer")
                                : localizedText("Tự động qua PayOS", "Automatic via PayOS")}
                            </span>
                          )}
                        </div>
                      ) : cancellation.hasRefundBankDetails ? (
                        <div className="space-y-2">
                          <span className="inline-flex rounded-lg bg-blue-50 px-2.5 py-2 text-xs font-semibold text-blue-700">
                            {localizedText("Thông tin tài khoản đã được mã hóa", "Recipient details are encrypted")}
                          </span>
                          {cancellation.refundTransferMethod && (
                            <span className="block text-xs font-medium text-slate-600">
                              {cancellation.refundTransferMethod === "MANUAL_BANK"
                                ? localizedText("Chuyển khoản thủ công", "Manual bank transfer")
                                : localizedText("Tự động qua PayOS", "Automatic via PayOS")}
                            </span>
                          )}
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
                    </td>}
                    {visibleColumns.amount && <td className="px-3 py-4">
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
                    </td>}
                    {visibleColumns.refundedBy && <td className="px-3 py-4 text-slate-700">
                      {cancellation.status === "REFUNDED" ? cancellation.refundedBy || "—" : "—"}
                    </td>}
                    {visibleColumns.status && <td className="px-4 py-4">
                      <span className={`inline-flex max-w-full whitespace-normal break-words rounded-full border px-3 py-2 text-xs font-semibold ${statusStyles[cancellation.status]}`}>
                        {cancellation.status === "NO_REFUND_REQUIRED"
                          ? localizedText("Không hoàn", "No refund")
                          : localizedText(...statusLabels[cancellation.status])}
                      </span>
                      {cancellation.payoutState && (
                        <span className="mt-1 inline-flex max-w-full whitespace-normal break-words rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">
                          {localizedText(...payoutStateLabels[cancellation.payoutState])}
                        </span>
                      )}
                      {cancellation.status === "REFUNDED"
                        && cancellation.refundTransferMethod === "MANUAL_BANK"
                        && cancellation.refundReference && (
                        <p className="mt-2 break-all text-xs text-slate-600" title={cancellation.refundReference}>
                          {localizedText("Mã giao dịch:", "Transaction reference:")} {cancellation.refundReference}
                        </p>
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
                    </td>}
                    {visibleColumns.actions && <td className="border-l border-slate-200 px-4 py-4">
                      <div className="flex min-w-0 flex-col items-start gap-2">
                        {canApproveRefund && cancellation.status === "REFUND_REVIEW_PENDING" && (
                          <>
                            <button
                              type="button"
                              onClick={() => openAction(cancellation, "approve")}
                              className="inline-flex max-w-full items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-left text-xs font-semibold text-white hover:bg-emerald-700"
                            >
                              <Check size={14} /> {localizedText("Duyệt", "Approve")}
                            </button>
                            <button
                              type="button"
                              onClick={() => openAction(cancellation, "reject")}
                              className="inline-flex max-w-full items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50"
                            >
                              <X size={14} /> {localizedText("Từ chối", "Reject")}
                            </button>
                          </>
                        )}
                        {canApproveRefund && cancellation.status === "REFUND_APPROVED"
                          && cancellation.refundTransferMethod === "MANUAL_BANK" && (
                          <button
                            type="button"
                            onClick={() => openAction(cancellation, "manual-confirm")}
                            className="inline-flex max-w-full items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-left text-xs font-semibold text-white hover:bg-emerald-700"
                          >
                            <Check size={14} /> {localizedText("Xác nhận hoàn tiền thủ công", "Confirm manual refund")}
                          </button>
                        )}
                        {canApproveRefund && cancellation.status === "REFUND_APPROVED"
                          && cancellation.refundTransferMethod !== "MANUAL_BANK" && (
                          <button
                            type="button"
                            onClick={() => openAction(cancellation, "manual-confirm")}
                            className="inline-flex max-w-full items-center gap-1 rounded-lg border border-emerald-300 px-3 py-2 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                          >
                            <Banknote size={14} /> {localizedText("Hoàn thủ công", "Manual refund")}
                          </button>
                        )}
                        {canApproveRefund && (cancellation.status === "PAYOUT_PROCESSING"
                          || (cancellation.status === "REFUND_APPROVED"
                            && cancellation.refundTransferMethod !== "MANUAL_BANK")) && (
                          <button
                            type="button"
                            onClick={() => openAction(cancellation, "payout")}
                            className="inline-flex max-w-full items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-left text-xs font-semibold text-white hover:bg-blue-700"
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
                            className="inline-flex max-w-full rounded-lg border border-amber-300 px-3 py-2 text-left text-xs font-semibold text-amber-800 hover:bg-amber-50"
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
                    </td>}
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
            <ListPagination
              totalItems={visibleCancellations.length}
              page={safeCancellationPage}
              pageSize={cancellationPageSize}
              mode="table"
              onPageChange={setCancellationPage}
              onPageSizeChange={setCancellationPageSize}
            />
          </>
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
                <span className="text-right font-semibold text-slate-800">{activeCancellation.customerName || "—"}</span>
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
                  {typeof activeCancellation.hoursBeforeCheckIn === "number" && (
                    <p className="mt-3 text-xs leading-5 text-slate-600">
                      {localizedText(`Yêu cầu trước giờ nhận phòng ${activeCancellation.hoursBeforeCheckIn} giờ`, `Requested ${activeCancellation.hoursBeforeCheckIn} hours before check-in`)}
                    </p>
                  )}
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
                    <fieldset className="space-y-2">
                      <legend className="font-semibold text-slate-900">{localizedText("Phương thức chuyển tiền", "Transfer method")}</legend>
                      <label className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3">
                        <input
                          type="radio"
                          name="refund-transfer-method"
                          checked={refundTransferMethod === "PAYOS"}
                          onChange={() => setRefundTransferMethod("PAYOS")}
                          className="mt-1 accent-blue-600"
                        />
                        <span className="text-sm">
                          <span className="block font-semibold text-slate-800">{localizedText("Tự động qua PayOS", "Automatic via PayOS")}</span>
                          <span className="mt-1 block text-xs text-slate-500">{localizedText("Hệ thống gửi lệnh chuyển tiền và cập nhật trạng thái từ PayOS.", "The system sends the transfer and tracks its PayOS status.")}</span>
                        </span>
                      </label>
                      <label className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3">
                        <input
                          type="radio"
                          name="refund-transfer-method"
                          checked={refundTransferMethod === "MANUAL_BANK"}
                          onChange={() => setRefundTransferMethod("MANUAL_BANK")}
                          className="mt-1 accent-blue-600"
                        />
                        <span className="text-sm">
                          <span className="block font-semibold text-slate-800">{localizedText("Chuyển khoản thủ công", "Manual bank transfer")}</span>
                          <span className="mt-1 block text-xs text-slate-500">{localizedText("Nhân viên tự chuyển khoản ngoài hệ thống, sau đó xác nhận giao dịch tại đây.", "Transfer outside the system, then confirm the transaction here.")}</span>
                        </span>
                      </label>
                    </fieldset>
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

            {activeAction === "manual-confirm" && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                <p className="text-sm text-emerald-900">
                  {localizedText("Thao tác này chỉ ghi nhận khoản hoàn đã chuyển bên ngoài hệ thống; không gửi lệnh qua PayOS.", "This only records a refund transferred outside the system; it does not send a PayOS payout.")}
                </p>
                <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={refundCompletedConfirmed}
                    onChange={(event) => setRefundCompletedConfirmed(event.target.checked)}
                    className="mt-0.5 accent-emerald-600"
                  />
                  <span>{localizedText("Tôi xác nhận khoản hoàn tiền này đã được chuyển cho khách.", "I confirm that this refund has already been transferred to the guest.")}</span>
                </label>
                <label className="mt-3 block text-sm font-semibold text-slate-700">
                  {localizedText("Mã giao dịch (không bắt buộc)", "Transaction reference (optional)")}
                  <input
                    value={actionNote}
                    onChange={(event) => setActionNote(event.target.value)}
                    maxLength={120}
                    placeholder={localizedText("Nhập mã giao dịch nếu có", "Enter a transaction reference if available")}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-emerald-400"
                  />
                </label>
              </div>
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
