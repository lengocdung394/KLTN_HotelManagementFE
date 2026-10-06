import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, LoaderCircle, X } from "lucide-react";
import type { ServiceImportRowResult } from "../lib/serviceBulkImport";
import {
  getServiceImportErrorMessage,
  getServiceImportStatus,
  isServiceImportFinished,
  isServiceImportFailed,
  type ServiceImportTaskStatus,
} from "../services/serviceImportApi";

type ServiceImportProgressDialogProps = {
  taskId: string;
  onDismiss: () => void;
  onFinished: (status: ServiceImportTaskStatus) => void;
  validationRows?: ServiceImportRowResult[];
  archiveError?: string;
  validationOnly?: boolean;
  liveStatus?: ServiceImportTaskStatus;
};

const getProgressValue = (status: ServiceImportTaskStatus) => {
  const explicitProgress = status.progressPercentage ?? status.percentage ?? status.progress;
  if (typeof explicitProgress === "number" && Number.isFinite(explicitProgress)) {
    return Math.min(100, Math.max(0, explicitProgress));
  }

  const processed = status.processedCount ?? status.processed;
  const total = status.totalCount ?? status.total;
  if (typeof processed === "number" && typeof total === "number" && total > 0) {
    return Math.min(100, Math.max(0, (processed / total) * 100));
  }
  return null;
};

const getStatusLabel = (status?: string) => {
  switch (status?.trim().toUpperCase()) {
    case "PENDING":
    case "QUEUED":
      return "Đang chờ xử lý";
    case "PROCESSING":
    case "IN_PROGRESS":
      return "Đang nhập dịch vụ";
    case "COMPLETED":
    case "COMPLETE":
    case "SUCCESS":
    case "SUCCEEDED":
    case "DONE":
      return "Đã nhập xong";
    case "FAILED":
    case "ERROR":
      return "Nhập dịch vụ thất bại";
    default:
      return status || "Đang kiểm tra tiến trình";
  }
};

export default function ServiceImportProgressCard({
  taskId,
  onDismiss,
  onFinished,
  validationRows = [],
  archiveError,
  validationOnly = false,
  liveStatus,
}: ServiceImportProgressDialogProps) {
  const [status, setStatus] = useState<ServiceImportTaskStatus | null>(null);
  const [pollingError, setPollingError] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (!taskId) return;
    const controller = new AbortController();
    let timer: number | undefined;

    const poll = async () => {
      try {
        const nextStatus = await getServiceImportStatus(taskId, controller.signal);
        if (controller.signal.aborted) return;
        setStatus(nextStatus);
        setPollingError("");

        if (isServiceImportFinished(nextStatus)) {
          onFinished(nextStatus);
          return;
        }
        timer = window.setTimeout(() => void poll(), 1500);
      } catch (error) {
        if (controller.signal.aborted) return;
        setPollingError(getServiceImportErrorMessage(error));
      }
    };

    void poll();
    return () => {
      controller.abort();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [onFinished, taskId]);

  const visibleStatus = liveStatus?.taskId === taskId
    ? { ...status, ...liveStatus }
    : status;
  const finished = Boolean((visibleStatus && isServiceImportFinished(visibleStatus)) || validationOnly || archiveError);
  const failed = Boolean((visibleStatus && isServiceImportFailed(visibleStatus)) || archiveError);
  const progress = visibleStatus ? getProgressValue(visibleStatus) : null;
  const processed = visibleStatus?.processedCount ?? visibleStatus?.processed;
  const total = visibleStatus?.totalCount ?? visibleStatus?.total;
  const validRows = validationRows.filter((row) => row.passed);
  const invalidRows = validationRows.filter((row) => !row.passed);
  const validationFinished = validationRows.length > 0 && finished;

  return (
    <div className="fixed bottom-5 right-5 z-[60] w-[min(26rem,calc(100vw-2.5rem))]">
      <div
        role="status"
        aria-live="polite"
        className={`overflow-hidden rounded-2xl border bg-white shadow-2xl shadow-slate-900/15 ${
          failed || pollingError
            ? "border-rose-200"
            : finished
              ? "border-emerald-200"
              : "border-blue-200"
        }`}
      >
        <div className={`h-1 ${failed || pollingError ? "bg-rose-500" : finished ? "bg-emerald-500" : "bg-blue-600"}`} />
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 rounded-full p-2 ${
              failed || pollingError
                ? "bg-rose-50 text-rose-600"
                : finished
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-blue-50 text-blue-600"
            }`}>
              {pollingError ? (
                <AlertCircle size={18} />
              ) : finished && !failed ? (
                <CheckCircle2 size={18} />
              ) : failed ? (
                <AlertCircle size={18} />
              ) : (
                <LoaderCircle className="animate-spin" size={18} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {archiveError ? "Không thể đọc file dịch vụ" : pollingError ? "Không thể kiểm tra tiến trình"                     : validationOnly ? "Đã kiểm tra file dịch vụ" : getStatusLabel(visibleStatus?.status)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    {archiveError || pollingError || visibleStatus?.message || (validationOnly ? "Không có dòng hợp lệ để gửi nhập." : "File đã được gửi lên và đang được xử lý.")}
                  </p>
                </div>
                {(finished || pollingError || archiveError) && (
                  <button
                    type="button"
                    onClick={onDismiss}
                    aria-label="Đóng thông báo tiến trình"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <div
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-label="Tiến trình nhập dịch vụ"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress ?? undefined}
              >
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    failed || pollingError ? "bg-rose-500" : finished ? "bg-emerald-500" : "bg-blue-600"
                  } ${progress === null && !finished && !pollingError ? "w-1/3 animate-pulse" : ""}`}
                  style={progress === null ? undefined : { width: `${progress}%` }}
                />
              </div>
              {typeof processed === "number" && typeof total === "number" && (
                <p className="mt-1 text-right text-[11px] text-slate-500">{processed}/{total} mục đã xử lý</p>
              )}
              {validationRows.length > 0 && (
                <>
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold">
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <CheckCircle2 size={14} />{validRows.length} dòng đạt
                    </span>
                    <span className={`inline-flex items-center gap-1 ${invalidRows.length ? "text-rose-700" : "text-slate-500"}`}>
                      <AlertCircle size={14} />{invalidRows.length} dòng lỗi
                    </span>
                    <span className="text-slate-500">{validationRows.length} dòng tổng cộng</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailsOpen((open) => !open)}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800"
                  >
                    {detailsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {detailsOpen ? "Ẩn chi tiết" : `Xem chi tiết${invalidRows.length ? ` (${invalidRows.length} lỗi)` : ""}`}
                  </button>
                  {detailsOpen && (
                    <ul className="mt-2 max-h-52 space-y-2 overflow-y-auto border-t border-slate-100 pt-2">
                      {validationRows.map((row) => (
                        <li key={`${row.rowNumber}-${row.serviceName}`} className={`flex items-start gap-2 text-xs ${row.passed ? "text-slate-600" : "text-rose-700"}`}>
                          {row.passed
                            ? <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={14} />
                            : <AlertCircle className="mt-0.5 shrink-0 text-rose-600" size={14} />}
                          <span><strong>Dòng {row.rowNumber}{row.serviceName ? ` · ${row.serviceName}` : ""}:</strong> {row.passed ? "Đạt kiểm tra dữ liệu." : row.message}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {validationFinished && (
                    <p className="mt-2 text-[11px] leading-4 text-slate-500">
                      Các dấu đạt/lỗi là kết quả kiểm tra file trước khi gửi; tiến trình máy chủ hiển thị riêng ở phía trên.
                    </p>
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
