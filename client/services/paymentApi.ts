import { baseApi } from "./baseApi";

export type PaymentResponse = {
  error?: number;
  message?: string;
  checkoutUrl: string;
  expiredAt?: number | null;
};

export type CashPaymentRequest = {
  orderId: string;
  amountPaid: number;
  note?: string;
};

export type PaymentTransactionResponse = {
  transactionId?: string;
  status?: string;
  message?: string;
  [key: string]: unknown;
};

export type PaymentStatusResponse = {
  isPaid: boolean;
  status: string;
  paymentStatus?: string;
  gatewayStatus?: string;
  bookingStatus?: string;
  paidAmount?: number;
  remainingAmount?: number;
  message?: string;
};

export const paymentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPaymentStatus: builder.query<PaymentStatusResponse, string>({
      query: (orderId) => ({
        url: `/payment/check-order-status/${encodeURIComponent(orderId)}`,
        method: "GET",
      }),
      transformResponse: (response: PaymentStatusResponse | { result?: PaymentStatusResponse }) =>
        "result" in response && response.result ? response.result : response as PaymentStatusResponse,
    }),
    createPaymentQr: builder.mutation<PaymentResponse, { orderId: string }>({
      query: (request) => ({
        url: "/payment/create-qr",
        method: "POST",
        data: request,
      }),
      transformResponse: (response: PaymentResponse | { result?: PaymentResponse }) =>
        "result" in response && response.result ? response.result : response as PaymentResponse,
    }),
    payWithCash: builder.mutation<PaymentTransactionResponse, CashPaymentRequest>({
      query: (request) => ({
        url: "/payment/cash",
        method: "POST",
        data: request,
      }),
      transformResponse: (response: PaymentTransactionResponse | { result?: PaymentTransactionResponse }) =>
        "result" in response && response.result ? response.result : response as PaymentTransactionResponse,
    }),
  }),
});

export const { useCreatePaymentQrMutation, useGetPaymentStatusQuery, usePayWithCashMutation } = paymentApi;
