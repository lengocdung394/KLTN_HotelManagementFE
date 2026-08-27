import { Bell, Menu } from "lucide-react";
import { useTranslation } from "react-i18next";

type AppHeaderProps = {
  onMenuClick?: () => void;
};

export default function AppHeader({ onMenuClick }: AppHeaderProps) {
  const { t } = useTranslation();

  return <header className="sticky top-0 z-20 flex h-18 items-center justify-between border-b border-slate-200/80 bg-white/90 px-5 backdrop-blur lg:px-9">
    <div className="flex min-w-0 items-center gap-3">
      {onMenuClick && <button type="button" onClick={onMenuClick} className="rounded-lg p-2 hover:bg-slate-100 lg:hidden" aria-label="Open navigation"><Menu size={20} /></button>}
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-400">{t("common.dateLabel")}</p>
        <h1 className="truncate text-lg font-bold tracking-tight text-slate-900">{t("common.goodMorning", { name: "Linh" })}</h1>
      </div>
    </div>
    <div className="flex shrink-0 items-center gap-2 sm:gap-4">
      <button type="button" className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Notifications"><Bell size={19} /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-orange-500 ring-2 ring-white" /></button>
      <div className="hidden h-7 w-px bg-slate-200 sm:block" />
      <div className="flex items-center gap-2"><div className="grid h-8 w-8 place-items-center rounded-full bg-[#f6c8a4] text-[11px] font-bold text-[#6f3c25]">LT</div><span className="hidden text-sm font-semibold sm:block">Linh Trần</span></div>
    </div>
  </header>;
}
