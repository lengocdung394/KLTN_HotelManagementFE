import { useState } from "react";
import { Clock3, LogOut, Search } from "lucide-react";

export type LateCheckoutLevel = string;

export type LateCheckoutRecord = {
  recordId: string;
  room: string;
  guest: string;
  bookingId: string;
  overdueDuration: string;
  level: LateCheckoutLevel;
  scheduledCheckout?: string;
  currentTime?: string;
  currentSurcharge?: number;
};

const levelStyle = (level: LateCheckoutLevel) => {
  const normalized = level.toUpperCase();
  if (normalized.includes("3") || normalized.includes("AFTER_18") || normalized.includes("AFTER18")) return "bg-rose-50 text-rose-800 ring-rose-200";
  if (normalized.includes("2") || normalized.includes("15_18") || normalized.includes("15-18")) return "bg-orange-50 text-orange-800 ring-orange-200";
  if (normalized.includes("1") || normalized.includes("12_30") || normalized.includes("12:30")) return "bg-amber-50 text-amber-800 ring-amber-200";
  return "bg-slate-50 text-slate-700 ring-slate-200";
};

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
};

type LateCheckoutPreviewProps = {
  records: LateCheckoutRecord[];
  isLoading?: boolean;
  isError?: boolean;
  onCheckout?: (record: LateCheckoutRecord) => void;
};

export default function LateCheckoutPreview({ records, isLoading = false, isError = false, onCheckout }: LateCheckoutPreviewProps) {
  const [query, setQuery] = useState("");
  const [activeLevel, setActiveLevel] = useState<LateCheckoutLevel | "all">("all");
  const levels = [...new Set(records.map((record) => record.level).filter(Boolean))];
  const counts = Object.fromEntries(levels.map((level) => [level, records.filter((record) => record.level === level).length])) as Record<LateCheckoutLevel, number>;
  const filteredRecords = records.filter((record) => {
    const searchMatches = `${record.room} ${record.guest} ${record.bookingId} ${record.level}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    return searchMatches && (activeLevel === "all" || record.level === activeLevel);
  });

  return (
    <section className="border-b border-slate-100 bg-white px-4 py-4" aria-labelledby="late-checkout-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock3 size={16} className="text-amber-600" />
          <h3 id="late-checkout-title" className="text-sm font-bold text-slate-800">Phòng đang check-out trễ</h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{records.length}</span>
        </div>
      </div>
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label="Lọc mức check-out trễ" className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
          <button type="button" role="tab" aria-selected={activeLevel === "all"} onClick={() => setActiveLevel("all")} className={`rounded-md px-3 py-2 text-xs font-semibold ${activeLevel === "all" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>Tất cả ({records.length})</button>
          {levels.map((level) => (
            <button key={level} type="button" role="tab" aria-selected={activeLevel === level} onClick={() => setActiveLevel(level)} className={`rounded-md px-3 py-2 text-xs font-semibold ${activeLevel === level ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
              {level} ({counts[level]})
            </button>
          ))}
        </div>
        <label className="relative block w-full lg:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm phòng, khách, mã booking" aria-label="Tìm phòng check-out trễ" className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
        </label>
      </div>
      {isLoading ? (
        <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">Đang tải danh sách check-out...</p>
      ) : isError ? (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-4 text-center text-sm text-rose-700">Không tải được danh sách check-out. Vui lòng thử lại.</p>
      ) : filteredRecords.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">Không có phòng check-out trễ.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-250 border-collapse text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Phòng</th>
                <th className="px-3 py-2.5">Khách hàng</th>
                <th className="px-3 py-2.5">Mã booking</th>
                <th className="px-3 py-2.5">Giờ trả dự kiến</th>
                <th className="px-3 py-2.5">Thời điểm cập nhật</th>
                <th className="px-3 py-2.5">Đã trễ</th>
                <th className="px-3 py-2.5">Mức trễ</th>
                <th className="px-3 py-2.5">Phụ thu</th>
                <th className="px-3 py-2.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredRecords.map((record) => (
                <tr key={record.recordId} className="text-slate-700 hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-900">{record.room}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{record.guest}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-medium">{record.bookingId}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{formatDateTime(record.scheduledCheckout)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{formatDateTime(record.currentTime)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-semibold">{record.overdueDuration}</td>
                  <td className="whitespace-nowrap px-3 py-2.5"><span title={`Dự kiến: ${formatDateTime(record.scheduledCheckout)} · Hiện tại: ${formatDateTime(record.currentTime)}`} className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ring-inset ${levelStyle(record.level)}`}>{record.level}</span></td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-semibold">{record.currentSurcharge == null ? "-" : `${record.currentSurcharge.toLocaleString("vi-VN")}đ`}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right"><button type="button" onClick={() => onCheckout?.(record)} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-amber-600 px-3 text-xs font-semibold text-white transition hover:bg-amber-700"><LogOut size={14} />Check-out</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
