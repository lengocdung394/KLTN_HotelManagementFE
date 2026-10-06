import { baseApi } from "./baseApi";

type ApiResponse<T> = {
  code: number;
  message?: string;
  result: T;
};

export type ProvinceOption = {
  id: string;
  name: string;
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
};

export type CreateBranchRequest = {
  name: string;
  address: string;
  phone: string;
  provinceName: string;
};

export const superAdminApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSuperAdminBranches: builder.query<SuperAdminBranch[], void>({
      query: () => ({ url: "/super-admin/branches", method: "GET" }),
      transformResponse: (response: ApiResponse<SuperAdminBranch[]>) => response?.result ?? [],
      providesTags: ["SuperAdminBranch"],
    }),
    getSuperAdminProvinces: builder.query<ProvinceOption[], void>({
      query: () => ({ url: "/super-admin/provinces", method: "GET" }),
      transformResponse: (response: ApiResponse<ProvinceOption[]>) => response?.result ?? [],
    }),
    createSuperAdminBranch: builder.mutation<SuperAdminBranch, CreateBranchRequest>({
      query: (data) => ({ url: "/super-admin/branches", method: "POST", data }),
      transformResponse: (response: ApiResponse<SuperAdminBranch>) => response.result,
      invalidatesTags: ["SuperAdminBranch"],
    }),
    getSuperAdminBranchDetails: builder.query<SuperAdminBranchDetails, number>({
      query: (hotelId) => ({ url: `/super-admin/branches/${hotelId}`, method: "GET" }),
      transformResponse: (response: ApiResponse<SuperAdminBranchDetails>) => response.result,
    }),
  }),
});

export const {
  useGetSuperAdminBranchesQuery,
  useGetSuperAdminProvincesQuery,
  useCreateSuperAdminBranchMutation,
  useGetSuperAdminBranchDetailsQuery,
} = superAdminApi;
