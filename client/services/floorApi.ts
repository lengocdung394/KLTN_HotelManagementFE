import { baseApi } from "./baseApi";

export type FloorResponse = Record<string, unknown>;

interface ApiResponse<T> {
	code: number;
	message?: string;
	result: T;
}

export const floorApi = baseApi.injectEndpoints({
	endpoints: (builder) => ({
		getFloorsByBuildingId: builder.query<FloorResponse[], string>({
			query: (buildingId) => ({
				url: "/floor/getFloorsByBuildingId",
				method: "GET",
				params: { buildingId },
			}),
			transformResponse: (response: ApiResponse<FloorResponse[]>) => response?.result ?? [],
		}),
		getFloorsByHotelId: builder.query<FloorResponse[], void>({
			query: () => ({
				url: "/floor/getFloorsByHotelId",
				method: "GET",
			}),
			transformResponse: (response: ApiResponse<FloorResponse[]>) => response?.result ?? [],
		}),
	}),
});

export const { useGetFloorsByBuildingIdQuery, useGetFloorsByHotelIdQuery } = floorApi;