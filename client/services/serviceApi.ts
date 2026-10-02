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
  unit: string;
  category: string;
  active: boolean;
  imageUrl?: string;
};

export type ServiceResponse = {
  id: string;
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

export type CreateServiceRequest = {
  name: string;
  description: string;
  price: number;
  unit: string;
  category: string;
  imageUrl?: string;
  hotelId?: number;
};

export type UpdateServiceRequest = {
  name: string;
  description: string;
  price: number;
  unit: string;
  category: string;
  imageUrl?: string;
  active?: boolean;
};

export const serviceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllServices: builder.query<HotelService[], { hotelId?: number; category?: string; activeOnly?: boolean } | void>({
      query: (params) => ({
        url: "/services",
        method: "GET",
        params: params ?? undefined,
      }),
      transformResponse: (response: ApiResponse<ServiceResponse[]>) => (response?.result ?? []).map(({ id, name, description, price, unit, category, active, imageUrl }) => ({ id: String(id), name, detail: description, price: Number(price ?? 0), unit, category, active: active ?? true, imageUrl })),
      providesTags: ["Service"],
    }),
    createService: builder.mutation<HotelService, CreateServiceRequest>({
      query: (data) => ({
        url: "/services",
        method: "POST",
        data,
      }),
      invalidatesTags: ["Service"],
    }),
    updateService: builder.mutation<HotelService, { id: string; data: UpdateServiceRequest }>({
      query: ({ id, data }) => ({
        url: `/services/${id}`,
        method: "PUT",
        data,
      }),
      invalidatesTags: ["Service"],
    }),
    toggleServiceStatus: builder.mutation<HotelService, string>({
      query: (id) => ({
        url: `/services/${id}/toggle-status`,
        method: "PATCH",
      }),
      invalidatesTags: ["Service"],
    }),
    deleteService: builder.mutation<void, string>({
      query: (id) => ({
        url: `/services/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Service"],
    }),
  }),
});

export const {
  useGetAllServicesQuery,
  useCreateServiceMutation,
  useUpdateServiceMutation,
  useToggleServiceStatusMutation,
  useDeleteServiceMutation,
} = serviceApi;
