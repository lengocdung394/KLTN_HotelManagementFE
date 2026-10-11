import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "../store/axiosBaseQuery";

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: axiosBaseQuery(),
  keepUnusedDataFor: 300,
  refetchOnMountOrArgChange: false,
  tagTypes: ["User", "Room", "Booking", "Staff", "Customer", "BranchRoomPolicy", "Promotion", "Service", "Amenity", "BedType", "Building", "Floor", "SuperAdminBranch", "SuperAdminProvince", "SuperAdminRole", "SuperAdminPermissionCatalog", "SuperAdminAccounts"],
  endpoints: () => ({}),
});