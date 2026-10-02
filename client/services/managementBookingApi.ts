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
  }),
});

export const { useModifyBookingMutation } = managementBookingApi;
