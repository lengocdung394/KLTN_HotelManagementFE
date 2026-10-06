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

export type ServiceRequest = {
  name: string;
  description: string;
  price: number;
  unit: string;
  category: string;
  active: boolean;
};

type SaveServiceArgs = {
  service: ServiceRequest;
  imageFile?: File | null;
  skipInvalidation?: boolean;
};

const serviceFormData = ({ service, imageFile }: SaveServiceArgs) => {
  const formData = new FormData();
  formData.append("service", new Blob([JSON.stringify(service)], { type: "application/json" }));
  if (imageFile) formData.append("imageFile", imageFile);
  return formData;
};

const mapService = (service: ServiceResponse): HotelService => ({
  id: String(service.id),
  name: service.name,
  detail: service.description,
  price: Number(service.price ?? 0),
  unit: service.unit,
  category: service.category,
  active: service.active ?? true,
  imageUrl: service.imageUrl || undefined,
});

export const serviceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllServices: builder.query<HotelService[], { hotelId?: number; category?: string; activeOnly?: boolean } | void>({
      query: (params) => ({
        url: "/services",
        method: "GET",
        params: params ?? undefined,
      }),
      transformResponse: (response: ApiResponse<ServiceResponse[]>) => (response?.result ?? []).map(mapService),
      providesTags: ["Service"],
    }),
    createService: builder.mutation<ServiceResponse, SaveServiceArgs>({
      query: (body) => ({
        url: "/services/createService",
        method: "POST",
        data: serviceFormData(body),
      }),
      transformResponse: (response: ApiResponse<ServiceResponse>) => response.result,
      invalidatesTags: (_result, _error, args) => args.skipInvalidation ? [] : ["Service"],
    }),
    updateService: builder.mutation<ServiceResponse, SaveServiceArgs & { id: string }>({
      query: ({ id, ...body }) => ({
        url: `/services/updateService/${encodeURIComponent(id)}`,
        method: "PUT",
        data: serviceFormData(body),
      }),
      transformResponse: (response: ApiResponse<ServiceResponse>) => response.result,
      invalidatesTags: ["Service"],
    }),
  }),
});

export const { useGetAllServicesQuery, useCreateServiceMutation, useUpdateServiceMutation } = serviceApi;
