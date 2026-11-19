import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  X,
} from "lucide-react";
import { localizedText } from "../i18n";
import type { EmployeeImportRowResult } from "../lib/employeeBulkImport";

type EmployeeImportProgressCardProps = {
  progress: string;
  progressPercent?: number;
  rows: EmployeeImportRowResult[];
  finished: boolean;
  archiveError?: string;
  onDismiss: () => void;
};

export default function EmployeeImportProgressCard({
  progress,
  progressPercent,
  rows,
  finished,
  archiveError,
  onDismiss,
}: EmployeeImportProgressCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const validRows = rows.filter((row) => row.passed);
  const invalidRows = rows.filter((row) => !row.passed);
  const failed = Boolean(archiveError);
  const statusLabel = archiveError
    ? localizedText("Không thể đọc file nhập", "Could not read import file")
    : finished
      ? localizedText("Hoàn tất nhập nhân viên", "Employee import complete")
      : localizedText("Đang nhập nhân viên", "Importing employees");

  return (
    <div className="fixed bottom-5 right-5 z-[60] w-[min(26rem,calc(100vw-2.5rem))]">
      <div
        role="status"
        aria-live="polite"
        className={`overflow-hidden rounded-2xl border bg-white shadow-2xl shadow-slate-900/15 ${
          failed ? "border-rose-200" : finished ? "border-emerald-200" : "border-blue-200"
        }`}
      >
        <div className={`h-1 ${failed ? "bg-rose-500" : finished ? "bg-emerald-500" : "bg-blue-600"}`} />
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 rounded-full p-2 ${
              failed
                ? "bg-rose-50 text-rose-600"
                : finished
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-blue-50 text-blue-600"
            }`}>
              {finished && !failed
                ? <CheckCircle2 size={18} />
                : failed
                  ? <AlertCircle size={18} />
                  : <LoaderCircle className="animate-spin" size={18} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{statusLabel}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    {archiveError || progress || localizedText("Đang kiểm tra dữ liệu...", "Checking data...")}
                  </p>
                </div>
                {(finished || failed) && (
                  <button
                    type="button"
                    onClick={onDismiss}
                    aria-label={localizedText("Đóng tiến trình nhập", "Dismiss import progress")}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <div
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-label={localizedText("Tiến trình nhập nhân viên", "Employee import progress")}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPercent}
              >
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    failed ? "bg-rose-500" : finished ? "bg-emerald-500" : "bg-blue-600"
                  } ${progressPercent === undefined && !finished && !failed ? "w-1/3 animate-pulse" : ""}`}
                  style={progressPercent === undefined ? undefined : { width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
                />
              </div>

              {rows.length > 0 && (
                <>
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold">
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <CheckCircle2 size={14} />
                      {localizedText(`${validRows.length} dòng hợp lệ`, `${validRows.length} valid rows`)}
                    </span>
                    <span className={`inline-flex items-center gap-1 ${invalidRows.length ? "text-rose-700" : "text-slate-500"}`}>
                      <AlertCircle size={14} />
                      {localizedText(`${invalidRows.length} dòng lỗi`, `${invalidRows.length} invalid rows`)}
                    </span>
                    <span className="text-slate-500">
                      {localizedText(`${rows.length} dòng tổng`, `${rows.length} total rows`)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailsOpen((open) => !open)}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800"
                  >
                    {detailsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {detailsOpen
                      ? localizedText("Ẩn chi tiết", "Hide details")
                      : localizedText("Xem chi tiết", "View details")}
                  </button>
                  {detailsOpen && (
                    <ul className="mt-2 max-h-52 space-y-2 overflow-y-auto border-t border-slate-100 pt-2">
                      {rows.map((row) => (
                        <li key={row.rowNumber} className={`flex items-start gap-2 text-xs ${row.passed ? "text-slate-600" : "text-rose-700"}`}>
                          {row.passed
                            ? <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={14} />
                            : <AlertCircle className="mt-0.5 shrink-0 text-rose-600" size={14} />}
                          <span>
                            <strong>{localizedText("Dòng", "Row")} {row.rowNumber}{row.fullName ? ` · ${row.fullName}` : ""}:</strong>{" "}
                            {row.message || localizedText("Hợp lệ.", "Valid.")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
