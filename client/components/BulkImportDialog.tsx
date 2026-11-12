import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Download, Upload, X } from "lucide-react";
import { localizedText } from "../i18n";

type BulkImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eyebrow: string;
  title: string;
  description: string;
  templateLabel: string;
  onDownloadTemplate: () => void;
  acceptedFileTypes: string;
  fileLabel: string;
  instructions: ReactNode;
  uploadLabel: string;
  validateFile?: (file: File) => string | null;
  progress?: string;
  progressPercent?: number;
  onUpload: (file: File) => Promise<boolean>;
};

export default function BulkImportDialog({
  open,
  onOpenChange,
  eyebrow,
  title,
  description,
  templateLabel,
  onDownloadTemplate,
  acceptedFileTypes,
  fileLabel,
  instructions,
  uploadLabel,
  validateFile,
  progress,
  progressPercent,
  onUpload,
}: BulkImportDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const selectFile = (file: File | undefined) => {
    if (!file) {
      setSelectedFile(null);
      setUploadError("");
      return;
    }
    const validationError = validateFile?.(file) ?? null;
    setSelectedFile(validationError ? null : file);
    setUploadError(validationError ?? "");
  };

  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      setUploadError("");
    }
  }, [open]);

  if (!open) return null;

  const upload = async () => {
    if (!selectedFile || isUploading) return;
    setUploadError("");
    setIsUploading(true);
    try {
      if (await onUpload(selectedFile)) onOpenChange(false);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : t("room.importDialog.uploadFailed"));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-[1px]"
      onMouseDown={() => {
        if (!isUploading) onOpenChange(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="my-auto max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-blue-600">{eyebrow}</p>
            <h4 id={titleId} className="mt-1 font-serif text-lg font-bold text-slate-900">{title}</h4>
            <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
          </div>
          <button
            type="button"
            disabled={isUploading}
            onClick={() => onOpenChange(false)}
            aria-label={t("common.close")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <button
          type="button"
          onClick={onDownloadTemplate}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
        >
          <Download size={17} />{templateLabel}
        </button>

        <div className="mt-4 rounded-lg border border-slate-200 p-3.5">
          <div className="text-sm font-semibold text-slate-800">{fileLabel}</div>
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedFileTypes}
            disabled={isUploading}
            onChange={(event) => selectFile(event.target.files?.[0])}
            className="sr-only"
            aria-label={fileLabel}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
            >
              {localizedText("Chọn tệp", "Choose file")}
            </button>
            <span className="min-w-0 truncate text-sm text-slate-500">
              {selectedFile?.name ?? localizedText("Chưa có tệp nào được chọn", "No file selected")}
            </span>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-700">
          {instructions}
        </div>

        {uploadError && (
          <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {uploadError}
          </p>
        )}

        {progress && (
          <div role="status" className="mt-4 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">
            <p>{progress}</p>
            {progressPercent !== undefined && (
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-blue-100"
                role="progressbar"
                aria-label={t("room.importDialog.progressLabel")}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPercent}
              >
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
                />
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            disabled={isUploading}
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={isUploading || !selectedFile}
            onClick={() => void upload()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload size={16} />{isUploading ? t("room.importDialog.uploading") : uploadLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
