import { CreditCard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { localizedText } from "../i18n";
import CheckoutSummary, { getCheckoutOutstandingAmount, type CheckoutSummaryRoom } from "./CheckoutSummary";
import CheckoutSurplusRefundChoice, { type CheckoutSurplusRefundMethod } from "./CheckoutSurplusRefundChoice";
import CheckoutUnusedServicesWarning, { type CheckoutUnusedService } from "./CheckoutUnusedServicesWarning";

type BatchActionRoom = {
  id: string;
  bookingId?: string;
  label: string;
  meta: string;
  status: "pending" | "complete";
  amount?: number;
};

type BatchActionDialogProps = {
  open: boolean;
  mode: "check-in" | "check-out";
  rooms: BatchActionRoom[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  checkoutSummaryRooms?: CheckoutSummaryRoom[];
  checkoutRefundMethods?: Record<string, CheckoutSurplusRefundMethod>;
  onCheckoutRefundMethodChange?: (bookingId: string, method: CheckoutSurplusRefundMethod) => void;
  checkoutUnusedServices?: CheckoutUnusedService[];
  isCancellingUnusedServices?: boolean;
  onCancelUnusedServices?: () => void;
};

const formatMoney = (amount: number, language: string) => `${amount.toLocaleString(language.startsWith("en") ? "en-US" : "vi-VN")}${language.startsWith("en") ? " VND" : "đ"}`;

export default function BatchActionDialog({
  open,
  mode,
  rooms,
  selectedIds,
  onToggle,
  onClose,
  onConfirm,
  checkoutSummaryRooms,
  checkoutRefundMethods = {},
  onCheckoutRefundMethodChange,
  checkoutUnusedServices = [],
  isCancellingUnusedServices = false,
  onCancelUnusedServices,
}: BatchActionDialogProps) {
  const { i18n } = useTranslation();
  const language = i18n.language;
  if (!open) return null;

  const isCheckIn = mode === "check-in";
  const selectedRooms = rooms.filter((room) => selectedIds.includes(room.id));
  const total = selectedRooms.reduce((sum, room) => sum + (room.amount || 0), 0);
  const selectedBookings = [...new Map(
    (checkoutSummaryRooms ?? [])
      .filter((room) => selectedIds.includes(room.id) && room.bookingId)
      .filter((selectedRoom) => rooms
        .filter((room) => room.bookingId === selectedRoom.bookingId)
        .every((room) => selectedIds.includes(room.id)))
      .map((room) => [room.bookingId!, room]),
  ).entries()];
  const selectedCheckoutRooms = checkoutSummaryRooms?.filter((room) => selectedIds.includes(room.id)) ?? [];
  const outstandingAmount = getCheckoutOutstandingAmount(selectedCheckoutRooms);
  const bookingsRequiringRefund = selectedBookings.filter(([bookingId, room]) =>
    (room.surplusAmount ?? 0) > 0
      && getCheckoutOutstandingAmount(selectedCheckoutRooms.filter((selectedRoom) => selectedRoom.bookingId === bookingId)) === 0,
  );
  const allRefundMethodsSelected = bookingsRequiringRefund.every(([bookingId]) => checkoutRefundMethods[bookingId] != null);

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onMouseDown={onClose}>
    <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wider ${isCheckIn ? "text-blue-600" : "text-amber-600"}`}>{isCheckIn ? localizedText("Check-in từng phòng", "Check in rooms individually") : localizedText("Check-out hàng loạt", "Bulk check-out")}</p>
          <h3 className="mt-1 text-xl font-bold text-slate-900">{isCheckIn ? localizedText("Cập nhật trạng thái phòng", "Update room status") : localizedText(`Xác nhận ${selectedRooms.length} phòng`, `Confirm ${selectedRooms.length} rooms`)}</h3>
          <p className="mt-1 text-sm text-slate-500">{isCheckIn ? localizedText("Bấm vào phòng để đổi trạng thái. Phòng vẫn giữ trong danh sách để chỉnh lại.", "Select a room to change its status. It will remain in the list so you can update it.") : localizedText("Tiền phòng của các booking đã thanh toán trước.", "Room charges for these bookings have already been paid.")}</p>
        </div>
        <button type="button" onClick={onClose} className="text-2xl leading-none text-slate-400">×</button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {rooms.map((room) => {
          const checkedIn = room.status === "complete";
          const selected = selectedIds.includes(room.id);
          const active = isCheckIn ? checkedIn : selected;
          return <button type="button" key={room.id} onClick={() => onToggle(room.id)} className={`rounded-xl border p-4 text-left transition ${active ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50"}`}>
            <span className="flex items-center justify-between text-xs font-semibold text-slate-500"><span>{room.label}</span>{isCheckIn ? <span className={`rounded-full px-2 py-1 text-[10px] ${checkedIn ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{checkedIn ? localizedText("Đã check-in", "Checked in") : localizedText("Chờ check-in", "Awaiting check-in")}</span> : <input type="checkbox" checked={selected} onChange={() => onToggle(room.id)} onClick={(event) => event.stopPropagation()} className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500" />}</span>
            <span className="mt-2 block text-lg font-bold text-slate-900">{room.meta}</span>
            {isCheckIn ? <span className={`mt-1 block text-xs ${checkedIn ? "text-rose-600" : "text-blue-700"}`}>{checkedIn ? localizedText("Bấm để hoàn tác", "Click to undo") : localizedText("Bấm để check-in", "Click to check in")}</span> : <span className="mt-1 block text-xs font-semibold text-slate-500">{formatMoney(room.amount || 0, language)}</span>}
          </button>;
        })}
      </div>

      {!isCheckIn && checkoutSummaryRooms ? <div className="mt-4 border-t border-slate-200 pt-4"><CheckoutSummary rooms={checkoutSummaryRooms} compact /></div> : !isCheckIn && <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4"><span className="font-bold text-slate-900">{localizedText("Tổng cần thanh toán", "Total due")}</span><strong className="text-lg text-amber-700">{formatMoney(total, language)}</strong></div>}
      {!isCheckIn && bookingsRequiringRefund.length > 0 && (
        <div className="mt-4 space-y-3">
          <p className="text-xs leading-5 text-slate-600">
            {localizedText("Khách sạn đang cần hoàn tiền cho khách. Chọn cách hoàn cho từng booking.", "A refund is due to the guest. Choose a refund method for each booking.")}
          </p>
          {bookingsRequiringRefund.map(([bookingId, room]) => (
            <div key={bookingId}>
              <p className="mb-1 text-xs font-semibold text-slate-700">
                    {localizedText("Booking", "Booking")} {bookingId} · {room.label}
              </p>
              <CheckoutSurplusRefundChoice
                name={`checkout-refund-${bookingId}`}
                value={checkoutRefundMethods[bookingId] ?? null}
                onChange={(method) => onCheckoutRefundMethodChange?.(bookingId, method)}
              />
            </div>
          ))}
        </div>
      )}
      {!isCheckIn && outstandingAmount > 0 && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          {localizedText(`Khách còn phải thanh toán ${formatMoney(outstandingAmount, language)} trước khi check-out.`, `The guest must pay ${formatMoney(outstandingAmount, language)} before check-out.`)}
        </p>
      )}
      {!isCheckIn && (
        <CheckoutUnusedServicesWarning
          services={checkoutUnusedServices}
          isCancelling={isCancellingUnusedServices}
          onCancel={() => onCancelUnusedServices?.()}
        />
      )}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">{localizedText("Hủy", "Cancel")}</button>
        {isCheckIn ? <button type="button" onClick={onClose} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white">{localizedText("Đóng", "Close")}</button> : <button type="button" disabled={selectedRooms.length === 0 || outstandingAmount > 0 || !allRefundMethodsSelected || checkoutUnusedServices.length > 0 || isCancellingUnusedServices} onClick={onConfirm} className="flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><CreditCard size={16} />{localizedText("Thanh toán & Check-out", "Pay & Check out")}</button>}
      </div>
    </div>
  </div>;
}
