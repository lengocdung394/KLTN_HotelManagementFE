import { baseApi } from "./baseApi";

interface LoginRequest {
  email: string;
  password: string;
}

interface AuthenticationResult {
  id: string;
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

interface ForgotPasswordRequest {
  email: string;
}

interface ResetPasswordRequest {
  email: string;
  otp: string;
  newPassword: string;
  confirmPassword: string;
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
    requestPasswordReset: builder.mutation<void, ForgotPasswordRequest>({
      query: (data) => ({ url: "/auth/forgot-password/request", method: "POST", data }),
      transformResponse: (response: ApiResponse<void>) => response.result,
    }),
    resetPassword: builder.mutation<void, ResetPasswordRequest>({
      query: (data) => ({ url: "/auth/forgot-password/reset", method: "POST", data }),
      transformResponse: (response: ApiResponse<void>) => response.result,
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useRequestPasswordResetMutation,
  useResetPasswordMutation,
} = authApi;