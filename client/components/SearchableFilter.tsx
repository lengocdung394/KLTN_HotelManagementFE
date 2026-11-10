import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, LoaderCircle, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { localizedText } from "../i18n";

export type SearchableFilterOption = {
  value: string;
  label: string;
};

type SearchableFilterProps = {
  value: string;
  options: SearchableFilterOption[];
  onChange: (value: string) => void;
  searchPlaceholder: string;
  emptyMessage: string;
  ariaLabel: string;
  className?: string;
};

const normalize = (value: string) =>
  value.trim().toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export default function SearchableFilter({
  value,
  options,
  onChange,
  searchPlaceholder,
  emptyMessage,
  ariaLabel,
  className = "w-full",
}: SearchableFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isSearchingOptions, setIsSearchingOptions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = options.filter((option) => normalize(option.label).includes(normalize(query)));

  useEffect(() => {
    if (!query) {
      setIsSearchingOptions(false);
      return;
    }
    setIsSearchingOptions(true);
    const timeout = window.setTimeout(() => setIsSearchingOptions(false), 350);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
        setIsOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [isOpen]);

  const closeMenu = () => {
    setIsOpen(false);
    setQuery("");
  };

  return <div className={`relative ${className}`}>
    <div ref={containerRef} className="relative w-full">
      <SlidersHorizontal size={15} className="pointer-events-none absolute left-3 top-3 z-10 text-slate-400" />
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => { setIsOpen((open) => !open); setQuery(""); }}
        onKeyDown={(event) => {
          if (event.key === "Escape") closeMenu();
        }}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-left text-sm text-slate-600 outline-none transition hover:border-blue-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      >
        <span className="truncate">{selectedOption?.label ?? ariaLabel}</span>
        <ChevronDown size={15} className="shrink-0 text-slate-400" />
      </button>
      {isOpen && <div className="absolute left-0 top-full z-30 mt-1 w-full min-w-48 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-100 p-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") closeMenu();
              }}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-2 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
        <div role="listbox" aria-label={ariaLabel} className="max-h-60 overflow-y-auto p-1">
          {isSearchingOptions ? (
            <p className="flex items-center justify-center gap-2 px-3 py-4 text-center text-xs text-slate-500" role="status">
              <LoaderCircle size={14} className="animate-spin text-blue-500" />
              {localizedText("Đang tìm kiếm...", "Searching...")}
            </p>
          ) : filteredOptions.map((option) => (
            <button
            type="button"
            role="option"
            aria-selected={value === option.value}
            key={option.value}
            onClick={() => {
              onChange(option.value);
              closeMenu();
            }}
            className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-blue-50 ${value === option.value ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-600"}`}
          >
            <span className="truncate">{option.label}</span>
            {value === option.value && <Check size={14} className="shrink-0" />}
            </button>
          ))}
          {!isSearchingOptions && filteredOptions.length === 0 && <p className="px-3 py-4 text-center text-xs text-slate-400">{emptyMessage}</p>}
        </div>
      </div>}
    </div>
  </div>;
}

export function FilterResetButton({
  onClick,
  label,
  showLabel = false,
}: {
  onClick: () => void;
  label: string;
  showLabel?: boolean;
}) {
  return <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    className={`flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 ${showLabel ? "w-auto px-3" : "w-10"}`}
  >
    <RotateCcw size={15} />
    {showLabel && <span className="text-xs font-medium">{label}</span>}
  </button>;
}
