import { AlertTriangle } from "lucide-react";
import { localizedText } from "../i18n";

export type CheckoutUnusedService = {
  room: string;
  name: string;
  quantity: number;
  amount: number;
};

type CheckoutUnusedServicesWarningProps = {
  services: CheckoutUnusedService[];
  isCancelling: boolean;
  onCancel: () => void;
};

export default function CheckoutUnusedServicesWarning({
  services,
  isCancelling,
  onCancel,
}: CheckoutUnusedServicesWarningProps) {
  if (services.length === 0) return null;

  return (
    <div role="alert" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <AlertTriangle size={16} className="shrink-0" />
        {localizedText(
          "Có dịch vụ đã đặt nhưng chưa sử dụng. Vui lòng hủy trước khi check-out để cập nhật khoản hoàn cho khách.",
          "Some booked services have not been used. Cancel them before check-out so the guest's refund can be updated.",
        )}
      </p>
      <ul className="mt-2 space-y-1 text-xs text-amber-900">
        {services.map((service, index) => (
          <li key={`${service.room}-${service.name}-${index}`} className="flex justify-between gap-3">
            <span>
              {localizedText("Phòng", "Room")} {service.room} · {service.name} x{service.quantity}
            </span>
            <strong className="shrink-0">{service.amount.toLocaleString("vi-VN")}đ</strong>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onCancel}
        disabled={isCancelling}
        className="mt-3 rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-800 disabled:cursor-wait disabled:opacity-60"
      >
        {isCancelling
          ? localizedText("Đang hủy dịch vụ...", "Canceling services...")
          : localizedText("Hủy dịch vụ chưa dùng và cập nhật tiền", "Cancel unused services and update totals")}
      </button>
    </div>
  );
}
