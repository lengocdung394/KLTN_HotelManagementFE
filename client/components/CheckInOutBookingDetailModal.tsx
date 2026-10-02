import { CalendarDays, CreditCard, UserRound, X } from "lucide-react";
import type { DailyRecord, ServiceCharge } from "./CheckInOutRecordList";

type CheckInOutBookingDetailModalProps = {
  records: DailyRecord[];
  onClose: () => void;
};

const money = (value: number) => `${value.toLocaleString("vi-VN")}đ`;
const formatDateTime = (value?: string) => value
  ? new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })
  : "Chưa cập nhật";

export default function CheckInOutBookingDetailModal({ records, onClose }: CheckInOutBookingDetailModalProps) {
  const firstRecord = records[0];
  if (!firstRecord) return null;

  const roomTotal = records.reduce((total, record) => total + Number(record.roomAmount ?? 0), 0);
  const serviceTotal = records.reduce((total, record) => total + (record.services ?? []).reduce((sum, service) => sum + service.amount, 0), 0);
  const earlyCheckInFeeTotal = records.reduce((total, record) => total + Number(record.earlyCheckInFee ?? 0), 0);
  const totalAmount = roomTotal + serviceTotal + earlyCheckInFeeTotal;
  const paidAmounts = records.flatMap((record) => record.paidAmount === undefined ? [] : [record.paidAmount]);
  const remainingAmounts = records.flatMap((record) => record.remainingAmount === undefined ? [] : [record.remainingAmount]);
  const paymentStates = records.flatMap((record) => record.roomPaid === undefined ? [] : [record.roomPaid]);
  const groupPaid = paymentStates.length > 0 ? paymentStates.every(Boolean) : undefined;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" onMouseDown={onClose}>
      <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="checkin-booking-detail-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Chi tiết booking</p>
            <h2 id="checkin-booking-detail-title" className="mt-1 text-lg font-bold text-slate-900">{firstRecord.bookingId ?? firstRecord.id}</h2>
            <p className="mt-1 text-xs text-slate-500">{records.length} phòng · {firstRecord.flow === "check-in" ? "Check-in" : "Check-out"}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng chi tiết booking" title="Đóng" className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </header>

        <div className="space-y-4 p-5">
          <section className="rounded-lg border border-slate-200 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800"><UserRound size={16} className="text-blue-600" />Khách và phòng</h3>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">Khách hàng</dt><dd className="mt-0.5 font-semibold text-slate-900">{firstRecord.guest}</dd></div>
              <div><dt className="text-xs text-slate-500">Số điện thoại</dt><dd className="mt-0.5 font-semibold text-slate-900">{firstRecord.phone || "Chưa cập nhật"}</dd></div>
              <div><dt className="text-xs text-slate-500">CCCD</dt><dd className="mt-0.5 font-semibold text-slate-900">{firstRecord.identityNumber || "Chưa cập nhật"}</dd></div>
              <div><dt className="text-xs text-slate-500">Số phòng</dt><dd className="mt-0.5 font-semibold text-slate-900">{records.length}</dd></div>
              <div><dt className="text-xs text-slate-500">Tổng số khách</dt><dd className="mt-0.5 font-semibold text-slate-900">{records.reduce((total, record) => total + (record.guests ?? 0), 0)}</dd></div>
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800"><CalendarDays size={16} className="text-blue-600" />Chi tiết từng phòng</h3>
            <div className="mt-3 divide-y divide-slate-100">
              {records.map((record) => {
                const roomNumber = record.room.split(" · ")[0];
                const roomType = record.room.split(" · ")[1] ?? "Phòng";
                const roomServices = record.services ?? [];
                const roomServiceTotal = roomServices.reduce((total, service) => total + service.amount, 0);
                const earlyCheckInFee = Number(record.earlyCheckInFee ?? 0);
                const recordTotal = Number(record.roomAmount ?? 0) + roomServiceTotal + earlyCheckInFee;
                return (
                  <div key={record.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-sm text-slate-900">Phòng {roomNumber} · {roomType}</strong>
                    </div>
                    <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                      <p>Check-in: {formatDateTime(record.checkInAt)}</p>
                      <p>Check-out: {formatDateTime(record.checkOutAt)}</p>
                      <p>Số khách: {record.guests ?? "Chưa cập nhật"}</p>
                      <p>Trạng thái: {record.status}</p>
                    </div>
                    <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs">
                      <div className="flex justify-between gap-3"><span className="text-slate-600">Tiền phòng</span><strong>{money(record.roomAmount ?? 0)}</strong></div>
                      {earlyCheckInFee > 0 && <div className="flex justify-between gap-3 text-slate-600"><span>Phụ thu check-in sớm</span><strong>{money(earlyCheckInFee)}</strong></div>}
                      {record.paidAmount !== undefined && <div className="flex justify-between gap-3 text-slate-600"><span>Đã thanh toán</span><strong>{money(record.paidAmount)}</strong></div>}
                      {record.remainingAmount !== undefined && <div className="flex justify-between gap-3 text-slate-600"><span>Còn phải thanh toán</span><strong>{money(record.remainingAmount)}</strong></div>}
                      {roomServices.map((service, index) => (
                        <div key={`${service.serviceId ?? service.name}-${index}`} className="flex justify-between gap-3 text-slate-600">
                          <span>{service.name} × {service.quantity}</span><strong className="text-slate-900">{money(service.amount)}</strong>
                        </div>
                      ))}
                      <div className="flex justify-between gap-3 border-t border-slate-100 pt-1"><span className="font-semibold text-slate-700">Tạm tính phòng</span><strong className="text-blue-700">{money(recordTotal)}</strong></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800"><CreditCard size={16} className="text-blue-600" />Thanh toán</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-600">Tổng tiền phòng</dt><dd className="font-semibold text-slate-900">{money(roomTotal)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-600">Tổng phụ thu check-in sớm</dt><dd className="font-semibold text-slate-900">{money(earlyCheckInFeeTotal)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-600">Tổng tiền dịch vụ</dt><dd className="font-semibold text-slate-900">{money(serviceTotal)}</dd></div>
              <div className="flex justify-between gap-3 border-t border-blue-100 pt-2"><dt className="font-bold text-slate-800">Tổng tiền phòng và dịch vụ</dt><dd className="font-bold text-blue-700">{money(totalAmount)}</dd></div>
              {paidAmounts.length > 0 && <div className="flex justify-between gap-3"><dt className="text-slate-600">Tổng đã thanh toán</dt><dd className="font-semibold text-emerald-700">{money(paidAmounts.reduce((total, amount) => total + amount, 0))}</dd></div>}
              {remainingAmounts.length > 0 && <div className="flex justify-between gap-3"><dt className="text-slate-600">Còn phải thanh toán</dt><dd className="font-semibold text-slate-900">{money(remainingAmounts.reduce((total, amount) => total + amount, 0))}</dd></div>}
              {groupPaid !== undefined && <div className="flex justify-between gap-3"><dt className="text-slate-600">Trạng thái thanh toán</dt><dd className={`font-semibold ${groupPaid ? "text-emerald-700" : "text-rose-700"}`}>{groupPaid ? "Đã thanh toán đủ" : "Chưa thanh toán đủ"}</dd></div>}
            </dl>
          </section>
        </div>
      </section>
    </div>
  );
}
