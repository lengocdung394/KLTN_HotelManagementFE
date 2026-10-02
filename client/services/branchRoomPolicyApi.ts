import { baseApi } from "./baseApi";

export type BranchRoomPolicy = Record<string, unknown>;

export type BranchRoomPolicyUpdateRequest = {
  price: number;
  extraAdultFee: number;
  extraChildFee: number;
  standardCapacity: number;
  maxExtraGuests: number;
};

const extractPolicies = (response: unknown): BranchRoomPolicy[] => {
  if (Array.isArray(response)) return response as BranchRoomPolicy[];
  if (!response || typeof response !== "object") return [];
  const result = (response as { result?: unknown }).result;
  return Array.isArray(result) ? result as BranchRoomPolicy[] : [];
};

export const branchRoomPolicyApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getBranchRoomPolicies: builder.query<BranchRoomPolicy[], number | void>({
      query: (hotelId) => ({
        url: "/branch_room_policys/hotel",
        method: "GET",
        params: hotelId ? { hotelId } : undefined,
      }),
      transformResponse: extractPolicies,
      providesTags: ["BranchRoomPolicy"],
    }),
    updateBranchRoomPolicy: builder.mutation<BranchRoomPolicy, { policyId: string; request: BranchRoomPolicyUpdateRequest }>({
      query: ({ policyId, request }) => ({
        url: `/branch_room_policys/${encodeURIComponent(policyId)}`,
        method: "PUT",
        data: request,
      }),
      invalidatesTags: ["BranchRoomPolicy"],
    }),
  }),
});

export const { useGetBranchRoomPoliciesQuery, useUpdateBranchRoomPolicyMutation } = branchRoomPolicyApi;