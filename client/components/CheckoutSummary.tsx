import { useMemo } from "react";

export type CheckoutSummaryRoom = {
  id: string;
  label: string;
  roomAmount?: number;
  roomPaid?: boolean;
  services?: { name: string; quantity: number; amount: number }[];
  lateFee?: number;
};

type CheckoutSummaryProps = {
  rooms: CheckoutSummaryRoom[];
  compact?: boolean;
};

const formatMoney = (amount: number) => `${amount.toLocaleString("vi-VN")}đ`;

export default function CheckoutSummary({ rooms, compact = false }: CheckoutSummaryProps) {
  const total = useMemo(() => rooms.reduce((sum, room) => {
    const roomAmount = room.roomPaid ? 0 : room.roomAmount || 0;
    const serviceAmount = (room.services || []).reduce((serviceSum, service) => serviceSum + service.amount, 0);
    return sum + roomAmount + serviceAmount + (room.lateFee || 0);
  }, 0), [rooms]);

  return <div className={compact ? "space-y-2" : "space-y-3"}>
    {rooms.map((room) => {
      const roomAmount = room.roomPaid ? 0 : room.roomAmount || 0;
      const serviceAmount = (room.services || []).reduce((sum, service) => sum + service.amount, 0);
      const amount = roomAmount + serviceAmount + (room.lateFee || 0);
      return <div key={room.id} className={`rounded-lg ${compact ? "bg-slate-50 px-3 py-2.5" : "border border-slate-200 p-3"}`}>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="min-w-0">
            <span className="block truncate font-semibold text-slate-700">{room.label}</span>
            {!room.roomPaid && roomAmount > 0 && <span className="mt-1 block text-xs text-slate-500">Tiền phòng: {formatMoney(roomAmount)}</span>}
            {serviceAmount > 0 && <span className="mt-1 block text-xs text-slate-500">Dịch vụ: {formatMoney(serviceAmount)}</span>}
            {(room.lateFee || 0) > 0 && <span className="mt-1 block text-xs text-slate-500">Phụ thu: {formatMoney(room.lateFee || 0)}</span>}
          </span>
          <strong className="shrink-0 text-slate-900">{formatMoney(amount)}</strong>
        </div>
      </div>;
    })}
    <div className="flex items-center justify-between border-t border-slate-200 pt-4">
      <span className="font-bold text-slate-900">Tổng cần thanh toán</span>
      <strong className="text-lg text-blue-700">{formatMoney(total)}</strong>
    </div>
  </div>;
}