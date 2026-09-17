import { baseApi } from "./baseApi";

interface ApiResponse<T> {
  code: number;
  message?: string;
  result: T;
}

export type HotelService = {
  id: string;
  name: string;
  detail: string;
  price: number;
  category: string;
  active: boolean;
};

export type ServiceResponse = {
  id: number;
  name: string;
  description: string;
  price: number;
  unit: string;
  category: string;
  imageUrl: string;
  active: boolean;
  hotelId: number;
  hotelName: string;
};

export const serviceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllServices: builder.query<HotelService[], { hotelId?: number; category?: string; activeOnly?: boolean } | void>({
      query: (params) => ({
        url: "/services",
        method: "GET",
        params: params ?? undefined,
      }),
      transformResponse: (response: ApiResponse<ServiceResponse[]>) => (response?.result ?? []).map(({ id, name, description, price, category, active }) => ({ id: String(id), name, detail: description, price: Number(price ?? 0), category, active: active ?? true })),
    }),
  }),
});

export const { useGetAllServicesQuery } = serviceApi;
