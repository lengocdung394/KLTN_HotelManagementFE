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

export type BookingCancellation = {
  id: string;
  bookingId: string;
  bookingChannel?: BookingChannel | null;
  customerName?: string | null;
  customerPhone?: string | null;
  status: BookingCancellationStatus;
  reason?: string | null;
  refundAmount: number;
  roomRefundAmount?: number;
  serviceRefundAmount?: number;
  roomPenaltyAmount?: number;
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
      { cancellationId: string; note?: string }
    >({
      query: ({ cancellationId, note }) => ({
        url: `/management-bookings/cancellations/${cancellationId}/approve`,
        method: "PATCH",
        data: note ? { note } : {},
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
} = managementBookingApi;
