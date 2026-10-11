import { baseApi } from "./baseApi";

export type BuildingResponse = Record<string, unknown> & {
	id: string;
	name: string;
};

export type BuildingCreateRequest = {
	name: string;
};

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
			providesTags: ["Building"],
		}),
		createBuilding: builder.mutation<BuildingResponse, BuildingCreateRequest>({
			query: (body) => ({
				url: "/branch/createBuilding",
				method: "POST",
				data: body,
			}),
			transformResponse: (response: ApiResponse<BuildingResponse>) => response.result,
			invalidatesTags: ["Building"],
		}),
		updateBuilding: builder.mutation<BuildingResponse, { buildingId: string; body: BuildingCreateRequest }>({
			query: ({ buildingId, body }) => ({
				url: `/branch/updateBuilding/${encodeURIComponent(buildingId)}`,
				method: "PUT",
				data: body,
			}),
			transformResponse: (response: ApiResponse<BuildingResponse>) => response.result,
			invalidatesTags: ["Building", "Floor"],
		}),
	}),
});

export const { useGetBuildingsByCurrentHotelQuery, useCreateBuildingMutation, useUpdateBuildingMutation } = buildingApi;