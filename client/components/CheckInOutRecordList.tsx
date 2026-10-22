import { useTranslation } from "react-i18next";
import { localizedText } from "../i18n";
import { AlertTriangle, Clock3, Eye, LogIn, LogOut } from "lucide-react";
import BatchStayCard from "./BatchStayCard";

export type ServiceCharge = { serviceId?: string; serviceDetailId?: string; name: string; quantity: number; amount: number; usedAt?: string; used?: boolean };

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
  otherSurcharges?: number;
  estimatedEarlyCheckInFee?: number;
  remainingAmount?: number;
  surplusAmount?: number;
  services?: ServiceCharge[];
  lateFee?: number;
  lateFeeIncludedInRemainingAmount?: boolean;
  identityNumber?: string;
  historical?: boolean;
};

type CheckInOutRecordListProps = {
  records: DailyRecord[];
  groupedRecordIds: Set<string>;
  pendingGroupedRecords?: DailyRecord[][];
  completedGroupedRecords?: DailyRecord[][];
  recordServices: Record<string, ServiceCharge[]>;
  checkMatrixCheckInConflict: (record: DailyRecord) => { message: string } | null;
  onRecordAction: (record: DailyRecord) => void;
  onAddService: (record: DailyRecord) => void;
  onAddServiceGroup?: (records: DailyRecord[]) => void;
  onCheckoutGroup?: (records: DailyRecord[]) => void;
  onUndo: (record: DailyRecord) => void;
  onViewBooking: (record: DailyRecord | DailyRecord[]) => void;
};

