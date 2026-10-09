import { baseApi } from "./baseApi";

export type FloorResponse = Record<string, unknown> & {
	id: string;
	floorNumber: number;
	building?: { id: string; name: string };
};

export type FloorCreateRequest = {
	buildingId: string;
	floorNumber: number;
};

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
			providesTags: ["Floor"],
		}),
		getFloorsByHotelId: builder.query<FloorResponse[], void>({
			query: () => ({
				url: "/floor/getFloorsByHotelId",
				method: "GET",
			}),
			transformResponse: (response: ApiResponse<FloorResponse[]>) => response?.result ?? [],
			providesTags: ["Floor"],
		}),
		createFloor: builder.mutation<FloorResponse, FloorCreateRequest>({
			query: (body) => ({
				url: "/floor/createFloor",
				method: "POST",
				data: body,
			}),
			transformResponse: (response: ApiResponse<FloorResponse>) => response.result,
			invalidatesTags: ["Floor"],
		}),
		updateFloor: builder.mutation<FloorResponse, { floorId: string; floorNumber: number }>({
			query: ({ floorId, floorNumber }) => ({
				url: `/floor/updateFloor/${encodeURIComponent(floorId)}`,
				method: "PUT",
				data: { floorNumber },
			}),
			transformResponse: (response: ApiResponse<FloorResponse>) => response.result,
			invalidatesTags: ["Floor"],
		}),
	}),
});

export const { useGetFloorsByBuildingIdQuery, useGetFloorsByHotelIdQuery, useCreateFloorMutation, useUpdateFloorMutation } = floorApi;