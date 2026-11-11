import { baseApi } from "./baseApi";
import type { BookingResponse } from "./bookingApi";

export type ManagementBookingServiceCancellation = {
  bookingDetailId: string;
  serviceDetailIds: string[];
};

export type ManagementBookingServiceAddition = {
  serviceId: string;
  quantity: number;
  name?: string;
  price?: number;
};

export type ManagementBookingRoomServiceAddition = {
  bookingDetailId: string;
  services: ManagementBookingServiceAddition[];
};

export type ManagementBookingRoomToAdd = {
  roomId: string;
  checkInTime: string;
  checkOutTime: string;
  numAdults: number;
  numChildren: number;
  numInfants: number;
  serviceRequests: {
    serviceId: string;
    quantity: number;
    name?: string;
    price?: number;
  }[];
};

export type ManagementBookingServiceQuantityItem = {
  serviceId: string;
  bookingServiceDetailId?: string;
  quantity: number;
};

export type ManagementBookingUpdateServiceQuantityRequest = {
  bookingDetailId: string;
  services: ManagementBookingServiceQuantityItem[];
};

export type ManagementBookingRoomUpdateRequest = {
  bookingDetailId: string;
  newRoomId: string | null;
  newCheckInTime: string | null;
  newCheckoutTime: string | null;
  numAdults: number | null;
  numChildren: number | null;
  numInfants: number | null;
};

export type ManagementBookingPromotionRequest = {
  promotionId: string;
};

export type ManagementBookingCustomerPromotionRequest = {
  customerPromotionId: string;
};

export type ManagementBookingModificationRequest = {
  employeeId: string;
  bookingDetailIdsToCancel: string[];
  servicesToCancel: ManagementBookingServiceCancellation[];
  roomsToAdd: ManagementBookingRoomToAdd[];
  roomsToChange: ManagementBookingRoomUpdateRequest[];
  servicesToAddForExistingRooms: ManagementBookingRoomServiceAddition[];
  serviceQuantityUpdates: ManagementBookingUpdateServiceQuantityRequest[];
  promotionRequest: ManagementBookingPromotionRequest | null;
  customerPromotionRequest: ManagementBookingCustomerPromotionRequest | null;
  removePromotion?: boolean | null;
};

export type ManagementBookingCancellationRequest = {
  reason?: string;
  refundMethod?: "CASH" | "BANK";
  cashRefundConfirmed?: boolean;
  confirmedRefundAmount?: number;
  confirmedRoomRefundAmount?: number;
  confirmedServiceRefundAmount?: number;
  confirmedRoomPenaltyAmount?: number;
  confirmedRefundPolicy?: string;
  bankName?: string;
  bankCode?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  refundEmail?: string;
};

export type BookingCancellationPreview = {
  bookingId: string;
  paidAmount: number;
  refundAmount: number;
  roomRefundAmount: number;
  serviceRefundAmount: number;
  roomPenaltyAmount: number;
  hoursBeforeCheckIn: number;
  refundPolicy: string;
};

type BookingCancellationPreviewApiResponse = {
  code?: number;
  message?: string;
  result?: BookingCancellationPreview;
};

export type BookingCancellationStatus =
  | "REFUND_BANK_DETAILS_REQUIRED"
  | "REFUND_REVIEW_PENDING"
  | "REFUND_APPROVED"
  | "PAYOUT_PROCESSING"
  | "PAYOUT_FAILED"
  | "REFUND_REJECTED"
  | "REFUNDED"
  | "NO_REFUND_REQUIRED";

export type BookingRefundTransferMethod = "PAYOS" | "MANUAL_BANK";

export type PayOSPayoutState =
  | "PROCESSING"
  | "TRANSFERRED"
  | "FAILED"
  | "UNKNOWN";

export type BookingChannel = "ONLINE" | "OFFLINE";
export type CheckoutRefundStatus =
  | "PENDING"
  | "APPROVED"
  | "PAYOUT_PROCESSING"
  | "PAYOUT_FAILED"
  | "REFUNDED";

export type CheckoutRefund = {
  id: string;
  bookingId: string;
  bookingChannel?: BookingChannel | null;
  customerName?: string | null;
  customerPhone?: string | null;
  paidAmount: number;
  finalAmount: number;
  refundAmount: number;
  refundMethod: "CASH" | "BANK" | "EWALLET";
  status: CheckoutRefundStatus;
  refundTransferMethod?: BookingRefundTransferMethod | null;
  payoutReference?: string | null;
  payoutState?: PayOSPayoutState | null;
  payoutError?: string | null;
  hasBankDetails?: boolean;
  note?: string | null;
  requestedAt?: string | null;
  approvedAt?: string | null;
  refundedAt?: string | null;
  refundedBy?: string | null;
};

