import { useEffect, useState } from "react";
import { Bell, CheckCheck, LoaderCircle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { baseApi } from "../services/baseApi";
import {
  useGetNotificationsQuery,
  useGetNotificationSummaryQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from "../services/notificationApi";
import { bindHotelSocketEvents, joinHotelRoom } from "../lib/socket";
import {
  formatEntityUpdateNotification,
  formatRoomUpdateNotification,
} from "../lib/roomUpdateNotification";

const formatOccurredAt = (value: string) =>
  new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });

export default function NotificationBell() {
  const dispatch = useAppDispatch();
  const hotelId = useAppSelector((state) => state.auth.hotelId);
  const [isOpen, setIsOpen] = useState(false);
  const {
    data: pageResponse,
    isLoading,
    isError: isNotificationsError,
    refetch: refetchNotifications,
  } = useGetNotificationsQuery({ page: 0, size: 8 });
  const {
    data: summaryResponse,
    isError: isSummaryError,
    refetch: refetchSummary,
  } = useGetNotificationSummaryQuery();
  const [markRead, markReadState] = useMarkNotificationReadMutation();
  const [markAllRead, markAllState] = useMarkAllNotificationsReadMutation();
  const notifications = pageResponse?.result.content ?? [];
  const unreadCount = summaryResponse?.result.unreadCount ?? 0;

  useEffect(() => {
    joinHotelRoom(hotelId);
  }, [hotelId]);

  useEffect(
    () => bindHotelSocketEvents({
      onEmployeeChanged: () => {
        dispatch(baseApi.util.invalidateTags(["Staff"]));
      },
      onNotificationCreated: (payload) => {
        if (import.meta.env.DEV) {
          console.info("[NotificationBell] Received notification_created:", payload);
        }
        void refetchNotifications();
        void refetchSummary();
      },
      onNewBookingNotification: () => {
        dispatch(baseApi.util.invalidateTags(["Notification"]));
      },
      onRoomUpdated: (payload) => {
        dispatch(baseApi.util.invalidateTags(["Room", "Notification"]));
        void refetchNotifications();
        void refetchSummary();
        toast({
          title: "Phòng được cập nhật",
          description: formatRoomUpdateNotification(payload),
        });
      },
      onRoomPolicyUpdated: (payload) => {
        dispatch(baseApi.util.invalidateTags(["BranchRoomPolicy", "Notification"]));
        void refetchNotifications();
        void refetchSummary();
        toast({
          title: "Chính sách phòng được cập nhật",
          description: formatEntityUpdateNotification(payload, "Chính sách phòng"),
        });
      },
      onBuildingChanged: (payload) => {
        const event = payload && typeof payload === "object"
          ? payload as Record<string, unknown>
          : {};
        const data = event.data && typeof event.data === "object"
          ? event.data as Record<string, unknown>
          : {};
        const created = String(event.action ?? "").toUpperCase() === "CREATED";
        const description = formatEntityUpdateNotification(
          event,
          `Tòa nhà${data.name ? ` ${String(data.name)}` : ""}`,
        );
        dispatch(baseApi.util.invalidateTags(["Notification"]));
        void refetchNotifications();
        void refetchSummary();
        toast({
          title: created ? "Tòa nhà mới được thêm" : "Tòa nhà được cập nhật",
          description,
        });
      },
      onFloorChanged: (payload) => {
        const event = payload && typeof payload === "object"
          ? payload as Record<string, unknown>
          : {};
        const data = event.data && typeof event.data === "object"
          ? event.data as Record<string, unknown>
          : {};
        const created = String(event.action ?? "").toUpperCase() === "CREATED";
        const description = formatEntityUpdateNotification(
          event,
          `Tầng${data.floorNumber != null ? ` ${String(data.floorNumber)}` : ""}`,
        );
        dispatch(baseApi.util.invalidateTags(["Notification"]));
        void refetchNotifications();
        void refetchSummary();
        toast({
          title: created ? "Tầng mới được thêm" : "Tầng được cập nhật",
          description,
        });
      },
      onServiceChanged: () => {
        dispatch(baseApi.util.invalidateTags(["Notification"]));
      },
    }),
    [dispatch, refetchNotifications, refetchSummary],
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-blue-700"
        aria-label={`Thông báo${unreadCount ? `, ${unreadCount} chưa đọc` : ""}`}
        aria-expanded={isOpen}
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <section className="absolute right-0 top-11 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Thông báo</h2>
              <p className="mt-0.5 text-xs text-slate-500">{unreadCount} thông báo chưa đọc</p>
            </div>
            <button
              type="button"
              disabled={unreadCount === 0 || markAllState.isLoading}
              onClick={() => {
                void markAllRead().unwrap().catch(() => {
                  toast({ variant: "destructive", title: "Không thể cập nhật thông báo", description: "Vui lòng thử lại." });
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {markAllState.isLoading ? <LoaderCircle size={14} className="animate-spin" /> : <CheckCheck size={14} />}
              Đọc tất cả
            </button>
          </header>
          <div className="max-h-[min(28rem,70vh)] overflow-y-auto">
            {isSummaryError || isNotificationsError ? (
              <p role="alert" className="px-4 py-8 text-center text-sm text-rose-600">
                Không thể tải thông báo. Vui lòng thử lại sau.
              </p>
            ) : isLoading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-slate-500">
                <LoaderCircle size={16} className="animate-spin" /> Đang tải thông báo...
              </div>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">Chưa có thông báo nào.</p>
            ) : notifications.map((notification) => (
              <button
                type="button"
                key={notification.id}
                onClick={() => {
                  if (!notification.read) {
                    void markRead(notification.id).unwrap().catch(() => {
                      toast({ variant: "destructive", title: "Không thể cập nhật thông báo", description: "Vui lòng thử lại." });
                    });
                  }
                }}
                className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50 ${
                  notification.read ? "bg-white" : "bg-blue-50/60"
                }`}
                disabled={markReadState.isLoading}
              >
                <span className="flex items-start gap-2.5">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.read ? "bg-transparent" : "bg-blue-600"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-800">{notification.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-600">{notification.description}</span>
                    <span className="mt-1.5 block text-[11px] text-slate-400">{formatOccurredAt(notification.createdAt)}</span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
