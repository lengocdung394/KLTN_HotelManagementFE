import { baseApi } from "./baseApi";

export type BuildingResponse = Record<string, unknown>;

interface ApiResponse<T> {
	code: number;
	message?: string;
	result: T;
}

export const buildingApi = baseApi.injectEndpoints({
	endpoints: (builder) => ({
		getBuildingsByHotelId: builder.query<BuildingResponse[], number>({
			query: (hotelId) => ({
				url: "/branch/getBuildingByHotelId",
				method: "GET",
				params: { hotelId },
			}),
			transformResponse: (response: ApiResponse<BuildingResponse[]>) => response?.result ?? [],
		}),
	}),
});

export const { useGetBuildingsByHotelIdQuery } = buildingApi;