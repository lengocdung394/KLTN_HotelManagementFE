import { baseApi } from "./baseApi";

type ApiResponse<T> = {
  code: number;
  message?: string;
  result: T;
};

export type DailyServiceRevenue = {
  date: string;
  revenue: number;
  serviceUsageCount: number;
};

export type PromotionUsageReport = {
  promotionId: string;
  promotionName: string;
  promotionCode: string;
  usageCount: number;
  userCount: number;
  savings: number;
};

export type RoomStatusReport = {
  status: "READY" | "MAINTENANCE" | "IN_USE" | "CLEANING" | string;
  roomCount: number;
};

export type RoomTypeBookingReport = {
  roomType: string;
  bookingCount: number;
};

export type BookingCancellationReport = {
  bookingId: string;
  bookingChannel: "ONLINE" | "OFFLINE" | "UNKNOWN";
  reason: string;
  cancelledAt: string | null;
};

export type HotelReport = {
  startDate: string;
  endDate: string;
  totalBookingCount?: number;
  cashReceived?: number;
  cashRefunded?: number;
  cashChangeReturned?: number;
  netCashReceived?: number;
  serviceRevenue: number;
  serviceUsageCount: number;
  dailyServiceRevenue: DailyServiceRevenue[];
  promotionUsageCount: number;
  promotionSavings: number;
  promotions: PromotionUsageReport[];
  cancelledBookingCount?: number;
  onlineCancelledBookingCount?: number;
  offlineCancelledBookingCount?: number;
  cancelledBookings?: BookingCancellationReport[];
  totalRoomCount: number;
  roomStatuses: RoomStatusReport[];
  roomTypeBookings: RoomTypeBookingReport[];
};

export type HotelReportArgs = {
  startDate: string;
  endDate: string;
  hotelId?: number;
};

export const reportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getHotelReport: builder.query<HotelReport, HotelReportArgs>({
      query: ({ startDate, endDate, hotelId }) => ({
        url: "/reports/hotel-summary",
        method: "GET",
        params: {
          startDate,
          endDate,
          ...(hotelId === undefined ? {} : { hotelId }),
        },
      }),
      transformResponse: (response: ApiResponse<HotelReport>) => response.result,
      providesTags: ["Booking", "Room"],
    }),
  }),
});

export const { useGetHotelReportQuery } = reportApi;
