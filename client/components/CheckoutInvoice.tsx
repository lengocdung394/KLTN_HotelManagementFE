import { Printer, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { localizedText } from "../i18n";
import type { BookingListItem } from "../services/bookingApi";

type InvoiceRoom = {
  room: string;
  checkIn: string;
  checkOut: string;
  roomAmount: number;
  services: Array<{ name: string; quantity: number; amount: number }>;
  earlyFee: number;
  lateFee: number;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? value as Record<string, unknown> : {};

const readAmount = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") {
      const amount = Number(value);
      if (Number.isFinite(amount)) return amount;
    }
  }
  return 0;
};

const readText = (source: Record<string, unknown>, keys: string[], fallback = "") => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return fallback;
};

const formatMoney = (amount: number, language: string) => `${Math.round(amount).toLocaleString(language.startsWith("en") ? "en-US" : "vi-VN")}${language.startsWith("en") ? " VND" : "đ"}`;
const formatDateTime = (value: string, language: string) => {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString(language.startsWith("en") ? "en-US" : "vi-VN", { dateStyle: "short", timeStyle: "short" });
};

const getRoomDetails = (booking: BookingListItem): InvoiceRoom[] => {
  const details = Array.isArray(booking.bookingDetails) ? booking.bookingDetails : [];
  return details.map((value) => {
    const detail = asRecord(value);
    const servicesValue = detail.bookingServiceResponseForHotel
      ?? detail.bookingServiceResponsForHotels
      ?? detail.bookingServiceResponsesForHotels
      ?? detail.bookingServiceDetails
      ?? detail.services;
    const services = (Array.isArray(servicesValue) ? servicesValue : [])
      .filter((value) => !Boolean(asRecord(value).cancelled))
      .map((value) => {
        const service = asRecord(value);
        const quantity = Math.max(0, readAmount(service, ["quantity", "serviceQuantity", "quantityService", "count"]) || 1);
        const amount = readAmount(service, ["totalAmount", "subTotal", "subtotal"])
          || readAmount(service, ["price", "unitPrice", "servicePrice"]) * quantity;
        return {
          name: readText(service, ["name", "serviceName", "nameService"], "Dịch vụ"),
          quantity,
          amount,
        };
      });
    const serviceSubtotal = readAmount(detail, ["serviceSubTotal", "serviceSubtotal", "serviceTotal"]);
    if (!Array.isArray(servicesValue) && serviceSubtotal > 0) {
      services.push({
        name: "Dịch vụ",
        quantity: 1,
        amount: serviceSubtotal,
      });
    }

    return {
      room: readText(detail, ["roomNumber", "roomName", "roomId"], "—"),
      checkIn: readText(detail, ["actualCheckInTime", "checkInTime"]),
      checkOut: readText(detail, ["actualCheckOutTime", "checkOutTime"]),
      roomAmount: readAmount(detail, ["roomSubTotal", "roomSubtotal", "roomAmount", "roomTotal", "totalRoomAmount", "baseRoomPrice"]),
      services,
      earlyFee: readAmount(detail, ["earlyCheckInFee", "earlyCheckinFee"]),
      lateFee: readAmount(detail, ["lateCheckOutFee", "lateCheckoutFee", "lateFee"]),
    };
  });
};

type CheckoutInvoiceProps = {
  booking: BookingListItem;
  onClose: () => void;
};

