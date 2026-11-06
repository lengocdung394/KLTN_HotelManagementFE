import { baseApi } from "./baseApi";

type ApiResponse<T> = {
  code: number;
  message: string;
  result: T;
};

export type HotelClosure = {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  allHotels: boolean;
  hotelIds: number[];
  createdAt: string;
  active?: boolean;
};

export type AffectedClosureBooking = {
  bookingId: string;
  guestName: string;
  bookingStatus: string;
  cancellationRefundAmount?: number;
  cancellationRoomRefundAmount?: number;
  cancellationServiceRefundAmount?: number;
  cancellationRoomPenaltyAmount?: number;
  cancellationRefundPolicy?: string;
  earlyCheckoutRefundAmount?: number;
  earlyCheckoutOriginalRoomAmount?: number;
  earlyCheckoutOriginalRoomNights?: number;
  earlyCheckoutUsedRoomNights?: number;
  earlyCheckoutRoomAmount?: number;
  earlyCheckoutEarlyCheckInFeeAmount?: number;
  earlyCheckoutUnpaidBeforeCheckoutAmount?: number;
  earlyCheckoutOutstandingAmount?: number;
  earlyCheckoutBookingTotalAmount?: number;
  earlyCheckoutPaidAmount?: number;
  earlyCheckoutProjectedTotalAmount?: number;
  roomStays: {
    bookingDetailId: string;
    roomNumber: string | null;
    checkinDate: string | null;
    checkoutDate: string | null;
    status: string | null;
    services?: {
      name: string | null;
      quantity: number;
      usedQuantity: number;
      refundableQuantity: number;
      refundableAmount: number;
    }[];
  }[];
  resolutionAction: string | null;
};

export type CreateHotelClosure = {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  allHotels: boolean;
  hotelIds: number[];
};

export type ResolveHotelClosure = {
  action: "CANCEL_FULL_REFUND" | "EARLY_CHECKOUT";
  cancellation?: {
    reason: string;
    refundMethod?: "CASH" | "BANK";
    cashRefundConfirmed?: boolean;
    confirmedRefundAmount?: number;
    confirmedRoomRefundAmount?: number;
    confirmedServiceRefundAmount?: number;
    confirmedRoomPenaltyAmount?: number;
    confirmedRefundPolicy?: string;
  };
  checkout?: {
    bookingDetailIds: string[];
    surplusRefundMethod?: "CASH" | "BANK";
    refundNote: string;
  };
};

export const hotelClosureApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getHotelClosures: builder.query<ApiResponse<HotelClosure[]>, void>({
      query: () => ({ url: "/hotel-closures", method: "GET" }),
      providesTags: ["HotelClosure"],
    }),
    createHotelClosure: builder.mutation<ApiResponse<HotelClosure>, CreateHotelClosure>({
      query: (data) => ({ url: "/hotel-closures", method: "POST", data }),
      invalidatesTags: ["HotelClosure", "Notification"],
    }),
    getAffectedClosureBookings: builder.query<
      ApiResponse<AffectedClosureBooking[]>,
      string
    >({
      query: (scheduleId) => ({
        url: `/hotel-closures/${scheduleId}/affected-bookings`,
        method: "GET",
      }),
      providesTags: ["HotelClosure"],
    }),
    resolveClosureBooking: builder.mutation<
      ApiResponse<void>,
      { scheduleId: string; bookingId: string; data: ResolveHotelClosure }
    >({
      query: ({ scheduleId, bookingId, data }) => ({
        url: `/hotel-closures/${scheduleId}/bookings/${bookingId}/resolve`,
        method: "POST",
        data,
      }),
      invalidatesTags: ["HotelClosure", "Booking", "CheckoutRefund", "RefundCancellation"],
    }),
  }),
});

export const {
  useGetHotelClosuresQuery,
  useCreateHotelClosureMutation,
  useGetAffectedClosureBookingsQuery,
  useResolveClosureBookingMutation,
} = hotelClosureApi;
