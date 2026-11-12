import { localizedText } from "../i18n";
import BankSelectionField from "./BankSelectionField";
import type { CheckoutSurplusRefundSelection } from "../services/checkInOutApi";

export type { CheckoutSurplusRefundMethod } from "../services/checkInOutApi";

type CheckoutSurplusRefundChoiceProps = {
  name: string;
  value: CheckoutSurplusRefundSelection | null;
  onChange: (selection: CheckoutSurplusRefundSelection) => void;
};

export default function CheckoutSurplusRefundChoice({
  name,
  value,
  onChange,
}: CheckoutSurplusRefundChoiceProps) {
  return (
    <fieldset className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
      <legend className="px-1 text-sm font-semibold text-slate-800">
        {localizedText("Nếu có khoản thu dư, chọn cách hoàn", "Choose a refund method for any surplus payment")}
      </legend>
      <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-white p-3 text-sm">
        <input
          type="radio"
          name={name}
          checked={value?.method === "CASH"}
          onChange={() => onChange({ method: "CASH" })}
          className="mt-0.5 accent-emerald-600"
        />
        <span>
          <span className="block font-semibold text-slate-800">{localizedText("Hoàn tiền mặt ngay tại quầy", "Refund in cash at the front desk")}</span>
          <span className="mt-0.5 block text-xs text-slate-500">{localizedText("Nhân viên giao tiền lại cho khách khi check-out.", "Staff will return the money to the guest at check-out.")}</span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-white p-3 text-sm">
        <input
          type="radio"
          name={name}
          checked={value?.method === "BANK"}
          onChange={() => onChange({
            method: "BANK",
            bankDetails: value?.bankDetails ?? {
              bankName: "",
              bankAccountName: "",
              bankAccountNumber: "",
            },
          })}
          className="mt-0.5 accent-blue-600"
        />
        <span>
          <span className="block font-semibold text-slate-800">{localizedText("Hoàn qua ngân hàng", "Refund by bank transfer")}</span>
          <span className="mt-0.5 block text-xs text-slate-500">{localizedText("Quản lý duyệt và chuyển khoản; tiền thường về trong 1–3 ngày làm việc kể từ khi chuyển.", "A manager approves and sends the transfer; funds usually arrive within 1–3 business days.")}</span>
        </span>
      </label>
      {value?.method === "BANK" && (
        <div className="grid gap-3 rounded-lg border border-blue-100 bg-white p-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <BankSelectionField
              id={`${name}-bank`}
              bankName={value.bankDetails?.bankName ?? ""}
              bankCode={value.bankDetails?.bankCode ?? ""}
              requireBankCode={false}
              onChange={(bankName, bankCode) => onChange({
                method: "BANK",
                bankDetails: {
                  bankName,
                  bankCode,
                  bankAccountName: value.bankDetails?.bankAccountName ?? "",
                  bankAccountNumber: value.bankDetails?.bankAccountNumber ?? "",
                },
              })}
            />
          </div>
          <label className="text-sm font-semibold text-slate-700">
            {localizedText("Tên chủ tài khoản", "Account holder name")} <span className="text-rose-600" aria-hidden="true">*</span>
            <input
              value={value.bankDetails?.bankAccountName ?? ""}
              onChange={(event) => onChange({
                method: "BANK",
                bankDetails: {
                  bankName: value.bankDetails?.bankName ?? "",
                  bankCode: value.bankDetails?.bankCode,
                  bankAccountName: event.target.value,
                  bankAccountNumber: value.bankDetails?.bankAccountNumber ?? "",
                },
              })}
              maxLength={120}
              required
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            {localizedText("Số tài khoản", "Account number")} <span className="text-rose-600" aria-hidden="true">*</span>
            <input
              inputMode="numeric"
              value={value.bankDetails?.bankAccountNumber ?? ""}
              onChange={(event) => onChange({
                method: "BANK",
                bankDetails: {
                  bankName: value.bankDetails?.bankName ?? "",
                  bankCode: value.bankDetails?.bankCode,
                  bankAccountName: value.bankDetails?.bankAccountName ?? "",
                  bankAccountNumber: event.target.value,
                },
              })}
              maxLength={50}
              required
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400"
            />
          </label>
          <p className="text-xs text-slate-500 sm:col-span-2">
            {localizedText("Thông tin tài khoản sẽ được mã hóa khi lưu.", "Account details will be encrypted when saved.")}
          </p>
        </div>
      )}
    </fieldset>
  );
}
