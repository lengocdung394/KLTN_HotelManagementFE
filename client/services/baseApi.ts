import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "../store/axiosBaseQuery";

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: axiosBaseQuery(),
  keepUnusedDataFor: 300,
  refetchOnMountOrArgChange: false,
  tagTypes: ["User", "Room", "Booking", "Staff", "Customer"],
  endpoints: () => ({}),
});