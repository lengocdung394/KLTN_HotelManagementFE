import { baseApi } from "./baseApi";

interface ApiResponse<T> {
  code: number;
  message: string;
  result: T;
}

export type AmenityResponse = {
  id: number;
  name: string;
  price: number;
};

export const amenityApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllAmenities: builder.query<AmenityResponse[], void>({
      query: () => ({
        url: "/amenities/getAll",
        method: "GET",
      }),
      transformResponse: (response: ApiResponse<AmenityResponse[]>) => response?.result ?? [],
    }),
  }),
});

export const { useGetAllAmenitiesQuery } = amenityApi;