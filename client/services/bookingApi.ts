import { baseApi } from "./baseApi";

export type BookingServiceRequest = {
  serviceId: string;
  quantity: number;
  name?: string;
  price?: number;
  usedAt?: string;
};

export type BookingDetailCreateRequest = {
  roomId: string;
  roomNumber: string;
  checkInTime: string;
  checkOutTime: string;
  numAdults: number;
  numChildren: number;
  numInfants: number;
  serviceRequests: BookingServiceRequest[];
};

export type BookingCreateRequest = {
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerIdentityNumber?: string;
  employeeId?: string;
  bookingChannel: "ONLINE" | "OFFLINE";
  customerPromotionId: string | null;
  promotionId: string | null;
  bookingDetails: BookingDetailCreateRequest[];
};

export type BookingResponse = Record<string, unknown>;

export type BookingListItem = {
  id?: string;
  orderId?: string;
  bookingId?: string;
  customerId?: string;
  employeeId?: string;
  customerName?: string;
  bookingStatus?: string;
  bookingChannel?: string;
  createdAt?: string;
  roomTotal?: number;
  serviceTotal?: number;
  discountTotal?: number;
  finalAmount?: number;
  bookingDetails?: Record<string, unknown>[];
  [key: string]: unknown;
};

export type RoomMatrixResponse = Record<string, unknown>;

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
  bookingId?: string;
  customerName?: string;
  bookingStatus?: string;
  bookingChannel?: string;
  roomTotal?: number;
  serviceTotal?: number;
  discountTotal?: number;
  finalAmount?: number;
  notes?: string;
  [key: string]: unknown;
};

export const bookingApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getRoomMatrix: builder.query<RoomMatrixResponse[], { startDate: string; endDate: string }>({
      query: ({ startDate, endDate }) => ({
        url: "/hotels/matrix",
        method: "GET",
        params: { startDate, endDate },
      }),
      transformResponse: (response: unknown) => {
        if (Array.isArray(response)) return response as RoomMatrixResponse[];
        if (response && typeof response === "object") {
          const result = (response as { result?: unknown }).result;
          if (Array.isArray(result)) return result as RoomMatrixResponse[];
        }
        return [];
      },
      providesTags: ["Booking"],
    }),
    getBookingsByHotel: builder.query<BookingListItem[], number>({
      query: (hotelId) => ({
        url: `/hotels/bookings`,
        method: "GET",
      }),
      transformResponse: extractBookingList,
      providesTags: ["Booking"],
    }),
    createCounterBooking: builder.mutation<BookingResponse, { employeeId: string; request: BookingCreateRequest }>({
      query: ({ employeeId, request }) => ({
        url: `/bookings/counter`,
        method: "POST",
        data: request,
      }),
      invalidatesTags: ["Booking", "Room"],
    }),
    updateBooking: builder.mutation<BookingResponse, { id: string; request: BookingUpdateRequest }>({
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
  useGetRoomMatrixQuery,
  useGetBookingsByHotelQuery,
  useCreateCounterBookingMutation,
  useUpdateBookingMutation,
} = bookingApi;
