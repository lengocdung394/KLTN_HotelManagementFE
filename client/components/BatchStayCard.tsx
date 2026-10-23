import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, ChevronUp, Eye, LogIn, LogOut } from "lucide-react";
import { localizedText } from "../i18n";

type BatchStayItem = {
  id: string;
  badge?: string;
  title: string;
  subtitle: string;
  status?: string;
  amount?: string;
  roomPaid?: boolean;
};

type BatchStayCardProps = {
  mode: "check-in" | "check-out";
  title: string;
  description: string;
  bookingCode?: string;
  identityNumber?: string;
  items: BatchStayItem[];
  selectedIds: string[];
  draftSelectedIds?: string[];
  actionLabel: string;
  actionCount?: number;
  actionDisabled?: boolean;
  showAction?: boolean;
  showSelectionFooter?: boolean;
  onAddService?: () => void;
  onViewBooking?: () => void;
  onAction: (selected: string[]) => void;
};

export default function BatchStayCard({ mode, title, description, bookingCode, identityNumber, items, selectedIds, draftSelectedIds, actionLabel, actionCount, actionDisabled, showAction = true, showSelectionFooter = true, onAddService, onViewBooking, onAction }: BatchStayCardProps) {
  useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [draftSelected, setDraftSelected] = useState<string[]>(draftSelectedIds ?? selectedIds ?? []);

  useEffect(() => {
    setDraftSelected(draftSelectedIds ?? selectedIds ?? []);
  }, [draftSelectedIds, selectedIds]);

  const isCheckIn = mode === "check-in";
  const colors = isCheckIn ? { border: "border-blue-200", background: "bg-blue-50/45", icon: "bg-blue-100 text-blue-700", button: "bg-blue-600 hover:bg-blue-700", selected: "border-blue-400 ring-blue-100", hover: "hover:border-blue-300", badge: "bg-blue-50 text-blue-700" } : { border: "border-amber-200", background: "bg-amber-50/45", icon: "bg-amber-100 text-amber-700", button: "bg-amber-600 hover:bg-amber-700", selected: "border-amber-400 ring-amber-100", hover: "hover:border-amber-300", badge: "bg-amber-50 text-amber-700" };

  const confirmedIds = new Set(selectedIds ?? []);
  const paymentStates = items.flatMap((item) => item.roomPaid === undefined ? [] : [item.roomPaid]);
  const groupRoomPaid = paymentStates.length > 0 ? paymentStates.every(Boolean) : undefined;
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

  return <section className={`m-4 overflow-hidden rounded-2xl border shadow-sm ${colors.border} ${colors.background}`}>
    <div className="p-4 sm:p-5">
      <div className="flex min-w-0 items-start gap-3">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${colors.icon} border-current/10 transition hover:opacity-90`}
          aria-label={isOpen ? localizedText("Thu gọn danh sách phòng", "Collapse room list") : localizedText("Mở danh sách phòng", "Expand room list")}
        >
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${colors.icon}`}>{isCheckIn ? <LogIn size={17} /> : <LogOut size={17} />}</span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            {identityNumber && <span className="text-sm text-slate-500">{localizedText("CCCD", "National ID")}: <strong className="text-slate-700">{identityNumber}</strong></span>}
          </div>
          {bookingCode && <p className="mt-1 text-sm font-medium text-slate-500">{localizedText("Mã booking", "Booking ID")}: <strong className="text-slate-700">{bookingCode}</strong></p>}
          <p className={`${bookingCode ? "mt-0.5" : "mt-1"} text-sm text-slate-600`}>{description}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200/70 pt-4">
        <div className="mr-auto hidden min-w-0 flex-1 text-xs text-slate-500 sm:block">
          {localizedText("Booking gồm", "Booking includes")} <strong className="font-semibold text-slate-700">{items.length} {localizedText("phòng", "rooms")}</strong>
        </div>
        {groupRoomPaid !== undefined && (
          <span className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold ${groupRoomPaid ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${groupRoomPaid ? "bg-emerald-500" : "bg-rose-500"}`} />
            {groupRoomPaid ? localizedText("Đã thanh toán", "Paid") : localizedText("Chưa thanh toán", "Unpaid")}
          </span>
        )}
        {onViewBooking && <button type="button" onClick={onViewBooking} aria-label={localizedText("Xem chi tiết booking nhóm", "View group booking details")} title={localizedText("Xem chi tiết booking", "View booking details")} className="inline-flex h-10 w-36 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><Eye size={16} />{localizedText("Xem chi tiết", "View details")}</button>}
        {onAddService && <button type="button" onClick={onAddService} className="inline-flex h-10 w-36 shrink-0 items-center justify-center rounded-lg border border-blue-200 px-3 text-xs font-bold text-blue-700 hover:bg-blue-50">{localizedText("Thêm dịch vụ", "Add service")}</button>}
        {showAction && (
          <button type="button" disabled={actionDisabled ?? availableIds.length === 0} onClick={toggleSelectAll} className={`flex h-10 w-36 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-bold text-white ${colors.button} disabled:cursor-not-allowed disabled:opacity-50`}>
            <Check size={14} />
            {isCheckIn
              ? localizedText("Check-in", "Check in")
              : localizedText("Check-out", "Check out")} ({actionCount ?? availableIds.length})
          </button>
        )}
      </div>
    </div>
    {isOpen && (
      <>
        <div className="grid gap-3 border-t border-slate-200/70 bg-white/60 p-4 sm:grid-cols-2 sm:p-5">
          {items.map((item) => {
            const selected = draftSelected.includes(item.id);
            const alreadyConfirmed = confirmedIds.has(item.id);
            return <button
              type="button"
              key={item.id}
              onClick={() => toggleDraft(item.id)}
              disabled={alreadyConfirmed}
              className={`flex min-h-[4.5rem] items-center gap-3 rounded-xl border p-4 text-left transition ${alreadyConfirmed ? "cursor-not-allowed border-emerald-200 bg-emerald-50/70 opacity-80" : selected ? `${colors.selected} bg-white ring-2` : `border-slate-200 bg-white ${colors.hover}`}`}
            >
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${alreadyConfirmed ? "bg-emerald-100 text-emerald-700" : colors.badge}`}>{item.badge || item.id.slice(-2)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-800">{item.title}</span>
                {item.subtitle && <span className="mt-0.5 block truncate text-xs text-slate-500">{item.subtitle}</span>}
              </span>
              <span className="ml-auto flex shrink-0 items-center gap-2">
                {alreadyConfirmed ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">{localizedText("Đã xác nhận", "Confirmed")}</span>
                ) : isCheckIn ? (
                  <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${selected ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{selected ? localizedText("Đã chọn", "Selected") : localizedText("Chờ check-in", "Awaiting check-in")}</span>
                ) : (
                  <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${selected ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{selected ? localizedText("Đã chọn", "Selected") : localizedText("Chờ check-out", "Awaiting check-out")}</span>
                )}
              </span>
            </button>;
            })}
          </div>

      </>
    )}
    {showSelectionFooter && (
    <div className="border-t border-slate-200/70 bg-white/50 px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          {hasDraftSelection ? `${selectedCount} ${localizedText("phòng đã chọn", "rooms selected")}` : localizedText("Chưa chọn phòng nào", "No rooms selected")}
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={!hasDraftSelection}
            onClick={handleClearDraft}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {localizedText("Bỏ chọn", "Clear selection")}
          </button>
          <button
            type="button"
            disabled={!hasDraftSelection}
            onClick={handleConfirm}
            className={`flex h-10 w-56 shrink-0 items-center justify-center gap-1.5 rounded-lg px-4 text-xs font-bold text-white ${colors.button} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Check size={14} />
            {localizedText("Xác nhận", "Confirm")} ({selectedCount})
          </button>
        </div>
      </div>
    </div>
    )}
  </section>;
}
