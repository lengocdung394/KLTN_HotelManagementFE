import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "../store/axiosBaseQuery";

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["User", "Room", "Booking", "Staff"],
  endpoints: () => ({}),
});