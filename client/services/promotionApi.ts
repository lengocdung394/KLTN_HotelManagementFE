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
  hotelId?: number;
  hotelName?: string;
};

export type CustomerPromotion = Promotion & {
  customerId?: number;
  claimedAt?: string;
  used?: boolean;
};

type PromotionApiResponse = Record<string, unknown>;

const valueOf = (item: PromotionApiResponse, keys: string[]) => keys.map((key) => item[key]).find((value) => value !== undefined && value !== null && value !== "");

const parseNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizePromotion = (item: PromotionApiResponse): Promotion => ({
  id: String(valueOf(item, ["id", "promotionId", "promotionID"]) ?? ""),
  name: String(valueOf(item, ["name", "promotionName", "title"]) ?? "Khuyến mãi"),
  code: String(valueOf(item, ["code", "promotionCode", "voucherCode"]) ?? ""),
  description: String(valueOf(item, ["description", "detail", "content"]) ?? ""),
  value: parseNumber(valueOf(item, ["value", "discountValue", "discount", "percent"])),
  valueType: String(valueOf(item, ["valueType", "discountType", "type"]) ?? "PERCENTAGE"),
  startDate: String(valueOf(item, ["startDate", "fromDate", "validFrom", "startAt"]) ?? ""),
  endDate: String(valueOf(item, ["endDate", "toDate", "validTo", "endAt"]) ?? ""),
  active: Boolean(valueOf(item, ["active", "isActive", "available"]) ?? true),
  hotelId: valueOf(item, ["hotelId", "hotelID"]) == null ? undefined : parseNumber(valueOf(item, ["hotelId", "hotelID"])),
  hotelName: valueOf(item, ["hotelName"]) == null ? undefined : String(valueOf(item, ["hotelName"])),
});

const normalizeCustomerPromotion = (item: PromotionApiResponse): CustomerPromotion => ({
  ...normalizePromotion(item),
  customerId: valueOf(item, ["customerId", "customerID"]) == null ? undefined : parseNumber(valueOf(item, ["customerId", "customerID"])),
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
      transformResponse: (response: ApiResponse<unknown>) => extractList(response).map(normalizePromotion).filter((promotion) => promotion.id && promotion.code),
    }),
    getCustomerPromotions: builder.query<CustomerPromotion[], number>({
      query: (customerId) => ({ url: `/customer-promotions/customer/${customerId}`, method: "GET" }),
      transformResponse: (response: ApiResponse<unknown>) => extractList(response).map(normalizeCustomerPromotion).filter((promotion) => promotion.id && promotion.code),
    }),
  }),
});

export const { useGetPromotionsQuery, useGetCustomerPromotionsQuery } = promotionApi;
