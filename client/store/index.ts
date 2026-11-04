import { configureStore, type Middleware } from "@reduxjs/toolkit";
import { baseApi } from "../services/baseApi";
import authReducer, { logout, setCredentials } from "./authSlice";

const resetApiCacheOnAccountChange: Middleware =
  (middlewareApi) => (next) => (action) => {
    const previousToken = (middlewareApi.getState() as {
      auth: { token: string | null };
    }).auth.token;
    const result = next(action);

    if (
      logout.match(action) ||
      (setCredentials.match(action) && previousToken !== action.payload.token)
    ) {
      middlewareApi.dispatch(baseApi.util.resetApiState());
    }

    return result;
  };

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    auth: authReducer,
  },
  middleware: (getDefault) =>
    getDefault().concat(baseApi.middleware, resetApiCacheOnAccountChange),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;