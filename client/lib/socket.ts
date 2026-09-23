import { io, type Socket } from "socket.io-client";

const SOCKET_URL = "http://localhost:8085";

let socket: Socket | null = null;

type HotelSocketHandlers = {
  onRoomMatrixUpdated?: (data: unknown) => void;
  onNewBookingNotification?: (data: unknown) => void;
  onCustomerBookingUpdated?: (data: unknown) => void;
};

let hotelSocketHandlers: HotelSocketHandlers = {};

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
  onRoomMatrixUpdated,
  onNewBookingNotification,
  onCustomerBookingUpdated,
}: HotelSocketHandlers = {}) => {
  hotelSocketHandlers = {
    onRoomMatrixUpdated,
    onNewBookingNotification,
    onCustomerBookingUpdated,
  };

  if (!socket) return;

  socket.off("room_matrix_updated");
  socket.off("new_booking_notification");
  socket.off("customer_booking_updated");

  if (onRoomMatrixUpdated) {
    socket.on("room_matrix_updated", onRoomMatrixUpdated);
  }

  if (onNewBookingNotification) {
    socket.on("new_booking_notification", onNewBookingNotification);
  }

  if (onCustomerBookingUpdated) {
    socket.on("customer_booking_updated", onCustomerBookingUpdated);
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
  });

  socket.on("room_matrix_updated", (data) => {
    console.log("📅 [Socket] room_matrix_updated:", data);
  });

  socket.on("new_booking_notification", (data) => {
    console.log("🔔 [Socket] new_booking_notification:", data);
  });

  socket.on("customer_booking_updated", (data) => {
    console.log("👤 [Socket] customer_booking_updated:", data);
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
