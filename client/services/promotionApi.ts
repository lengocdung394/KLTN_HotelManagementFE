import { baseApi } from "./baseApi";

interface ApiResponse<T> {
  code?: number;
  message?: string;
  result: T;
}

export type Promotion = {
  id: string;
  name: string;
  code: string;
  description: string;
  value: number;
  valueType: string;
  startDate: string;
  endDate: string;
  active: boolean;
  status?: string;
  type?: string;
  maxDiscountAmount?: number;
  minBookingValue?: number;
  minRoomValue?: number;
  minServiceValue?: number;
  usageLimit?: number;
  isExclusive?: boolean;
  imageUrl?: string;
  minimumOrderAmount?: number;
  hotelId?: number;
  hotelName?: string;
};

export type CustomerPromotion = Promotion & {
  customerId?: string;
  customerPromotionId?: string;
  claimedAt?: string;
  used?: boolean;
};

export type PromotionScope = "ROOM" | "SERVICE" | "TOTAL";
export type PromotionDiscountType = "PERCENTAGE" | "FIXED_AMOUNT";
export type PromotionStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "EXPIRED";

export type CreatePromotionRequest = {
  name: string;
  description?: string;
  type: PromotionScope;
  discountType: PromotionDiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  minBookingValue?: number;
  minRoomValue?: number;
  minServiceValue?: number;
  startDate: string;
  endDate: string;
  usageLimit?: number;
  status: PromotionStatus;
  isExclusive: boolean;
};

type PromotionApiResponse = Record<string, unknown>;

const valueOf = (item: PromotionApiResponse, keys: string[]) => keys.map((key) => item[key]).find((value) => value !== undefined && value !== null && value !== "");

const parseNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const minimumFromDescription = (description: unknown) => {
  const text = String(description ?? "").toLowerCase().replace(/\s/g, "");
  const millionMatch = text.match(/từ([\d.,]+)triệu/);
  if (millionMatch) return parseNumber(millionMatch[1].replace(",", ".")) * 1_000_000;
  const amountMatch = text.match(/từ([\d.,]+)(?:đ|vnđ|vnd)/);
  return amountMatch ? parseNumber(amountMatch[1].replace(/\./g, "").replace(",", ".")) : undefined;
};

const normalizePromotion = (item: PromotionApiResponse): Promotion => {
  const nestedPromotion = item.promotion ?? item.promotionInfo ?? item.promotionDetail ?? item.promotionResponse;
  const source = nestedPromotion && typeof nestedPromotion === "object"
    ? nestedPromotion as PromotionApiResponse
    : item;
  const getValue = (keys: string[]) => valueOf(source, keys) ?? (source === item ? undefined : valueOf(item, keys));
  const description = getValue(["description", "detail", "content"]);
  const status = String(getValue(["status"]) ?? "").toUpperCase();
  const activeValue = getValue(["active", "isActive", "available"]);
  const minimumValue = getValue(["minimumOrderAmount", "minOrderAmount", "minimumTotal", "minTotal", "minimumAmount", "minAmount", "minimumBookingAmount", "minBookingValue"]);
  const exclusiveValue = getValue(["isExclusive", "exclusive"]);
  const isExclusive = typeof exclusiveValue === "boolean"
    ? exclusiveValue
    : ["TRUE", "1", "YES"].includes(String(exclusiveValue ?? "").toUpperCase());

  return {
    id: String(getValue(["id", "promotionId", "promotionID"]) ?? ""),
    name: String(getValue(["name", "promotionName", "title"]) ?? "Khuyến mãi"),
    code: String(getValue(["code", "promotionCode", "voucherCode"]) ?? ""),
    description: String(description ?? ""),
    value: parseNumber(getValue(["value", "discountValue", "discount", "percent"])),
    valueType: String(getValue(["promotionDiscountType", "discountType", "valueType"]) ?? "PERCENTAGE").toUpperCase(),
    type: String(getValue(["type", "scope", "promotionScope"]) ?? "TOTAL"),
    startDate: String(getValue(["startDate", "fromDate", "validFrom", "startAt"]) ?? ""),
    endDate: String(getValue(["endDate", "toDate", "validTo", "endAt"]) ?? ""),
    active: typeof activeValue === "boolean"
      ? activeValue
      : typeof activeValue === "string"
        ? ["TRUE", "1", "ACTIVE"].includes(activeValue.toUpperCase())
        : status === "ACTIVE",
    status: status || undefined,
    maxDiscountAmount: getValue(["maxDiscountAmount"]) == null ? undefined : parseNumber(getValue(["maxDiscountAmount"])),
    minBookingValue: getValue(["minBookingValue"]) == null ? undefined : parseNumber(getValue(["minBookingValue"])),
    minRoomValue: getValue(["minRoomValue"]) == null ? undefined : parseNumber(getValue(["minRoomValue"])),
    minServiceValue: getValue(["minServiceValue"]) == null ? undefined : parseNumber(getValue(["minServiceValue"])),
    usageLimit: getValue(["usageLimit"]) == null ? undefined : parseNumber(getValue(["usageLimit"])),
    isExclusive,
    imageUrl: getValue(["imageUrl", "imageURL"]) == null ? undefined : String(getValue(["imageUrl", "imageURL"])),
    minimumOrderAmount: minimumValue == null ? minimumFromDescription(description) : parseNumber(minimumValue),
    hotelId: getValue(["hotelId", "hotelID"]) == null ? undefined : parseNumber(getValue(["hotelId", "hotelID"])),
    hotelName: getValue(["hotelName"]) == null ? undefined : String(getValue(["hotelName"])),
  };
};

