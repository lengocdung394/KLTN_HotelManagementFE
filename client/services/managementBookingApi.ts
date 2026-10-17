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
  usedAt?: string;
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
    usedAt?: string;
  }[];
};

export type ManagementBookingServiceQuantityItem = {
  serviceId: string;
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
  bankName?: string;
  bankCode?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  refundEmail?: string;
};

export type BookingCancellationStatus =
  | "REFUND_BANK_DETAILS_REQUIRED"
  | "REFUND_REVIEW_PENDING"
  | "REFUND_APPROVED"
  | "REFUND_REJECTED"
  | "REFUNDED"
  | "NO_REFUND_REQUIRED";

export type BookingChannel = "ONLINE" | "OFFLINE";
export type CheckoutRefundStatus = "PENDING" | "APPROVED" | "REFUNDED";

export type CheckoutRefund = {
  id: string;
  bookingId: string;
  customerName?: string | null;
  customerPhone?: string | null;
  paidAmount: number;
  finalAmount: number;
  refundAmount: number;
  refundMethod: "CASH" | "BANK" | "EWALLET";
  status: CheckoutRefundStatus;
  bankName?: string | null;
  bankCode?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  note?: string | null;
  requestedAt?: string | null;
  approvedAt?: string | null;
  refundedAt?: string | null;
};

export type BookingCancellation = {
  id: string;
  bookingId: string;
  bookingChannel?: BookingChannel | null;
  customerName?: string | null;
  customerPhone?: string | null;
  status: BookingCancellationStatus;
  reason?: string | null;
  paidAmount?: number;
  refundAmount: number;
  roomRefundAmount?: number;
  serviceRefundAmount?: number;
  roomPenaltyAmount?: number;
  hoursBeforeCheckIn?: number;
  refundPolicy?: string | null;
  bankName?: string | null;
  bankCode?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  refundEmail?: string | null;
  reviewNote?: string | null;
  refundReference?: string | null;
  requestedAt?: string | null;
  reviewedAt?: string | null;
  refundedAt?: string | null;
};

type BookingCancellationApiResponse = {
  code?: number;
  message?: string;
  result?: BookingCancellation;
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
    modifyBooking: builder.mutation<
      BookingResponse,
      { bookingId: string; request: ManagementBookingModificationRequest }
    >({
      query: ({ bookingId, request }) => ({
        url: `/management-bookings/${bookingId}/modify`,
        method: "PUT",
        data: request,
      }),
      invalidatesTags: ["Booking", "Room"],
    }),
    getBookingCancellations: builder.query<BookingCancellation[], void>({
      query: () => ({
        url: "/management-bookings/cancellations",
        method: "GET",
      }),
      transformResponse: unwrapCancellationList,
      providesTags: ["RefundCancellation"],
      refetchOnMountOrArgChange: true,
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
      invalidatesTags: ["Booking", "Room", "RefundCancellation"],
    }),
    approveBookingRefund: builder.mutation<
      BookingCancellationApiResponse,
      {
        cancellationId: string;
        note?: string;
        refundAmountVerified: boolean;
        refundAccountConfirmed: boolean;
      }
    >({
      query: ({ cancellationId, note, refundAmountVerified, refundAccountConfirmed }) => ({
        url: `/management-bookings/cancellations/${cancellationId}/approve`,
        method: "PATCH",
        data: { note, refundAmountVerified, refundAccountConfirmed },
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
      { cancellationId: string; note?: string }
    >({
      query: ({ cancellationId, note }) => ({
        url: `/management-bookings/cancellations/${cancellationId}/confirm-refund`,
        method: "PATCH",
        data: note ? { note } : {},
      }),
      invalidatesTags: ["RefundCancellation"],
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
    getCheckoutRefunds: builder.query<CheckoutRefund[], void>({
      query: () => ({
        url: "/management-bookings/checkout-refunds",
        method: "GET",
      }),
      transformResponse: unwrapCheckoutRefundList,
      providesTags: ["CheckoutRefund"],
      refetchOnMountOrArgChange: true,
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
      { refundId: string; note?: string }
    >({
      query: ({ refundId, note }) => ({
        url: `/management-bookings/checkout-refunds/${refundId}/approve`,
        method: "PATCH",
        data: { note, refundAmountVerified: true, refundAccountConfirmed: true },
      }),
      invalidatesTags: ["CheckoutRefund"],
    }),
    confirmCheckoutRefund: builder.mutation<
      { result?: CheckoutRefund },
      { refundId: string; note?: string }
    >({
      query: ({ refundId, note }) => ({
        url: `/management-bookings/checkout-refunds/${refundId}/confirm-refund`,
        method: "PATCH",
        data: note ? { note } : {},
      }),
      invalidatesTags: ["CheckoutRefund"],
    }),
  }),
});

export const {
  useModifyBookingMutation,
  useCancelBookingByStaffMutation,
  useGetBookingCancellationsQuery,
  useApproveBookingRefundMutation,
  useRejectBookingRefundMutation,
  useConfirmBookingRefundMutation,
  useSubmitRefundBankDetailsByStaffMutation,
  useGetCheckoutRefundsQuery,
  useUpdateCheckoutRefundBankDetailsMutation,
  useApproveCheckoutRefundMutation,
  useConfirmCheckoutRefundMutation,
} = managementBookingApi;
