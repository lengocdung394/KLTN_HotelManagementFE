export type CheckoutSurplusRefundMethod = "CASH" | "BANK";

type CheckoutSurplusRefundChoiceProps = {
  name: string;
  value: CheckoutSurplusRefundMethod | null;
  onChange: (method: CheckoutSurplusRefundMethod) => void;
};

export default function CheckoutSurplusRefundChoice({
  name,
  value,
  onChange,
}: CheckoutSurplusRefundChoiceProps) {
  return (
    <fieldset className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
      <legend className="px-1 text-sm font-semibold text-slate-800">
        Nếu có khoản thu dư, chọn cách hoàn
      </legend>
      <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-white p-3 text-sm">
        <input
          type="radio"
          name={name}
          checked={value === "CASH"}
          onChange={() => onChange("CASH")}
          className="mt-0.5 accent-emerald-600"
        />
        <span>
          <span className="block font-semibold text-slate-800">Hoàn tiền mặt ngay tại quầy</span>
          <span className="mt-0.5 block text-xs text-slate-500">Nhân viên giao tiền lại cho khách khi check-out.</span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-white p-3 text-sm">
        <input
          type="radio"
          name={name}
          checked={value === "BANK"}
          onChange={() => onChange("BANK")}
          className="mt-0.5 accent-blue-600"
        />
        <span>
          <span className="block font-semibold text-slate-800">Hoàn qua ngân hàng</span>
          <span className="mt-0.5 block text-xs text-slate-500">Quản lý xử lý thủ công trong 1–3 ngày; có thể kiểm tra hoặc cập nhật tài khoản nhận.</span>
        </span>
      </label>
    </fieldset>
  );
}
