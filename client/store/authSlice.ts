import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface AuthState {
  token: string | null;
  fullName: string | null;
  email: string | null;
  position: string | null;
  hotelId: string | null;
  hotelName: string | null;
  employeeId: string | null;
}

type JwtPayload = {
  hotelId?: number | string | null;
  hotelName?: string | null;
  employeeId?: number | string | null;
  employeeID?: number | string | null;
  employee_id?: number | string | null;
  staffId?: number | string | null;
  staffID?: number | string | null;
  userId?: number | string | null;
  adminId?: number | string | null;
  adminID?: number | string | null;
  accountId?: number | string | null;
  id?: number | string | null;
  sub?: number | string | null;
};

const getHotelFromToken = (token: string | null) => {
  if (!token) return { hotelId: null, hotelName: null };

  try {
    const encodedPayload = token.split(".")[1];
    if (!encodedPayload) return { hotelId: null, hotelName: null };
    const normalizedPayload = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(normalizedPayload.length + ((4 - normalizedPayload.length % 4) % 4), "=");
    const payloadBytes = Uint8Array.from(atob(paddedPayload), (character) => character.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as JwtPayload;
    return {
      hotelId: payload.hotelId == null ? null : String(payload.hotelId),
      hotelName: payload.hotelName?.trim() || null,
    };
  } catch {
    return { hotelId: null, hotelName: null };
  }
};

const getEmployeeIdFromToken = (token: string | null) => {
  if (!token) return null;

  try {
    const encodedPayload = token.split(".")[1];
    if (!encodedPayload) return null;
    const normalizedPayload = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(normalizedPayload.length + ((4 - normalizedPayload.length % 4) % 4), "=");
    const payload = JSON.parse(atob(paddedPayload)) as JwtPayload;
    const employeeId = payload.employeeId
      ?? payload.employeeID
      ?? payload.employee_id
      ?? payload.staffId
      ?? payload.staffID
      ?? payload.userId
      ?? payload.adminId
      ?? payload.adminID
      ?? payload.accountId
      ?? payload.id
      ?? payload.sub;
    return employeeId == null ? null : String(employeeId);
  } catch {
    return null;
  }
};

const initialState: AuthState = {
  token: localStorage.getItem("accessToken"),
  fullName: localStorage.getItem("fullName"),
  email: localStorage.getItem("email"),
  position: localStorage.getItem("position"),
  ...getHotelFromToken(localStorage.getItem("accessToken")),
  employeeId: getEmployeeIdFromToken(localStorage.getItem("accessToken")) ?? localStorage.getItem("id"),
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    
    setCredentials: (state, action: PayloadAction<{ id: string; token: string; fullName: string; email: string; position: string }>) => {
      state.token = action.payload.token;
      state.fullName = action.payload.fullName;
      state.email = action.payload.email;
      state.position = action.payload.position;
      const hotel = getHotelFromToken(action.payload.token);
      state.hotelId = hotel.hotelId;
      state.hotelName = hotel.hotelName;
      state.employeeId = getEmployeeIdFromToken(action.payload.token);
      if (action.payload.id != null) {
        state.employeeId = String(action.payload.id);
        localStorage.setItem("id", String(action.payload.id));
      }
      localStorage.setItem("accessToken", action.payload.token);
      localStorage.setItem("fullName", action.payload.fullName);
      localStorage.setItem("email", action.payload.email);
      localStorage.setItem("position", action.payload.position);
    },
    logout: (state) => {
      state.token = null;
      state.fullName = null;
      state.email = null;
      state.position = null;
      state.hotelId = null;
      state.hotelName = null;
      state.employeeId = null;
      localStorage.clear();
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;