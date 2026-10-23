import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, Check, CreditCard, Pencil, UserRound, X } from "lucide-react";
import { localizedText } from "../i18n";
import type { DailyRecord, ServiceCharge } from "./CheckInOutRecordList";

export type BookingServiceQuantityEdit = {
  bookingDetailId: string;
  services: Array<{ serviceId: string; bookingServiceDetailId: string; quantity: number }>;
};

type CheckInOutBookingDetailModalProps = {
  records: DailyRecord[];
  onClose: () => void;
  onSaveServices?: (updates: BookingServiceQuantityEdit[]) => Promise<boolean>;
  isSavingServices?: boolean;
};

const money = (value: number, language: string) => `${value.toLocaleString(language.startsWith("en") ? "en-US" : "vi-VN")}${language.startsWith("en") ? " VND" : "đ"}`;
const formatDateTime = (value: string | undefined, language: string) => value
  ? new Date(value).toLocaleString(language.startsWith("en") ? "en-US" : "vi-VN", { dateStyle: "short", timeStyle: "short" })
  : localizedText("Chưa cập nhật", "Not provided");

export default function CheckInOutBookingDetailModal({ records, onClose, onSaveServices, isSavingServices = false }: CheckInOutBookingDetailModalProps) {
  const { i18n } = useTranslation();
  const language = i18n.language;
  const [isEditingServices, setIsEditingServices] = useState(false);
  const [serviceQuantities, setServiceQuantities] = useState<Record<string, number>>({});
  const firstRecord = records[0];
  if (!firstRecord) return null;

  const canEditRecordServices = (record: DailyRecord) =>
    !record.historical && ["Chờ check-in", "Đang ở", "Đã check-in"].includes(record.status);
  const canEditServices = Boolean(onSaveServices)
    && records.some((record) => canEditRecordServices(record)
      && (record.services ?? []).some((service) => service.used !== true && service.serviceDetailId && service.serviceId));
  const serviceKey = (recordId: string, serviceDetailId: string) => `${recordId}:${serviceDetailId}`;
  const beginServiceEdit = () => {
    setServiceQuantities(Object.fromEntries(records.flatMap((record) =>
      (record.services ?? []).flatMap((service) =>
        service.serviceDetailId
          ? [[serviceKey(record.id, service.serviceDetailId), service.quantity]]
          : [],
      ),
    )));
    setIsEditingServices(true);
  };
  const saveServiceEdits = async () => {
    if (!onSaveServices) return;
    const updates = records.flatMap((record) => {
      const changedServices = (record.services ?? []).flatMap((service) => {
        if (!canEditRecordServices(record) || !service.serviceDetailId || !service.serviceId || service.used === true) return [];
        const quantity = serviceQuantities[serviceKey(record.id, service.serviceDetailId)] ?? service.quantity;
        if (quantity === service.quantity) return [];
        return [{ serviceId: service.serviceId, bookingServiceDetailId: service.serviceDetailId, quantity }];
      });
      return changedServices.length > 0 ? [{ bookingDetailId: record.id, services: changedServices }] : [];
    });
    if (updates.length === 0) {
      setIsEditingServices(false);
      return;
    }
    if (await onSaveServices(updates)) setIsEditingServices(false);
  };

  const displayedQuantity = (record: DailyRecord, service: ServiceCharge) =>
    isEditingServices && canEditRecordServices(record) && service.serviceDetailId && service.used !== true
      ? serviceQuantities[serviceKey(record.id, service.serviceDetailId)] ?? service.quantity
      : service.quantity;
  const serviceAmount = (record: DailyRecord, service: NonNullable<DailyRecord["services"]>[number]) => {
    const unitPrice = service.quantity > 0 ? service.amount / service.quantity : 0;
    return unitPrice * displayedQuantity(record, service);
  };

  const roomTotal = records.reduce((total, record) => total + Number(record.roomAmount ?? 0), 0);
  const serviceTotal = records.reduce((total, record) => total + (record.services ?? []).reduce((sum, service) => sum + serviceAmount(record, service), 0), 0);
  const earlyCheckInFeeTotal = records.reduce((total, record) => total + Number(record.earlyCheckInFee ?? 0), 0);
  const lateCheckOutFeeTotal = records.reduce((total, record) => total + Number(record.lateFee ?? 0), 0);
  const otherSurchargesTotal = records.reduce((total, record) => total + Number(record.otherSurcharges ?? 0), 0);
  const totalAmount = roomTotal + serviceTotal + earlyCheckInFeeTotal + lateCheckOutFeeTotal + otherSurchargesTotal;
  const sumBookingAmounts = (selectAmount: (record: DailyRecord) => number | undefined) => {
    const amountsByBooking = new Map<string, number>();
    records.forEach((record, index) => {
      const amount = selectAmount(record);
      const bookingKey = record.bookingId ?? record.id ?? String(index);
      if (amount !== undefined && Number.isFinite(amount) && !amountsByBooking.has(bookingKey)) {
        amountsByBooking.set(bookingKey, amount);
      }
    });
    return [...amountsByBooking.values()].reduce((total, amount) => total + amount, 0);
  };
  const paidTotal = sumBookingAmounts((record) => record.paidAmount);
  const remainingTotal = sumBookingAmounts((record) => record.remainingAmount);
  const hasPaidAmount = records.some((record) => record.paidAmount !== undefined);
  const hasRemainingAmount = records.some((record) => record.remainingAmount !== undefined);
  const paymentStates = records.flatMap((record) => record.roomPaid === undefined ? [] : [record.roomPaid]);
  const groupPaid = paymentStates.length > 0 ? paymentStates.every(Boolean) : undefined;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" onMouseDown={onClose}>
      <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="checkin-booking-detail-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{localizedText("Chi tiết booking", "Booking details")}</p>
            <h2 id="checkin-booking-detail-title" className="mt-1 text-lg font-bold text-slate-900">{firstRecord.bookingId ?? firstRecord.id}</h2>
            <p className="mt-1 text-xs text-slate-500">{records.length} {localizedText("phòng", "rooms")} · {firstRecord.flow === "check-in" ? "Check-in" : "Check-out"}</p>
          </div>
          <div className="flex items-center gap-2">
            {canEditServices && !isEditingServices && <button type="button" onClick={beginServiceEdit} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"><Pencil size={14} />{localizedText("Chỉnh sửa dịch vụ", "Edit services")}</button>}
            <button type="button" onClick={onClose} aria-label={localizedText("Đóng chi tiết booking", "Close booking details")} title={localizedText("Đóng", "Close")} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="space-y-4 p-5">
          <section className="rounded-lg border border-slate-200 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800"><UserRound size={16} className="text-blue-600" />{localizedText("Khách và phòng", "Guest and rooms")}</h3>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">{localizedText("Khách hàng", "Guest")}</dt><dd className="mt-0.5 font-semibold text-slate-900">{firstRecord.guest}</dd></div>
              <div><dt className="text-xs text-slate-500">{localizedText("Số điện thoại", "Phone")}</dt><dd className="mt-0.5 font-semibold text-slate-900">{firstRecord.phone || localizedText("Chưa cập nhật", "Not provided")}</dd></div>
              <div><dt className="text-xs text-slate-500">{localizedText("CCCD", "National ID")}</dt><dd className="mt-0.5 font-semibold text-slate-900">{firstRecord.identityNumber || localizedText("Chưa cập nhật", "Not provided")}</dd></div>
              <div><dt className="text-xs text-slate-500">{localizedText("Số phòng", "Rooms")}</dt><dd className="mt-0.5 font-semibold text-slate-900">{records.length}</dd></div>
              <div><dt className="text-xs text-slate-500">{localizedText("Tổng số khách", "Total guests")}</dt><dd className="mt-0.5 font-semibold text-slate-900">{records.reduce((total, record) => total + (record.guests ?? 0), 0)}</dd></div>
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800"><CalendarDays size={16} className="text-blue-600" />{localizedText("Chi tiết từng phòng", "Room details")}</h3>
            <div className="mt-3 divide-y divide-slate-100">
              {records.map((record) => {
                const roomNumber = record.room.split(" · ")[0];
                const roomType = record.room.split(" · ")[1] ?? localizedText("Phòng", "Room");
                const roomServices = record.services ?? [];
                const roomServiceTotal = roomServices.reduce((total, service) => total + serviceAmount(record, service), 0);
                const earlyCheckInFee = Number(record.earlyCheckInFee ?? 0);
                const lateCheckOutFee = Number(record.lateFee ?? 0);
                const otherSurcharges = Number(record.otherSurcharges ?? 0);
                const recordTotal = Number(record.roomAmount ?? 0) + roomServiceTotal + earlyCheckInFee + lateCheckOutFee + otherSurcharges;
                return (
                  <div key={record.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-sm text-slate-900">{localizedText("Phòng", "Room")} {roomNumber} · {roomType}</strong>
                    </div>
                    <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                      <p>Check-in: {formatDateTime(record.checkInAt, language)}</p>
                      <p>Check-out: {formatDateTime(record.checkOutAt, language)}</p>
                      <p>{localizedText("Số khách", "Guests")}: {record.guests ?? localizedText("Chưa cập nhật", "Not provided")}</p>
                      <p>{localizedText("Trạng thái", "Status")}: {localizedText(record.status, record.status === "Chờ check-in" ? "Awaiting check-in" : record.status === "Đang ở" ? "In-house" : record.status === "Đã check-in" ? "Checked in" : record.status === "Đã trả phòng" ? "Checked out" : record.status)}</p>
                    </div>
                    <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs">
                      <div className="flex justify-between gap-3"><span className="text-slate-600">{localizedText("Tiền phòng", "Room charge")}</span><strong>{money(record.roomAmount ?? 0, language)}</strong></div>
                      {earlyCheckInFee > 0 && <div className="flex justify-between gap-3 text-slate-600"><span>{localizedText("Phụ thu check-in sớm", "Early check-in surcharge")}</span><strong>{money(earlyCheckInFee, language)}</strong></div>}
                      {lateCheckOutFee > 0 && <div className="flex justify-between gap-3 text-amber-700"><span>{localizedText("Phụ thu check-out trễ", "Late check-out surcharge")}</span><strong>{money(lateCheckOutFee, language)}</strong></div>}
                      {otherSurcharges > 0 && <div className="flex justify-between gap-3 text-amber-700"><span>{localizedText("Phụ thu khác", "Other surcharges")}</span><strong>{money(otherSurcharges, language)}</strong></div>}
                      {roomServices.map((service, index) => (
                        <div key={`${service.serviceDetailId ?? service.serviceId ?? service.name}-${index}`} className="flex items-center justify-between gap-3 text-slate-600">
                          <span>{service.name} · {money(service.quantity > 0 ? service.amount / service.quantity : 0, language)} × {isEditingServices && canEditRecordServices(record) && service.serviceDetailId && service.used !== true
                            ? <input
                              type="number"
                              min="0"
                              step="1"
                              value={serviceQuantities[serviceKey(record.id, service.serviceDetailId)] ?? service.quantity}
                              onChange={(event) => setServiceQuantities((current) => ({
                                ...current,
                                [serviceKey(record.id, service.serviceDetailId as string)]: Math.max(0, Math.floor(Number(event.target.value) || 0)),
                              }))}
                              aria-label={`${localizedText("Số lượng", "Quantity")} ${service.name} ${localizedText("phòng", "room")} ${roomNumber}`}
                              className="mx-1 h-7 w-16 rounded border border-slate-300 bg-white px-2 text-center"
                            />
                            : service.quantity}</span><strong className="text-slate-900">{money(serviceAmount(record, service), language)}</strong>
                        </div>
                      ))}
                      <div className="flex justify-between gap-3 border-t border-slate-100 pt-1"><span className="font-semibold text-slate-700">{localizedText("Tạm tính phòng", "Room subtotal")}</span><strong className="text-blue-700">{money(recordTotal, language)}</strong></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800"><CreditCard size={16} className="text-blue-600" />{localizedText("Thanh toán", "Payment")}</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-600">{localizedText("Tổng tiền phòng", "Room total")}</dt><dd className="font-semibold text-slate-900">{money(roomTotal, language)}</dd></div>
              {earlyCheckInFeeTotal > 0 && <div className="flex justify-between gap-3"><dt className="text-slate-600">{localizedText("Tổng phụ thu check-in sớm", "Total early check-in surcharge")}</dt><dd className="font-semibold text-slate-900">{money(earlyCheckInFeeTotal, language)}</dd></div>}
              {lateCheckOutFeeTotal > 0 && <div className="flex justify-between gap-3"><dt className="text-amber-700">{localizedText("Tổng phụ thu check-out trễ", "Total late check-out surcharge")}</dt><dd className="font-semibold text-amber-700">{money(lateCheckOutFeeTotal, language)}</dd></div>}
              {otherSurchargesTotal > 0 && <div className="flex justify-between gap-3"><dt className="text-amber-700">{localizedText("Tổng phụ thu khác", "Total other surcharges")}</dt><dd className="font-semibold text-amber-700">{money(otherSurchargesTotal, language)}</dd></div>}
              <div className="flex justify-between gap-3"><dt className="text-slate-600">{localizedText("Tổng tiền dịch vụ", "Service total")}</dt><dd className="font-semibold text-slate-900">{money(serviceTotal, language)}</dd></div>
              <div className="flex justify-between gap-3 border-t border-blue-100 pt-2"><dt className="font-bold text-slate-800">{localizedText("Tổng tiền phòng và dịch vụ", "Rooms and services total")}</dt><dd className="font-bold text-blue-700">{money(totalAmount, language)}</dd></div>
              {hasPaidAmount && <div className="flex justify-between gap-3"><dt className="text-slate-600">{localizedText("Tổng đã thanh toán", "Total paid")}</dt><dd className="font-semibold text-emerald-700">{money(paidTotal, language)}</dd></div>}
              {hasRemainingAmount && <div className="flex justify-between gap-3"><dt className="text-slate-600">{localizedText("Còn phải thanh toán", "Balance due")}</dt><dd className="font-semibold text-slate-900">{money(remainingTotal, language)}</dd></div>}
              {groupPaid !== undefined && <div className="flex justify-between gap-3"><dt className="text-slate-600">{localizedText("Trạng thái thanh toán", "Payment status")}</dt><dd className={`font-semibold ${groupPaid ? "text-emerald-700" : "text-rose-700"}`}>{groupPaid ? localizedText("Đã thanh toán đủ", "Paid in full") : localizedText("Chưa thanh toán đủ", "Payment incomplete")}</dd></div>}
            </dl>
          </section>
          {isEditingServices && (
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsEditingServices(false)} disabled={isSavingServices} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">{localizedText("Hủy", "Cancel")}</button>
              <button type="button" onClick={() => void saveServiceEdits()} disabled={isSavingServices} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">{isSavingServices ? localizedText("Đang lưu...", "Saving...") : <><Check size={15} />{localizedText("Lưu dịch vụ", "Save services")}</>}</button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
