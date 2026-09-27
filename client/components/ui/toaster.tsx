import { useToast } from "@/hooks/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const closeButtonClassName =
          props.variant === "destructive"
            ? "bg-red-200/80 text-red-700 hover:bg-red-300 hover:text-red-800"
            : props.variant === "success"
              ? "bg-emerald-200/80 text-emerald-700 hover:bg-emerald-300 hover:text-emerald-800"
              : "bg-slate-200/80 text-slate-700 hover:bg-slate-300 hover:text-slate-900";

        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <button
              type="button"
              aria-label="Đóng thông báo"
              onClick={() => dismiss(id)}
              className={`absolute right-2 top-2 rounded-full p-1.5 transition-all ${closeButtonClassName}`}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
