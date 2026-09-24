import { Bell, Menu } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "../store/hooks";

type AppHeaderProps = {
  onMenuClick?: () => void;
  fullName?: string | null;
};

export default function AppHeader({ onMenuClick, fullName }: AppHeaderProps) {
  const { t, i18n } = useTranslation();
  const auth = useAppSelector((state) => state.auth);
  const displayName = fullName?.trim() || auth.fullName?.trim() || auth.email?.trim() || "Người dùng";
  const currentDate = new Date().toLocaleDateString(i18n.language.startsWith("en") ? "en-US" : "vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return <header className="sticky top-0 z-20 flex h-18 items-center border-b border-slate-200/80 bg-white/90 px-5 pr-16 backdrop-blur lg:px-9 lg:pr-20">
    <div className="flex min-w-0 items-center gap-3">
      {onMenuClick && <button type="button" onClick={onMenuClick} className="rounded-lg p-2 hover:bg-slate-100 lg:hidden" aria-label="Open navigation"><Menu size={20} /></button>}
      <div className="min-w-0">
        <p className="text-xs font-medium capitalize text-slate-400">{currentDate}</p>
        <h1 className="truncate text-lg font-bold tracking-tight text-slate-900">{t("common.goodMorning", { name: displayName })}</h1>
      </div>
    </div>
    <div className="fixed right-5 top-4.5 z-30 flex h-9 w-9 items-center justify-center lg:right-9">
      <button type="button" className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Notifications"><Bell size={19} /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-orange-500 ring-2 ring-white" /></button>
    </div>
  </header>;
}
