import { baseApi } from "./baseApi";

export type CheckInOutService = {
  bookingServiceDetailId?: string;
  serviceId?: string;
  price?: number;
  quantity?: number;
  usedAt?: string;
  name?: string;
  serviceName?: string;
  nameService?: string;
  cancelled?: boolean;
  cancelledAt?: string;
};

export type CheckInOutBookingDetail = {
  bookingId?: string;
  bookingDetailId?: string | number;
  roomId?: string;
  roomNumber?: string;
  roomName?: string;
  roomTypeName?: string;
  checkInTime?: string;
  checkOutTime?: string;
  actualCheckInTime?: string;
  numAdults?: number;
  numChildren?: number;
  numInfants?: number;
  baseRoomPricePerNight?: number;
  roomPrice?: number;
  extraAdultFeePerNight?: number;
  extraChildFeePerNight?: number;
  roomSubTotal?: number;
  roomSubtotal?: number;
  roomAmount?: number;
  roomTotal?: number;
  earlyCheckInFee?: number | string;
  estimatedEarlyCheckInFee?: number | string;
  lateCheckOutFee?: number | string;
  lateCheckoutFee?: number | string;
  lateFee?: number | string;
  serviceSubTotal?: number;
  totalPrice?: number;
  paidAmount?: number | string;
  amountPaid?: number | string;
  totalPaidAmount?: number | string;
  remainingAmount?: number | string;
  surplusAmount?: number | string | null;
  remainAmount?: number | string;
  remain?: number | string;
  nameCustomer?: string;
  cccd?: string;
  customerCccd?: string;
  customerName?: string;
  phone?: string;
  bookingDetailStatus?: string;
  identityNumber?: string;
  bookingServiceResponseForHotel?: CheckInOutService[];
  bookingServiceResponsesForHotels?: CheckInOutService[];
  bookingServiceDetails?: CheckInOutService[];
  services?: CheckInOutService[];
  bookingDetails?: CheckInOutBookingDetail[];
  details?: CheckInOutBookingDetail[];
  bookingDetailResponses?: CheckInOutBookingDetail[];
  [key: string]: unknown;
};

export type CheckInOutQuery = {
  date?: string;
  status?: string;
  bookingStatus?: string;
};

export type BulkCheckInOutRequest = string[];
export type CheckoutSurplusRefundMethod = "CASH" | "BANK";
export type BulkCheckInOutResponse = Record<string, unknown>;
export type CheckInOutSummary = {
  waitingCheckIn: number;
  inHouse: number;
  waitingCheckOut: number;
  completed: number;
};

const extractCheckInOutList = (response: unknown): CheckInOutBookingDetail[] => {
  const values = Array.isArray(response)
    ? response
    : response && typeof response === "object" && Array.isArray((response as { result?: unknown }).result)
      ? (response as { result: unknown[] }).result
      : [];

  return values.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const booking = value as CheckInOutBookingDetail;
    const details = booking.bookingDetails ?? booking.details ?? booking.bookingDetailResponses;
    if (!Array.isArray(details)) return [booking];
    return details.map((detail) => ({
      ...booking,
      ...detail,
      bookingId: detail.bookingId ?? booking.bookingId,
      nameCustomer: detail.nameCustomer ?? booking.nameCustomer,
      customerName: detail.customerName ?? booking.customerName,
      cccd: [detail.cccd, detail.customerCccd, detail.identityNumber, booking.cccd, booking.customerCccd, booking.identityNumber]
        .find((value) => typeof value === "string" && value.trim() !== ""),
      identityNumber: [detail.identityNumber, detail.cccd, detail.customerCccd, booking.identityNumber, booking.cccd, booking.customerCccd]
        .find((value) => typeof value === "string" && value.trim() !== ""),
    }));
  });
};

