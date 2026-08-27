import { Check, LogIn, LogOut } from "lucide-react";

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
  actionLabel: string;
  actionCount?: number;
  actionDisabled?: boolean;
  onToggle: (id: string) => void;
  onAction: () => void;
};

export default function BatchStayCard({ mode, title, description, items, selectedIds, actionLabel, actionCount, actionDisabled, onToggle, onAction }: BatchStayCardProps) {
  const isCheckIn = mode === "check-in";
  const colors = isCheckIn ? { border: "border-blue-200", background: "bg-blue-50/45", icon: "bg-blue-100 text-blue-700", button: "bg-blue-600 hover:bg-blue-700", selected: "border-blue-400 ring-blue-100", hover: "hover:border-blue-300", badge: "bg-blue-50 text-blue-700" } : { border: "border-amber-200", background: "bg-amber-50/45", icon: "bg-amber-100 text-amber-700", button: "bg-amber-600 hover:bg-amber-700", selected: "border-amber-400 ring-amber-100", hover: "hover:border-amber-300", badge: "bg-amber-50 text-amber-700" };
  return <section className={`m-4 rounded-xl border p-5 ${colors.border} ${colors.background}`}>
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex items-start gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${colors.icon}`}>{isCheckIn ? <LogIn size={17} /> : <LogOut size={17} />}</span>
        <div><h3 className="font-bold text-slate-900">{title}</h3><p className="mt-1 text-sm text-slate-600">{description}</p></div>
      </div>
      <button type="button" disabled={actionDisabled ?? selectedIds.length === 0} onClick={onAction} className={`flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-bold text-white ${colors.button} disabled:cursor-not-allowed disabled:opacity-50`}><Check size={14} />{actionLabel} ({actionCount ?? selectedIds.length})</button>
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {items.map((item) => { const selected = selectedIds.includes(item.id); return <button type="button" key={item.id} onClick={() => onToggle(item.id)} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${selected ? `${colors.selected} bg-white ring-2` : `border-slate-200 bg-white ${colors.hover}`}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${colors.badge}`}>{item.badge || item.id.slice(-2)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{item.title}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{item.subtitle}</span></span>{isCheckIn ? <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${selected ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{selected ? "Đã check-in" : "Chờ check-in"}</span> : <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${selected ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{selected ? "Đã chọn" : "Chờ check-out"}</span>}</button>; })}
    </div>
  </section>;
}
