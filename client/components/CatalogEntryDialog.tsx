import type { ReactNode } from "react";
import { FileSpreadsheet, Plus, X } from "lucide-react";

export type CatalogEntryMode = "manual" | "file";

type CatalogEntryDialogProps = {
  title: string;
  description: string;
  mode: CatalogEntryMode;
  onModeChange: (mode: CatalogEntryMode) => void;
  onClose: () => void;
  manualContent: ReactNode;
  fileContent: ReactNode;
};

export default function CatalogEntryDialog({
  title,
  description,
  mode,
  onModeChange,
  onClose,
  manualContent,
  fileContent,
}: CatalogEntryDialogProps) {
  return (
    <div
      className="fixed inset-0 z-70 grid place-items-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-entry-title"
        className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
          <div>
            <h2 id="catalog-entry-title" className="font-serif text-lg font-bold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
            <X size={18} />
          </button>
        </header>
        <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => onModeChange("manual")}
              aria-pressed={mode === "manual"}
              className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition ${
                mode === "manual" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Plus size={15} /> Tạo thủ công
            </button>
            <button
              type="button"
              onClick={() => onModeChange("file")}
              aria-pressed={mode === "file"}
              className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition ${
                mode === "file" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileSpreadsheet size={15} /> Nhập từ Excel
            </button>
          </div>
          <div className="mt-4">{mode === "manual" ? manualContent : fileContent}</div>
        </div>
      </section>
    </div>
  );
}