export type BookingCancellation = {
  id: string;
  bookingId: string;
  bookingChannel?: BookingChannel | null;
  customerName?: string | null;
  customerPhone?: string | null;
  status: BookingCancellationStatus;
  refundMethod?: "CASH" | "BANK" | null;
  refundTransferMethod?: BookingRefundTransferMethod | null;
  hasRefundBankDetails?: boolean;
  payoutReference?: string | null;
  payoutState?: PayOSPayoutState | null;
  payoutError?: string | null;
  reason?: string | null;
  paidAmount?: number;
  refundAmount: number;
  roomRefundAmount?: number;
  serviceRefundAmount?: number;
  roomPenaltyAmount?: number;
  hoursBeforeCheckIn?: number;
  refundPolicy?: string | null;
  refundEmail?: string | null;
  reviewNote?: string | null;
  refundReference?: string | null;
  refundedBy?: string | null;
  requestedAt?: string | null;
  reviewedAt?: string | null;
  refundedAt?: string | null;
};

export type RefundBankDetails = {
  bankName: string;
  bankCode: string;
  bankAccountName: string;
  bankAccountNumber: string;
};

type BookingCancellationApiResponse = {
  code?: number;
  message?: string;
  result?: BookingCancellation;
};

type RefundBankDetailsApiResponse = {
  result?: RefundBankDetails;
};

type CheckoutRefundBankDetailsApiResponse = {
  result?: RefundBankDetails;
};

const unwrapCancellationList = (response: unknown): BookingCancellation[] => {
  if (Array.isArray(response)) return response as BookingCancellation[];
  if (!response || typeof response !== "object") return [];
  const result = (response as { result?: unknown }).result;
  return Array.isArray(result) ? result : [];
};

const unwrapCheckoutRefundList = (response: unknown): CheckoutRefund[] => {
  if (Array.isArray(response)) return response as CheckoutRefund[];
  if (!response || typeof response !== "object") return [];
  const result = (response as { result?: unknown }).result;
  return Array.isArray(result) ? result as CheckoutRefund[] : [];
};

