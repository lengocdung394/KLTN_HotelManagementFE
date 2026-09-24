import { baseApi } from "./baseApi";

interface ApiResponse<T> {
  code: number;
  message: string;
  result: T;
}

export type RoomResponse = {
  id?: string;
  roomId?: string;
  roomNumber?: string | number;
  roomCode?: string;
  roomType?: string;
  roomName?: string;
  roomStatus?: string;
  basePrice?: number;
  price?: number;
  totalPrice?: number;
  standardCapacity?: number;
  maxAdults?: number;
  maxChildren?: number;
  maxInfants?: number;
  maxExtraGuests?: number;
  extraAdultFee?: number;
  extraChildFee?: number;
  floorId?: number;
  buildingId?: number;
  [key: string]: unknown;
};
export type RoomTypeDetailResponse = {
  [key: string]: unknown;
};
export type BedTypeResponse = {
  id?: string;
  name?: string;
  [key: string]: unknown;
};
export type RoomDailyPricesResponse = Record<string, Record<string, number>>;

export const roomApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createRoom: builder.mutation<RoomResponse, { roomInfo: { floorId: number; roomStatus: string; roomType: string; basePrice: number; standardCapacity: number; maxExtraGuests: number; extraAdultFee: number; extraChildFee: number; defaultImageIndex: number; amenityIds: number[] }; imageFiles: File[] }>({
      query: ({ roomInfo, imageFiles }) => {
        const formData = new FormData();
        formData.append("roomInfo", new Blob([JSON.stringify(roomInfo)], { type: "application/json" }));
        imageFiles.forEach((file) => formData.append("avatarUrl", file));
        return { url: "/rooms/create", method: "POST", data: formData };
      },
      transformResponse: (response: ApiResponse<RoomResponse>) => response?.result ?? {},
      invalidatesTags: ["Room"],
    }),
    // Trả về mảng string[] từ Backend
    getRoomTypes: builder.query<string[], void>({
      query: () => ({
        url: "/rooms/enums/types", // Đúng chính xác đường dẫn Swagger đang chạy
        method: "GET",
      }),
      transformResponse: (response: ApiResponse<string[]>) => response?.result ?? [],
    }),

    getAllBedTypes: builder.query<BedTypeResponse[], void>({
      query: () => ({
        url: "/bedTypes/getAll",
        method: "GET",
      }),
      transformResponse: (response: ApiResponse<BedTypeResponse[]>) => response?.result ?? [],
    }),

    getRoomStatuses: builder.query<string[], void>({
      query: () => ({
        url: "/rooms/enums/statuses", // Đúng chính xác đường dẫn Swagger đang chạy
        method: "GET",
      }),
      transformResponse: (response: ApiResponse<string[]>) => response?.result ?? [],
    }),

    getRoomsByFloorId: builder.query<RoomResponse[], number>({
      query: (floorId) => ({
        url: "/room/getRoomsByFloorId",
        method: "GET",
        params: { floorId },
      }),
      transformResponse: (response: ApiResponse<RoomResponse[]>) => response?.result ?? [],
    }),

    getRoomsByCurrentHotel: builder.query<RoomResponse[], void>({
      query: () => ({
        url: "/room/hotel",
        method: "GET",
      }),
      transformResponse: (response: ApiResponse<RoomResponse[]>) => response?.result ?? [],
      providesTags: ["Room"],
    }),

    getBranchRoomDailyPrices: builder.query<RoomDailyPricesResponse, { hotelId: number; startDate: string; endDate: string }>({
      query: ({ hotelId, startDate, endDate }) => ({
        url: "/management-rooms/branch-prices",
        method: "GET",
        params: { hotelId, startDate, endDate },
      }),
    }),

    getRoomTypeDetail: builder.query<RoomTypeDetailResponse, { hotelId: number; roomType: string }>({
      query: ({ hotelId, roomType }) => ({
        url: `/hotels/${hotelId}/room-types/${roomType}/detail`,
        method: "GET",
      }),
    }),
  }),
});

export const { useCreateRoomMutation, useGetRoomTypesQuery, useGetAllBedTypesQuery, useGetRoomStatusesQuery, useGetRoomsByFloorIdQuery, useGetRoomsByCurrentHotelQuery, useGetBranchRoomDailyPricesQuery, useGetRoomTypeDetailQuery } = roomApi;