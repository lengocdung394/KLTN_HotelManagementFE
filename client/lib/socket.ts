import { io, type Socket } from "socket.io-client";
import { store } from "../store";
import { baseApi } from "../services/baseApi";

const SOCKET_URL = "http://localhost:8085";

let socket: Socket | null = null;
let requestedHotelRoomId: string | null = null;

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
  onBuildingChanged?: (data: unknown) => void;
  onFloorChanged?: (data: unknown) => void;
  onNewBookingNotification?: (data: unknown) => void;
  onBookingStateUpdated?: (data: unknown) => void;
  onNotificationCreated?: (data: unknown) => void;
  onServiceChanged?: (data: unknown) => void;
  onEmployeeChanged?: (data: unknown) => void;
  onCustomerBookingUpdated?: (data: unknown) => void;
  onCustomerCreated?: (data: unknown) => void;
  onSeasonalRateAnnouncement?: (data: unknown) => void;
  onSeasonalRateAnnouncementUpdate?: (data: unknown) => void;
  onPromotionUpdate?: (data: unknown) => void;
  onPromotionCreate?: (data: unknown) => void;
  onLateCheckOutCalendar?: (data: unknown) => void;
};

type SuperAdminSocketHandlers = {
  onCustomerCreated?: (data: unknown) => void;
  onAccountCreated?: (data: unknown) => void;
  onBranchCreated?: (data: unknown) => void;
  onRoomPolicyUpdated?: (data: unknown) => void;
  onBuildingChanged?: (data: unknown) => void;
  onFloorChanged?: (data: unknown) => void;
  onRoomCreated?: (data: unknown) => void;
  onRoomUpdated?: (data: unknown) => void;
  onRoomImportProgress?: (data: unknown) => void;
  onNewBookingNotification?: (data: unknown) => void;
  onNotificationCreated?: (data: unknown) => void;
  onEmployeeChanged?: (data: unknown) => void;
  onServiceImportProgress?: (data: unknown) => void;
  onServiceChanged?: (data: unknown) => void;
  onPromotionUpdate?: (data: unknown) => void;
  onPromotionCreate?: (data: unknown) => void;
};

type HandlerMap = {
  [K in keyof HotelSocketHandlers]: Set<NonNullable<HotelSocketHandlers[K]>>;
};

const hotelSubscribers: HandlerMap = {
  onRoomCreated: new Set(),
  onRoomUpdated: new Set(),
  onRoomImportProgress: new Set(),
  onServiceImportProgress: new Set(),
  onRoomMatrixUpdated: new Set(),
  onRoomPolicyUpdated: new Set(),
  onBuildingChanged: new Set(),
  onFloorChanged: new Set(),
  onNewBookingNotification: new Set(),
  onBookingStateUpdated: new Set(),
  onNotificationCreated: new Set(),
  onServiceChanged: new Set(),
  onEmployeeChanged: new Set(),
  onCustomerBookingUpdated: new Set(),
  onCustomerCreated: new Set(),
  onSeasonalRateAnnouncement: new Set(),
  onSeasonalRateAnnouncementUpdate: new Set(),
  onPromotionUpdate: new Set(),
  onPromotionCreate: new Set(),
  onLateCheckOutCalendar: new Set(),
};

const dispatchToSubscribers = (key: keyof HandlerMap, data: unknown) => {
  hotelSubscribers[key].forEach((handler) => {
    try {
      (handler as (d: unknown) => void)(data);
    } catch (err) {
      console.error(`Error in hotel socket subscriber for ${key}:`, err);
    }
  });
};

let superAdminSocketHandlers: SuperAdminSocketHandlers = {};
let superAdminRoomRequested = false;
const roomPolicyUpdatedSubscribers = new Set<(data: unknown) => void>();
const dispatchRoomPolicyUpdated = (data: unknown) => {
  roomPolicyUpdatedSubscribers.forEach((handler) => handler(data));
};
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

const hasJwtRole = (token: string, role: string) => {
  const payload = decodeJwtPayload(token);
  return Array.isArray(payload?.roles) && payload.roles.includes(role);
};

const requestSuperAdminRoomJoin = () => {
  socket?.emit("join_super_admin_accounts_room", "", (result: unknown) => {
    const response = result && typeof result === "object" ? result as Record<string, unknown> : {};
    if (response.joined === true) {
      console.log("🛡️ [Socket] joined super_admin_accounts room");
    } else if (result === undefined || result === null) {
      console.info("🛡️ [Socket] join_super_admin_accounts_room sent; backend did not return an acknowledgement");
    } else {
      console.error("🛡️ [Socket] failed to join super_admin_accounts room:", response.reason ?? result);
    }
  });
};

