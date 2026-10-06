import { useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, LoaderCircle, X } from "lucide-react";
import type { RoomImportRowResult } from "../lib/roomBulkImport";

type RoomImportProgressCardProps = {
  processing: boolean;
  rows: RoomImportRowResult[];
  archiveError?: string;
  liveProgress?: {
    percent: number | null;
    message: string;
    completed: boolean;
  };
  onDismiss: () => void;
};

export default function RoomImportProgressCard({
  processing,
  rows,
  archiveError,
  liveProgress,
  onDismiss,
}: RoomImportProgressCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const passedCount = rows.filter((row) => row.passed).length;
  const failedRows = rows.filter((row) => !row.passed);
  const isProcessing = liveProgress ? !liveProgress.completed : processing;
  const finishedWithErrors = !isProcessing && (failedRows.length > 0 || Boolean(archiveError));

  return (
    <div className="fixed bottom-5 right-5 z-[60] w-[min(26rem,calc(100vw-2.5rem))]">
      <section
        role="status"
        aria-live="polite"
        className={`overflow-hidden rounded-2xl border bg-white shadow-2xl shadow-slate-900/15 ${
          isProcessing ? "border-blue-200" : finishedWithErrors ? "border-rose-200" : "border-emerald-200"
        }`}
      >
        <div className={`h-1 ${isProcessing ? "bg-blue-600" : finishedWithErrors ? "bg-rose-500" : "bg-emerald-500"}`} />
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 rounded-full p-2 ${
              isProcessing ? "bg-blue-50 text-blue-600" : finishedWithErrors ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
            }`}>
              {isProcessing
                ? <LoaderCircle className="animate-spin" size={18} />
                : finishedWithErrors
                  ? <AlertCircle size={18} />
                  : <CheckCircle2 size={18} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {liveProgress
                      ? isProcessing ? "Đang nhập phòng" : failedRows.length > 0 ? "Nhập phòng hoàn tất · có dòng lỗi" : "Tiến trình nhập phòng hoàn tất"
                      : isProcessing ? "Đang kiểm tra dữ liệu phòng" : finishedWithErrors ? "Đã kiểm tra file phòng" : "Nhập phòng hoàn tất"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    {liveProgress
                      ? `${liveProgress.message}${rows.length ? ` · ${passedCount} dòng đạt · ${failedRows.length} dòng lỗi · ${rows.length} dòng tổng` : ""}`
                      : processing
                        ? "Đang đọc file ZIP và kiểm tra từng dòng..."
                      : archiveError
                        ? archiveError
                        : `${passedCount} dòng đạt · ${failedRows.length} dòng chưa đạt · ${rows.length} dòng tổng cộng`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onDismiss}
                  aria-label="Đóng thông báo nhập phòng"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={16} />
                </button>
              </div>

              {liveProgress?.percent !== null && liveProgress?.percent !== undefined && (
                <div className="mt-3">
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all ${isProcessing ? "bg-blue-600" : finishedWithErrors ? "bg-rose-500" : "bg-emerald-500"}`}
                      style={{ width: `${liveProgress.percent}%` }}
                    />
                  </div>
                  <p className="mt-1 text-right text-[11px] text-slate-500">{liveProgress.percent}%</p>
                </div>
              )}

              {rows.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDetailsOpen((open) => !open)}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800"
                >
                  {detailsOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  {detailsOpen ? "Ẩn chi tiết" : `Xem chi tiết từng dòng${failedRows.length ? ` (${failedRows.length} lỗi)` : ""}`}
                </button>
              )}

              {detailsOpen && (
                <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto border-t border-slate-100 pt-3">
                  {rows.map((row) => (
                    <li key={`${row.rowNumber}-${row.roomNumber}`} className="flex items-start gap-2 text-xs">
                      {row.passed
                        ? <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={15} />
                        : <AlertCircle className="mt-0.5 shrink-0 text-rose-600" size={15} />}
                      <span className={row.passed ? "text-slate-600" : "text-rose-700"}>
                        <strong>Dòng {row.rowNumber}{row.roomNumber ? ` · Phòng ${row.roomNumber}` : ""}:</strong>{" "}
                        {row.passed ? "Đạt theo trạng thái tiến trình." : row.message}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
