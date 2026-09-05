type EarlyLateStayNoticeProps = {
  action: "check-in" | "check-out";
  message: string;
  fee: number;
  onCancel: () => void;
  onConfirm: () => void;
};

const money = (value: number) => `${value.toLocaleString("vi-VN")}đ`;

export default function EarlyLateStayNotice({ action, message, fee, onCancel, onConfirm }: EarlyLateStayNoticeProps) {
  const isEarlyCheckIn = action === "check-in";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onMouseDown={onCancel}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <p className={`text-xs font-bold uppercase tracking-wider ${isEarlyCheckIn ? "text-blue-600" : "text-amber-600"}`}>
          {isEarlyCheckIn ? "Check-in sớm" : "Check-out trễ"}
        </p>
        <h3 className="mt-2 text-lg font-bold text-slate-900">Xác nhận phụ phí lưu trú</h3>
        <p className="mt-2 text-sm text-slate-500">{message}</p>
        <div className={`mt-4 rounded-xl p-4 ${isEarlyCheckIn ? "bg-blue-50" : "bg-amber-50"}`}>
          <p className="text-xs font-semibold text-slate-500">Phụ phí dự kiến</p>
          <p className={`mt-1 text-xl font-bold ${isEarlyCheckIn ? "text-blue-700" : "text-amber-700"}`}>{fee > 0 ? money(fee) : "Chưa tính phí"}</p>
          <p className="mt-1 text-xs text-slate-500">Có thể điều chỉnh lại trong hóa đơn nếu chính sách chi nhánh thay đổi.</p>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Hủy</button>
          <button type="button" onClick={onConfirm} className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white ${isEarlyCheckIn ? "bg-blue-600 hover:bg-blue-700" : "bg-amber-600 hover:bg-amber-700"}`}>Xác nhận và tiếp tục</button>
        </div>
      </div>
    </div>
  );
}
