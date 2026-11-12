import { X } from "lucide-react";

type ClearSearchButtonProps = {
  value: string;
  onClear: () => void;
  label: string;
  className?: string;
};

export default function ClearSearchButton({ value, onClear, label, className = "" }: ClearSearchButtonProps) {
  if (!value) return null;

  return <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClear}
    className={`absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 ${className}`}
  >
    <X size={15} />
  </button>;
}
