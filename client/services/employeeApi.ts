import { baseApi } from "./baseApi";

export interface EmployeeResponse {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  cccd: string;
  address: string;
  position: string;
  avatarUrl: string;
  dateOfBirth?: string;
  hotelId?: number;
  hotelName?: string;
  roles?: string[];
}

export interface EmployeeRegisterRequest {
  fullName: string;
  email: string;
  phone: string;
  cccd: string;
  address: string;
  position: string;
  hotelId?: number;
  password?: string;
}

export const employeeApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getEmployeesByHotel: builder.query<EmployeeResponse[], number | string>({
      query: (hotelId) => ({
        url: `/employee/hotel/${hotelId}`,
        method: "GET",
      }),
      transformResponse: (response: any) => {
        return (response?.result !== undefined ? response.result : response) || [];
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Staff" as const, id })),
              { type: "Staff", id: "LIST" },
            ]
          : [{ type: "Staff", id: "LIST" }],
    }),

    getEmployeeById: builder.query<EmployeeResponse, string>({
      query: (id) => ({
        url: `/employee/${id}`,
        method: "GET",
      }),
      transformResponse: (response: any) => {
        return (response?.result !== undefined ? response.result : response) || null;
      },
      providesTags: (result, error, id) => [{ type: "Staff", id }],
    }),

    createStaff: builder.mutation<EmployeeResponse, FormData>({
      query: (formData) => ({
        url: "/employee/create",
        method: "POST",
        data: formData,
        headers: { "Content-Type": "multipart/form-data" },
      }),
      transformResponse: (response: any) => {
        return response?.result !== undefined ? response.result : response;
      },
      invalidatesTags: [{ type: "Staff", id: "LIST" }],
    }),

    updateStaff: builder.mutation<EmployeeResponse, { id: string; formData: FormData }>({
      query: ({ id, formData }) => ({
        url: `/employee/update/${id}`,
        method: "PUT",
        data: formData,
        headers: { "Content-Type": "multipart/form-data" },
      }),
      transformResponse: (response: any) => {
        return response?.result !== undefined ? response.result : response;
      },
      invalidatesTags: (result, error, { id }) => [
        { type: "Staff", id },
        { type: "Staff", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useGetEmployeesByHotelQuery,
  useGetEmployeeByIdQuery,
  useCreateStaffMutation,
  useUpdateStaffMutation,
} = employeeApi;