export const managementBookingApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getBookingCancellationPreview: builder.query<BookingCancellationPreviewApiResponse, string>({
      query: (bookingId) => ({
        url: `/management-bookings/${bookingId}/cancellation-preview`,
        method: "GET",
      }),
    }),
    modifyBooking: builder.mutation<
      BookingResponse,
      { bookingId: string; request: ManagementBookingModificationRequest }
    >({
      query: ({ bookingId, request }) => ({
        url: `/management-bookings/${bookingId}/modify`,
        method: "PUT",
        data: request,
      }),
      invalidatesTags: ["Booking", "Room", "Promotion"],
    }),
    getBookingCancellations: builder.query<BookingCancellation[], number | undefined>({
      query: (hotelId) => ({
        url: "/management-bookings/cancellations",
        method: "GET",
        params: hotelId == null ? undefined : { hotelId },
      }),
      transformResponse: unwrapCancellationList,
      providesTags: ["RefundCancellation"],
    }),
    getCancellationBankDetails: builder.query<RefundBankDetails, string>({
      query: (cancellationId) => ({
        url: `/management-bookings/cancellations/${cancellationId}/bank-details`,
        method: "GET",
      }),
      transformResponse: (response: RefundBankDetailsApiResponse) => {
        if (!response.result) throw new Error("Refund bank details were not returned.");
        return response.result;
      },
    }),
    cancelBookingByStaff: builder.mutation<
      BookingCancellationApiResponse,
      { bookingId: string; request?: ManagementBookingCancellationRequest }
    >({
      query: ({ bookingId, request }) => ({
        url: `/management-bookings/${bookingId}/cancel`,
        method: "POST",
        data: request ?? {},
      }),
      invalidatesTags: ["Booking", "Room", "RefundCancellation", "Promotion"],
    }),
    approveBookingRefund: builder.mutation<
      BookingCancellationApiResponse,
      {
        cancellationId: string;
        note?: string;
        refundAmountVerified: boolean;
        refundAccountConfirmed: boolean;
        refundTransferMethod: BookingRefundTransferMethod;
      }
    >({
      query: ({ cancellationId, note, refundAmountVerified, refundAccountConfirmed, refundTransferMethod }) => ({
        url: `/management-bookings/cancellations/${cancellationId}/approve`,
        method: "PATCH",
        data: { note, refundAmountVerified, refundAccountConfirmed, refundTransferMethod },
      }),
      invalidatesTags: ["RefundCancellation"],
    }),
    rejectBookingRefund: builder.mutation<
      BookingCancellationApiResponse,
      { cancellationId: string; note: string }
    >({
      query: ({ cancellationId, note }) => ({
        url: `/management-bookings/cancellations/${cancellationId}/reject`,
        method: "PATCH",
        data: { note },
      }),
      invalidatesTags: ["RefundCancellation"],
    }),
    confirmBookingRefund: builder.mutation<
      BookingCancellationApiResponse,
      {
        cancellationId: string;
        transactionReference?: string;
        refundCompletedConfirmed: boolean;
      }
    >({
      query: ({ cancellationId, transactionReference, refundCompletedConfirmed }) => ({
        url: `/management-bookings/cancellations/${cancellationId}/confirm-refund`,
        method: "PATCH",
        data: { transactionReference, refundCompletedConfirmed },
      }),
      invalidatesTags: ["RefundCancellation", "Booking"],
    }),
    requestBookingPayout: builder.mutation<
      BookingCancellationApiResponse,
      { cancellationId: string }
    >({
      query: ({ cancellationId }) => ({
        url: `/management-bookings/cancellations/${cancellationId}/payout`,
        method: "POST",
      }),
      invalidatesTags: ["RefundCancellation", "Booking"],
    }),
    submitRefundBankDetailsByStaff: builder.mutation<
      BookingCancellationApiResponse,
      { cancellationId: string; request: ManagementBookingCancellationRequest }
    >({
      query: ({ cancellationId, request }) => ({
        url: `/management-bookings/cancellations/${cancellationId}/bank-details`,
        method: "PATCH",
        data: request,
      }),
      invalidatesTags: ["RefundCancellation"],
    }),
    getCheckoutRefunds: builder.query<CheckoutRefund[], number | undefined>({
      query: (hotelId) => ({
        url: "/management-bookings/checkout-refunds",
        method: "GET",
        params: hotelId == null ? undefined : { hotelId },
      }),
      transformResponse: unwrapCheckoutRefundList,
      providesTags: ["CheckoutRefund"],
    }),
    getCheckoutRefundBankDetails: builder.query<RefundBankDetails, string>({
      query: (refundId) => ({
        url: `/management-bookings/checkout-refunds/${refundId}/bank-details`,
        method: "GET",
      }),
      keepUnusedDataFor: 0,
      transformResponse: (response: CheckoutRefundBankDetailsApiResponse) => {
        if (!response.result) throw new Error("Checkout refund bank details were not returned.");
        return response.result;
      },
    }),
    updateCheckoutRefundBankDetails: builder.mutation<
      { result?: CheckoutRefund },
      { refundId: string; request: ManagementBookingCancellationRequest }
    >({
      query: ({ refundId, request }) => ({
        url: `/management-bookings/checkout-refunds/${refundId}/bank-details`,
        method: "PATCH",
        data: request,
      }),
      invalidatesTags: ["CheckoutRefund"],
    }),
    approveCheckoutRefund: builder.mutation<
      { result?: CheckoutRefund },
      { refundId: string; note?: string; refundTransferMethod: BookingRefundTransferMethod }
    >({
      query: ({ refundId, note, refundTransferMethod }) => ({
        url: `/management-bookings/checkout-refunds/${refundId}/approve`,
        method: "PATCH",
        data: { note, refundAmountVerified: true, refundAccountConfirmed: true, refundTransferMethod },
      }),
      invalidatesTags: ["CheckoutRefund"],
    }),
    requestCheckoutRefundPayout: builder.mutation<
      { result?: CheckoutRefund },
      { refundId: string }
    >({
      query: ({ refundId }) => ({
        url: `/management-bookings/checkout-refunds/${refundId}/payout`,
        method: "POST",
      }),
      invalidatesTags: ["CheckoutRefund"],
    }),
    confirmCheckoutRefund: builder.mutation<
      { result?: CheckoutRefund },
      { refundId: string; note?: string; refundCompletedConfirmed?: boolean }
    >({
      query: ({ refundId, note, refundCompletedConfirmed }) => ({
        url: `/management-bookings/checkout-refunds/${refundId}/confirm-refund`,
        method: "PATCH",
        data: { ...(note ? { note } : {}), ...(refundCompletedConfirmed ? { refundCompletedConfirmed } : {}) },
      }),
      invalidatesTags: ["CheckoutRefund"],
    }),
  }),
});

export const {
  useModifyBookingMutation,
  useGetBookingCancellationPreviewQuery,
  useCancelBookingByStaffMutation,
  useGetBookingCancellationsQuery,
  useLazyGetCancellationBankDetailsQuery,
  useApproveBookingRefundMutation,
  useRejectBookingRefundMutation,
  useConfirmBookingRefundMutation,
  useRequestBookingPayoutMutation,
  useSubmitRefundBankDetailsByStaffMutation,
  useGetCheckoutRefundsQuery,
  useLazyGetCheckoutRefundBankDetailsQuery,
  useUpdateCheckoutRefundBankDetailsMutation,
  useApproveCheckoutRefundMutation,
  useRequestCheckoutRefundPayoutMutation,
  useConfirmCheckoutRefundMutation,
} = managementBookingApi;
