import { baseApi } from "./baseApi";

interface LoginRequest {
  email: string;
  password: string;
}

interface AuthenticationResult {
  token: string;
  email: string;
  fullName: string;
  position: string;
}

interface ApiResponse<T> {
  code: number;
  message: string;
  result: T;
}
interface RegisterRequest {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<AuthenticationResult, LoginRequest>({
      query: (body) => ({ url: "/auth/login", method: "POST", data: body }),
      // unwrap "result" ra khỏi lớp bọc ApiResponse
      transformResponse: (response: ApiResponse<AuthenticationResult>) =>
        response.result,
    }),
    register: builder.mutation<void, RegisterRequest>({
      query: (body) => ({ url: "/auth/register", method: "POST", data: body }),
    }),
  }),
});

export const { useLoginMutation, useRegisterMutation } = authApi;