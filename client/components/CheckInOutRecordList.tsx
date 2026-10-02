import { useTranslation } from "react-i18next";
import { AlertTriangle, Clock3, Eye, LogIn, LogOut } from "lucide-react";

export type ServiceCharge = { serviceId?: string; name: string; quantity: number; amount: number; usedAt?: string };

export type DailyRecord = {
  id: string;
  bookingId?: string;
  guest: string;
  phone?: string;
  room: string;
  time: string;
  checkInAt?: string;
  checkOutAt?: string;
  status: string;
  flow: "check-in" | "check-out";
  guests?: number;
  roomPaid?: boolean;
  paymentStatus?: string;
  paidAmount?: number;
  roomAmount?: number;
  totalAmount?: number;
  earlyCheckInFee?: number;
  remainingAmount?: number;
  services?: ServiceCharge[];
  lateFee?: number;
  identityNumber?: string;
};

type CheckInOutRecordListProps = {
  records: DailyRecord[];
  groupedRecordIds: Set<string>;
  recordServices: Record<string, ServiceCharge[]>;
  checkMatrixCheckInConflict: (record: DailyRecord) => { message: string } | null;
  onRecordAction: (record: DailyRecord) => void;
  onAddService: (record: DailyRecord) => void;
  onUndo: (record: DailyRecord) => void;
  onViewBooking: (record: DailyRecord) => void;
};

export default function CheckInOutRecordList({
  records,
  groupedRecordIds,
  recordServices,
  checkMatrixCheckInConflict,
  onRecordAction,
  onAddService,
  onUndo,
  onViewBooking,
}: CheckInOutRecordListProps) {
  const { t } = useTranslation();
  const visibleRecords = records.filter((record) => !groupedRecordIds.has(record.id));
  const pendingRecords = visibleRecords.filter((record) => record.status === "Chờ check-in" || record.status === "Đang ở");
  const completedRecords = visibleRecords.filter((record) => record.status === "Đã check-in" || record.status === "Đã trả phòng");

  const renderRecord = (record: DailyRecord) => {
    const isCheckIn = record.flow === "check-in";
    const canComplete = (isCheckIn && record.status === "Chờ check-in") || (!isCheckIn && record.status === "Đang ở");
    const canUndo = (isCheckIn && record.status === "Đã check-in") || (!isCheckIn && record.status === "Đã trả phòng");
    const services = recordServices[record.id] ?? record.services ?? [];
    const serviceTotal = services.reduce((total, service) => total + service.amount, 0) + (record.lateFee || 0);
    const totalAmount = Number(record.roomAmount ?? 0) + serviceTotal + Number(record.earlyCheckInFee ?? 0);
    const statusLabel = record.status === "Chờ check-in"
      ? t("frontDesk.waitingCheckIn")
      : record.status === "Đang ở"
        ? "Đang lưu trú"
        : record.status === "Đã check-in"
          ? "Đã check-in"
          : "Đã check-out";
    const matrixConflict = isCheckIn && record.status === "Chờ check-in" ? checkMatrixCheckInConflict(record) : null;

    return (
      <article
        key={record.id}
        className={`relative mx-4 my-3 flex flex-col gap-4 overflow-hidden rounded-xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between ${
          matrixConflict ? "border-rose-300 ring-1 ring-rose-200" : isCheckIn ? "border-blue-200" : "border-amber-200"
        }`}
      >
        <span className={`absolute right-4 top-4 h-3 w-3 rounded-full ring-2 ring-white shadow-sm ${record.roomPaid ? "bg-emerald-500" : "bg-rose-500"}`} title={record.roomPaid ? "Đã thanh toán đủ" : "Chưa thanh toán đủ"} aria-label={record.roomPaid ? "Đã thanh toán đủ" : "Chưa thanh toán đủ"} />
        <div className="flex items-center gap-3">
          <div className={`grid h-10 w-10 place-items-center rounded-full ${matrixConflict ? "bg-rose-100 text-rose-700" : isCheckIn ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
            {isCheckIn ? <LogIn size={18} /> : <LogOut size={18} />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-500">Tên:</span>
              <h4 className="text-sm font-bold text-slate-900">{record.guest}</h4>
              <span className="text-sm text-slate-500">CCCD: <strong className="text-slate-700">{record.identityNumber || "Chưa cập nhật"}</strong></span>
            </div>
            {matrixConflict && (
              <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/80 p-2.5 text-xs font-semibold text-rose-800 shadow-2xs">
                <AlertTriangle size={16} className="shrink-0 text-rose-600" />
                <span>{matrixConflict.message}</span>
              </div>
            )}
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Thông tin phòng</p>
              <div className="mt-2 grid gap-1.5 text-xs text-slate-500 sm:grid-cols-3">
                <span>Mã booking: <strong className="text-slate-700">{record.bookingId ?? "Chưa cập nhật"}</strong></span>
                <span>Số phòng: <strong className="text-blue-700">{record.room.split(" · ")[0]}</strong></span>
                <span>Tổng tiền: <strong className="text-slate-900">{totalAmount.toLocaleString("vi-VN")}đ</strong></span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
          <button type="button" onClick={() => onViewBooking(record)} aria-label="Xem chi tiết booking" title="Xem chi tiết booking" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
            <Eye size={16} />
          </button>
          {!isCheckIn && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${record.status === "Đã check-in" || record.status === "Đã trả phòng" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{statusLabel}</span>}
          {canComplete && (
            <button type="button" onClick={() => onRecordAction(record)} className={`flex w-36 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:shadow-md ${matrixConflict ? "bg-rose-600 hover:bg-rose-700" : isCheckIn ? "bg-blue-600 hover:bg-blue-700" : "bg-amber-600 hover:bg-amber-700"}`}>
              {isCheckIn ? "Check-in" : "Check-out"}
            </button>
          )}
          {isCheckIn && record.status === "Chờ check-in" && <button type="button" onClick={() => onAddService(record)} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50">Thêm dịch vụ</button>}
          {!isCheckIn && record.status === "Đang ở" && <button type="button" onClick={() => onAddService(record)} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50">Thêm dịch vụ</button>}
          {canUndo && <button type="button" onClick={() => onUndo(record)} className={`w-36 shrink-0 rounded-lg border px-4 py-2.5 text-xs font-bold transition ${isCheckIn ? "border-blue-200 text-blue-700 hover:bg-blue-50" : "border-amber-200 text-amber-700 hover:bg-amber-50"}`}>{isCheckIn ? "Bỏ check-in" : "Bỏ check-out"}</button>}
        </div>
      </article>
    );
  };

  const renderStatusGroup = (title: string, groupedRecords: DailyRecord[], isCompleted: boolean) => {
    if (groupedRecords.length === 0) return null;
    return (
      <div className="border-b border-slate-100 last:border-0">
        <div className="flex items-center justify-between bg-slate-50 px-5 py-3">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
            {!isCompleted && <Clock3 size={14} className="text-amber-600" />}
            {title} ({groupedRecords.length})
          </p>
          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${isCompleted ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{isCompleted ? "Đã xử lý" : "Chờ xử lý"}</span>
        </div>
        {groupedRecords.map(renderRecord)}
      </div>
    );
  };

  return <>
    {renderStatusGroup("Chờ xử lý", pendingRecords, false)}
    {renderStatusGroup("Đã check-in / Đã trả phòng", completedRecords, true)}
  </>;
}