export default function CheckInOutRecordList({
  records,
  groupedRecordIds,
  pendingGroupedRecords = [],
  completedGroupedRecords = [],
  recordServices,
  checkMatrixCheckInConflict,
  onRecordAction,
  onAddService,
  onAddServiceGroup,
  onCheckoutGroup,
  onUndo,
  onViewBooking,
}: CheckInOutRecordListProps) {
  const { t, i18n } = useTranslation();
  const visibleRecords = records.filter((record) => !groupedRecordIds.has(record.id));
  const pendingRecords = visibleRecords.filter((record) => record.status === "Chờ check-in" || record.status === "Đang ở");
  const completedRecords = visibleRecords.filter((record) => record.status === "Đã check-in" || record.status === "Đã trả phòng");

  const renderRecord = (record: DailyRecord) => {
    const isCheckIn = record.flow === "check-in";
    const canComplete = (isCheckIn && record.status === "Chờ check-in") || (!isCheckIn && record.status === "Đang ở");
    const canUndo = !record.historical && ((isCheckIn && record.status === "Đã check-in") || (!isCheckIn && record.status === "Đã trả phòng"));
    const services = recordServices[record.id] ?? record.services ?? [];
    const serviceTotal = services.reduce((total, service) => total + service.amount, 0) + (record.lateFee || 0);
    const totalAmount = Number(record.roomAmount ?? 0) + serviceTotal + Number(record.earlyCheckInFee ?? 0);
    const matrixConflict = isCheckIn && record.status === "Chờ check-in" ? checkMatrixCheckInConflict(record) : null;

    return (
      <article
        key={record.id}
        className={`mx-4 my-3 overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md ${
          matrixConflict ? "border-rose-300 ring-1 ring-rose-200" : isCheckIn ? "border-blue-200" : "border-amber-200"
        }`}
      >
        <div className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${matrixConflict ? "bg-rose-100 text-rose-700" : isCheckIn ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
                {isCheckIn ? <LogIn size={18} /> : <LogOut size={18} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h4 className="truncate text-sm font-bold text-slate-900">{record.guest}</h4>
                  {record.identityNumber && <span className="text-xs text-slate-500">{localizedText("CCCD", "National ID")} <strong className="font-semibold text-slate-700">{record.identityNumber}</strong></span>}
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${record.roomPaid ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${record.roomPaid ? "bg-emerald-500" : "bg-rose-500"}`} />
                    {record.roomPaid ? localizedText("Đã thanh toán", "Paid") : localizedText("Chưa thanh toán", "Unpaid")}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  {record.bookingId && <span>{localizedText("Mã booking", "Booking ID")}: <strong className="font-semibold text-slate-700">{record.bookingId}</strong></span>}
                  <span className="inline-flex items-center gap-1"><Clock3 size={12} />{localizedText(isCheckIn ? `Nhận lúc ${record.time}` : `Trả lúc ${record.time}`, isCheckIn ? `Check-in at ${record.time}` : `Check-out at ${record.time}`)}</span>
                </div>
              </div>
            </div>
            {matrixConflict && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800">
                <AlertTriangle size={16} className="shrink-0 text-rose-600" />
                <span>{matrixConflict.message}</span>
              </div>
            )}
            <div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{localizedText("Phòng", "Room")}</p>
                <p className="mt-1 text-sm font-bold text-blue-700">{record.room.split(" · ")[0]} <span className="font-medium text-slate-500">{record.room.split(" · ")[1] ?? ""}</span></p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{localizedText("Số khách", "Guests")}</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{record.guests ?? 0}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{localizedText("Tổng tiền", "Total")}</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{totalAmount.toLocaleString(i18n.language.startsWith("en") ? "en-US" : "vi-VN")}{i18n.language.startsWith("en") ? " VND" : "đ"}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <button type="button" onClick={() => onViewBooking(record)} aria-label={localizedText("Xem chi tiết booking", "View booking details")} title={localizedText("Xem chi tiết booking", "View booking details")} className="inline-flex h-10 w-36 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
            <Eye size={16} />{localizedText("Xem chi tiết", "View details")}
          </button>
          {!isCheckIn && record.status !== "Đã trả phòng" && record.status !== "Đang ở" && (
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${record.status === "Đã check-in" || record.status === "Đã trả phòng" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
              {statusLabel}
            </span>
          )}
          {canComplete && (
            <button type="button" onClick={() => onRecordAction(record)} className={`flex h-10 w-36 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-bold text-white shadow-sm transition hover:shadow-md ${matrixConflict ? "bg-rose-600 hover:bg-rose-700" : isCheckIn ? "bg-blue-600 hover:bg-blue-700" : "bg-amber-600 hover:bg-amber-700"}`}>
              {isCheckIn ? "Check-in" : "Check-out"}
            </button>
          )}
          {(record.status === "Chờ check-in" || record.status === "Đang ở" || record.status === "Đã check-in") && <button type="button" onClick={() => onAddService(record)} className="inline-flex h-10 w-36 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-blue-200 px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-50">{localizedText("Thêm dịch vụ", "Add service")}</button>}
          {canUndo && <button type="button" onClick={() => onUndo(record)} className={`inline-flex h-10 w-36 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border px-3 text-xs font-bold transition ${isCheckIn ? "border-blue-200 text-blue-700 hover:bg-blue-50" : "border-amber-200 text-amber-700 hover:bg-amber-50"}`}>{isCheckIn ? localizedText("Bỏ check-in", "Undo check-in") : localizedText("Bỏ check-out", "Undo check-out")}</button>}
          </div>
        </div>
      </article>
    );
  };

  const renderStatusGroup = (title: string, groupedRecords: DailyRecord[], isCompleted: boolean, groupedBookings: DailyRecord[][] = []) => {
    const totalCount = groupedRecords.length + groupedBookings.reduce((count, group) => count + group.length, 0);
    if (totalCount === 0) return null;
    return (
      <div className="border-b border-slate-100 last:border-0">
        <div className="flex items-center justify-between bg-slate-50 px-5 py-3">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
            {!isCompleted && <Clock3 size={14} className="text-amber-600" />}
            {title} ({totalCount})
          </p>
          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${isCompleted ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{isCompleted ? localizedText("Đã xử lý", "Completed") : localizedText("Chờ xử lý", "Pending")}</span>
        </div>
        {groupedRecords.map(renderRecord)}
        {groupedBookings.map((group) => {
          const firstRecord = group[0];
          if (!firstRecord) return null;
          return (
            <BatchStayCard
              key={`checkout-group-${firstRecord.bookingId ?? firstRecord.id}`}
              mode="check-out"
              title={firstRecord.guest}
              bookingCode={firstRecord.bookingId}
              identityNumber={firstRecord.identityNumber}
              description={localizedText(`${group.length} phòng · ${group.reduce((total, record) => total + (record.guests ?? 0), 0)} khách · Trả lúc ${firstRecord.time}`, `${group.length} rooms · ${group.reduce((total, record) => total + (record.guests ?? 0), 0)} guests · Departure at ${firstRecord.time}`)}
              items={group.map((record) => ({
                id: record.id,
                title: record.room,
                subtitle: record.bookingId ?? "",
                status: "pending",
                roomPaid: record.roomPaid,
              }))}
              selectedIds={[]}
              draftSelectedIds={[]}
              actionLabel={localizedText("Check-out các phòng", "Check out rooms")}
              actionCount={group.length}
              actionDisabled={false}
              onViewBooking={() => onViewBooking(group)}
              onAddService={onAddServiceGroup ? () => onAddServiceGroup(group) : undefined}
              onAction={(selectedIds) => {
                const selectedRecords = group.filter((record) => selectedIds.includes(record.id));
                if (selectedRecords.length > 0) onCheckoutGroup?.(selectedRecords);
              }}
            />
          );
        })}
      </div>
    );
  };

  const completedTitle = records[0]?.flow === "check-in"
    ? localizedText("Đã check-in hôm nay", "Checked in today")
    : localizedText("Đã check-out hôm nay", "Checked out today");
  const completedCount = completedRecords.length + completedGroupedRecords.reduce((count, group) => count + group.length, 0);
  const completedEntries = [
    ...completedGroupedRecords.map((group) => ({ group, record: null as DailyRecord | null })),
    ...completedRecords.map((record) => ({ group: null as DailyRecord[] | null, record })),
  ].sort((left, right) => {
    const getProcessedAt = (entry: typeof left) => {
      const timestamps = entry.group
        ? entry.group.map((record) => record.checkInAt ?? record.checkOutAt)
        : [entry.record?.checkInAt ?? entry.record?.checkOutAt];
      return timestamps.reduce((latest, timestamp) => {
        const parsed = timestamp ? new Date(timestamp).getTime() : 0;
        return Number.isFinite(parsed) ? Math.max(latest, parsed) : latest;
      }, 0);
    };
    return getProcessedAt(right) - getProcessedAt(left);
  });

  return <>
    {renderStatusGroup(localizedText("Chờ xử lý", "Pending"), pendingRecords, false, pendingGroupedRecords)}
    {(completedCount > 0) && (
      <div className="border-b border-slate-100 last:border-0">
        <div className="flex items-center justify-between bg-slate-50 px-5 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">{completedTitle} ({completedCount})</p>
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">{localizedText("Đã xử lý", "Completed")}</span>
        </div>
        {completedEntries.map(({ group, record }) => {
          if (!group) return record ? renderRecord(record) : null;
          const firstRecord = group[0];
          return (
            <BatchStayCard
              key={`completed-${firstRecord.bookingId ?? firstRecord.id}`}
              mode="check-in"
              title={firstRecord.guest}
              bookingCode={firstRecord.bookingId}
              identityNumber={firstRecord.identityNumber}
              description={localizedText(
                `${group.length} phòng · ${group.reduce((total, record) => total + (record.guests ?? 0), 0)} khách · Đã check-in`,
                `${group.length} rooms · ${group.reduce((total, record) => total + (record.guests ?? 0), 0)} guests · Checked in`,
              )}
              items={group.map((record) => ({
                id: record.id,
                title: record.room,
                subtitle: "",
                status: "complete",
                roomPaid: record.roomPaid,
              }))}
              selectedIds={group.map((record) => record.id)}
              draftSelectedIds={group.map((record) => record.id)}
              actionLabel=""
              showAction={false}
              showSelectionFooter={false}
              onAddService={onAddServiceGroup ? () => onAddServiceGroup(group) : undefined}
              onViewBooking={() => onViewBooking(group)}
              onAction={() => undefined}
            />
          );
        })}
      </div>
    )}
  </>;
}
