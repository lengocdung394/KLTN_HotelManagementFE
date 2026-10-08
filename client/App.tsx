  window.localStorage.removeItem("position");
import "./global.css";
import "./i18n";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { useEffect, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Provider } from "react-redux";
import { store } from "./store";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import NotFound from "./pages/NotFound";
import ModulePage from "./pages/ModulePage";
import CustomerPage from "./pages/CustomerPage";
import LoginPage from "./pages/LoginPage";
import { disconnectSocket, initSocket } from "./lib/socket";
import { useAppSelector } from "./store/hooks";

type AppRoutesProps = {
  authenticated: boolean;
  onLogin: () => void;
  onLogout: () => void;
};

function AppRoutes({ authenticated, onLogin, onLogout }: AppRoutesProps) {
  const roles = useAppSelector((state) => state.auth.roles);
  const isSystemAdmin = roles.includes("ROLE_SUPER_ADMIN");
  const isBranchAdmin = roles.includes("ROLE_ADMIN");
  const isManager = roles.includes("ROLE_MANAGER");
  const isEmployee = roles.includes("ROLE_EMPLOYEE");

  if (!authenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={onLogin} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (isSystemAdmin) {
    return (
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/admin" element={<AdminDashboardPage onLogout={onLogout} />} />
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

  if (isEmployee && !isManager && !isBranchAdmin) {
    return (
      <Routes>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<Index onLogout={onLogout} />} />
        <Route path="/bookings" element={<ModulePage path="/bookings" onLogout={onLogout} />} />
        <Route path="/booking-list" element={<ModulePage path="/booking-list" onLogout={onLogout} />} />
        <Route path="/customers" element={<CustomerPage onLogout={onLogout} />} />
        <Route path="/check-in-out" element={<ModulePage path="/check-in-out" onLogout={onLogout} />} />
        <Route path="/promotions" element={<ModulePage path="/promotions" onLogout={onLogout} />} />
        <Route path="/services" element={<ModulePage path="/services" onLogout={onLogout} />} />
        <Route path="/rooms" element={<ModulePage path="/rooms" onLogout={onLogout} />} />
        <Route path="/invoices" element={<ModulePage path="/invoices" onLogout={onLogout} />} />
        <Route path="/reports" element={<ModulePage path="/reports" onLogout={onLogout} />} />
        <Route path="/staff" element={<ModulePage path="/staff" onLogout={onLogout} />} />
        <Route path="/settings" element={<ModulePage path="/settings" onLogout={onLogout} />} />
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/overview" replace />} />
      <Route path="/overview" element={<Index onLogout={onLogout} />} />
      <Route path="/bookings" element={<ModulePage path="/bookings" onLogout={onLogout} />} />
      <Route path="/booking-list" element={<ModulePage path="/booking-list" onLogout={onLogout} />} />
      <Route path="/customers" element={<CustomerPage onLogout={onLogout} />} />
      <Route path="/check-in-out" element={<ModulePage path="/check-in-out" onLogout={onLogout} />} />
      <Route path="/promotions" element={<ModulePage path="/promotions" onLogout={onLogout} />} />
      <Route path="/services" element={<ModulePage path="/services" onLogout={onLogout} />} />
      <Route path="/rooms" element={<ModulePage path="/rooms" onLogout={onLogout} />} />
      <Route path="/invoices" element={<ModulePage path="/invoices" onLogout={onLogout} />} />
      <Route path="/staff" element={<ModulePage path="/staff" onLogout={onLogout} />} />
      <Route path="/permissions" element={<ModulePage path="/permissions" onLogout={onLogout} />} />
      <Route path="/reports" element={<ModulePage path="/reports" onLogout={onLogout} />} />
      <Route path="/settings" element={<ModulePage path="/settings" onLogout={onLogout} />} />
      <Route path="/dat-phong" element={<Navigate to="/bookings" replace />} />
      <Route path="/nhan-vien" element={<Navigate to="/staff" replace />} />
      <Route path="/phan-quyen" element={<Navigate to="/permissions" replace />} />
      <Route path="/bao-cao" element={<Navigate to="/reports" replace />} />
      <Route path="/cai-dat" element={<Navigate to="/settings" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
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
        </BrowserRouter>
      </TooltipProvider>
    </Provider>
  );
};

createRoot(document.getElementById("root")!).render(<App />);