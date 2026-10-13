import { baseApi } from "./baseApi";

export type NotificationType =
  | "BOOKING_CREATED"
  | "BOOKING_CANCELLED"
  | "BOOKING_REFUND_REQUESTED"
  | "BOOKING_REFUND_COMPLETED"
  | "ROOM_CREATED"
  | "ROOM_UPDATED"
  | "BUILDING_CREATED"
  | "BUILDING_UPDATED"
  | "FLOOR_CREATED"
  | "FLOOR_UPDATED"
  | "ROOM_POLICY_CREATED"
  | "ROOM_POLICY_UPDATED"
  | "EMPLOYEE_CREATED"
  | "EMPLOYEE_UPDATED"
  | "PROMOTION_CREATED"
  | "PROMOTION_UPDATED"
  | "SERVICE_CREATED"
  | "SERVICE_UPDATED"
  | "SERVICE_IMPORT_COMPLETED"
  | "SERVICE_IMPORT_FAILED"
  | "SYSTEM";

export type NotificationRecord = {
  id: number;
  hotelId: number | null;
  type: NotificationType;
  title: string;
  description: string;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
  read: boolean;
};

export type NotificationPage = {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  content: NotificationRecord[];
};

export type NotificationSummary = {
  totalCount: number;
  unreadCount: number;
  totalByType: Record<string, number>;
  unreadByType: Record<string, number>;
  branches: { hotelId: number; totalCount: number; unreadCount: number }[];
};

type ApiResponse<T> = {
  code: number;
  message: string;
  result: T;
};

export type NotificationListQuery = {
  hotelId?: number;
  type?: NotificationType;
  unreadOnly?: boolean;
  page?: number;
  size?: number;
};

export const notificationApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getNotifications: builder.query<ApiResponse<NotificationPage>, NotificationListQuery>({
      query: (params) => ({
        url: "/notifications",
        method: "GET",
        params,
      }),
      providesTags: ["Notification"],
    }),
    getNotificationSummary: builder.query<ApiResponse<NotificationSummary>, { hotelId?: number } | void>({
      query: (params) => ({
        url: "/notifications/summary",
        method: "GET",
        params: params ?? {},
      }),
      providesTags: ["Notification"],
    }),
    markNotificationRead: builder.mutation<ApiResponse<NotificationRecord>, number>({
      query: (id) => ({
        url: `/notifications/${id}/read`,
        method: "PATCH",
      }),
      invalidatesTags: ["Notification"],
    }),
    markAllNotificationsRead: builder.mutation<ApiResponse<number>, { hotelId?: number } | void>({
      query: (params) => ({
        url: "/notifications/read-all",
        method: "PATCH",
        params: params ?? {},
      }),
      invalidatesTags: ["Notification"],
    }),
  }),
});

export const {
  useGetNotificationsQuery,
  useGetNotificationSummaryQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} = notificationApi;
