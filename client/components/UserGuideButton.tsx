import { Download, HelpCircle, ZoomIn, ZoomOut } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";

export default function UserGuideButton() {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const { i18n } = useTranslation();
  const isEn = i18n.language.startsWith("en");
  const guidePdf = isEn
    ? "/user-guide/USER_GUIDE_EN.pdf?v=20261123-2"
    : "/user-guide/USER_GUIDE_VI.pdf?v=20261123-2";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={isEn ? "Open user guide" : "Mở hướng dẫn sử dụng"}
        title={isEn ? "Support" : "Hỗ trợ"}
        className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <HelpCircle className="h-[19px] w-[19px]" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="text-xl">
              {isEn ? "Detailed system user guide" : "Hướng dẫn chi tiết sử dụng hệ thống"}
            </DialogTitle>
            <DialogDescription>
              {isEn
                ? "The guide below is the same complete document as the downloadable PDF."
                : "Tài liệu bên dưới giống với bản PDF tải xuống và có đầy đủ hình ảnh, nội dung hướng dẫn."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            <a
              href="/user-guide/USER_GUIDE_VI.pdf?v=20261123-2"
              download="Sen-Viet-User-Guide-VI.pdf"
              className="inline-flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Download className="h-4 w-4" />
              {isEn ? "Download Vietnamese guide (PDF)" : "Tải hướng dẫn tiếng Việt (PDF)"}
            </a>
            <a
              href="/user-guide/USER_GUIDE_EN.pdf?v=20261123-2"
              download="Sen-Viet-User-Guide-EN.pdf"
              className="inline-flex w-fit items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Download className="h-4 w-4" />
              {isEn ? "Download English guide (PDF)" : "Tải hướng dẫn tiếng Anh (PDF)"}
            </a>
          </div>
          <div className="flex items-center justify-end gap-2">
            <span className="mr-1 text-sm text-slate-600">
              {isEn ? "Zoom" : "Thu phóng"}
            </span>
            <button
              type="button"
              onClick={() => setZoom((value) => Math.max(50, value - 25))}
              disabled={zoom <= 50}
              aria-label={isEn ? "Zoom out" : "Thu nhỏ"}
              className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="min-w-12 text-center text-sm tabular-nums text-slate-700">
              {zoom}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((value) => Math.min(200, value + 25))}
              disabled={zoom >= 200}
              aria-label={isEn ? "Zoom in" : "Phóng to"}
              className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
          <iframe
            title={isEn ? "English user guide" : "Hướng dẫn sử dụng tiếng Việt"}
            src={`${guidePdf}#zoom=${zoom}`}
            className="h-[68vh] min-h-[360px] w-full rounded-lg border border-slate-200 bg-white"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
