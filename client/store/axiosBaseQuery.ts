import type { BaseQueryFn } from "@reduxjs/toolkit/query";
import type { AxiosRequestConfig, AxiosError } from "axios";
import axiosClient from "./axiosClient";

interface AxiosBaseQueryArgs {
  url: string;
  method: AxiosRequestConfig["method"];
  data?: any;
  params?: any;
}

export const axiosBaseQuery =
  (): BaseQueryFn<AxiosBaseQueryArgs, unknown, unknown> =>
  async ({ url, method, data, params }) => {
    try {
      const result = await axiosClient({ url, method, data, params });
      return { data: result.data };
    } catch (axiosError) {
      const err = axiosError as AxiosError;
      return {
        error: {
          status: err.response?.status,
          data: err.response?.data ?? err.message,
        },
      };
    }
  };