export const bindHotelSocketEvents = (handlers: HotelSocketHandlers = {}) => {
  const entries = Object.entries(handlers) as [keyof HandlerMap, ((data: unknown) => void) | undefined][];
  entries.forEach(([key, handler]) => {
    if (handler && hotelSubscribers[key]) {
      hotelSubscribers[key].add(handler as any);
    }
  });

  return () => {
    entries.forEach(([key, handler]) => {
      if (handler && hotelSubscribers[key]) {
        hotelSubscribers[key].delete(handler as any);
      }
    });
  };
};

const attachHotelSocketHandlers = () => {
  // Handlers are dynamically dispatched via hotelSubscribers
};

const attachSuperAdminSocketHandlers = () => {
  if (!socket) return;

  const registrations: [string, ((data: unknown) => void) | undefined][] = [
    ["customer_created", superAdminSocketHandlers.onCustomerCreated],
    ["account_created", superAdminSocketHandlers.onAccountCreated],
    ["branch_created", superAdminSocketHandlers.onBranchCreated],
    ["room_policy_updated", superAdminSocketHandlers.onRoomPolicyUpdated],
    ["building_changed", superAdminSocketHandlers.onBuildingChanged],
    ["floor_changed", superAdminSocketHandlers.onFloorChanged],
    ["room_create", superAdminSocketHandlers.onRoomCreated],
    ["room_update", superAdminSocketHandlers.onRoomUpdated],
    ["room_import_progress", superAdminSocketHandlers.onRoomImportProgress],
    ["new_booking_notification", superAdminSocketHandlers.onNewBookingNotification],
    ["notification_created", superAdminSocketHandlers.onNotificationCreated],
    ["employee_created", superAdminSocketHandlers.onEmployeeChanged],
    ["employee_updated", superAdminSocketHandlers.onEmployeeChanged],
    ["service_import_progress", superAdminSocketHandlers.onServiceImportProgress],
    ["service_created", superAdminSocketHandlers.onServiceChanged],
    ["service_updated", superAdminSocketHandlers.onServiceChanged],
    ["new_service_notification", superAdminSocketHandlers.onServiceChanged],
    ["update_service_notification", superAdminSocketHandlers.onServiceChanged],
    ["update_promotion_notification", superAdminSocketHandlers.onPromotionUpdate],
    ["new_promotion_notification", superAdminSocketHandlers.onPromotionCreate],
  ];
  registrations.forEach(([event, handler]) => {
    if (handler) socket?.on(event, handler);
  });
};

