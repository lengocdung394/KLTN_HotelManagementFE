import { baseApi } from "./baseApi";

export type CustomerResponse = {
	id: string;
	name: string;
	phone: string;
	email: string;
	identityNumber: string;
	visits: number;
	lastStay: string;
	totalSpend: number;
	tier: "loyal" | "new" | "potential";
	note: string;
};

type ApiCustomer = Record<string, unknown>;

const valueOf = (item: ApiCustomer, keys: string[]) => keys.map((key) => item[key]).find((value) => value !== undefined && value !== null && value !== "");
const numberOf = (value: unknown) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeCustomer = (item: ApiCustomer, index: number): CustomerResponse => {
	const visits = numberOf(valueOf(item, ["visits", "visitCount", "totalVisits", "numberOfBookings", "totalBookings"]));
	const totalSpend = numberOf(valueOf(item, ["totalSpend", "totalSpending", "spending", "totalAmount", "totalSpent"]));
	const loyaltyTier = valueOf(item, ["loyaltyTier"]);
	const loyaltyDescription = loyaltyTier && typeof loyaltyTier === "object" ? String((loyaltyTier as { description?: unknown }).description ?? "") : String(loyaltyTier ?? "");
	const tierValue = String(valueOf(item, ["tier", "customerTier", "level"]) ?? "").toLowerCase();
	const tier = tierValue.includes("bạc") || tierValue.includes("silver") || loyaltyDescription.toLowerCase().includes("bạc") || loyaltyDescription.toLowerCase().includes("silver")
		? "potential"
		: tierValue.includes("vàng") || tierValue.includes("gold") || loyaltyDescription.toLowerCase().includes("vàng") || loyaltyDescription.toLowerCase().includes("gold")
			? "loyal"
			: visits >= 4 ? "loyal" : visits > 0 ? "potential" : "new";
	return {
		id: String(valueOf(item, ["id", "customerId", "customerID", "userId"]) ?? `customer-${index + 1}`),
		name: String(valueOf(item, ["name", "fullName", "customerName"]) ?? "Chưa cập nhật"),
		phone: String(valueOf(item, ["phone", "phoneNumber", "mobile"]) ?? ""),
		email: String(valueOf(item, ["email", "emailAddress"]) ?? ""),
		identityNumber: String(valueOf(item, ["identityNumber", "identityCard", "citizenId", "cccd"]) ?? ""),
		visits,
		lastStay: String(valueOf(item, ["lastStay", "lastBookingDate", "lastCheckOut", "updatedAt"]) ?? "Chưa lưu trú"),
		totalSpend,
		tier,
		note: String(valueOf(item, ["note", "remark", "description"]) ?? "Chưa có ghi chú."),
	};
};

const getResult = (response: unknown): ApiCustomer[] => {
	if (Array.isArray(response)) return response as ApiCustomer[];
	if (response && typeof response === "object" && Array.isArray((response as { result?: unknown }).result)) return (response as { result: ApiCustomer[] }).result;
	return [];
};

export const customerApi = baseApi.injectEndpoints({
	endpoints: (builder) => ({
		getCustomersByHotelId: builder.query<CustomerResponse[], number>({
			query: (hotelId) => ({ url: `/hotels/hotel/${hotelId}`, method: "GET" }),
			transformResponse: (response: unknown) => getResult(response).map(normalizeCustomer),
		}),
	}),
});

export const { useGetCustomersByHotelIdQuery } = customerApi;