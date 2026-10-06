import { io, type Socket } from "socket.io-client";

const SOCKET_URL = "http://localhost:8085";

let socket: Socket | null = null;

export const CUSTOMER_REFRESH_EVENTS = ["customer_created", "customer_booking_updated"] as const;
export const SEASONAL_RATE_UPDATE_EVENT = "seasonal_rate_announcement_update";

export const buildCustomerSocketPayload = (
  hotelId: string | number | null | undefined,
  customer: Record<string, unknown> | null | undefined,
) => ({
  hotelId: hotelId === null || hotelId === undefined || hotelId === "" ? null : Number(hotelId),
  customer: customer ?? null,
  createdAt: new Date().toISOString(),
});

export const buildSeasonalRateSocketPayload = (
  hotelId: string | number | null | undefined,
  rateData: Record<string, unknown> | Record<string, unknown>[] | null | undefined,
) => ({
  hotelId: hotelId === null || hotelId === undefined || hotelId === "" ? null : Number(hotelId),
  event: SEASONAL_RATE_UPDATE_EVENT,
  data: Array.isArray(rateData) ? rateData : rateData ? [rateData] : [],
  createdAt: new Date().toISOString(),
});

type HotelSocketHandlers = {
  onRoomCreated?: (data: unknown) => void;
  onRoomUpdated?: (data: unknown) => void;
  onRoomImportProgress?: (data: unknown) => void;
  onServiceImportProgress?: (data: unknown) => void;
  onRoomMatrixUpdated?: (data: unknown) => void;
  onRoomPolicyUpdated?: (data: unknown) => void;
  onNewBookingNotification?: (data: unknown) => void;
  onCustomerBookingUpdated?: (data: unknown) => void;
  onCustomerCreated?: (data: unknown) => void;
  onSeasonalRateAnnouncement?: (data: unknown) => void;
  onSeasonalRateAnnouncementUpdate?: (data: unknown) => void;
  onPromotionUpdate?: (data: unknown) => void;
  onPromotionCreate?: (data: unknown) => void;
  onLateCheckOutCalendar?: (data: unknown) => void;
};

let hotelSocketHandlers: HotelSocketHandlers = {};
const pendingCustomerEvents: Array<{ event: "customer_created"; payload: Record<string, unknown> }> = [];

const flushPendingCustomerEvents = () => {
  if (!socket || !socket.connected) return;

  while (pendingCustomerEvents.length > 0) {
    const queuedEvent = pendingCustomerEvents.shift();
    if (!queuedEvent) continue;
    socket.emit(queuedEvent.event, queuedEvent.payload);
    console.log("📦 [Socket] flushed queued customer event:", queuedEvent.event, queuedEvent.payload);
  }
};

const decodeJwtPayload = (token: string) => {
  try {
    const base64Payload = token.split(".")[1];
    if (!base64Payload) return null;

    const normalized = base64Payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const binary = atob(padded);
    return JSON.parse(
      Uint8Array.from(binary, (char) => char.charCodeAt(0)).reduce((acc, value) => acc + String.fromCharCode(value), "")
    );
  } catch {
    return null;
  }
};

const getCurrentUserId = () => {
  const directUserId = localStorage.getItem("userId") ?? localStorage.getItem("id");
  if (directUserId) return directUserId;

  const token = localStorage.getItem("accessToken");
  if (!token) return "";

  const payload = decodeJwtPayload(token);
  return (
    payload?.userId ??
    payload?.sub ??
    payload?.id ??
    payload?.employeeId ??
    payload?.employeeID ??
    payload?.accountId ??
    payload?.staffId ??
    payload?.staffID ??
    ""
  );
};

const getCurrentHotelId = () => {
  const directHotelId = localStorage.getItem("hotelId");
  if (directHotelId) return directHotelId;

  const token = localStorage.getItem("accessToken");
  if (!token) return "";

  const payload = decodeJwtPayload(token);
  return payload?.hotelId ?? payload?.hotel_id ?? payload?.hotelID ?? "";
};

