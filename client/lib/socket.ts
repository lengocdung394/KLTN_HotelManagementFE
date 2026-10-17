import { io, type Socket } from "socket.io-client";

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

let hotelSocketHandlers: HotelSocketHandlers = {};
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

export const bindHotelSocketEvents = ({
  onRoomCreated,
  onRoomUpdated,
  onRoomImportProgress,
  onServiceImportProgress,
  onRoomMatrixUpdated,
  onRoomPolicyUpdated,
  onBuildingChanged,
  onFloorChanged,
  onNewBookingNotification,
  onNotificationCreated,
  onServiceChanged,
  onEmployeeChanged,
  onCustomerBookingUpdated,
  onCustomerCreated,
  onSeasonalRateAnnouncement,
  onSeasonalRateAnnouncementUpdate,
  onPromotionUpdate,
  onPromotionCreate,
  onLateCheckOutCalendar,
}: HotelSocketHandlers = {}) => {
  if (onRoomPolicyUpdated && onRoomPolicyUpdated !== dispatchRoomPolicyUpdated) {
    roomPolicyUpdatedSubscribers.add(onRoomPolicyUpdated);
  }

  hotelSocketHandlers = {
    ...hotelSocketHandlers,
    ...(onRoomCreated ? { onRoomCreated } : {}),
    ...(onRoomUpdated ? { onRoomUpdated } : {}),
    ...(onRoomImportProgress ? { onRoomImportProgress } : {}),
    ...(onServiceImportProgress ? { onServiceImportProgress } : {}),
    ...(onRoomMatrixUpdated ? { onRoomMatrixUpdated } : {}),
    ...(onRoomPolicyUpdated ? { onRoomPolicyUpdated: dispatchRoomPolicyUpdated } : {}),
    ...(onBuildingChanged ? { onBuildingChanged } : {}),
    ...(onFloorChanged ? { onFloorChanged } : {}),
    ...(onNewBookingNotification ? { onNewBookingNotification } : {}),
    ...(onNotificationCreated ? { onNotificationCreated } : {}),
    ...(onServiceChanged ? { onServiceChanged } : {}),
    ...(onEmployeeChanged ? { onEmployeeChanged } : {}),
    ...(onCustomerBookingUpdated ? { onCustomerBookingUpdated } : {}),
    ...(onCustomerCreated ? { onCustomerCreated } : {}),
    ...(onSeasonalRateAnnouncement ? { onSeasonalRateAnnouncement } : {}),
    ...(onSeasonalRateAnnouncementUpdate ? { onSeasonalRateAnnouncementUpdate } : {}),
    ...(onPromotionUpdate ? { onPromotionUpdate } : {}),
    ...(onPromotionCreate ? { onPromotionCreate } : {}),
    ...(onLateCheckOutCalendar ? { onLateCheckOutCalendar } : {}),
  };

  const boundNotificationHandler = onNotificationCreated;
  const boundServiceHandler = onServiceChanged;
  const boundEmployeeHandler = onEmployeeChanged;
  const boundNewBookingHandler = onNewBookingNotification;
  const boundRoomPolicyHandler = onRoomPolicyUpdated === dispatchRoomPolicyUpdated
    ? undefined
    : onRoomPolicyUpdated;
  const unbindNotificationHandler = () => {
    if (boundNotificationHandler && socket) {
      socket.off("notification_created", boundNotificationHandler);
    }
    if (boundServiceHandler && socket) {
      socket.off("new_service_notification", boundServiceHandler);
      socket.off("update_service_notification", boundServiceHandler);
    }
    if (boundNewBookingHandler && socket) {
      socket.off("new_booking_notification", boundNewBookingHandler);
    }
    if (boundEmployeeHandler && socket) {
      socket.off("employee_created", boundEmployeeHandler);
      socket.off("employee_updated", boundEmployeeHandler);
    }
    if (boundRoomPolicyHandler) {
      roomPolicyUpdatedSubscribers.delete(boundRoomPolicyHandler);
      if (socket) {
        socket.off("room_policy_updated", dispatchRoomPolicyUpdated);
        if (roomPolicyUpdatedSubscribers.size > 0) {
          socket.on("room_policy_updated", dispatchRoomPolicyUpdated);
        }
      }
      if (
        roomPolicyUpdatedSubscribers.size === 0
        && hotelSocketHandlers.onRoomPolicyUpdated === dispatchRoomPolicyUpdated
      ) {
        hotelSocketHandlers = { ...hotelSocketHandlers, onRoomPolicyUpdated: undefined };
      }
    }
    if (hotelSocketHandlers.onNotificationCreated === boundNotificationHandler) {
      hotelSocketHandlers = { ...hotelSocketHandlers, onNotificationCreated: undefined };
    }
    if (hotelSocketHandlers.onServiceChanged === boundServiceHandler) {
      hotelSocketHandlers = { ...hotelSocketHandlers, onServiceChanged: undefined };
    }
    if (hotelSocketHandlers.onEmployeeChanged === boundEmployeeHandler) {
      hotelSocketHandlers = { ...hotelSocketHandlers, onEmployeeChanged: undefined };
    }
    if (hotelSocketHandlers.onNewBookingNotification === boundNewBookingHandler) {
      hotelSocketHandlers = { ...hotelSocketHandlers, onNewBookingNotification: undefined };
    }
  };
  if (!socket) return unbindNotificationHandler;

  const eventHandlers: [string, ((data: unknown) => void) | undefined][] = [
    ["room_create", hotelSocketHandlers.onRoomCreated],
    ["room_update", hotelSocketHandlers.onRoomUpdated],
    ["room_import_progress", hotelSocketHandlers.onRoomImportProgress],
    ["service_import_progress", hotelSocketHandlers.onServiceImportProgress],
    ["room_matrix_updated", hotelSocketHandlers.onRoomMatrixUpdated],
    ["room_policy_updated", hotelSocketHandlers.onRoomPolicyUpdated],
    ["building_changed", hotelSocketHandlers.onBuildingChanged],
    ["floor_changed", hotelSocketHandlers.onFloorChanged],
    ["new_booking_notification", hotelSocketHandlers.onNewBookingNotification],
    ["notification_created", hotelSocketHandlers.onNotificationCreated],
    ["new_service_notification", hotelSocketHandlers.onServiceChanged],
    ["update_service_notification", hotelSocketHandlers.onServiceChanged],
    ["employee_created", hotelSocketHandlers.onEmployeeChanged],
    ["employee_updated", hotelSocketHandlers.onEmployeeChanged],
    ["customer_booking_updated", hotelSocketHandlers.onCustomerBookingUpdated],
    ["customer_created", hotelSocketHandlers.onCustomerCreated],
    ["seasonal_rate_announcement", hotelSocketHandlers.onSeasonalRateAnnouncement],
    [SEASONAL_RATE_UPDATE_EVENT, hotelSocketHandlers.onSeasonalRateAnnouncementUpdate],
    ["update_promotion_notification", hotelSocketHandlers.onPromotionUpdate],
    ["new_promotion_notification", hotelSocketHandlers.onPromotionCreate],
    ["late_check_out_calendar", hotelSocketHandlers.onLateCheckOutCalendar],
  ];
  eventHandlers.forEach(([event, handler]) => {
    if (handler) socket.off(event, handler);
  });

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

  if (hotelSocketHandlers.onBuildingChanged) {
    socket.on("building_changed", hotelSocketHandlers.onBuildingChanged);
  }

  if (hotelSocketHandlers.onFloorChanged) {
    socket.on("floor_changed", hotelSocketHandlers.onFloorChanged);
  }

  if (hotelSocketHandlers.onNewBookingNotification) {
    socket.on("new_booking_notification", hotelSocketHandlers.onNewBookingNotification);
  }

  if (hotelSocketHandlers.onNotificationCreated) {
    socket.on("notification_created", hotelSocketHandlers.onNotificationCreated);
  }

  if (hotelSocketHandlers.onServiceChanged) {
    socket.on("new_service_notification", hotelSocketHandlers.onServiceChanged);
    socket.on("update_service_notification", hotelSocketHandlers.onServiceChanged);
  }

  if (hotelSocketHandlers.onEmployeeChanged) {
    socket.on("employee_created", hotelSocketHandlers.onEmployeeChanged);
    socket.on("employee_updated", hotelSocketHandlers.onEmployeeChanged);
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
  return unbindNotificationHandler;
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
  attachSuperAdminSocketHandlers();

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
