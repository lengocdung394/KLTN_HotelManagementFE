import { baseApi } from "./baseApi";
import axiosClient from "../store/axiosClient";

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

export type AmenityImportRequest = {
  amenities: Array<{
    row: number;
    name: string;
    price: number;
  }>;
};

export type AmenityImportTaskStatus = {
  status: string;
  message?: string;
  percent?: number;
  details?: AmenityResponse[];
};

type StartAmenityImportResponse = {
  taskId: string;
  message?: string;
};

export const getAmenityImportStatus = async (taskId: string, signal?: AbortSignal) => {
  const response = await axiosClient.get<AmenityImportTaskStatus>(
    `/amenitiesExcel/import-status/${encodeURIComponent(taskId)}`,
    { signal },
  );
  if (!response.data || typeof response.data.status !== "string") {
    throw new Error("Phản hồi trạng thái nhập tiện nghi không hợp lệ.");
  }
  return response.data;
};

export const isAmenityImportFinished = (status: AmenityImportTaskStatus) =>
  ["SUCCESS", "FAILED"].includes(status.status.trim().toUpperCase());

export const amenityApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllAmenities: builder.query<AmenityResponse[], void>({
      query: () => ({
        url: "/amenities/getAll",
        method: "GET",
      }),
      transformResponse: (response: ApiResponse<AmenityResponse[]>) => response?.result ?? [],
      providesTags: ["Amenity"],
    }),
    createSharedAmenity: builder.mutation<AmenityResponse[], AmenityImportRequest>({
      query: (data) => ({
        url: "/amenities/importExcel",
        method: "POST",
        data,
      }),
      transformResponse: (response: ApiResponse<AmenityResponse[]>) => response?.result ?? [],
      invalidatesTags: ["Amenity"],
    }),
    importAmenitiesFromFile: builder.mutation<StartAmenityImportResponse, AmenityImportRequest>({
      query: (data) => ({
        url: "/amenitiesExcel/importExcel/async",
        method: "POST",
        data,
      }),
      transformResponse: (response: StartAmenityImportResponse) => response,
    }),
  }),
});

export const { useGetAllAmenitiesQuery, useCreateSharedAmenityMutation, useImportAmenitiesFromFileMutation } = amenityApi;