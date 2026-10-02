import { baseApi } from "./baseApi";

export interface PaymentTransactionResponse {
  id?: string;
  orderId?: string;
  amount?: number;
  paymentType?: string;
  cashFlowType?: string;
  note?: string;
  createdAt?: string;
}

export interface OrderResponse {
  id: string;
  bookingId?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  issueDate?: string;
  closeDate?: string;
  orderStatus: "OPEN" | "CLOSED" | "CANCELLED";
  roomTotalAmount?: number;
  serviceTotalAmount?: number;
  discountRoomAmount?: number;
  discountServiceAmount?: number;
  discountAmountTotal?: number;
  totalAmount: number;
  paidAmount?: number;
  remainingAmount?: number;
  paymentTransactions?: PaymentTransactionResponse[];
}

export interface PaymentCreateRequest {
  orderId: string;
  amount: number;
  paymentType: "CASH" | "BANK_TRANSFER" | "PAYOS";
  cashFlowType?: "RECEIPT" | "PAYMENT";
  note?: string;
}

interface ApiResponse<T> {
  code: number;
  message: string;
  result: T;
}

export const orderApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getOrders: build.query<OrderResponse[], { status?: "OPEN" | "CLOSED" | "CANCELLED" } | void>({
      query: (params) => ({
        url: "/orders",
        method: "GET",
        params: params?.status ? { status: params.status } : {},
      }),
      transformResponse: (response: ApiResponse<OrderResponse[]>) => response?.result ?? [],
      providesTags: ["Booking"],
    }),

    getOrderById: build.query<OrderResponse, string>({
      query: (id) => ({
        url: `/orders/${id}`,
        method: "GET",
      }),
      transformResponse: (response: ApiResponse<OrderResponse>) => response?.result,
      providesTags: ["Booking"],
    }),

    getOrderByBookingId: build.query<OrderResponse, string>({
      query: (bookingId) => ({
        url: `/orders/booking/${bookingId}`,
        method: "GET",
      }),
      transformResponse: (response: ApiResponse<OrderResponse>) => response?.result,
      providesTags: ["Booking"],
    }),

    processPayment: build.mutation<PaymentTransactionResponse, PaymentCreateRequest>({
      query: (body) => ({
        url: "/orders/payments",
        method: "POST",
        data: body,
      }),
      invalidatesTags: ["Booking"],
    }),

    closeOrder: build.mutation<OrderResponse, string>({
      query: (id) => ({
        url: `/orders/${id}/close`,
        method: "PATCH",
      }),
      invalidatesTags: ["Booking"],
    }),
  }),
});

export const {
  useGetOrdersQuery,
  useGetOrderByIdQuery,
  useGetOrderByBookingIdQuery,
  useProcessPaymentMutation,
  useCloseOrderMutation,
} = orderApi;
