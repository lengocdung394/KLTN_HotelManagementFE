import { baseApi } from "./baseApi";

export type BookingServiceRequest = {
  serviceId: number;
  quantity: number;
  name?: string;
  price?: number;
  usedAt?: string;
};

export type BookingDetailCreateRequest = {
  roomId: number;
  checkInTime: string;
  checkOutTime: string;
  numAdults: number;
  numChildren: number;
  numInfants: number;
  serviceRequests: BookingServiceRequest[];
};

export type BookingCreateRequest = {
  customerId: number;
  employeeId?: number;
  bookingChannel: "ONLINE" | "OFFLINE";
  customerPromotionId: number | null;
  promotionId: number | null;
  bookingDetails: BookingDetailCreateRequest[];
};

export type BookingResponse = Record<string, unknown>;

export type BookingListItem = {
  orderId?: number;
  bookingId?: number;
  customerId?: number;
  customerName?: string;
  bookingStatus?: string;
  bookingChannel?: string;
  createdAt?: string;
  roomTotal?: number | string;
  serviceTotal?: number | string;
  discountTotal?: number | string;
  finalAmount?: number | string;
  bookingDetails?: Record<string, unknown>[];
  [key: string]: unknown;
};

const extractBookingList = (response: unknown): BookingListItem[] => {
  if (Array.isArray(response)) return response as BookingListItem[];
  if (!response || typeof response !== "object") return [];
  const result = (response as { result?: unknown }).result;
  if (Array.isArray(result)) return result as BookingListItem[];
  if (!result || typeof result !== "object") return [];
  const page = result as { content?: unknown; items?: unknown; data?: unknown; records?: unknown };
  const values = [page.content, page.items, page.data, page.records].find(Array.isArray);
  return (values ?? []) as BookingListItem[];
};

export type BookingUpdateRequest = {
  bookingId?: number | string;
  customerName?: string;
  bookingStatus?: string;
  bookingChannel?: string;
  roomTotal?: number | string;
  serviceTotal?: number | string;
  discountTotal?: number | string;
  finalAmount?: number | string;
  notes?: string;
  [key: string]: unknown;
};

export const bookingApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getBookingsByHotel: builder.query<BookingListItem[], number>({
      query: (hotelId) => ({
        url: `/hotels/booking/${hotelId}`,
        method: "GET",
      }),
      transformResponse: extractBookingList,
      providesTags: ["Booking"],
    }),
    createCounterBooking: builder.mutation<BookingResponse, { employeeId: number; request: BookingCreateRequest }>({
      query: ({ employeeId, request }) => ({
        url: `/bookings/counter/${employeeId}`,
        method: "POST",
        data: request,
      }),
      invalidatesTags: ["Booking", "Room"],
    }),
    updateBooking: builder.mutation<BookingResponse, { id: number | string; request: BookingUpdateRequest }>({
      query: ({ id, request }) => ({
        url: `/bookings/${id}`,
        method: "PUT",
        data: request,
      }),
      invalidatesTags: ["Booking"],
    }),
  }),
});

export const {
  useGetBookingsByHotelQuery,
  useCreateCounterBookingMutation,
  useUpdateBookingMutation,
} = bookingApi;
