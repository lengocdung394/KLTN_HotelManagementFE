  window.localStorage.removeItem("position");
import "./global.css";
import "./i18n";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Provider } from "react-redux";
import { store } from "./store";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ModulePage from "./pages/ModulePage";
import CustomerPage from "./pages/CustomerPage";
import LoginPage from "./pages/LoginPage";

const App = () => {
  const [authenticated, setAuthenticated] = useState(() => Boolean(window.localStorage.getItem("accessToken")));
  const handleLogout = () => {
    window.localStorage.removeItem("staywise-authenticated");
    setAuthenticated(false);
  };

  return (
    <Provider store={store}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          {authenticated ? <Routes>
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<Index onLogout={handleLogout} />} />
            <Route path="/bookings" element={<ModulePage path="/bookings" onLogout={handleLogout} />} />
            <Route path="/customers" element={<CustomerPage onLogout={handleLogout} />} />
            <Route path="/check-in-out" element={<ModulePage path="/check-in-out" onLogout={handleLogout} />} />
            <Route path="/promotions" element={<ModulePage path="/promotions" onLogout={handleLogout} />} />
             <Route path="/services" element={<ModulePage path="/services" onLogout={handleLogout} />} />
            <Route path="/rooms" element={<ModulePage path="/rooms" onLogout={handleLogout} />} />
            <Route path="/tasks" element={<ModulePage path="/tasks" onLogout={handleLogout} />} />
            <Route path="/invoices" element={<ModulePage path="/invoices" onLogout={handleLogout} />} />
            <Route path="/staff" element={<ModulePage path="/staff" onLogout={handleLogout} />} />
            <Route path="/permissions" element={<ModulePage path="/permissions" onLogout={handleLogout} />} />
            <Route path="/reports" element={<ModulePage path="/reports" onLogout={handleLogout} />} />
            <Route path="/settings" element={<ModulePage path="/settings" onLogout={handleLogout} />} />
            <Route path="/dat-phong" element={<Navigate to="/bookings" replace />} />
            <Route path="/nhan-vien" element={<Navigate to="/staff" replace />} />
            <Route path="/phan-quyen" element={<Navigate to="/permissions" replace />} />
            <Route path="/bao-cao" element={<Navigate to="/reports" replace />} />
            <Route path="/cai-dat" element={<Navigate to="/settings" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes> : <Routes>
            <Route path="/login" element={<LoginPage onLogin={() => setAuthenticated(true)} />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>}
        </BrowserRouter>
      </TooltipProvider>
    </Provider>
  );
};

createRoot(document.getElementById("root")!).render(<App />);