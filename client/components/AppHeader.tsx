import { Bell, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "../store/hooks";

type AppHeaderProps = {
  onMenuClick?: () => void;
  fullName?: string | null;
  collapsed?: boolean;
};

export default function AppHeader({ onMenuClick, fullName, collapsed }: AppHeaderProps) {
  const { t, i18n } = useTranslation();
  const auth = useAppSelector((state) => state.auth);
  const displayName = fullName?.trim() || auth.fullName?.trim() || auth.email?.trim() || "Người dùng";
  const currentDate = new Date().toLocaleDateString(i18n.language.startsWith("en") ? "en-US" : "vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const currentLanguage = i18n.language.startsWith("en") ? "en" : "vi";

  const changeLanguage = (lang: "en" | "vi") => {
    void i18n.changeLanguage(lang);
    localStorage.setItem("language", lang);
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 sm:px-6 lg:px-8 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-blue-600"
            title={collapsed ? "Mở menu" : "Thu gọn menu"}
            aria-label={collapsed ? "Mở menu" : "Thu gọn menu"}
          >
            {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
        )}
        <div className="min-w-0">
          <p className="text-xs font-medium capitalize text-slate-400">{currentDate}</p>
          <h1 className="truncate text-lg font-bold tracking-tight text-slate-900">{t("common.goodMorning", { name: displayName })}</h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Global Language Switcher Pill Widget */}
        <div className="flex items-center rounded-xl border border-slate-200/90 bg-slate-100/90 p-1 shadow-2xs">
          <button
            type="button"
            onClick={() => changeLanguage("vi")}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition duration-150 ${
              currentLanguage === "vi"
                ? "bg-white text-blue-700 shadow-2xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <span className="text-xs">🇻🇳</span>
            <span className="hidden sm:inline">Tiếng Việt</span>
            <span className="sm:hidden">VIE</span>
          </button>

          <button
            type="button"
            onClick={() => changeLanguage("en")}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition duration-150 ${
              currentLanguage === "en"
                ? "bg-white text-blue-700 shadow-2xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <span className="text-xs">🇬🇧</span>
            <span className="hidden sm:inline">English</span>
            <span className="sm:hidden">ENG</span>
          </button>
        </div>

        <button type="button" className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition" aria-label="Notifications">
          <Bell size={19} />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-orange-500 ring-2 ring-white" />
        </button>
      </div>
    </header>
  );
}
