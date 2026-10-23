import { useTranslation } from "react-i18next";
import { localizedText } from "../i18n";

type EarlyLateStayNoticeProps = {
  action: "check-in" | "check-out";
  message: string;
  fee: number;
  roomFees?: Array<{ room: string; fee: number }>;
  onCancel: () => void;
  onConfirm: () => void;
};

const money = (value: number, language: string) => `${value.toLocaleString(language.startsWith("en") ? "en-US" : "vi-VN")}${language.startsWith("en") ? " VND" : "đ"}`;

export default function EarlyLateStayNotice({ action, message, fee, roomFees = [], onCancel, onConfirm }: EarlyLateStayNoticeProps) {
  const { i18n } = useTranslation();
  const language = i18n.language;
  const isEarlyCheckIn = action === "check-in";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onMouseDown={onCancel}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <p className={`text-xs font-bold uppercase tracking-wider ${isEarlyCheckIn ? "text-blue-600" : "text-amber-600"}`}>
          {isEarlyCheckIn ? localizedText("Check-in sớm", "Early check-in") : localizedText("Check-out trễ", "Late check-out")}
        </p>
        <h3 className="mt-2 text-lg font-bold text-slate-900">{isEarlyCheckIn ? localizedText("Xác nhận check-in sớm", "Confirm early check-in") : localizedText("Xác nhận phụ phí lưu trú", "Confirm stay surcharge")}</h3>
        <p className="mt-2 text-sm text-slate-500">{message}</p>
        <div className={`mt-4 rounded-xl p-4 ${isEarlyCheckIn ? "bg-blue-50" : "bg-amber-50"}`}>
          <p className="text-xs font-semibold text-slate-500">{isEarlyCheckIn ? localizedText("Phụ thu nếu check-in ngay", "Surcharge for checking in now") : localizedText("Phụ phí dự kiến", "Estimated surcharge")}</p>
          <p className={`mt-1 text-xl font-bold ${isEarlyCheckIn ? "text-blue-700" : "text-amber-700"}`}>{money(fee, language)}</p>
          {roomFees.length > 0 && (
            <div className="mt-3 divide-y divide-blue-100 rounded-lg border border-blue-100 bg-white px-3">
              {roomFees.map(({ room, fee: roomFee }) => (
                <div key={room} className="flex items-center justify-between gap-3 py-2 text-xs">
                  <span className="font-medium text-slate-600">{localizedText("Phòng", "Room")} {room}</span>
                  <span className="font-semibold text-slate-800">{money(roomFee, language)}</span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">{isEarlyCheckIn ? localizedText("Khoản phụ thu chỉ được ghi nhận khi bạn đồng ý và xác nhận check-in.", "This surcharge is recorded only after you approve and confirm check-in.") : localizedText("Có thể điều chỉnh lại trong hóa đơn nếu chính sách chi nhánh thay đổi.", "This amount may be adjusted on the invoice if branch policy changes.")}</p>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">{localizedText("Hủy", "Cancel")}</button>
          <button type="button" onClick={onConfirm} className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white ${isEarlyCheckIn ? "bg-blue-600 hover:bg-blue-700" : "bg-amber-600 hover:bg-amber-700"}`}>{isEarlyCheckIn ? localizedText("Đồng ý và check-in", "Approve and check in") : localizedText("Xác nhận và tiếp tục", "Confirm and continue")}</button>
        </div>
      </div>
    </div>
  );
}