export default function CheckoutInvoice({ booking, onClose }: CheckoutInvoiceProps) {
  const { i18n } = useTranslation();
  const language = i18n.language;
  const rooms = getRoomDetails(booking);
  const roomTotal = rooms.reduce((sum, room) => sum + room.roomAmount, 0);
  const servicesTotal = rooms.reduce(
    (sum, room) => sum + room.services.reduce((serviceSum, service) => serviceSum + service.amount, 0),
    0,
  );
  const earlyFeesTotal = rooms.reduce((sum, room) => sum + room.earlyFee, 0);
  const lateFeesTotal = rooms.reduce((sum, room) => sum + room.lateFee, 0);
  const itemSubtotal = roomTotal + servicesTotal + earlyFeesTotal + lateFeesTotal;
  const discount = readAmount(booking, ["discountAmountTotal", "discountTotal"]);
  const total = readAmount(booking, ["finalAmount"]) || Math.max(0, itemSubtotal - discount);
  const adjustment = total - (itemSubtotal - discount);
  const paidAmount = readAmount(booking, ["paidAmount"]);
  const remainingAmount = readAmount(booking, ["remainingAmount", "customerDueAmount"]);
  const bookingId = readText(booking, ["bookingId", "id"], "—");
  const latestCheckout = rooms
    .map((room) => room.checkOut)
    .filter(Boolean)
    .reduce((latest, checkout) => checkout > latest ? checkout : latest, "");

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-slate-950/50 p-4">
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          body * { visibility: hidden !important; }
          #checkout-invoice-print-area, #checkout-invoice-print-area * { visibility: visible !important; }
          #checkout-invoice-print-area {
            position: fixed !important;
            inset: 0 !important;
            width: 100% !important;
            max-width: none !important;
            max-height: none !important;
            overflow: visible !important;
            padding: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
          }
          .checkout-invoice-actions { display: none !important; }
        }
      `}</style>
      <section
        id="checkout-invoice-print-area"
        className="my-auto max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-10"
        aria-label={localizedText("Hóa đơn thanh toán", "Payment invoice")}
      >
        <div className="checkout-invoice-actions mb-5 flex justify-end gap-2">
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
            <Printer size={16} /> {localizedText("In / Lưu PDF", "Print / Save PDF")}
          </button>
          <button type="button" onClick={onClose} aria-label={localizedText("Đóng hóa đơn", "Close invoice")} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
            <X size={17} />
          </button>
        </div>

        <header className="flex flex-wrap items-start justify-between gap-5 border-b-2 border-slate-900 pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">Hotel Management</p>
            <h1 className="mt-2 text-3xl font-black uppercase tracking-wide text-slate-900">{localizedText("Hóa đơn thanh toán", "Payment invoice")}</h1>
            <p className="mt-1 text-sm text-slate-500">{localizedText("Chi tiết lưu trú và dịch vụ theo từng phòng", "Accommodation and service details by room")}</p>
          </div>
          <div className="text-right text-sm">
            <p className="text-slate-500">{localizedText("Mã booking", "Booking ID")}</p>
            <p className="font-bold text-slate-900">{bookingId}</p>
            <p className="mt-2 text-slate-500">{localizedText("Ngày hoàn tất", "Completion date")}</p>
            <p className="font-semibold text-slate-800">{formatDateTime(latestCheckout, language)}</p>
          </div>
        </header>

        <div className="grid gap-4 border-b border-slate-200 py-5 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{localizedText("Khách hàng", "Guest")}</p>
            <p className="mt-1 font-bold text-slate-900">{readText(booking, ["customerName", "nameCustomer"], localizedText("Chưa cập nhật", "Not provided"))}</p>
            <p className="text-slate-600">{readText(booking, ["customerPhone", "phone", "phoneNumber"], "—")}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{localizedText("Mã đơn hàng", "Order ID")}</p>
            <p className="mt-1 font-semibold text-slate-800">{readText(booking, ["orderId"], "—")}</p>
          </div>
        </div>

        <div className="space-y-5 py-5">
          {rooms.map((room, index) => {
            const roomSubtotal = room.roomAmount + room.services.reduce((sum, service) => sum + service.amount, 0) + room.earlyFee + room.lateFee;
            return (
              <section key={`${room.room}-${index}`} className="break-inside-avoid rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-xl bg-slate-50 px-4 py-3">
                  <h2 className="font-bold text-slate-900">{localizedText("Phòng", "Room")} {room.room}</h2>
                  <span className="text-xs text-slate-500">
                    {formatDateTime(room.checkIn, language)} – {formatDateTime(room.checkOut, language)}
                  </span>
                </div>
                <div className="divide-y divide-slate-100 px-4">
                  <div className="flex justify-between gap-4 py-3 text-sm">
                    <span className="text-slate-700">{localizedText("Tiền phòng", "Room charge")}</span>
                    <span className="font-semibold text-slate-900">{formatMoney(room.roomAmount, language)}</span>
                  </div>
                  {room.services.map((service, serviceIndex) => (
                    <div key={`${service.name}-${serviceIndex}`} className="flex justify-between gap-4 py-3 text-sm">
                      <span className="text-slate-700">{service.name} <span className="text-slate-400">× {service.quantity}</span></span>
                      <span className="font-semibold text-slate-900">{formatMoney(service.amount, language)}</span>
                    </div>
                  ))}
                  {room.earlyFee > 0 && (
                    <div className="flex justify-between gap-4 py-3 text-sm">
                      <span className="text-slate-700">{localizedText("Phụ thu check-in sớm", "Early check-in surcharge")}</span>
                      <span className="font-semibold text-slate-900">{formatMoney(room.earlyFee, language)}</span>
                    </div>
                  )}
                  {room.lateFee > 0 && (
                    <div className="flex justify-between gap-4 py-3 text-sm">
                      <span className="text-slate-700">{localizedText("Phụ thu check-out trễ", "Late check-out surcharge")}</span>
                      <span className="font-semibold text-slate-900">{formatMoney(room.lateFee, language)}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-between rounded-b-xl bg-blue-50 px-4 py-3 text-sm">
                  <span className="font-semibold text-blue-900">{localizedText("Tổng phòng", "Room total")} {room.room}</span>
                  <span className="font-bold text-blue-900">{formatMoney(roomSubtotal, language)}</span>
                </div>
              </section>
            );
          })}
        </div>

        <section className="ml-auto max-w-sm space-y-2 border-t border-slate-200 pt-5 text-sm">
          <div className="flex justify-between gap-4 text-slate-600"><span>{localizedText("Tiền phòng", "Room charges")}</span><span>{formatMoney(roomTotal, language)}</span></div>
          <div className="flex justify-between gap-4 text-slate-600"><span>{localizedText("Dịch vụ", "Services")}</span><span>{formatMoney(servicesTotal, language)}</span></div>
          <div className="flex justify-between gap-4 text-slate-600"><span>{localizedText("Phụ thu check-in sớm", "Early check-in surcharge")}</span><span>{formatMoney(earlyFeesTotal, language)}</span></div>
          <div className="flex justify-between gap-4 text-slate-600"><span>{localizedText("Phụ thu check-out trễ", "Late check-out surcharge")}</span><span>{formatMoney(lateFeesTotal, language)}</span></div>
          <div className="flex justify-between gap-4 border-t border-slate-100 pt-2 text-slate-700"><span>{localizedText("Tạm tính", "Subtotal")}</span><span>{formatMoney(itemSubtotal, language)}</span></div>
          {discount > 0 && <div className="flex justify-between gap-4 text-emerald-700"><span>{localizedText("Giảm giá", "Discount")}</span><span>−{formatMoney(discount, language)}</span></div>}
          {Math.abs(adjustment) >= 1 && <div className="flex justify-between gap-4 text-slate-600"><span>{localizedText("Điều chỉnh theo booking", "Booking adjustment")}</span><span>{formatMoney(adjustment, language)}</span></div>}
          <div className="flex justify-between gap-4 border-t-2 border-slate-900 pt-3 text-lg font-black text-slate-950"><span>{localizedText("Tổng thanh toán", "Total due")}</span><span>{formatMoney(total, language)}</span></div>
          <div className="flex justify-between gap-4 text-slate-600"><span>{localizedText("Đã thanh toán", "Paid")}</span><span>{formatMoney(paidAmount, language)}</span></div>
          <div className="flex justify-between gap-4 font-bold text-emerald-700"><span>{localizedText("Còn phải thanh toán", "Balance due")}</span><span>{formatMoney(remainingAmount, language)}</span></div>
        </section>

        <footer className="mt-10 border-t border-dashed border-slate-300 pt-5 text-center text-xs text-slate-500">
          <p className="font-semibold text-slate-700">{localizedText("Cảm ơn Quý khách đã sử dụng dịch vụ!", "Thank you for staying with us!")}</p>
          <p className="mt-1">{localizedText("Hóa đơn được lập sau khi toàn bộ phòng trong booking đã hoàn tất check-out.", "This invoice was issued after all rooms in the booking had checked out.")}</p>
        </footer>
      </section>
    </div>
  );
}
