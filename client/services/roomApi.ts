import { baseApi } from "./baseApi";

interface ApiResponse<T> {
  code: number;
  message: string;
  result: T;
}

export type RoomResponse = {
  id?: string;
  roomId?: string;
  roomNumber?: string | number;
  roomCode?: string;
  roomType?: string;
  roomName?: string;
  roomStatus?: string;
  area?: number | string | null;
  beds?: Array<{
    bedTypeId?: number;
    bedTypeName?: string;
    quantity?: number;
    [key: string]: unknown;
  }>;
  basePrice?: number;
  price?: number;
  totalPrice?: number;
  standardCapacity?: number;
  maxAdults?: number;
  maxChildren?: number;
  maxInfants?: number;
  maxExtraGuests?: number;
  extraAdultFee?: number;
  extraChildFee?: number;
  floorId?: string | number;
  buildingId?: string | number;
  [key: string]: unknown;
};
export type RoomCreateRequest = {
  roomNumber: string;
  floorId: string;
  roomStatus: string;
  roomType: string;
  defaultImageIndex: number;
  amenityIds: number[];
  beds: Array<{ bedTypeId: number; quantity: number }>;
};
export type RoomUpdateRequest = RoomCreateRequest & {
  keptImageUrls: string[];
};
export type RoomTypeDetailResponse = {
  [key: string]: unknown;
};
export type BedTypeResponse = {
  id?: number;
  name?: string;
  bedTypeName?: string;
  description?: string;
  capacity?: number;
  isExtraBed?: boolean;
  [key: string]: unknown;
};
export type BedTypeRequest = {
  name: string;
  description: string;
  capacity: number;
  isExtraBed: boolean;
};
export type RoomDailyPricesResponse = Record<string, Record<string, number>>;

export type RoomSeasonalRate = {
  id?: string | number;
  name?: string;
  rateName?: string;
  startDate?: string;
  endDate?: string;
  roomType?: string | string[] | null;
  roomTypes?: string[] | string | null;
  roomTypeAdjustments?: Record<string, number>;
  percentValue?: number;
  price?: number;
  value?: number;
  modifierType?: string;
  fixedPrices?: Record<string, number>;
  colorTheme?: "amber" | "emerald" | "purple" | "rose" | "blue" | string;
  [key: string]: unknown;
};

export type RoomSeasonalRatePageResponse = {
  content: RoomSeasonalRate[];
  page?: {
    size?: number;
    number?: number;
    totalElements?: number;
    totalPages?: number;
  };
};

export type CreateRoomSeasonalRateRequest = {
  id?: number | string;
  roomType: string;
  rateName: string;
  startDate: string;
  endDate: string;
  price: number;
};

const valueOf = (source: Record<string, unknown>, keys: string[]) =>
  keys
    .map((key) => source[key])
    .find((value) => value !== undefined && value !== null && value !== "");

const parseNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeRoomTypeValues = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === "string") {
    if (value.trim() === "") return [];
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

export const extractRoomSeasonalRatePage = (response: unknown): RoomSeasonalRatePageResponse => {
  if (Array.isArray(response)) {
    return { content: response as RoomSeasonalRate[] };
  }

  if (!response || typeof response !== "object") {
    return { content: [] };
  }

  const responseObj = response as Record<string, unknown>;
  const result = responseObj.result;

  const contentSources = [
    Array.isArray(result) ? result : undefined,
    result && typeof result === "object" ? (result as Record<string, unknown>).content : undefined,
    result && typeof result === "object" ? (result as Record<string, unknown>).items : undefined,
    result && typeof result === "object" ? (result as Record<string, unknown>).data : undefined,
    result && typeof result === "object" ? (result as Record<string, unknown>).records : undefined,
    responseObj.content,
    responseObj.items,
    responseObj.data,
    responseObj.records,
  ];

  const contentArray = contentSources.find(Array.isArray) as RoomSeasonalRate[] | undefined;

  const pageObject =
    (result && typeof result === "object" && (result as Record<string, unknown>).page && typeof (result as Record<string, unknown>).page === "object"
      ? ((result as Record<string, unknown>).page as Record<string, unknown>)
      : responseObj.page && typeof responseObj.page === "object"
        ? (responseObj.page as Record<string, unknown>)
        : undefined);

  const size = Number(pageObject?.size ?? pageObject?.pageSize ?? responseObj.size ?? 10);
  const number = Number(pageObject?.number ?? pageObject?.pageNumber ?? responseObj.number ?? 0);
  const totalElements = Number(pageObject?.totalElements ?? pageObject?.total ?? responseObj.totalElements ?? responseObj.total ?? 0);
  const totalPages = Number(
    pageObject?.totalPages ??
      pageObject?.totalPage ??
      responseObj.totalPages ??
      (size > 0 && totalElements > 0 ? Math.ceil(totalElements / size) : 1)
  );

  return {
    content: Array.isArray(contentArray) ? contentArray : [],
    page: pageObject
      ? {
          size: Number.isFinite(size) ? size : 10,
          number: Number.isFinite(number) ? number : 0,
          totalElements: Number.isFinite(totalElements) ? totalElements : 0,
          totalPages: Number.isFinite(totalPages) ? totalPages : 1,
        }
      : undefined,
  };
};

export const roomApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createRoom: builder.mutation<RoomResponse, { roomInfo: RoomCreateRequest; imageFiles: File[] }>({
      query: ({ roomInfo, imageFiles }) => {
        const formData = new FormData();
        formData.append("roomInfo", new Blob([JSON.stringify(roomInfo)], { type: "application/json" }));
        imageFiles.forEach((file) => formData.append("avatarUrl", file));
        return { url: "/room/create", method: "POST", data: formData };
      },
      transformResponse: (response: ApiResponse<RoomResponse>) => response?.result ?? {},
      invalidatesTags: ["Room", "Booking"],
    }),
    updateRoom: builder.mutation<RoomResponse, { roomId: string; room: RoomUpdateRequest; images: File[] }>({
      query: ({ roomId, room, images }) => {
        const formData = new FormData();
        formData.append("room", new Blob([JSON.stringify(room)], { type: "application/json" }));
        images.forEach((file) => formData.append("images", file));
        return { url: `/room/updateRoomById/${encodeURIComponent(roomId)}`, method: "PUT", data: formData };
      },
      transformResponse: (response: ApiResponse<RoomResponse>) => response?.result ?? {},
      invalidatesTags: ["Room", "Booking"],
    }),
    // Trả về mảng string[] từ Backend
    getRoomTypes: builder.query<string[], void>({
      query: () => ({
        url: "/rooms/enums/types", // Đúng chính xác đường dẫn Swagger đang chạy
        method: "GET",
      }),
      transformResponse: (response: ApiResponse<string[]>) => response?.result ?? [],
    }),

    getAllBedTypes: builder.query<BedTypeResponse[], void>({
      query: () => ({
        url: "/bedTypes/getAll",
        method: "GET",
      }),
      transformResponse: (response: ApiResponse<BedTypeResponse[]>) => response?.result ?? [],
      providesTags: ["BedType"],
    }),

    createBedType: builder.mutation<BedTypeResponse, BedTypeRequest>({
      query: (data) => ({ url: "/bedTypes/createBedType", method: "POST", data }),
      transformResponse: (response: ApiResponse<BedTypeResponse>) => response?.result,
      invalidatesTags: ["BedType"],
    }),

    updateBedType: builder.mutation<BedTypeResponse, { id: number; bedType: BedTypeRequest }>({
      query: ({ id, bedType }) => ({ url: `/bedTypes/updateBedType/${id}`, method: "PUT", data: bedType }),
      transformResponse: (response: ApiResponse<BedTypeResponse>) => response?.result,
      invalidatesTags: ["BedType"],
    }),

    importBedTypes: builder.mutation<BedTypeResponse[], BedTypeRequest[]>({
      query: (data) => ({ url: "/bedTypes/importExcel", method: "POST", data }),
      transformResponse: (response: ApiResponse<BedTypeResponse[]>) => response?.result ?? [],
      invalidatesTags: ["BedType"],
    }),

    getRoomStatuses: builder.query<string[], void>({
      query: () => ({
        url: "/rooms/enums/statuses", // Đúng chính xác đường dẫn Swagger đang chạy
        method: "GET",
      }),
      transformResponse: (response: ApiResponse<string[]>) => response?.result ?? [],
    }),

    getRoomsByFloorId: builder.query<RoomResponse[], number>({
      query: (floorId) => ({
        url: "/room/getRoomsByFloorId",
        method: "GET",
        params: { floorId },
      }),
      transformResponse: (response: ApiResponse<RoomResponse[]>) => response?.result ?? [],
      providesTags: ["Room"],
    }),

    getRoomsByCurrentHotel: builder.query<RoomResponse[], void>({
      query: () => ({
        url: "/room/hotel",
        method: "GET",
      }),
      transformResponse: (response: ApiResponse<RoomResponse[]>) => response?.result ?? [],
      providesTags: ["Room"],
    }),

    getBranchRoomDailyPrices: builder.query<RoomDailyPricesResponse, { hotelId: number; startDate: string; endDate: string }>({
      query: ({ hotelId, startDate, endDate }) => ({
        url: "/management-rooms/branch-prices",
        method: "GET",
        params: { hotelId, startDate, endDate },
      }),
      providesTags: ["Room"],
    }),

    getRoomTypeDetail: builder.query<RoomTypeDetailResponse, { hotelId: number; roomType: string }>({
      query: ({ hotelId, roomType }) => ({
        url: `/hotels/${hotelId}/room-types/${encodeURIComponent(roomType)}/detail`,
        method: "GET",
      }),
    }),

    getRoomSeasonalRates: builder.query<RoomSeasonalRatePageResponse, { roomType?: string; date?: string; page?: number; size?: number; sort?: string } | void>(
      {
        query: (params) => ({
          url: "/room_seasonal_rates/hotel/by-date",
          method: "GET",
          params: {
            page: 0,
            size: 10,
            sort: "startDate,asc",
            ...params,
          },
        }),
        transformResponse: (response: unknown) => {
          const pageData = extractRoomSeasonalRatePage(response);

          return {
            content: pageData.content.map((item) => {
              const rawId = valueOf(item as Record<string, unknown>, ["id", "roomSeasonalRateId", "seasonalRateId"]);
              const normalizedId = rawId == null ? String(Date.now() + Math.random()) : String(rawId);

              return {
                ...item,
                id: normalizedId,
                name: String(valueOf(item as Record<string, unknown>, ["rateName", "name", "title", "ruleName", "seasonName"]) ?? "Sự kiện giá"),
                startDate: String(valueOf(item as Record<string, unknown>, ["startDate", "start_date", "fromDate", "validFrom"]) ?? ""),
                endDate: String(valueOf(item as Record<string, unknown>, ["endDate", "end_date", "toDate", "validTo"]) ?? ""),
                roomType: valueOf(item as Record<string, unknown>, ["roomType", "room_type", "type"]) ?? valueOf(item as Record<string, unknown>, ["roomTypes", "room_types"]),
                roomTypes: normalizeRoomTypeValues(
                  valueOf(item as Record<string, unknown>, ["roomTypes", "room_types", "appliedRoomTypes"]) ??
                    valueOf(item as Record<string, unknown>, ["roomType", "room_type", "type"])
                ),
                percentValue: parseNumber(
                  valueOf(item as Record<string, unknown>, ["percentValue", "percent_value", "value", "adjustmentPercent", "ratePercent", "modifierPercent", "discountPercent"]) ?? 0
                ),
                colorTheme: (valueOf(item as Record<string, unknown>, ["colorTheme", "color_theme"]) as string | undefined) ?? "emerald",
              } as RoomSeasonalRate;
            }),
            page: pageData.page,
          };
        },
      },
    ),

    getRoomSeasonalRatesByMonth: builder.query<RoomSeasonalRatePageResponse, { hotelId: number; month: number; year: number }>(
      {
        query: ({ hotelId, month, year }) => ({
          url: `/room_seasonal_rates/hotel/${hotelId}/monthly`,
          method: "GET",
          params: {
            month,
            year,
          },
        }),
        transformResponse: (response: unknown) => {
          const pageData = extractRoomSeasonalRatePage(response);

          return {
            content: pageData.content.map((item) => {
              const rawId = valueOf(item as Record<string, unknown>, ["id", "roomSeasonalRateId", "seasonalRateId"]);
              const normalizedId = rawId == null ? String(Date.now() + Math.random()) : String(rawId);

              return {
                ...item,
                id: normalizedId,
                name: String(valueOf(item as Record<string, unknown>, ["rateName", "name", "title", "ruleName", "seasonName"]) ?? "Sự kiện giá"),
                startDate: String(valueOf(item as Record<string, unknown>, ["startDate", "start_date", "fromDate", "validFrom"]) ?? ""),
                endDate: String(valueOf(item as Record<string, unknown>, ["endDate", "end_date", "toDate", "validTo"]) ?? ""),
                roomType: valueOf(item as Record<string, unknown>, ["roomType", "room_type", "type"]) ?? valueOf(item as Record<string, unknown>, ["roomTypes", "room_types"]),
                roomTypes: normalizeRoomTypeValues(
                  valueOf(item as Record<string, unknown>, ["roomTypes", "room_types", "appliedRoomTypes"]) ??
                    valueOf(item as Record<string, unknown>, ["roomType", "room_type", "type"])
                ),
                percentValue: parseNumber(
                  valueOf(item as Record<string, unknown>, ["percentValue", "percent_value", "value", "adjustmentPercent", "ratePercent", "modifierPercent", "discountPercent"]) ?? 0
                ),
                colorTheme: (valueOf(item as Record<string, unknown>, ["colorTheme", "color_theme"]) as string | undefined) ?? "emerald",
              } as RoomSeasonalRate;
            }),
            page: pageData.page,
          };
        },
      },
    ),

    createRoomSeasonalRate: builder.mutation<RoomSeasonalRate[] | unknown, CreateRoomSeasonalRateRequest[]>({
      query: (payload) => ({
        url: "/room_seasonal_rates/createSeasonalRate",
        method: "POST",
        data: payload,
      }),
      invalidatesTags: ["Room"],
    }),

    updateRoomSeasonalRate: builder.mutation<RoomSeasonalRate[] | unknown, CreateRoomSeasonalRateRequest[]>({
      query: (payload) => ({
        url: "/room_seasonal_rates/updateSeasonalRate",
        method: "POST",
        data: payload,
      }),
      invalidatesTags: ["Room"],
    }),
  }),
});

export const { useCreateRoomMutation, useUpdateRoomMutation, useCreateRoomSeasonalRateMutation, useUpdateRoomSeasonalRateMutation, useGetRoomTypesQuery, useGetAllBedTypesQuery, useCreateBedTypeMutation, useUpdateBedTypeMutation, useImportBedTypesMutation, useGetRoomStatusesQuery, useGetRoomsByFloorIdQuery, useGetRoomsByCurrentHotelQuery, useGetBranchRoomDailyPricesQuery, useGetRoomTypeDetailQuery, useGetRoomSeasonalRatesQuery, useGetRoomSeasonalRatesByMonthQuery } = roomApi;