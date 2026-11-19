import { baseApi } from "./baseApi";

export type CustomerLoyaltyTier = "bronze" | "silver" | "gold" | "platinum";

export type CustomerResponse = {
	id: string;
	name: string;
	phone: string;
	email: string;
	identityNumber: string;
	alreadyExists: boolean;
	registered: boolean;
	visits: number;
	cancelledBookings: number;
	latestBookingAt: string | null;
	lastStay: string;
	totalSpend: number;
	totalRoomAmount: number;
	tier: CustomerLoyaltyTier;
	note: string;
};

export type WalkInCustomerRequest = {
	fullName: string;
	phone: string;
	cccd: string;
	email?: string;
};

export type CustomerUpdateRequest = {
	name: string;
	phone: string;
	email: string;
	identityNumber: string;
	note: string;
};

type ApiCustomer = Record<string, unknown>;

const valueOf = (item: ApiCustomer, keys: string[]) => keys.map((key) => item[key]).find((value) => value !== undefined && value !== null && value !== "");
const numberOf = (value: unknown) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
};

const loyaltyTierFromValue = (value: unknown): CustomerLoyaltyTier | undefined => {
	const values = value && typeof value === "object"
		? ["name", "code", "tier", "description"].map((key) => (value as ApiCustomer)[key])
		: [value];
	for (const candidate of values) {
		const normalized = String(candidate ?? "").toLowerCase();
		if (normalized.includes("platinum") || normalized.includes("bạch kim")) return "platinum";
		if (normalized.includes("gold") || normalized.includes("vàng")) return "gold";
		if (normalized.includes("silver") || normalized.includes("bạc")) return "silver";
		if (normalized.includes("bronze") || normalized.includes("đồng")) return "bronze";
	}
	return undefined;
};

const loyaltyTierFromSpend = (totalSpend: number): CustomerLoyaltyTier => {
	if (totalSpend >= 40_000_000) return "platinum";
	if (totalSpend >= 15_000_000) return "gold";
	if (totalSpend >= 5_000_000) return "silver";
	return "bronze";
};

export const normalizeCustomer = (item: ApiCustomer): CustomerResponse => {
	const visits = numberOf(valueOf(item, ["visits", "visitCount", "totalVisits", "numberOfBookings", "totalBookings"]));
	const totalSpend = numberOf(valueOf(item, ["totalSpend", "totalSpending", "spending", "totalAmount", "totalSpent"]));
	const tier = loyaltyTierFromValue(valueOf(item, ["loyaltyTier", "tier", "customerTier", "level"]))
		?? loyaltyTierFromSpend(totalSpend);
	return {
		id: String(valueOf(item, ["id", "customerId", "customerID", "idCustomer"]) ?? ""),
		name: String(valueOf(item, ["name", "fullName", "customerName"]) ?? "Chưa cập nhật"),
		phone: String(valueOf(item, ["phone", "phoneNumber", "customerPhone", "mobile", "mobileNumber"]) ?? ""),
		email: String(valueOf(item, ["email", "emailAddress"]) ?? ""),
		identityNumber: String(valueOf(item, ["identityNumber", "identityCard", "identityCardNumber", "citizenId", "citizenNumber", "cccd"]) ?? ""),
		alreadyExists: valueOf(item, ["alreadyExists"]) === true,
		registered: valueOf(item, ["registered", "isRegistered"]) === true,
		visits,
		cancelledBookings: numberOf(valueOf(item, ["cancelledBookings", "cancelledBookingCount"])),
		latestBookingAt: valueOf(item, ["latestBookingAt", "lastBookingAt"]) == null
			? null
			: String(valueOf(item, ["latestBookingAt", "lastBookingAt"])),
		lastStay: String(valueOf(item, ["lastStay", "lastBookingDate", "lastCheckOut", "updatedAt"]) ?? "Chưa lưu trú"),
		totalSpend,
		totalRoomAmount: numberOf(valueOf(item, ["totalRoomAmount", "roomTotalAmount"])),
		tier,
		note: String(valueOf(item, ["note", "remark", "description"]) ?? "Chưa có ghi chú."),
	};
};

const getResult = (response: unknown): ApiCustomer[] => {
	if (Array.isArray(response)) return response as ApiCustomer[];
	if (!response || typeof response !== "object") return [];
	const value = response as Record<string, unknown>;
	for (const key of ["result", "data", "content", "items", "records", "customers", "customerList"]) {
		if (Array.isArray(value[key])) return value[key] as ApiCustomer[];
	}
	for (const key of ["result", "data"]) {
		if (value[key] && typeof value[key] === "object") {
			const nestedResult = getResult(value[key]);
			if (nestedResult.length > 0) return nestedResult;
		}
	}
	return [];
};

export const customerApi = baseApi.injectEndpoints({
	endpoints: (builder) => ({
		getCustomersByHotelId: builder.query<CustomerResponse[], number>({
			query: (hotelId) => ({ url: `/hotels/hotel/${hotelId}`, method: "GET" }),
			transformResponse: (response: unknown) => getResult(response).map(normalizeCustomer),
			providesTags: ["Customer"],
		}),
		getCustomerById: builder.query<CustomerResponse, string>({
			query: (id) => {
				console.log("[customerApi] request customer id:", id);
				return { url: `/customer/findByIdCustomer/${encodeURIComponent(id)}`, method: "GET" };
			},
			transformResponse: (response: unknown) => {
				console.log("[customerApi] customer response:", response);
				const value = response && typeof response === "object" && "result" in response ? (response as { result?: unknown }).result : response;
				const customer = (value ?? {}) as ApiCustomer;
				return normalizeCustomer({
					...customer,
					name: customer.name,
					phone: customer.phone,
					identityNumber: customer.cccd,
				});
			},
			providesTags: ["Customer"],
		}),
		createWalkInCustomer: builder.mutation<CustomerResponse, WalkInCustomerRequest>({
			query: (request) => ({ url: "/customer/walk-in", method: "POST", data: request }),
			transformResponse: (response: unknown) => {
				const value = response && typeof response === "object" && "result" in response ? (response as { result?: unknown }).result : response;
				return normalizeCustomer((value ?? {}) as ApiCustomer);
			},
			invalidatesTags: ["Customer"],
		}),
		updateCustomer: builder.mutation<CustomerResponse, { id: string; request: CustomerUpdateRequest }>({
			query: ({ id, request }) => ({ url: `/customer/${encodeURIComponent(id)}`, method: "PUT", data: request }),
			transformResponse: (response: unknown) => {
				const value = response && typeof response === "object" && "result" in response ? (response as { result?: unknown }).result : response;
				return normalizeCustomer((value ?? {}) as ApiCustomer);
			},
			invalidatesTags: ["Customer"],
		}),
	}),
});

export const { useGetCustomersByHotelIdQuery, useLazyGetCustomersByHotelIdQuery, useGetCustomerByIdQuery, useLazyGetCustomerByIdQuery, useCreateWalkInCustomerMutation, useUpdateCustomerMutation } = customerApi;