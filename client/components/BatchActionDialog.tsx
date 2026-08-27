import { CreditCard } from "lucide-react";

type BatchActionRoom = {
  id: string;
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
};

const formatMoney = (amount: number) => `${amount.toLocaleString("vi-VN")}đ`;

export default function BatchActionDialog({
  open,
  mode,
  rooms,
  selectedIds,
  onToggle,
  onClose,
  onConfirm,
}: BatchActionDialogProps) {
  if (!open) return null;

  const isCheckIn = mode === "check-in";
  const selectedRooms = rooms.filter((room) => selectedIds.includes(room.id));
  const total = selectedRooms.reduce((sum, room) => sum + (room.amount || 0), 0);

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onMouseDown={onClose}>
    <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wider ${isCheckIn ? "text-blue-600" : "text-amber-600"}`}>{isCheckIn ? "Check-in từng phòng" : "Check-out hàng loạt"}</p>
          <h3 className="mt-1 text-xl font-bold text-slate-900">{isCheckIn ? "Cập nhật trạng thái phòng" : `Xác nhận ${selectedRooms.length} phòng`}</h3>
          <p className="mt-1 text-sm text-slate-500">{isCheckIn ? "Bấm vào phòng để đổi trạng thái. Phòng vẫn giữ trong danh sách để chỉnh lại." : "Tiền phòng của các booking đã thanh toán trước."}</p>
        </div>
        <button type="button" onClick={onClose} className="text-2xl leading-none text-slate-400">×</button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {rooms.map((room) => {
          const checkedIn = room.status === "complete";
          const selected = selectedIds.includes(room.id);
          const active = isCheckIn ? checkedIn : selected;
          return <button type="button" key={room.id} onClick={() => onToggle(room.id)} className={`rounded-xl border p-4 text-left transition ${active ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50"}`}>
            <span className="flex items-center justify-between text-xs font-semibold text-slate-500"><span>{room.label}</span>{isCheckIn ? <span className={`rounded-full px-2 py-1 text-[10px] ${checkedIn ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{checkedIn ? "Đã check-in" : "Chờ check-in"}</span> : <input type="checkbox" checked={selected} onChange={() => onToggle(room.id)} onClick={(event) => event.stopPropagation()} className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500" />}</span>
            <span className="mt-2 block text-lg font-bold text-slate-900">{room.meta}</span>
            {isCheckIn ? <span className={`mt-1 block text-xs ${checkedIn ? "text-rose-600" : "text-blue-700"}`}>{checkedIn ? "Bấm để hoàn tác" : "Bấm để check-in"}</span> : <span className="mt-1 block text-xs font-semibold text-slate-500">{formatMoney(room.amount || 0)}</span>}
          </button>;
        })}
      </div>

      {!isCheckIn && <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4"><span className="font-bold text-slate-900">Tổng cần thanh toán</span><strong className="text-lg text-amber-700">{formatMoney(total)}</strong></div>}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">Hủy</button>
        {isCheckIn ? <button type="button" onClick={onClose} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white">Đóng</button> : <button type="button" disabled={selectedRooms.length === 0} onClick={onConfirm} className="flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><CreditCard size={16} />Thanh toán & Check-out</button>}
      </div>
    </div>
  </div>;
}