export const checkInOutApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCheckInOutSummary: builder.query<CheckInOutSummary, { date?: string }>({
      query: ({ date }) => ({
        url: "/hotels/check-in-out-summary",
        method: "GET",
        params: { date },
      }),
      providesTags: ["Booking"],
    }),
    getTodayCheckIns: builder.query<CheckInOutBookingDetail[], CheckInOutQuery>({
      query: ({ date, status, bookingStatus }) => ({
        url: "/hotels/today-checkins",
        method: "GET",
        params: { date, status, bookingStatus },
      }),
      transformResponse: extractCheckInOutList,
      providesTags: ["Booking"],
    }),
    getTodayCheckOuts: builder.query<CheckInOutBookingDetail[], CheckInOutQuery>({
      query: ({ date, status, bookingStatus }) => ({
        url: "/hotels/today-checkouts",
        method: "GET",
        params: { date, status, bookingStatus },
      }),
      transformResponse: extractCheckInOutList,
      providesTags: ["Booking"],
    }),
    getEarlyCheckIns: builder.query<CheckInOutBookingDetail[], { date?: string }>({
      query: ({ date }) => ({
        url: "/hotels/early-checkins",
        method: "GET",
        params: { date },
      }),
      transformResponse: extractCheckInOutList,
      providesTags: ["Booking"],
    }),
    bulkCheckIn: builder.mutation<BulkCheckInOutResponse, { bookingId: string; bookingDetailIds: BulkCheckInOutRequest }>({
      query: ({ bookingId, bookingDetailIds }) => ({
        url: `/checkInOuts/${bookingId}/check-in/bulk`,
        method: "POST",
        data: bookingDetailIds,
      }),
      transformResponse: (response: unknown) => {
        if (!response || typeof response !== "object") return {} as BulkCheckInOutResponse;
        if ("result" in response && response.result && typeof response.result === "object") {
          return response.result as BulkCheckInOutResponse;
        }
        return response as BulkCheckInOutResponse;
      },
      invalidatesTags: ["Booking"],
    }),
    prepareBulkCheckOut: builder.mutation<BulkCheckInOutResponse, { bookingId: string; bookingDetailIds: BulkCheckInOutRequest }>({
      query: ({ bookingId, bookingDetailIds }) => ({
        url: `/checkInOuts/${bookingId}/check-out/prepare`,
        method: "POST",
        data: bookingDetailIds,
      }),
      transformResponse: (response: unknown) => {
        if (!response || typeof response !== "object") return {} as BulkCheckInOutResponse;
        if ("result" in response && response.result && typeof response.result === "object") {
          return response.result as BulkCheckInOutResponse;
        }
        return response as BulkCheckInOutResponse;
      },
      invalidatesTags: ["Booking", "CheckoutRefund"],
    }),
    bulkCheckOut: builder.mutation<BulkCheckInOutResponse, {
      bookingId: string;
      bookingDetailIds: BulkCheckInOutRequest;
      surplusRefundMethod?: CheckoutSurplusRefundMethod;
    }>({
      query: ({ bookingId, bookingDetailIds, surplusRefundMethod }) => ({
        url: `/checkInOuts/${bookingId}/check-out/bulk`,
        method: "POST",
        data: { bookingDetailIds, surplusRefundMethod },
      }),
      transformResponse: (response: unknown) => {
        if (!response || typeof response !== "object") return {} as BulkCheckInOutResponse;
        if ("result" in response && response.result && typeof response.result === "object") {
          return response.result as BulkCheckInOutResponse;
        }
        return response as BulkCheckInOutResponse;
      },
      invalidatesTags: ["Booking"],
    }),
  }),
});

export const {
  useGetCheckInOutSummaryQuery,
  useGetTodayCheckInsQuery,
  useGetTodayCheckOutsQuery,
  useGetEarlyCheckInsQuery,
  useBulkCheckInMutation,
  usePrepareBulkCheckOutMutation,
  useBulkCheckOutMutation,
} = checkInOutApi;
