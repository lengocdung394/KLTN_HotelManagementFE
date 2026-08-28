import { useEffect } from "react";
import { CheckCircle2, X } from "lucide-react";

type SuccessNotificationProps = {
  open: boolean;
  title?: string;
  message: string;
  onClose: () => void;
  duration?: number;
};

export default function SuccessNotification({
  open,
  title = "Thao tác thành công",
  message,
  onClose,
  duration = 4500,
}: SuccessNotificationProps) {
  useEffect(() => {
    if (!open || duration <= 0) return;
    const timeout = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timeout);
  }, [duration, onClose, open]);

  if (!open) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-100 w-[min(calc(100vw-2rem),24rem)] sm:right-6 sm:top-6">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex items-start gap-3 rounded-xl border border-blue-200 bg-white p-4 shadow-xl shadow-blue-100/70 ring-1 ring-blue-50"
      >
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-600">
          <CheckCircle2 size={20} strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-sm font-bold text-slate-900">{title}</p>
          <p className="mt-1 text-sm leading-5 text-slate-600">{message}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng thông báo"
          className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
        >
          <X size={17} />
        </button>
      </div>
    </div>
  );
}
