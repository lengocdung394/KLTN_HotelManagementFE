import { baseApi } from "./baseApi";

export type BuildingResponse = Record<string, unknown>;

interface ApiResponse<T> {
	code: number;
	message?: string;
	result: T;
}

export const buildingApi = baseApi.injectEndpoints({
	endpoints: (builder) => ({
		getBuildingsByCurrentHotel: builder.query<BuildingResponse[], void>({
			query: () => ({
				url: "/branch/getBuildingByHotelId",
				method: "GET",
			}),
			transformResponse: (response: ApiResponse<BuildingResponse[]>) => response?.result ?? [],
		}),
	}),
});

export const { useGetBuildingsByCurrentHotelQuery } = buildingApi;