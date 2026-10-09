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

export type CreateBranchAccountRequest = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
};

export type CreateBranchAdminAccountRequest = {
  username: string;
  password: string;
};

export type CreateBranchRequest = {
  name: string;
  address: string;
  phone: string;
  provinceName: string;
  adminAccount: CreateBranchAdminAccountRequest;
  managerAccount: CreateBranchAccountRequest;
  roomPolicies: SuperAdminRoomPolicy[];
};

export type CreateProvinceRequest = {
  name: string;
  backgroundImageUrl: string;
};

export type SuperAdminRole = {
  code: string;
  name: string;
  description: string;
  system: boolean;
};

export type CreateSuperAdminRoleRequest = {
  code: string;
  name: string;
  description: string;
};

export type SuperAdminPermissionAssignment = {
  code: string;
  name: string;
  category: string;
  description: string;
  granted: boolean;
};

export type SuperAdminPermissionCatalogItem = Omit<SuperAdminPermissionAssignment, "granted">;

export type CreateSuperAdminPermissionRequest = SuperAdminPermissionCatalogItem;

export type SuperAdminPermissionCatalogGroup = {
  category: string;
  permissions: SuperAdminPermissionCatalogItem[];
};

export type SuperAdminRolePermissionGroup = {
  roleCode: string;
  permissions: SuperAdminPermissionAssignment[];
};

export type SuperAdminRolePermissionOverview = SuperAdminRolePermissionGroup;

export type SuperAdminAccount = {
  accountId: string | null;
  profileId: string;
  accountType: "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "EMPLOYEE" | "CUSTOMER" | "WALK_IN_CUSTOMER" | "OTHER";
  email: string | null;
  fullName: string | null;
  phone: string | null;
  identityNumber: string | null;
  address: string | null;
  position: string | null;
  avatarUrl: string | null;
  hotelId: number | null;
  hotelName: string | null;
  registered: boolean | null;
  loyaltyTier: string | null;
  roles: string[];
};

export type SuperAdminAccountListType =
  | "ALL"
  | "STAFF"
  | "CUSTOMERS"
  | "REGISTERED_CUSTOMERS"
  | "WALK_IN_CUSTOMERS";

export type SuperAdminAccountUpdateRequest = {
  email?: string;
  fullName?: string;
  phone?: string;
  address?: string;
  position?: string;
  role?: "ROLE_ADMIN" | "ROLE_MANAGER" | "ROLE_EMPLOYEE";
};

export type SuperAdminCustomerUpdateRequest = {
  name?: string;
  phone?: string;
  email?: string;
  identityNumber?: string;
};

