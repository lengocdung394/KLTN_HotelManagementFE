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

export type WalkInCustomerRequest = {
	fullName: string;
	phone: string;
	cccd: string;
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

const normalizeCustomer = (item: ApiCustomer): CustomerResponse => {
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
		id: String(valueOf(item, ["id", "customerId", "customerID", "idCustomer"]) ?? ""),
		name: String(valueOf(item, ["name", "fullName", "customerName"]) ?? "Chưa cập nhật"),
		phone: String(valueOf(item, ["phone", "phoneNumber", "customerPhone", "mobile", "mobileNumber"]) ?? ""),
		email: String(valueOf(item, ["email", "emailAddress"]) ?? ""),
		identityNumber: String(valueOf(item, ["identityNumber", "identityCard", "identityCardNumber", "citizenId", "citizenNumber", "cccd"]) ?? ""),
		visits,
		lastStay: String(valueOf(item, ["lastStay", "lastBookingDate", "lastCheckOut", "updatedAt"]) ?? "Chưa lưu trú"),
		totalSpend,
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