import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "../store/hooks";
import LanguageSwitcher from "./LanguageSwitcher";
import NotificationBell from "./NotificationBell";
import UserGuideButton from "./UserGuideButton";

type AppHeaderProps = {
  onMenuClick?: () => void;
  fullName?: string | null;
  collapsed?: boolean;
};

export default function AppHeader({ onMenuClick, fullName, collapsed }: AppHeaderProps) {
  const { t, i18n } = useTranslation();
  const auth = useAppSelector((state) => state.auth);
  const displayName = fullName?.trim() || auth.fullName?.trim() || auth.email?.trim() || "Người dùng";
  const hour = new Date().getHours();
  const greetingKey = hour >= 5 && hour < 12
    ? "common.goodMorning"
    : hour >= 12 && hour < 18
      ? "common.goodAfternoon"
      : "common.goodEvening";
  const currentDate = new Date().toLocaleDateString(i18n.language.startsWith("en") ? "en-US" : "vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

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
          <h1 className="truncate text-lg font-bold tracking-tight text-slate-900">{t(greetingKey, { name: displayName })}</h1>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <LanguageSwitcher />

        <NotificationBell />
        <UserGuideButton />
      </div>
    </header>
  );
}
