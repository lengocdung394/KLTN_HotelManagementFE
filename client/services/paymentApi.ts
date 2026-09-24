import { baseApi } from "./baseApi";

export type PaymentResponse = {
  error?: number;
  message?: string;
  checkoutUrl: string;
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

export const paymentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
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

export const { useCreatePaymentQrMutation, usePayWithCashMutation } = paymentApi;
