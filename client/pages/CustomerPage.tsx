import { useTranslation } from "react-i18next";
import AppSidebar from "../components/AppSidebar";
import CustomerWorkspace from "./CustomerWorkspace";
import AppHeader from "../components/AppHeader";
import ScrollControls from "../components/ScrollControls";
import { useAppSelector } from "../store/hooks";
import { useSidebar } from "../hooks/useSidebar";

export default function CustomerPage({ onLogout }: { onLogout: () => void }) {
  const { t } = useTranslation();
  const { mobileOpen, collapsed, toggleSidebar, closeMobile } = useSidebar();
  const { fullName, email, position } = useAppSelector((state) => state.auth);
  return (
    <div className="min-h-screen min-w-0 bg-[#f7f8fc] text-slate-800">
      <AppSidebar
        mobile={mobileOpen}
        onCloseMobile={closeMobile}
        onLogout={onLogout}
        fullName={fullName || email}
        position={position}
        collapsed={collapsed}
        onToggleCollapse={toggleSidebar}
      />
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
          onClick={closeMobile}
        />
      )}
      <main className={`min-w-0 transition-[padding] duration-300 ease-in-out ${collapsed ? "lg:pl-0" : "lg:pl-72"}`}>
        <AppHeader onMenuClick={toggleSidebar} collapsed={collapsed} />
        <div className={`mx-auto min-w-0 px-4 py-6 sm:px-6 lg:px-8 transition-[max-width] duration-300 ease-in-out ${collapsed ? "max-w-[1650px]" : "max-w-7xl"}`}>
          <p className="mb-1 text-sm font-semibold text-blue-600">
            {t("pages.customers.eyebrow")}
          </p>
          <h2 className="text-[28px] font-bold tracking-tight text-slate-900">
            {t("pages.customers.title")}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {t("pages.customers.description")}
          </p>
          <CustomerWorkspace />
        </div>
      </main>
      <ScrollControls />
    </div>
  );
}
