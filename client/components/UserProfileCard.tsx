import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";

type UserProfileCardProps = {
  onLogout: () => void;
  fullName?: string | null;
  position?: string | null;
};

export default function UserProfileCard({ onLogout, fullName, position }: UserProfileCardProps) {
  const { t } = useTranslation();
  const displayName = fullName?.trim() || "Người dùng";
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mt-4 shrink-0 rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-2.5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f6c8a4] text-xs font-bold text-[#6f3c25]">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-white">{displayName}</p>
            <p className="text-[10px] text-slate-400">{position?.trim() || t("common.branchManager")}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          aria-label={t("auth.logout", "Đăng xuất")}
          title={t("auth.logout", "Đăng xuất")}
          className="ml-auto rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          <LogOut size={15} />
        </button>
      </div>
    </div>
  );
}