export const bindSuperAdminSocketEvents = (handlers: SuperAdminSocketHandlers) => {
  const previousHandlers = superAdminSocketHandlers;
  if (socket) {
    const previousRegistrations: [string, ((data: unknown) => void) | undefined][] = [
      ["customer_created", previousHandlers.onCustomerCreated],
      ["account_created", previousHandlers.onAccountCreated],
      ["branch_created", previousHandlers.onBranchCreated],
      ["room_policy_updated", previousHandlers.onRoomPolicyUpdated],
      ["building_changed", previousHandlers.onBuildingChanged],
      ["floor_changed", previousHandlers.onFloorChanged],
      ["room_create", previousHandlers.onRoomCreated],
      ["room_update", previousHandlers.onRoomUpdated],
      ["room_import_progress", previousHandlers.onRoomImportProgress],
      ["new_booking_notification", previousHandlers.onNewBookingNotification],
      ["notification_created", previousHandlers.onNotificationCreated],
      ["employee_created", previousHandlers.onEmployeeChanged],
      ["employee_updated", previousHandlers.onEmployeeChanged],
      ["service_import_progress", previousHandlers.onServiceImportProgress],
      ["service_created", previousHandlers.onServiceChanged],
      ["service_updated", previousHandlers.onServiceChanged],
      ["new_service_notification", previousHandlers.onServiceChanged],
      ["update_service_notification", previousHandlers.onServiceChanged],
      ["update_promotion_notification", previousHandlers.onPromotionUpdate],
      ["new_promotion_notification", previousHandlers.onPromotionCreate],
    ];
    previousRegistrations.forEach(([event, handler]) => {
      if (handler) socket?.off(event, handler);
    });
  }

  superAdminSocketHandlers = handlers;
  attachSuperAdminSocketHandlers();

  return () => {
    if (socket) {
      const registrations: [string, ((data: unknown) => void) | undefined][] = [
        ["customer_created", handlers.onCustomerCreated],
        ["account_created", handlers.onAccountCreated],
        ["branch_created", handlers.onBranchCreated],
        ["room_policy_updated", handlers.onRoomPolicyUpdated],
        ["building_changed", handlers.onBuildingChanged],
        ["floor_changed", handlers.onFloorChanged],
        ["room_create", handlers.onRoomCreated],
        ["room_update", handlers.onRoomUpdated],
        ["room_import_progress", handlers.onRoomImportProgress],
        ["new_booking_notification", handlers.onNewBookingNotification],
        ["notification_created", handlers.onNotificationCreated],
        ["employee_created", handlers.onEmployeeChanged],
        ["employee_updated", handlers.onEmployeeChanged],
        ["service_import_progress", handlers.onServiceImportProgress],
        ["service_created", handlers.onServiceChanged],
        ["service_updated", handlers.onServiceChanged],
        ["new_service_notification", handlers.onServiceChanged],
        ["update_service_notification", handlers.onServiceChanged],
        ["update_promotion_notification", handlers.onPromotionUpdate],
        ["new_promotion_notification", handlers.onPromotionCreate],
      ];
      registrations.forEach(([event, handler]) => {
        if (handler) socket?.off(event, handler);
      });
    }
    if (superAdminSocketHandlers === handlers) {
      superAdminSocketHandlers = {};
    }
  };
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

  if (import.meta.env.DEV) {
    socket.onAny((eventName) => {
      console.debug("📨 [Socket] incoming event:", eventName);
    });
  }

  socket.on("connect", () => {
    console.log("✅ [Socket] connected:", socket?.id);

    const userId = getCurrentUserId();
    const isSuperAdmin = hasJwtRole(token, "ROLE_SUPER_ADMIN");
    const hotelId = isSuperAdmin ? "" : requestedHotelRoomId ?? getCurrentHotelId();

    if (userId) {
      socket?.emit("join_user_room", String(userId));
      console.log("📩 [Socket] join_user_room emitted:", userId);
    }

    if (hotelId) {
      joinHotelRoom(hotelId);
    }

    if (superAdminRoomRequested || isSuperAdmin) {
      requestSuperAdminRoomJoin();
    }

    flushPendingCustomerEvents();
  });

  socket.on("room_matrix_updated", (data) => {
    console.log("📅 [Socket] room_matrix_updated:", data);
    try {
      store.dispatch(baseApi.util.invalidateTags(["Booking", "Room", "RefundCancellation"]));
    } catch (e) {
      console.error(e);
    }
    dispatchToSubscribers("onRoomMatrixUpdated", data);
  });

  socket.on("housekeeping_task_updated", (data) => {
    console.log("🧹 [Socket] housekeeping_task_updated:", data);
    try {
      store.dispatch(baseApi.util.invalidateTags(["Room", "Notification"]));
    } catch (error) {
      console.error("Could not refresh housekeeping task data:", error);
    }
  });

  socket.on("room_policy_updated", (data) => {
    console.log("💰 [Socket] room_policy_updated:", data);
    try {
      store.dispatch(baseApi.util.invalidateTags(["BranchRoomPolicy", "Room"]));
    } catch (e) {}
    dispatchToSubscribers("onRoomPolicyUpdated", data);
    dispatchRoomPolicyUpdated(data);
  });

  socket.on("new_booking_notification", (data) => {
    console.log("🔔 [Socket] new_booking_notification:", data);
    try {
      store.dispatch(baseApi.util.invalidateTags(["Notification", "Booking", "Room", "Customer", "RefundCancellation"]));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("senviet_socket_new_booking", { detail: data }));
      }
    } catch (e) {
      console.error(e);
    }
    dispatchToSubscribers("onNewBookingNotification", data);
  });

  socket.on("notification_created", (data) => {
    console.log("🔔 [Root Socket] notification_created received:", data);
    try {
      store.dispatch(baseApi.util.invalidateTags(["Notification", "Booking", "Room"]));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("senviet_socket_notification_created", { detail: data }));
      }
    } catch (e) {
      console.error(e);
    }
    dispatchToSubscribers("onNotificationCreated", data);
  });

  socket.on("booking_state_updated", (data) => {
    console.log("📋 [Socket] booking_state_updated:", data);
    try {
      store.dispatch(baseApi.util.invalidateTags(["Booking", "Room"]));
    } catch (e) {}
    dispatchToSubscribers("onBookingStateUpdated", data);
  });

  socket.on("room_create", (data) => {
    try { store.dispatch(baseApi.util.invalidateTags(["Room"])); } catch {}
    dispatchToSubscribers("onRoomCreated", data);
  });

  socket.on("room_update", (data) => {
    try { store.dispatch(baseApi.util.invalidateTags(["Room"])); } catch {}
    dispatchToSubscribers("onRoomUpdated", data);
  });

  socket.on("building_changed", (data) => {
    try { store.dispatch(baseApi.util.invalidateTags(["Building", "Room"])); } catch {}
    dispatchToSubscribers("onBuildingChanged", data);
  });

  socket.on("floor_changed", (data) => {
    try { store.dispatch(baseApi.util.invalidateTags(["Floor", "Room"])); } catch {}
    dispatchToSubscribers("onFloorChanged", data);
  });

  socket.on("employee_created", (data) => {
    try { store.dispatch(baseApi.util.invalidateTags(["Staff"])); } catch {}
    dispatchToSubscribers("onEmployeeChanged", data);
  });

  socket.on("employee_updated", (data) => {
    try { store.dispatch(baseApi.util.invalidateTags(["Staff"])); } catch {}
    dispatchToSubscribers("onEmployeeChanged", data);
  });

  socket.on("customer_booking_updated", (data) => {
    console.log("👤 [Socket] customer_booking_updated:", data);
    try {
      store.dispatch(baseApi.util.invalidateTags(["Booking", "Customer"]));
    } catch (e) {
      console.error(e);
    }
    dispatchToSubscribers("onCustomerBookingUpdated", data);
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

  socket.off("customer_staff_chat_message");
  socket.on("customer_staff_chat_message", (data) => {
    console.log("📩 [Socket] customer_staff_chat_message received:", data);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("customer_staff_chat_message", { detail: data }));
    }
  });

  socket.off("staff_customer_chat_reply");
  socket.on("staff_customer_chat_reply", (data) => {
    console.log("💬 [Socket] staff_customer_chat_reply broadcast:", data);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("staff_customer_chat_reply", { detail: data }));
    }
  });

  attachHotelSocketHandlers();
  attachSuperAdminSocketHandlers();

  socket.on("connect_error", (error) => {
    console.error("❌ [Socket] connect error:", error.message);
  });

  socket.on("disconnect", (reason) => {
    console.log("🔴 [Socket] disconnected:", reason);
  });

  return socket;
};

