import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface AuthState {
  token: string | null;
  fullName: string | null;
  email: string | null;
  position: string | null;
}

const initialState: AuthState = {
  token: localStorage.getItem("accessToken"),
  fullName: localStorage.getItem("fullName"),
  email: localStorage.getItem("email"),
  position: localStorage.getItem("position"),
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    
    setCredentials: (state, action: PayloadAction<{ token: string; fullName: string; email: string; position: string }>) => {
      state.token = action.payload.token;
      state.fullName = action.payload.fullName;
      state.email = action.payload.email;
      state.position = action.payload.position;
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
      localStorage.clear();
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;