import { baseApi } from "./baseApi";

interface ApiResponse<T> {
  code: number;
  message: string;
  result: T;
}

export const roomApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
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
  }),
});

export const { useGetRoomTypesQuery, useGetRoomStatusesQuery } = roomApi;