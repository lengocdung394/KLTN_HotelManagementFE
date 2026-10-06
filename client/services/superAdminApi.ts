import { baseApi } from "./baseApi";

type ApiResponse<T> = {
  code: number;
  message?: string;
  result: T;
};

type ProvinceApiOption = ProvinceOption & {
  background_image_url?: string | null;
};

export type ProvinceOption = {
  id: string;
  name: string;
  backgroundImageUrl?: string | null;
};

export type SuperAdminBranch = {
  id: number;
  name: string;
  address: string;
  phone: string;
  provinceName: string | null;
  employeeCount: number;
  bookingCount: number;
  totalRevenue: number;
};

export type SuperAdminEmployee = {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  position?: string;
  roles?: string[];
};

export type SuperAdminBooking = {
  bookingId?: string;
  bookingStatus?: string;
  bookingChannel?: string;
  customerName?: string;
  createdAt?: string;
  paidAmount?: number;
  remainingAmount?: number;
  finalAmount?: number;
};

export type SuperAdminBranchDetails = {
  branch: SuperAdminBranch;
  employees: SuperAdminEmployee[];
  bookings: SuperAdminBooking[];
  buildings: { id: string; name: string; floorCount: number }[];
  floors: { id: string; floorNumber: number; buildingId: string; buildingName: string; roomCount: number }[];
  rooms: { id: string; roomNumber: string; roomType: string | null; roomStatus: string | null; floorId: string; floorNumber: number; buildingName: string }[];
  services: { id: string; name: string; category: string | null; price: number | null; unit: string | null; shared: boolean }[];
  promotions: { id: string; code: string; name: string; status: string | null; startDate: string | null; endDate: string | null }[];
  roomPolicies: SuperAdminRoomPolicy[];
};

export type SuperAdminRoomPolicy = {
  id?: string;
  roomType: "STANDARD" | "DELUXE" | "SUITE" | "FAMILY";
  area: number;
  basePrice: number;
  extraAdultFee: number;
  extraChildFee: number;
  standardCapacity: number;
  maxExtraGuests: number;
};

export type CreateBranchRequest = {
  name: string;
  address: string;
  phone: string;
  provinceName: string;
};

export type CreateProvinceRequest = {
  name: string;
  backgroundImageUrl: string;
};

export const superAdminApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSuperAdminBranches: builder.query<SuperAdminBranch[], void>({
      query: () => ({ url: "/superAdmin/branches", method: "GET" }),
      transformResponse: (response: ApiResponse<SuperAdminBranch[]>) => response?.result ?? [],
      providesTags: ["SuperAdminBranch"],
    }),
    getSuperAdminBranchesByProvince: builder.query<SuperAdminBranch[], string>({
      query: (provinceId) => ({ url: `/superAdmin/branches/by-province/${encodeURIComponent(provinceId)}`, method: "GET" }),
      transformResponse: (response: ApiResponse<SuperAdminBranch[]>) => response?.result ?? [],
      providesTags: ["SuperAdminBranch"],
    }),
    getSuperAdminProvinces: builder.query<ProvinceOption[], void>({
      query: () => ({ url: "/superAdmin/provinces", method: "GET" }),
      transformResponse: (response: ApiResponse<ProvinceApiOption[]>) => (response?.result ?? []).map((province) => ({
        id: province.id,
        name: province.name,
        backgroundImageUrl: province.backgroundImageUrl ?? province.background_image_url ?? null,
      })),
      providesTags: ["SuperAdminProvince"],
    }),
    createSuperAdminProvince: builder.mutation<ProvinceOption, CreateProvinceRequest>({
      query: (data) => ({ url: "/superAdmin/createProvince", method: "POST", data }),
      transformResponse: (response: ApiResponse<ProvinceOption>) => response.result,
      invalidatesTags: ["SuperAdminProvince"],
    }),
    updateSuperAdminProvinceBackground: builder.mutation<ProvinceOption, { provinceId: string; backgroundImageUrl: string }>({
      query: ({ provinceId, backgroundImageUrl }) => ({
        url: `/superAdmin/provinces/${encodeURIComponent(provinceId)}/background-image`,
        method: "PUT",
        data: { backgroundImageUrl },
      }),
      transformResponse: (response: ApiResponse<ProvinceOption>) => response.result,
      invalidatesTags: ["SuperAdminProvince"],
    }),
    createSuperAdminBranch: builder.mutation<SuperAdminBranch, CreateBranchRequest>({
      query: (data) => ({ url: "/superAdmin/branches", method: "POST", data }),
      transformResponse: (response: ApiResponse<SuperAdminBranch>) => response.result,
      invalidatesTags: ["SuperAdminBranch"],
    }),
    getSuperAdminBranchDetails: builder.query<SuperAdminBranchDetails, number>({
      query: (hotelId) => ({ url: `/superAdmin/branches/${hotelId}`, method: "GET" }),
      transformResponse: (response: ApiResponse<SuperAdminBranchDetails>) => response.result,
      providesTags: ["SuperAdminBranch"],
    }),
    saveSuperAdminBranchRoomPolicies: builder.mutation<SuperAdminRoomPolicy[], { hotelId: number; policies: SuperAdminRoomPolicy[] }>({
      query: ({ hotelId, policies }) => ({
        url: `/superAdmin/branches/${hotelId}/room-policies`,
        method: "PUT",
        data: policies,
      }),
      transformResponse: (response: ApiResponse<SuperAdminRoomPolicy[]>) => response.result,
      invalidatesTags: ["SuperAdminBranch", "BranchRoomPolicy"],
    }),
  }),
});

export const {
  useGetSuperAdminBranchesQuery,
  useGetSuperAdminBranchesByProvinceQuery,
  useGetSuperAdminProvincesQuery,
  useCreateSuperAdminProvinceMutation,
  useUpdateSuperAdminProvinceBackgroundMutation,
  useCreateSuperAdminBranchMutation,
  useGetSuperAdminBranchDetailsQuery,
  useSaveSuperAdminBranchRoomPoliciesMutation,
} = superAdminApi;
