import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { localizedText } from "../i18n";

export type CheckoutSummaryRoom = {
  id: string;
  label: string;
  roomAmount?: number;
  roomPaid?: boolean;
  bookingId?: string;
  remainingAmount?: number;
  surplusAmount?: number;
  services?: { name: string; quantity: number; amount: number }[];
  earlyCheckInFee?: number;
  lateFee?: number;
  otherSurcharges?: number;
  lateFeeIncludedInRemainingAmount?: boolean;
};

type CheckoutSummaryProps = {
  rooms: CheckoutSummaryRoom[];
  compact?: boolean;
  showRoomBreakdown?: boolean;
  showTotal?: boolean;
};

const formatMoney = (amount: number, language: string) => `${amount.toLocaleString(language.startsWith("en") ? "en-US" : "vi-VN")}${language.startsWith("en") ? " VND" : "đ"}`;

export const getCheckoutOutstandingAmount = (rooms: CheckoutSummaryRoom[]) => {
  const countedBalances = new Set<string>();
  return rooms.reduce((sum, room) => {
    const lateFee = room.lateFeeIncludedInRemainingAmount ? 0 : Math.max(0, room.lateFee || 0);
    if (room.remainingAmount !== undefined && Number.isFinite(room.remainingAmount)) {
      const balanceKey = room.bookingId ? `booking:${room.bookingId}` : `room:${room.id}`;
      if (countedBalances.has(balanceKey)) return sum + lateFee;
      countedBalances.add(balanceKey);
      return sum + Math.max(0, room.remainingAmount) + lateFee;
    }
    const roomAmount = room.roomPaid ? 0 : room.roomAmount || 0;
    const serviceAmount = (room.services || []).reduce((serviceSum, service) => serviceSum + service.amount, 0);
    return sum + roomAmount + serviceAmount + (room.earlyCheckInFee || 0) + (room.lateFee || 0) + (room.otherSurcharges || 0);
  }, 0);
};

export const getCheckoutSurplusAmount = (rooms: CheckoutSummaryRoom[]) => {
  const countedBookings = new Set<string>();
  return rooms.reduce((sum, room) => {
    const bookingKey = room.bookingId ? `booking:${room.bookingId}` : `room:${room.id}`;
    if (countedBookings.has(bookingKey)) return sum;
    countedBookings.add(bookingKey);
    return sum + Math.max(0, room.surplusAmount || 0);
  }, 0);
};

export default function CheckoutSummary({ rooms, compact = false, showRoomBreakdown = true, showTotal = true }: CheckoutSummaryProps) {
  const { i18n } = useTranslation();
  const language = i18n.language;
  const hasRemainingAmount = rooms.some((room) => room.remainingAmount !== undefined);
  const total = useMemo(() => getCheckoutOutstandingAmount(rooms), [rooms]);
  const surplus = useMemo(() => getCheckoutSurplusAmount(rooms), [rooms]);

  return <div className={compact ? "space-y-2" : "space-y-3"}>
    {showRoomBreakdown && rooms.map((room) => {
      const roomAmount = room.roomPaid ? 0 : room.roomAmount || 0;
      const serviceAmount = (room.services || []).reduce((sum, service) => sum + service.amount, 0);
      const amount = roomAmount + serviceAmount + (room.earlyCheckInFee || 0) + (room.lateFee || 0) + (room.otherSurcharges || 0);
      return <div key={room.id} className={`rounded-lg ${compact ? "bg-slate-50 px-3 py-2.5" : "border border-slate-200 p-3"}`}>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="min-w-0">
            <span className="block truncate font-semibold text-slate-700">{room.label}</span>
            {!room.roomPaid && roomAmount > 0 && <span className="mt-1 block text-xs text-slate-500">{localizedText("Tiền phòng", "Room charge")}: {formatMoney(roomAmount, language)}</span>}
            {serviceAmount > 0 && <span className="mt-1 block text-xs text-slate-500">{localizedText("Dịch vụ", "Services")}: {formatMoney(serviceAmount, language)}</span>}
            {(room.earlyCheckInFee || 0) > 0 && <span className="mt-1 block text-xs text-slate-500">{localizedText("Phụ thu check-in sớm", "Early check-in surcharge")}: {formatMoney(room.earlyCheckInFee || 0, language)}</span>}
            {(room.lateFee || 0) > 0 && <span className="mt-1 block text-xs text-slate-500">{localizedText("Phụ thu check-out trễ", "Late check-out surcharge")}: {formatMoney(room.lateFee || 0, language)}</span>}
            {(room.otherSurcharges || 0) > 0 && <span className="mt-1 block text-xs text-slate-500">{localizedText("Phụ thu khác", "Other surcharges")}: {formatMoney(room.otherSurcharges || 0, language)}</span>}
          </span>
          <strong className="shrink-0 text-slate-900">{formatMoney(amount, language)}</strong>
        </div>
      </div>;
    })}
    {showTotal && <div className={`flex items-center justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50/80 ${compact ? "px-3 py-3" : "px-4 py-3.5"}`}>
      <span className="text-sm font-semibold text-slate-700">{hasRemainingAmount ? localizedText("Còn phải thanh toán", "Balance due") : localizedText("Tổng cần thanh toán", "Total due")}</span>
      <strong className="shrink-0 text-lg font-bold tabular-nums text-blue-700">{formatMoney(total, language)}</strong>
    </div>}
    {surplus > 0 && <div className="flex items-center justify-between text-sm">
      <span className="font-semibold text-amber-800">{localizedText("Khách sạn cần hoàn", "Refund due to guest")}</span>
      <strong className="text-amber-800">{formatMoney(surplus, language)}</strong>
    </div>}
  </div>;
}