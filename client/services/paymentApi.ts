import { baseApi } from "./baseApi";

export type PaymentResponse = {
  error?: number;
  message?: string;
  checkoutUrl: string;
};

export const paymentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createPaymentQr: builder.mutation<PaymentResponse, { orderId: number }>({
      query: (request) => ({
        url: "/payment/create-qr",
        method: "POST",
        data: request,
      }),
      transformResponse: (response: PaymentResponse | { result?: PaymentResponse }) =>
        "result" in response && response.result ? response.result : response as PaymentResponse,
    }),
  }),
});

export const { useCreatePaymentQrMutation } = paymentApi;