export const superAdminApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSuperAdminAccounts: builder.query<SuperAdminAccount[], SuperAdminAccountListType>({
      query: (type) => ({ url: "/super-admin/accounts", method: "GET", params: { type } }),
      transformResponse: (response: ApiResponse<SuperAdminAccount[]>) => response?.result ?? [],
      providesTags: ["SuperAdminAccounts"],
    }),
    getSuperAdminAccountDetails: builder.query<SuperAdminAccount, string>({
      query: (accountId) => ({ url: `/super-admin/accounts/${encodeURIComponent(accountId)}`, method: "GET" }),
      transformResponse: (response: ApiResponse<SuperAdminAccount>) => response.result,
      providesTags: (_result, _error, accountId) => [{ type: "SuperAdminAccounts", id: accountId }],
    }),
    getSuperAdminCustomerDetails: builder.query<SuperAdminAccount, string>({
      query: (customerId) => ({ url: `/super-admin/accounts/customers/${encodeURIComponent(customerId)}`, method: "GET" }),
      transformResponse: (response: ApiResponse<SuperAdminAccount>) => response.result,
      providesTags: (_result, _error, customerId) => [{ type: "SuperAdminAccounts", id: customerId }],
    }),
    updateSuperAdminAccount: builder.mutation<
      SuperAdminAccount,
      { accountId: string; request: SuperAdminAccountUpdateRequest }
    >({
      query: ({ accountId, request }) => ({
        url: `/super-admin/accounts/${encodeURIComponent(accountId)}`,
        method: "PUT",
        data: request,
      }),
      transformResponse: (response: ApiResponse<SuperAdminAccount>) => response.result,
      invalidatesTags: ["SuperAdminAccounts"],
    }),
    updateSuperAdminCustomer: builder.mutation<
      SuperAdminAccount,
      { customerId: string; request: SuperAdminCustomerUpdateRequest }
    >({
      query: ({ customerId, request }) => ({
        url: `/super-admin/accounts/customers/${encodeURIComponent(customerId)}`,
        method: "PUT",
        data: request,
      }),
      transformResponse: (response: ApiResponse<SuperAdminAccount>) => response.result,
      invalidatesTags: ["SuperAdminAccounts"],
    }),
    requestSuperAdminPasswordReset: builder.mutation<void, string>({
      query: (accountId) => ({
        url: `/super-admin/accounts/${encodeURIComponent(accountId)}/password-reset`,
        method: "POST",
      }),
      transformResponse: (response: ApiResponse<void>) => response?.result,
    }),
    getSuperAdminRoles: builder.query<SuperAdminRole[], void>({
      query: () => ({ url: "/role_permissions/roles", method: "GET" }),
      transformResponse: (response: ApiResponse<SuperAdminRole[]>) => response?.result ?? [],
      providesTags: ["SuperAdminRole"],
    }),
    createSuperAdminRole: builder.mutation<SuperAdminRole, CreateSuperAdminRoleRequest>({
      query: (data) => ({ url: "/role_permissions/roles", method: "POST", data }),
      transformResponse: (response: ApiResponse<SuperAdminRole>) => response.result,
      invalidatesTags: ["SuperAdminRole"],
    }),
    getSuperAdminPermissionCatalog: builder.query<SuperAdminPermissionCatalogItem[], void>({
      query: () => ({ url: "/role_permissions/permissions", method: "GET" }),
      transformResponse: (response: ApiResponse<SuperAdminPermissionCatalogGroup[]>) =>
        (response?.result ?? []).flatMap((group) =>
          group.permissions.map((permission) => ({
            ...permission,
            category: group.category,
          })),
        ),
      providesTags: ["SuperAdminPermissionCatalog"],
    }),
    createSuperAdminPermission: builder.mutation<
      SuperAdminPermissionCatalogItem,
      CreateSuperAdminPermissionRequest
    >({
      query: (data) => ({ url: "/role_permissions/permissions", method: "POST", data }),
      transformResponse: (response: ApiResponse<SuperAdminPermissionCatalogItem>) => response.result,
      invalidatesTags: ["SuperAdminPermissionCatalog", "SuperAdminRole"],
    }),
    importSuperAdminPermissionCatalog: builder.mutation<
      SuperAdminPermissionCatalogItem[],
      SuperAdminPermissionCatalogItem[]
    >({
      query: (permissions) => ({
        url: "/role_permissions/permissions/import",
        method: "POST",
        data: { permissions },
      }),
      transformResponse: (response: ApiResponse<SuperAdminPermissionCatalogGroup[]>) =>
        (response?.result ?? []).flatMap((group) =>
          group.permissions.map((permission) => ({
            ...permission,
            category: group.category,
          })),
        ),
      invalidatesTags: ["SuperAdminPermissionCatalog", "SuperAdminRole"],
    }),
    getSuperAdminRolePermissions: builder.query<SuperAdminRolePermissionOverview[], void>({
      query: () => ({ url: "/role_permissions/roles/permissions", method: "GET" }),
      transformResponse: (response: ApiResponse<SuperAdminRolePermissionOverview[]>) => response?.result ?? [],
      providesTags: ["SuperAdminRole"],
    }),
    importSuperAdminRolePermissions: builder.mutation<
      SuperAdminRolePermissionOverview[],
      SuperAdminRolePermissionGroup[]
    >({
      query: (rolePermissions) => ({
        url: "/role_permissions/roles/permissions/import",
        method: "POST",
        data: { rolePermissions },
      }),
      transformResponse: (response: ApiResponse<SuperAdminRolePermissionOverview[]>) => response.result,
      invalidatesTags: ["SuperAdminRole"],
    }),
    addSuperAdminPermissionToRole: builder.mutation<void, { roleCode: string; permissionCode: string }>({
      query: ({ roleCode, permissionCode }) => ({
        url: `/role_permissions/roles/${encodeURIComponent(roleCode)}/permissions/${encodeURIComponent(permissionCode)}`,
        method: "POST",
      }),
      invalidatesTags: ["SuperAdminRole"],
    }),
    removeSuperAdminPermissionFromRole: builder.mutation<void, { roleCode: string; permissionCode: string }>({
      query: ({ roleCode, permissionCode }) => ({
        url: `/role_permissions/roles/${encodeURIComponent(roleCode)}/permissions/${encodeURIComponent(permissionCode)}`,
        method: "DELETE",
      }),
      invalidatesTags: ["SuperAdminRole"],
    }),
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
  useGetSuperAdminAccountsQuery,
  useLazyGetSuperAdminAccountDetailsQuery,
  useLazyGetSuperAdminCustomerDetailsQuery,
  useUpdateSuperAdminAccountMutation,
  useUpdateSuperAdminCustomerMutation,
  useRequestSuperAdminPasswordResetMutation,
  useGetSuperAdminRolesQuery,
  useCreateSuperAdminRoleMutation,
  useGetSuperAdminPermissionCatalogQuery,
  useCreateSuperAdminPermissionMutation,
  useImportSuperAdminPermissionCatalogMutation,
  useGetSuperAdminRolePermissionsQuery,
  useImportSuperAdminRolePermissionsMutation,
  useAddSuperAdminPermissionToRoleMutation,
  useRemoveSuperAdminPermissionFromRoleMutation,
  useGetSuperAdminBranchesQuery,
  useGetSuperAdminBranchesByProvinceQuery,
  useGetSuperAdminProvincesQuery,
  useCreateSuperAdminProvinceMutation,
  useUpdateSuperAdminProvinceBackgroundMutation,
  useCreateSuperAdminBranchMutation,
  useGetSuperAdminBranchDetailsQuery,
  useLazyGetSuperAdminBranchDetailsQuery,
  useSaveSuperAdminBranchRoomPoliciesMutation,
} = superAdminApi;
