import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronUp, LogIn, LogOut } from "lucide-react";
import CheckoutSummary, { type CheckoutSummaryRoom } from "./CheckoutSummary";

type BatchStayItem = {
  id: string;
  badge?: string;
  title: string;
  subtitle: string;
  status?: string;
  amount?: string;
};

type BatchStayCardProps = {
  mode: "check-in" | "check-out";
  title: string;
  description: string;
  items: BatchStayItem[];
  selectedIds: string[];
  draftSelectedIds?: string[];
  actionLabel: string;
  actionCount?: number;
  actionDisabled?: boolean;
  checkoutSummaryRooms?: CheckoutSummaryRoom[];
  onAction: (selected: string[]) => void;
};

export default function BatchStayCard({ mode, title, description, items, selectedIds, draftSelectedIds, actionLabel, actionCount, actionDisabled, checkoutSummaryRooms, onAction }: BatchStayCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draftSelected, setDraftSelected] = useState<string[]>(draftSelectedIds ?? selectedIds ?? []);

  useEffect(() => {
    setDraftSelected(draftSelectedIds ?? selectedIds ?? []);
  }, [draftSelectedIds, selectedIds]);

  const isCheckIn = mode === "check-in";
  const colors = isCheckIn ? { border: "border-blue-200", background: "bg-blue-50/45", icon: "bg-blue-100 text-blue-700", button: "bg-blue-600 hover:bg-blue-700", selected: "border-blue-400 ring-blue-100", hover: "hover:border-blue-300", badge: "bg-blue-50 text-blue-700" } : { border: "border-amber-200", background: "bg-amber-50/45", icon: "bg-amber-100 text-amber-700", button: "bg-amber-600 hover:bg-amber-700", selected: "border-amber-400 ring-amber-100", hover: "hover:border-amber-300", badge: "bg-amber-50 text-amber-700" };

  const confirmedIds = new Set(selectedIds ?? []);
  const availableIds = items
    .map((item) => item.id)
    .filter((id) => !confirmedIds.has(id) && !draftSelected.includes(id));

  const toggleDraft = (id: string) => {
    if (confirmedIds.has(id)) return;
    setDraftSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleSelectAll = () => {
    setDraftSelected((current) => {
      const next = new Set(current);
      const allSelected = availableIds.every((id) => next.has(id));

      if (allSelected) {
        availableIds.forEach((id) => next.delete(id));
        return Array.from(next);
      }

      availableIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  };

  const hasDraftSelection = draftSelected.length > 0;
  const selectedCount = draftSelected.length;

  const handleConfirm = () => {
    if (!hasDraftSelection) return;
    onAction([...draftSelected]);
    setDraftSelected([]);
  };

  const handleClearDraft = () => {
    setDraftSelected([]);
  };

  return <section className={`m-4 rounded-xl border p-5 ${colors.border} ${colors.background}`}>
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border ${colors.icon} border-current/10 transition hover:opacity-90`}
          aria-label={isOpen ? "Thu gọn danh sách phòng" : "Mở danh sách phòng"}
        >
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${colors.icon}`}>{isCheckIn ? <LogIn size={17} /> : <LogOut size={17} />}</span>
        <div><h3 className="font-bold text-slate-900">{title}</h3><p className="mt-1 text-sm text-slate-600">{description}</p></div>
      </div>
      <button
        type="button"
        disabled={actionDisabled ?? availableIds.length === 0}
        onClick={toggleSelectAll}
        className={`flex w-56 shrink-0 items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-bold text-white ${colors.button} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <Check size={14} />
        {actionLabel} ({actionCount ?? availableIds.length})
      </button>
    </div>
    {isOpen && (
      <>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {items.map((item) => {
            const selected = draftSelected.includes(item.id);
            const alreadyConfirmed = confirmedIds.has(item.id);
            return <button
              type="button"
              key={item.id}
              onClick={() => toggleDraft(item.id)}
              disabled={alreadyConfirmed}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${alreadyConfirmed ? "cursor-not-allowed border-emerald-200 bg-emerald-50/70 opacity-80" : selected ? `${colors.selected} bg-white ring-2` : `border-slate-200 bg-white ${colors.hover}`}`}
            >
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${alreadyConfirmed ? "bg-emerald-100 text-emerald-700" : colors.badge}`}>{item.badge || item.id.slice(-2)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-800">{item.title}</span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">{item.subtitle}</span>
              </span>
              {alreadyConfirmed ? (
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">Đã xác nhận</span>
              ) : isCheckIn ? (
                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${selected ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{selected ? "Đã chọn" : "Chờ check-in"}</span>
              ) : (
                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${selected ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{selected ? "Đã chọn" : "Chờ check-out"}</span>
              )}
            </button>;
            })}
          </div>

        {mode === "check-out" && checkoutSummaryRooms && checkoutSummaryRooms.length > 0 && <div className="mt-4 border-t border-slate-200/80 pt-4"><CheckoutSummary rooms={checkoutSummaryRooms} compact /></div>}

      </>
    )}
    <div className="mt-4 border-t border-slate-200/80 pt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {hasDraftSelection ? `${selectedCount} phòng đã chọn` : "Chưa chọn phòng nào"}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!hasDraftSelection}
            onClick={handleClearDraft}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Bỏ chọn
          </button>
          <button
            type="button"
            disabled={!hasDraftSelection}
            onClick={handleConfirm}
            className={`flex w-56 shrink-0 items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-bold text-white ${colors.button} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Check size={14} />
            {isCheckIn ? "Xác nhận" : "Thanh toán & Check-out"} ({selectedCount})
          </button>
        </div>
      </div>
    </div>
  </section>;
}
