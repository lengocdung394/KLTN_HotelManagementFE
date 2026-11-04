import { baseApi } from "./baseApi";

type ApiResponse<T> = {
  code: number;
  message?: string;
  result: T;
};

type PublicHotel = {
  id: number;
  imageUrls?: string[] | null;
};

export const branchHotelApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPublicBranchImages: builder.query<string[], string>({
      query: () => ({ url: "/hotel/public/all", method: "GET" }),
      transformResponse: (response: ApiResponse<PublicHotel[]>, _meta, hotelId) => {
        if (!Array.isArray(response.result)) {
          throw new Error("BE trả về danh sách khách sạn không hợp lệ.");
        }
        return response.result.find((hotel) => String(hotel.id) === hotelId)?.imageUrls ?? [];
      },
      providesTags: ["BranchHotelImages"],
    }),
    getCurrentBranchImages: builder.query<string[], void>({
      query: () => ({ url: "/hotel/current/images", method: "GET" }),
      transformResponse: (response: ApiResponse<string[]>) => {
        if (!Array.isArray(response.result)) {
          throw new Error("BE trả về danh sách ảnh chi nhánh không hợp lệ.");
        }
        return response.result;
      },
      providesTags: ["BranchHotelImages"],
    }),
    updateCurrentBranchImages: builder.mutation<string[], string[]>({
      query: (imageUrls) => ({
        url: "/hotel/current/images",
        method: "PUT",
        data: { imageUrls },
      }),
      transformResponse: (response: ApiResponse<string[]>) => {
        if (!Array.isArray(response.result)) {
          throw new Error("BE trả về danh sách ảnh chi nhánh không hợp lệ.");
        }
        return response.result;
      },
      invalidatesTags: ["BranchHotelImages"],
    }),
  }),
});

export const {
  useGetPublicBranchImagesQuery,
  useGetCurrentBranchImagesQuery,
  useUpdateCurrentBranchImagesMutation,
} = branchHotelApi;
