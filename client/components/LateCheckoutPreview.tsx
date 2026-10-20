import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Clock3, LogOut, Search } from "lucide-react";
import { localizedText } from "../i18n";

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

const formatDateTime = (value: string | undefined, language: string) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString(language.startsWith("en") ? "en-US" : "vi-VN", { dateStyle: "short", timeStyle: "short" });
};

type LateCheckoutPreviewProps = {
  records: LateCheckoutRecord[];
  isLoading?: boolean;
  isError?: boolean;
  onCheckout?: (record: LateCheckoutRecord) => void;
};

export default function LateCheckoutPreview({ records, isLoading = false, isError = false, onCheckout }: LateCheckoutPreviewProps) {
  const { i18n } = useTranslation();
  const language = i18n.language;
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
          <h3 id="late-checkout-title" className="text-sm font-bold text-slate-800">{localizedText("Phòng đang check-out trễ", "Late check-out rooms")}</h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{records.length}</span>
        </div>
      </div>
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label={localizedText("Lọc mức check-out trễ", "Filter late check-out level")} className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
          <button type="button" role="tab" aria-selected={activeLevel === "all"} onClick={() => setActiveLevel("all")} className={`rounded-md px-3 py-2 text-xs font-semibold ${activeLevel === "all" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{localizedText("Tất cả", "All")} ({records.length})</button>
          {levels.map((level) => (
            <button key={level} type="button" role="tab" aria-selected={activeLevel === level} onClick={() => setActiveLevel(level)} className={`rounded-md px-3 py-2 text-xs font-semibold ${activeLevel === level ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
              {level} ({counts[level]})
            </button>
          ))}
        </div>
        <label className="relative block w-full lg:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={localizedText("Tìm phòng, khách, mã booking", "Search room, guest, or booking ID")} aria-label={localizedText("Tìm phòng check-out trễ", "Search late check-out rooms")} className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
        </label>
      </div>
      {isLoading ? (
        <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">{localizedText("Đang tải danh sách check-out...", "Loading check-out list...")}</p>
      ) : isError ? (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-4 text-center text-sm text-rose-700">{localizedText("Không tải được danh sách check-out. Vui lòng thử lại.", "Could not load check-out list. Please try again.")}</p>
      ) : filteredRecords.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">{localizedText("Không có phòng check-out trễ.", "No late check-out rooms.")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-250 border-collapse text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5">{localizedText("Phòng", "Room")}</th>
                <th className="px-3 py-2.5">{localizedText("Khách hàng", "Guest")}</th>
                <th className="px-3 py-2.5">{localizedText("Mã booking", "Booking ID")}</th>
                <th className="px-3 py-2.5">{localizedText("Giờ trả dự kiến", "Scheduled check-out")}</th>
                <th className="px-3 py-2.5">{localizedText("Thời điểm cập nhật", "Last updated")}</th>
                <th className="px-3 py-2.5">{localizedText("Đã trễ", "Overdue by")}</th>
                <th className="px-3 py-2.5">{localizedText("Mức trễ", "Level")}</th>
                <th className="px-3 py-2.5">{localizedText("Phụ thu", "Surcharge")}</th>
                <th className="px-3 py-2.5 text-right">{localizedText("Thao tác", "Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredRecords.map((record) => (
                <tr key={record.recordId} className="text-slate-700 hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-900">{record.room}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{record.guest}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-medium">{record.bookingId}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{formatDateTime(record.scheduledCheckout, language)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{formatDateTime(record.currentTime, language)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-semibold">{record.overdueDuration}</td>
                  <td className="whitespace-nowrap px-3 py-2.5"><span title={`${localizedText("Dự kiến", "Scheduled")}: ${formatDateTime(record.scheduledCheckout, language)} · ${localizedText("Hiện tại", "Current")}: ${formatDateTime(record.currentTime, language)}`} className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ring-inset ${levelStyle(record.level)}`}>{record.level}</span></td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-semibold">{record.currentSurcharge == null ? "-" : `${record.currentSurcharge.toLocaleString(language.startsWith("en") ? "en-US" : "vi-VN")}${language.startsWith("en") ? " VND" : "đ"}`}</td>
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