export const getStaffSocket = () => socket;

export const emitStaffSendCustomerChat = (payload: {
  customerId: string;
  staffId?: string;
  staffName?: string;
  hotelId?: number | string | null;
  branchName?: string;
  message: string;
  timestamp?: string;
}) => {
  if (socket && socket.connected) {
    socket.emit("staff_send_customer_chat", payload);
    console.log("💬 [Socket] staff_send_customer_chat emitted:", payload);
  } else {
    console.warn("⚠️ [Socket] Staff socket is not connected to emit staff_send_customer_chat");
  }
};

export const sendStaffMarkCustomerRead = (payload: { customerId: string; hotelId?: number | string | null }) => {
  if (socket && socket.connected) {
    socket.emit("staff_mark_customer_read", payload);
    console.log("👀 [Socket] staff_mark_customer_read emitted:", payload);
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  requestedHotelRoomId = null;
  superAdminRoomRequested = false;
};

export const joinSuperAdminAccountsRoom = () => {
  superAdminRoomRequested = true;
  if (socket?.connected) {
    requestSuperAdminRoomJoin();
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
  const token = localStorage.getItem("accessToken") ?? "";
  if (hasJwtRole(token, "ROLE_SUPER_ADMIN")) {
    requestedHotelRoomId = null;
    console.info("🛡️ [Socket] Super Admin does not join a hotel room");
    return;
  }

  const resolvedHotelId = hotelId === null || hotelId === ""
    ? getCurrentHotelId()
    : String(hotelId);
  if (!resolvedHotelId) {
    console.warn("🏢 [Socket] cannot join hotel room: no hotelId in auth state or token");
    return;
  }

  requestedHotelRoomId = String(resolvedHotelId);
  if (socket?.connected) {
    socket.emit("join_hotel_room", requestedHotelRoomId, (result: unknown) => {
      const response = result && typeof result === "object"
        ? result as Record<string, unknown>
        : {};
      if (response.joined === true) {
        console.log("🏢 [Socket] joined hotel room:", requestedHotelRoomId);
      } else if (result === undefined || result === null) {
        console.info("🏢 [Socket] join_hotel_room sent without server acknowledgement:", requestedHotelRoomId);
      } else {
        console.error(
          "🏢 [Socket] failed to join hotel room:",
          requestedHotelRoomId,
          response.reason ?? result,
        );
      }
    });
  }
};
