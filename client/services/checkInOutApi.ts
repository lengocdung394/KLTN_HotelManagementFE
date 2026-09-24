import { baseApi } from "./baseApi";

export type CheckInOutService = {
  serviceId?: string;
  price?: number;
  quantity?: number;
  usedAt?: string;
  name?: string;
  serviceName?: string;
  nameService?: string;
};

export type CheckInOutBookingDetail = {
  bookingId?: string;
  bookingDetailId?: number;
  roomId?: string;
  roomNumber?: string;
  roomName?: string;
  roomTypeName?: string;
  checkInTime?: string;
  checkOutTime?: string;
  numAdults?: number;
  numChildren?: number;
  numInfants?: number;
  baseRoomPricePerNight?: number;
  extraAdultFeePerNight?: number;
  extraChildFeePerNight?: number;
  roomSubTotal?: number;
  serviceSubTotal?: number;
  totalPrice?: number;
  nameCustomer?: string;
  cccd?: string;
  customerName?: string;
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

export type BulkCheckInOutRequest = number[];
export type BulkCheckInOutResponse = Record<string, unknown>;

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
      cccd: detail.cccd ?? booking.cccd,
      identityNumber: detail.identityNumber ?? booking.identityNumber,
    }));
  });
};

export const checkInOutApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
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
    bulkCheckIn: builder.mutation<BulkCheckInOutResponse, { bookingId: string; bookingDetailIds: number[] }>({
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
    bulkCheckOut: builder.mutation<BulkCheckInOutResponse, { bookingId: string; bookingDetailIds: number[] }>({
      query: ({ bookingId, bookingDetailIds }) => ({
        url: `/checkInOuts/${bookingId}/check-out/bulk`,
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
  }),
});

export const {
  useGetTodayCheckInsQuery,
  useGetTodayCheckOutsQuery,
  useBulkCheckInMutation,
  useBulkCheckOutMutation,
} = checkInOutApi;