const normalizeCustomerPromotion = (item: PromotionApiResponse): CustomerPromotion => ({
  ...normalizePromotion(item),
  customerId: valueOf(item, ["customerId", "customerID"]) == null ? undefined : String(valueOf(item, ["customerId", "customerID"])),
  customerPromotionId: valueOf(item, ["customerPromotionId", "customerPromotionID", "customerPromotionCodeId"]) == null ? undefined : String(valueOf(item, ["customerPromotionId", "customerPromotionID", "customerPromotionCodeId"])),
  claimedAt: valueOf(item, ["claimedAt", "savedAt", "createdAt"]) == null ? undefined : String(valueOf(item, ["claimedAt", "savedAt", "createdAt"])),
  used: valueOf(item, ["used", "isUsed"]) == null ? undefined : Boolean(valueOf(item, ["used", "isUsed"])),
});

const extractList = (response: unknown): PromotionApiResponse[] => {
  if (Array.isArray(response)) return response as PromotionApiResponse[];
  if (!response || typeof response !== "object") return [];
  const result = (response as { result?: unknown }).result;
  if (Array.isArray(result)) return result as PromotionApiResponse[];
  if (!result || typeof result !== "object") return [];
  const page = result as { content?: unknown; items?: unknown; data?: unknown; records?: unknown };
  const values = [page.content, page.items, page.data, page.records].find(Array.isArray);
  return (values ?? []) as PromotionApiResponse[];
};

export const promotionApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPromotions: builder.query<Promotion[], { hotelId?: number; activeOnly?: boolean; status?: string; page?: number; size?: number } | void>({
      query: (params) => ({
        url: "/promotions",
        method: "GET",
        params: params && params.activeOnly ? { ...params, status: "ACTIVE", page: 0, size: 100 } : params ?? undefined,
      }),
      transformResponse: (response: ApiResponse<unknown>) => extractList(response).map(normalizePromotion).filter((promotion) => promotion.id),
      providesTags: ["Promotion"],
    }),
    createPromotion: builder.mutation<Promotion, { promotionInfo: CreatePromotionRequest; image?: File }>({
      query: ({ promotionInfo, image }) => {
        const formData = new FormData();
        formData.append("promotionInfo", new Blob([JSON.stringify(promotionInfo)], { type: "application/json" }));
        if (image) formData.append("image", image);
        return {
          url: "/promotions",
          method: "POST",
          data: formData,
        };
      },
      transformResponse: (response: ApiResponse<PromotionApiResponse>) => normalizePromotion(response?.result ?? {}),
      invalidatesTags: ["Promotion"],
    }),
    getCustomerPromotions: builder.query<CustomerPromotion[], string>({
      query: (customerId) => ({ url: `/customer-promotions/customer/${customerId}`, method: "GET" }),
      transformResponse: (response: ApiResponse<unknown>) => extractList(response).map(normalizeCustomerPromotion).filter((promotion) => promotion.id && promotion.code),
    }),
  }),
});

export const { useGetPromotionsQuery, useCreatePromotionMutation, useGetCustomerPromotionsQuery } = promotionApi;