export const bindHotelSocketEvents = ({
  onRoomCreated,
  onRoomUpdated,
  onRoomImportProgress,
  onServiceImportProgress,
  onRoomMatrixUpdated,
  onRoomPolicyUpdated,
  onNewBookingNotification,
  onCustomerBookingUpdated,
  onCustomerCreated,
  onSeasonalRateAnnouncement,
  onSeasonalRateAnnouncementUpdate,
  onPromotionUpdate,
  onPromotionCreate,
  onLateCheckOutCalendar,
}: HotelSocketHandlers = {}) => {
  hotelSocketHandlers = {
    ...hotelSocketHandlers,
    ...(onRoomCreated ? { onRoomCreated } : {}),
    ...(onRoomUpdated ? { onRoomUpdated } : {}),
    ...(onRoomImportProgress ? { onRoomImportProgress } : {}),
    ...(onServiceImportProgress ? { onServiceImportProgress } : {}),
    ...(onRoomMatrixUpdated ? { onRoomMatrixUpdated } : {}),
    ...(onRoomPolicyUpdated ? { onRoomPolicyUpdated } : {}),
    ...(onNewBookingNotification ? { onNewBookingNotification } : {}),
    ...(onCustomerBookingUpdated ? { onCustomerBookingUpdated } : {}),
    ...(onCustomerCreated ? { onCustomerCreated } : {}),
    ...(onSeasonalRateAnnouncement ? { onSeasonalRateAnnouncement } : {}),
    ...(onSeasonalRateAnnouncementUpdate ? { onSeasonalRateAnnouncementUpdate } : {}),
    ...(onPromotionUpdate ? { onPromotionUpdate } : {}),
    ...(onPromotionCreate ? { onPromotionCreate } : {}),
    ...(onLateCheckOutCalendar ? { onLateCheckOutCalendar } : {}),
  };

  if (!socket) return;

  socket.off("room_create");
  socket.off("room_update");
  socket.off("room_import_progress");
  socket.off("service_import_progress");
  socket.off("room_matrix_updated");
  socket.off("room_policy_updated");
  socket.off("new_booking_notification");
  socket.off("customer_booking_updated");
  socket.off("customer_created");
  socket.off("seasonal_rate_announcement");
  socket.off(SEASONAL_RATE_UPDATE_EVENT);
  socket.off("update_promotion_notification");
  socket.off("new_promotion_notification");
  socket.off("late_check_out_calendar");

  if (hotelSocketHandlers.onRoomCreated) {
    socket.on("room_create", hotelSocketHandlers.onRoomCreated);
  }

  if (hotelSocketHandlers.onRoomUpdated) {
    socket.on("room_update", hotelSocketHandlers.onRoomUpdated);
  }

  if (hotelSocketHandlers.onRoomImportProgress) {
    socket.on("room_import_progress", hotelSocketHandlers.onRoomImportProgress);
  }

  if (hotelSocketHandlers.onServiceImportProgress) {
    socket.on("service_import_progress", hotelSocketHandlers.onServiceImportProgress);
  }

  if (hotelSocketHandlers.onRoomMatrixUpdated) {
    socket.on("room_matrix_updated", hotelSocketHandlers.onRoomMatrixUpdated);
  }

  if (hotelSocketHandlers.onRoomPolicyUpdated) {
    socket.on("room_policy_updated", hotelSocketHandlers.onRoomPolicyUpdated);
  }

  if (hotelSocketHandlers.onNewBookingNotification) {
    socket.on("new_booking_notification", hotelSocketHandlers.onNewBookingNotification);
  }

  if (hotelSocketHandlers.onCustomerBookingUpdated) {
    socket.on("customer_booking_updated", hotelSocketHandlers.onCustomerBookingUpdated);
  }

  if (hotelSocketHandlers.onCustomerCreated) {
    socket.on("customer_created", hotelSocketHandlers.onCustomerCreated);
  }

  if (hotelSocketHandlers.onSeasonalRateAnnouncement) {
    socket.on("seasonal_rate_announcement", hotelSocketHandlers.onSeasonalRateAnnouncement);
  }

  if (hotelSocketHandlers.onSeasonalRateAnnouncementUpdate) {
    socket.on(SEASONAL_RATE_UPDATE_EVENT, hotelSocketHandlers.onSeasonalRateAnnouncementUpdate);
  }

  if (hotelSocketHandlers.onPromotionUpdate) {
    socket.on("update_promotion_notification", hotelSocketHandlers.onPromotionUpdate);
  }

  if (hotelSocketHandlers.onPromotionCreate) {
    socket.on("new_promotion_notification", hotelSocketHandlers.onPromotionCreate);
  }

  if (hotelSocketHandlers.onLateCheckOutCalendar) {
    socket.on("late_check_out_calendar", hotelSocketHandlers.onLateCheckOutCalendar);
  }
};

