import { baseApi } from "./baseApi";
import type { BookingResponse } from "./bookingApi";

export type ManagementBookingServiceCancellation = {
  bookingDetailId: number;
  serviceDetailIds: number[];
};

export type ManagementBookingServiceAddition = {
  serviceId: number;
  quantity: number;
  name?: string;
  price?: number;
  usedAt?: string;
};

export type ManagementBookingRoomServiceAddition = {
  bookingDetailId: number;
  services: ManagementBookingServiceAddition[];
};

export type ManagementBookingRoomToAdd = {
  roomId: number;
  checkInTime: string;
  checkOutTime: string;
  numAdults: number;
  numChildren: number;
  numInfants: number;
  serviceRequests: {
    serviceId: number;
    quantity: number;
    name?: string;
    price?: number;
    usedAt?: string;
  }[];
};

export type ManagementBookingServiceQuantityItem = {
  serviceId: number;
  quantity: number;
};

export type ManagementBookingUpdateServiceQuantityRequest = {
  bookingDetailId: number;
  services: ManagementBookingServiceQuantityItem[];
};

export type ManagementBookingModificationRequest = {
  employeeId: number;
  bookingDetailIdsToCancel: number[];
  servicesToCancel: ManagementBookingServiceCancellation[];
  roomsToAdd: ManagementBookingRoomToAdd[];
  roomsToChange: { bookingDetailId: number; newRoomId: number }[];
  roomsToUpdateDates: { bookingDetailId: number; newCheckInTime: string; newCheckoutTime?: string; newCheckOutTime?: string }[];
  servicesToAddForExistingRooms: ManagementBookingRoomServiceAddition[];
  serviceQuantityUpdates: ManagementBookingUpdateServiceQuantityRequest[];
};

export const managementBookingApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    modifyBooking: builder.mutation<
      BookingResponse,
      { bookingId: number | string; request: ManagementBookingModificationRequest }
    >({
      query: ({ bookingId, request }) => ({
        url: `/management-bookings/${bookingId}/modify`,
        method: "PUT",
        data: request,
      }),
      invalidatesTags: ["Booking", "Room"],
    }),
  }),
});

export const { useModifyBookingMutation } = managementBookingApi;
