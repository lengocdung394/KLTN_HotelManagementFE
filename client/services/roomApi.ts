import { baseApi } from "./baseApi";

interface ApiResponse<T> {
  code: number;
  message: string;
  result: T;
}

export type RoomResponse = Record<string, unknown>;

export const roomApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createRoom: builder.mutation<RoomResponse, { roomInfo: { floorId: number; roomStatus: string; roomType: string; basePrice: number; defaultImageIndex: number; amenityIds: number[] }; imageFiles: File[] }>({
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
  }),
});

export const { useCreateRoomMutation, useGetRoomTypesQuery, useGetRoomStatusesQuery, useGetRoomsByFloorIdQuery, useGetRoomsByCurrentHotelQuery } = roomApi;