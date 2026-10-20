import { baseApi } from "./baseApi";

type ApiResponse<T> = {
  code: number;
  message?: string;
  result: T;
};

export type EmployeeRecord = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  cccd: string;
  address: string;
  position: string;
  avatarUrl: string | null;
  hotelId: number;
  hotelName: string;
  roles: string[];
  roleCodes?: string[];
};

type EmployeeCreateResult = Pick<
  EmployeeRecord,
  "id" | "email" | "fullName" | "phone" | "cccd" | "address" | "position" | "roles"
> & { hotelName: string };

export type UpdateMyProfileRequest = {
  currentPassword: string;
  email: string;
  fullName: string;
  phone: string;
  cccd: string;
  address: string;
  position: string;
  newPassword?: string;
  confirmPassword?: string;
};

export type CreateEmployeeRequest = {
  email: string;
  phone: string;
  fullName: string;
  address: string;
  cccd: string;
  position: string;
  hotelId: number;
  avatarUrl: string;
};

export type UpdateEmployeeRequest = Pick<
  EmployeeRecord,
  "email" | "phone" | "fullName" | "address" | "cccd" | "position"
> & {
  password?: string;
};

export const employeeApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getEmployeesByHotel: builder.query<EmployeeRecord[], number>({
      query: (hotelId) => ({ url: `/employee/hotel/${hotelId}`, method: "GET" }),
      transformResponse: (response: ApiResponse<EmployeeRecord[]>) => response.result,
      providesTags: ["Staff"],
    }),
    createEmployee: builder.mutation<EmployeeCreateResult, CreateEmployeeRequest>({
      query: (staffInfo) => {
        const data = new FormData();
        data.append("staffInfo", new Blob([JSON.stringify(staffInfo)], { type: "application/json" }));
        return { url: "/employee/create", method: "POST", data };
      },
      transformResponse: (response: ApiResponse<EmployeeCreateResult>) => response.result,
      invalidatesTags: ["Staff"],
    }),
    updateEmployee: builder.mutation<EmployeeRecord, { id: string; staffInfo: UpdateEmployeeRequest }>({
      query: ({ id, staffInfo }) => {
        const data = new FormData();
        data.append("staffInfo", new Blob([JSON.stringify(staffInfo)], { type: "application/json" }));
        return { url: `/employee/update/${encodeURIComponent(id)}`, method: "PUT", data };
      },
      transformResponse: (response: ApiResponse<EmployeeRecord>) => response.result,
      invalidatesTags: ["Staff"],
    }),
    updateMyProfile: builder.mutation<EmployeeRecord, UpdateMyProfileRequest>({
      query: (data) => ({ url: "/employee/me/profile", method: "PUT", data }),
      transformResponse: (response: ApiResponse<EmployeeRecord>) => response.result,
    }),
  }),
});

export const {
  useGetEmployeesByHotelQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useUpdateMyProfileMutation,
} = employeeApi;
