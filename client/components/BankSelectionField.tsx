import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { localizedText } from "../i18n";
import { vietnameseBanks } from "../lib/vietnameseBanks";
import ClearSearchButton from "./ClearSearchButton";
import FilterResultStatus from "./FilterResultStatus";

type BankSelectionFieldProps = {
  id?: string;
  bankName: string;
  bankCode: string;
  requireBankCode?: boolean;
  onChange: (bankName: string, bankCode: string) => void;
};

export default function BankSelectionField({
  id = "refund-bank-search",
  bankName,
  bankCode,
  requireBankCode = false,
  onChange,
}: BankSelectionFieldProps) {
  useTranslation();
  const listboxId = `${id}-options`;
  const [otherSelected, setOtherSelected] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedBank = vietnameseBanks.find((bank) => bank.bin === bankCode)
    ?? vietnameseBanks.find((bank) => bank.shortName.toLocaleLowerCase() === bankName.toLocaleLowerCase());
  const isOtherSelected = !selectedBank && (otherSelected || Boolean(bankName || bankCode));
  const filteredBanks = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return vietnameseBanks;
    return vietnameseBanks.filter((bank) =>
      bank.shortName.toLocaleLowerCase().includes(term) || bank.bin.includes(term),
    );
  }, [search]);

  return (
    <div className="space-y-2">
      <div
        className="relative"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setMenuOpen(false);
          }
        }}
      >
        <label className="block text-sm font-semibold text-slate-700" htmlFor={id}>
          {localizedText("Ngân hàng", "Bank")} <span className="text-rose-600" aria-hidden="true">*</span>
        </label>
        <div className="relative mt-1">
          <input
            id={id}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={menuOpen}
            aria-controls={listboxId}
            value={menuOpen ? search : selectedBank?.shortName ?? (isOtherSelected ? localizedText("Ngân hàng khác", "Other bank") : "")}
            onFocus={() => {
              setSearch("");
              setMenuOpen(true);
            }}
            onChange={(event) => {
              setSearch(event.target.value);
              setMenuOpen(true);
              setOtherSelected(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setMenuOpen(false);
              if (event.key === "Enter" && filteredBanks.length === 1) {
                event.preventDefault();
                const bank = filteredBanks[0];
                onChange(bank.shortName, bank.bin);
                setOtherSelected(false);
                setMenuOpen(false);
              }
            }}
            placeholder={localizedText("Tìm ngân hàng theo tên hoặc mã BIN", "Search banks by name or BIN")}
            autoComplete="off"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 pr-10 text-sm font-normal outline-none focus:border-blue-400"
          />
          <ClearSearchButton value={menuOpen ? search : ""} onClear={() => setSearch("")} label={localizedText("Xóa tìm kiếm", "Clear search")} />
        </div>
        {menuOpen && (
          <div
            id={listboxId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
          >
            {filteredBanks.map((bank) => (
              <button
                key={bank.bin}
                type="button"
                role="option"
                aria-selected={selectedBank?.bin === bank.bin}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(bank.shortName, bank.bin);
                  setOtherSelected(false);
                  setSearch("");
                  setMenuOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-blue-50"
              >
                <span>{bank.shortName}</span>
                <span className="text-xs text-slate-400">{bank.bin}</span>
              </button>
            ))}
            {filteredBanks.length === 0 && (
              <FilterResultStatus filterKey={search}><p className="px-3 py-2 text-sm text-slate-500">{localizedText("Không tìm thấy ngân hàng.", "No banks found.")}</p></FilterResultStatus>
            )}
            <button
              type="button"
              role="option"
              aria-selected={isOtherSelected}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setOtherSelected(true);
                onChange("", "");
                setSearch("");
                setMenuOpen(false);
              }}
              className="mt-1 w-full rounded-md border-t border-slate-100 px-3 py-2 text-left text-sm font-medium text-blue-700 hover:bg-blue-50"
            >
              {localizedText("Ngân hàng khác", "Other bank")}
            </button>
          </div>
        )}
      </div>
      {isOtherSelected ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="min-w-0 text-xs font-semibold text-slate-700">
            {localizedText("Tên ngân hàng", "Bank name")} <span className="text-rose-600" aria-hidden="true">*</span>
            <input
              aria-label={localizedText("Tên ngân hàng khác", "Other bank name")}
              value={bankName}
              onChange={(event) => onChange(event.target.value, bankCode)}
              maxLength={120}
              placeholder={localizedText("Nhập tên ngân hàng", "Enter bank name")}
              className="mt-1 h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-400"
            />
          </label>
          <label className="min-w-0 text-xs font-semibold text-slate-700">
            {localizedText("Mã BIN", "Bank BIN")}
            {requireBankCode ? <span className="text-rose-600" aria-hidden="true"> *</span> : null}
            <input
              aria-label={localizedText("Mã ngân hàng khác", "Other bank code")}
              value={bankCode}
              onChange={(event) => onChange(bankName, event.target.value)}
              maxLength={30}
              placeholder={localizedText("Nhập mã BIN", "Enter bank BIN")}
              className="mt-1 h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-400"
            />
          </label>
        </div>
      ) : selectedBank ? (
        <p className="text-xs font-normal text-slate-500">{localizedText("Mã BIN:", "BIN:")} {selectedBank.bin}</p>
      ) : null}
    </div>
  );
}
