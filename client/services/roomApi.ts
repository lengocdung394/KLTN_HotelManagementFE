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
  floorId?: number;
  buildingId?: number;
  [key: string]: unknown;
};
export type RoomTypeDetailResponse = {
  [key: string]: unknown;
};
export type BedTypeResponse = {
  id?: string;
  name?: string;
  [key: string]: unknown;
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

const extractRoomSeasonalRatePage = (response: unknown): RoomSeasonalRatePageResponse => {
  if (Array.isArray(response)) {
    return { content: response as RoomSeasonalRate[] };
  }

  if (!response || typeof response !== "object") {
    return { content: [] };
  }

  const result = (response as { result?: unknown }).result;
  if (result && typeof result === "object") {
    const page = result as { content?: unknown; items?: unknown; data?: unknown; records?: unknown; page?: unknown };
    const contentArray = [page.content, page.items, page.data, page.records].find(Array.isArray);
    const innerPage = page.page && typeof page.page === "object" ? (page.page as Record<string, unknown>) : undefined;

    const pageRecord = page as Record<string, unknown>;

    return {
      content: Array.isArray(contentArray) ? (contentArray as RoomSeasonalRate[]) : [],
      page: innerPage
        ? {
            size: Number(innerPage["size"] ?? pageRecord["size"] ?? 10),
            number: Number(innerPage["number"] ?? pageRecord["number"] ?? 0),
            totalElements: Number(innerPage["totalElements"] ?? pageRecord["totalElements"] ?? 0),
            totalPages: Number(innerPage["totalPages"] ?? pageRecord["totalPages"] ?? 1),
          }
        : undefined,
    };
  }

  const page = response as { content?: unknown; items?: unknown; data?: unknown; records?: unknown; page?: unknown };
  const contentArray = [page.content, page.items, page.data, page.records].find(Array.isArray);
  const responsePage = page.page && typeof page.page === "object" ? (page.page as Record<string, unknown>) : undefined;
  const pageRecord = page as Record<string, unknown>;

  return {
    content: Array.isArray(contentArray) ? (contentArray as RoomSeasonalRate[]) : [],
    page: responsePage
      ? {
          size: Number(responsePage["size"] ?? pageRecord["size"] ?? 10),
          number: Number(responsePage["number"] ?? pageRecord["number"] ?? 0),
          totalElements: Number(responsePage["totalElements"] ?? pageRecord["totalElements"] ?? 0),
          totalPages: Number(responsePage["totalPages"] ?? pageRecord["totalPages"] ?? 1),
        }
      : undefined,
  };
};

export const roomApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createRoom: builder.mutation<RoomResponse, { roomInfo: { floorId: number; roomStatus: string; roomType: string; basePrice: number; standardCapacity: number; maxExtraGuests: number; extraAdultFee: number; extraChildFee: number; defaultImageIndex: number; amenityIds: number[] }; imageFiles: File[] }>({
      query: ({ roomInfo, imageFiles }) => {
        const formData = new FormData();
        formData.append("roomInfo", new Blob([JSON.stringify(roomInfo)], { type: "application/json" }));
        imageFiles.forEach((file) => formData.append("avatarUrl", file));
        return { url: "/rooms/create", method: "POST", data: formData };
      },
      transformResponse: (response: ApiResponse<RoomResponse>) => response?.result ?? {},
      invalidatesTags: ["Room"],
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
        url: `/hotels/${hotelId}/room-types/${roomType}/detail`,
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

    createRoomSeasonalRate: builder.mutation<RoomSeasonalRate[] | unknown, CreateRoomSeasonalRateRequest[]>({
      query: (payload) => ({
        url: "/room_seasonal_rates/createSeasonalRate",
        method: "POST",
        data: payload,
      }),
    }),
  }),
});

export const { useCreateRoomMutation, useCreateRoomSeasonalRateMutation, useGetRoomTypesQuery, useGetAllBedTypesQuery, useGetRoomStatusesQuery, useGetRoomsByFloorIdQuery, useGetRoomsByCurrentHotelQuery, useGetBranchRoomDailyPricesQuery, useGetRoomTypeDetailQuery, useGetRoomSeasonalRatesQuery } = roomApi;