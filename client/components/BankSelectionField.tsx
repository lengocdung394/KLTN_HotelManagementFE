import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { localizedText } from "../i18n";
import { vietnameseBanks } from "../lib/vietnameseBanks";

type BankSelectionFieldProps = {
  bankName: string;
  bankCode: string;
  onChange: (bankName: string, bankCode: string) => void;
};

export default function BankSelectionField({
  bankName,
  bankCode,
  onChange,
}: BankSelectionFieldProps) {
  useTranslation();
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
        <label className="block text-sm font-semibold text-slate-700" htmlFor="refund-bank-search">
          {localizedText("Ngân hàng *", "Bank *")}
        </label>
        <input
          id="refund-bank-search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={menuOpen}
          aria-controls="refund-bank-options"
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
          className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-400"
        />
        {menuOpen && (
          <div
            id="refund-bank-options"
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
              <p className="px-3 py-2 text-sm text-slate-500">{localizedText("Không tìm thấy ngân hàng.", "No banks found.")}</p>
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
          <input
            aria-label={localizedText("Tên ngân hàng khác", "Other bank name")}
            value={bankName}
            onChange={(event) => onChange(event.target.value, bankCode)}
            maxLength={120}
            placeholder={localizedText("Tên ngân hàng", "Bank name")}
            className="h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
          />
          <input
            aria-label={localizedText("Mã ngân hàng khác", "Other bank code")}
            value={bankCode}
            onChange={(event) => onChange(bankName, event.target.value)}
            maxLength={30}
            placeholder={localizedText("Mã ngân hàng (nếu biết)", "Bank code (if known)")}
            className="h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
          />
        </div>
      ) : selectedBank ? (
        <p className="text-xs font-normal text-slate-500">{localizedText("Mã BIN:", "BIN:")} {selectedBank.bin}</p>
      ) : null}
    </div>
  );
}
