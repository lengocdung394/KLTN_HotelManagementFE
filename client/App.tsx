import "./global.css";
import "./i18n";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Provider } from "react-redux";
import { store } from "./store";
import { logout } from "./store/authSlice";
import { BrowserRouter, Navigate, Routes, Route, useLocation } from "react-router-dom";
import Index from "./pages/Index";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import NotFound from "./pages/NotFound";
import ModulePage from "./pages/ModulePage";
import CustomerPage from "./pages/CustomerPage";
import LoginPage from "./pages/LoginPage";
import { disconnectSocket, initSocket } from "./lib/socket";
import { useAppSelector } from "./store/hooks";
import { useGetCurrentUserPermissionsQuery } from "./services/authApi";
import { canAccessModule, getModulePermissionForRoute } from "./lib/modulePermissions";
import { localizedText } from "./i18n";
import ChatWidget from "./components/ChatWidget";
import BranchPhotoLoginSplash from "./components/BranchPhotoLoginSplash";

type AppRoutesProps = {
  authenticated: boolean;
  onLogin: () => void;
  onLogout: () => void;
};

function AppRoutes({ authenticated, onLogin, onLogout }: AppRoutesProps) {
  const { roles, hotelId, hotelName } = useAppSelector((state) => state.auth);
  const [showLoginSplash, setShowLoginSplash] = useState(false);
  const finishLoginSplash = useCallback(() => setShowLoginSplash(false), []);
  const isSystemAdmin = roles.includes("ROLE_SUPER_ADMIN");
  const isBranchAdmin = roles.includes("ROLE_ADMIN");
  const isManager = roles.includes("ROLE_MANAGER");
  const isEmployee = roles.includes("ROLE_EMPLOYEE") || roles.includes("ROLE_RECEPTIONIST") || roles.includes("ROLE_STAFF");

  if (!authenticated) {
    return (
      <Routes>
        <Route
          path="/login"
          element={
            <LoginPage
              onLogin={() => {
                onLogin();
                setShowLoginSplash(true);
              }}
            />
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (isSystemAdmin) {
    return (
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/admin" element={<AdminDashboardPage onLogout={onLogout} />} />
        <Route path="/refund-approvals" element={<ModulePage path="/refund-approvals" onLogout={onLogout} />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    );
  }

  if (!isBranchAdmin && !isManager && !isEmployee) {
    return (
      <Routes>
        <Route path="/access-denied" element={
          <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
            <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <h1 className="text-xl font-bold text-slate-900">Không có quyền truy cập</h1>
              <p className="mt-2 text-sm text-slate-500">Tài khoản khách hàng sử dụng cổng khách hàng riêng.</p>
              <button type="button" onClick={onLogout} className="mt-6 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Đăng xuất</button>
            </section>
          </main>
        } />
        <Route path="*" element={<Navigate to="/access-denied" replace />} />
      </Routes>
    );
  }

  return (
    <>
    <Routes>
      <Route path="/" element={<Navigate to="/overview" replace />} />
      <Route path="/overview" element={<RequireModulePermission><Index onLogout={onLogout} /></RequireModulePermission>} />
      <Route path="/bookings" element={<RequireModulePermission><ModulePage path="/bookings" onLogout={onLogout} /></RequireModulePermission>} />
      <Route path="/booking-list" element={<RequireModulePermission><ModulePage path="/booking-list" onLogout={onLogout} /></RequireModulePermission>} />
      <Route path="/refund-approvals" element={<RequireModulePermission><ModulePage path="/refund-approvals" onLogout={onLogout} /></RequireModulePermission>} />
      <Route path="/hotel-rules" element={<RequireModulePermission><ModulePage path="/hotel-rules" onLogout={onLogout} /></RequireModulePermission>} />
      <Route path="/customers" element={<RequireModulePermission><CustomerPage onLogout={onLogout} /></RequireModulePermission>} />
      <Route path="/check-in-out" element={<RequireModulePermission><ModulePage path="/check-in-out" onLogout={onLogout} /></RequireModulePermission>} />
      <Route path="/promotions" element={<RequireModulePermission><ModulePage path="/promotions" onLogout={onLogout} /></RequireModulePermission>} />
      <Route path="/services/usage" element={<RequireModulePermission><ModulePage path="/services/usage" onLogout={onLogout} /></RequireModulePermission>} />
      <Route path="/services/catalog" element={<RequireModulePermission><ModulePage path="/services/catalog" onLogout={onLogout} /></RequireModulePermission>} />
      <Route path="/services" element={<Navigate to="/services/usage" replace />} />
      <Route path="/rooms" element={<RequireModulePermission><ModulePage path="/rooms" onLogout={onLogout} /></RequireModulePermission>} />
      <Route path="/invoices" element={<RequireModulePermission><ModulePage path="/invoices" onLogout={onLogout} /></RequireModulePermission>} />
      <Route path="/staff" element={<RequireModulePermission><ModulePage path="/staff" onLogout={onLogout} /></RequireModulePermission>} />
      <Route path="/permissions" element={<RequireModulePermission><ModulePage path="/permissions" onLogout={onLogout} /></RequireModulePermission>} />
      <Route path="/reports" element={<RequireModulePermission><ModulePage path="/reports" onLogout={onLogout} /></RequireModulePermission>} />
      <Route path="/access-denied" element={<AccessDenied onLogout={onLogout} />} />
      <Route path="/settings" element={<RequireModulePermission><ModulePage path="/settings" onLogout={onLogout} /></RequireModulePermission>} />
      <Route path="/dat-phong" element={<Navigate to="/bookings" replace />} />
      <Route path="/nhan-vien" element={<Navigate to="/staff" replace />} />
      <Route path="/phan-quyen" element={<Navigate to="/permissions" replace />} />
      <Route path="/bao-cao" element={<Navigate to="/reports" replace />} />
      <Route path="/cai-dat" element={<Navigate to="/settings" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    {showLoginSplash && hotelId && (
      <BranchPhotoLoginSplash
        hotelId={hotelId}
        hotelName={hotelName}
        onComplete={finishLoginSplash}
      />
    )}
    </>
  );
}

function RequireModulePermission({ children }: { children: ReactNode }) {
  const location = useLocation();
  const roles = useAppSelector((state) => state.auth.roles);
  const { data: permissions = [], isLoading, isError, refetch } = useGetCurrentUserPermissionsQuery(undefined, {
    refetchOnFocus: true,
  });
  const module = getModulePermissionForRoute(location.pathname, location.search);

  if (isLoading) {
    return <p role="status" className="p-8 text-center text-sm text-slate-500">{localizedText("Đang kiểm tra quyền truy cập...", "Checking access...")}</p>;
  }
  if (isError) {
    return (
      <section role="alert" className="mx-auto mt-12 max-w-lg rounded-xl border border-rose-200 bg-white p-6 text-center">
        <p className="text-sm font-semibold text-rose-700">{localizedText("Không thể kiểm tra quyền truy cập.", "Could not verify access permissions.")}</p>
        <button type="button" onClick={() => void refetch()} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
          {localizedText("Thử lại", "Try again")}
        </button>
      </section>
    );
  }
  if (roles.includes("ROLE_SUPER_ADMIN") || (module && canAccessModule(permissions, module))) return children;
  return <Navigate to="/access-denied" replace />;
}

function AccessDenied({ onLogout }: { onLogout: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">{localizedText("Không có quyền truy cập", "Access denied")}</h1>
        <p className="mt-2 text-sm text-slate-500">{localizedText("Tài khoản của bạn chưa được cấp quyền xem mục này.", "Your account has not been granted access to this section.")}</p>
        <button type="button" onClick={onLogout} className="mt-6 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
          {localizedText("Đăng xuất", "Sign out")}
        </button>
      </section>
    </main>
  );
}

const App = () => {
  const [authenticated, setAuthenticated] = useState(() => Boolean(window.localStorage.getItem("accessToken")));

  useEffect(() => {
    const token = window.localStorage.getItem("accessToken");

    if (authenticated && token) {
      initSocket(token);
    } else {
      disconnectSocket();
    }

    return () => {
      if (!authenticated) {
        disconnectSocket();
      }
    };
  }, [authenticated]);

  const handleLogout = () => {
    window.localStorage.removeItem("staywise-authenticated");
    window.localStorage.removeItem("accessToken");
    window.localStorage.removeItem("senviet_admin_copilot_session_v3");
    window.localStorage.removeItem("senviet_admin_copilot_messages_v3");
    store.dispatch(logout());
    disconnectSocket();
    setAuthenticated(false);
  };

  return (
    <Provider store={store}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes
            authenticated={authenticated}
            onLogin={() => setAuthenticated(true)}
            onLogout={handleLogout}
          />
          {authenticated && (
            <>
              <ChatWidget />
            </>
          )}
        </BrowserRouter>
      </TooltipProvider>
    </Provider>
  );
};

createRoot(document.getElementById("root")!).render(<App />);