const attachHotelSocketHandlers = () => {
  bindHotelSocketEvents(hotelSocketHandlers);
};

export const initSocket = (token: string | null) => {
  if (!token) return null;

  if (socket && socket.connected) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
  }

  socket = io(SOCKET_URL, {
    transports: ["websocket"],
    query: { token },
    reconnection: true,
    reconnectionAttempts: 5,
  });

  socket.on("connect", () => {
    console.log("✅ [Socket] connected:", socket?.id);

    const userId = getCurrentUserId();
    const hotelId = getCurrentHotelId();

    if (userId) {
      socket?.emit("join_user_room", String(userId));
      console.log("📩 [Socket] join_user_room emitted:", userId);
    }

    if (hotelId) {
      socket?.emit("join_hotel_room", String(hotelId));
      console.log("🏢 [Socket] join_hotel_room emitted:", hotelId);
    }

    flushPendingCustomerEvents();
  });

  socket.on("room_matrix_updated", (data) => {
    console.log("📅 [Socket] room_matrix_updated:", data);
  });

  socket.on("room_policy_updated", (data) => {
    console.log("💰 [Socket] room_policy_updated:", data);
  });

  socket.on("new_booking_notification", (data) => {
    console.log("🔔 [Socket] new_booking_notification:", data);
  });

  socket.on("customer_booking_updated", (data) => {
    console.log("👤 [Socket] customer_booking_updated:", data);
  });

  socket.on("customer_created", (data) => {
    console.log("👤 [Socket] customer_created:", data);
    const payload = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    const roomName = payload.hotelId != null ? `hotel_${payload.hotelId}` : "global";
    console.log("👤 [Socket] customer_created matched room:", roomName);
  });

  socket.on("seasonal_rate_announcement", (data) => {
    console.log("📢 [Socket] seasonal_rate_announcement:", data);
  });

  socket.on(SEASONAL_RATE_UPDATE_EVENT, (data) => {
    console.log("📢 [Socket] seasonal_rate_announcement_update:", data);
  });

  socket.on("late_check_out_calendar", (data) => {
    console.log("📅 [Socket] late_check_out_calendar:", data);
  });

  attachHotelSocketHandlers();

  socket.on("connect_error", (error) => {
    console.error("❌ [Socket] connect error:", error.message);
  });

  socket.on("disconnect", (reason) => {
    console.log("🔴 [Socket] disconnected:", reason);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const emitCustomerCreated = (
  hotelId: string | number | null | undefined,
  customer: Record<string, unknown> | null | undefined,
) => {
  const payload = buildCustomerSocketPayload(hotelId, customer);

  if (!socket) {
    pendingCustomerEvents.push({ event: "customer_created", payload });
    console.log("👤 [Socket] queued customer_created until socket connects:", payload);
    return;
  }

  if (!socket.connected) {
    pendingCustomerEvents.push({ event: "customer_created", payload });
    console.log("👤 [Socket] queued customer_created while offline:", payload);
    return;
  }

  socket.emit("customer_created", payload);
  console.log("👤 [Socket] customer_created emitted:", payload);
};

export const joinUserRoom = (userId: string | number | null) => {
  if (!socket || !userId) return;

  socket.emit("join_user_room", String(userId));
  console.log("👤 [Socket] join_user_room manual:", userId);
};

export const joinHotelRoom = (hotelId: string | number | null) => {
  if (!socket || !hotelId) return;

  socket.emit("join_hotel_room", String(hotelId));
  console.log("🏢 [Socket] join_hotel_room manual:", hotelId);
};
