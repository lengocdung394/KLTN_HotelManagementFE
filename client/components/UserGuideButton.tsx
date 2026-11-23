import { Download, HelpCircle } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import guideEnHtml from "../../docs/USER_GUIDE_EN.print.html?raw";
import guideViHtml from "../../docs/USER_GUIDE_VI.print.html?raw";

export default function UserGuideButton() {
  const [open, setOpen] = useState(false);
  const [guideLanguage, setGuideLanguage] = useState<"vi" | "en">("vi");
  const { i18n } = useTranslation();
  const appIsEn = i18n.language.startsWith("en");
  const otherLanguage = guideLanguage === "en" ? "VI" : "EN";
  const guideHtml = (guideLanguage === "en" ? guideEnHtml : guideViHtml)
    .replace("<head>", '<head><base href="about:srcdoc">')
    .replace(/\.\.\/public\/user-guide\//g, "/user-guide/")
    .replace(
      `href="./USER_GUIDE_${otherLanguage}.md"`,
      `href="/user-guide/USER_GUIDE_${otherLanguage}.pdf?v=20261123-2"`,
    )
    .replace(
      "</style>",
      "@media screen { body { box-sizing: border-box; max-width: 1100px; min-height: 100vh; margin: 0 auto; padding: 24px; } } </style>",
    );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={appIsEn ? "Open user guide" : "Mở hướng dẫn sử dụng"}
        title={appIsEn ? "Support" : "Hỗ trợ"}
        className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <HelpCircle className="h-[19px] w-[19px]" />
      </button>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (nextOpen) setGuideLanguage(appIsEn ? "en" : "vi");
        }}
      >
        <DialogContent className="fixed inset-0 left-0 top-0 z-50 flex h-auto max-h-none w-auto max-w-none translate-x-0 translate-y-0 flex-col gap-3 overflow-hidden rounded-none border-0 p-4 shadow-none sm:rounded-none">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="text-xl">
              {appIsEn ? "Detailed system user guide" : "Hướng dẫn chi tiết sử dụng hệ thống"}
            </DialogTitle>
            <DialogDescription>
              {appIsEn
                ? "Browse the complete guide, with the same content and screenshots as the PDF."
                : "Xem đầy đủ nội dung và hình ảnh hướng dẫn như trong tài liệu PDF."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1" role="group" aria-label={appIsEn ? "Guide language" : "Ngôn ngữ tài liệu"}>
              <button
                type="button"
                aria-pressed={guideLanguage === "vi"}
                onClick={() => setGuideLanguage("vi")}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${guideLanguage === "vi" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
              >
                Tiếng Việt
              </button>
              <button
                type="button"
                aria-pressed={guideLanguage === "en"}
                onClick={() => setGuideLanguage("en")}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${guideLanguage === "en" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
              >
                English
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="/user-guide/USER_GUIDE_VI.pdf?v=20261123-2"
                download="Sen-Viet-User-Guide-VI.pdf"
                className="inline-flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <Download className="h-4 w-4" />
                {appIsEn ? "Download Vietnamese PDF" : "Tải PDF tiếng Việt"}
              </a>
              <a
                href="/user-guide/USER_GUIDE_EN.pdf?v=20261123-2"
                download="Sen-Viet-User-Guide-EN.pdf"
                className="inline-flex w-fit items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <Download className="h-4 w-4" />
                {appIsEn ? "Download English PDF" : "Tải PDF tiếng Anh"}
              </a>
            </div>
          </div>
          <iframe
            title={guideLanguage === "en" ? "English user guide" : "Hướng dẫn sử dụng tiếng Việt"}
            srcDoc={guideHtml}
            className="min-h-0 w-full flex-1 bg-white"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
