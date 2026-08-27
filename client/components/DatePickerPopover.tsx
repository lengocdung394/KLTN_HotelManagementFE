import { useMemo, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

interface DatePickerPopoverProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  buttonClassName?: string;
  align?: "start" | "center" | "end";
  label?: string;
}

const weekDays = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export default function DatePickerPopover({
  value,
  onChange,
  placeholder = "Chọn ngày",
  buttonClassName,
  align = "end",
  label,
}: DatePickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(() => {
    const current = value ?? new Date();
    return new Date(current.getFullYear(), current.getMonth(), 1);
  });

  const pickerMonthLabel = useMemo(
    () =>
      pickerMonth.toLocaleDateString("vi-VN", {
        month: "long",
        year: "numeric",
      }),
    [pickerMonth],
  );

  const pickerYear = pickerMonth.getFullYear();
  const pickerMonthIndex = pickerMonth.getMonth();
  const firstDayOfMonth = new Date(pickerYear, pickerMonthIndex, 1).getDay();
  const daysInMonth = new Date(pickerYear, pickerMonthIndex + 1, 0).getDate();
  const today = new Date();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={
            buttonClassName ??
            "flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:text-blue-600"
          }
          aria-label={placeholder}
          title={placeholder}
        >
          <CalendarDays size={16} className="text-blue-600" />
          <span>{label ? `${label}: ` : ""}{value ? value.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : placeholder}</span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align={align}
        sideOffset={8}
        className="w-[min(19rem,calc(100vw-2rem))] rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,0.12)]"
      >
        <div className="flex items-center justify-between pb-3">
          <button
            type="button"
            onClick={() => setPickerMonth(new Date(pickerYear, pickerMonthIndex - 1, 1))}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Tháng trước"
          >
            <ChevronLeft size={16} />
          </button>

          <p className="text-sm font-bold capitalize text-slate-800">{pickerMonthLabel}</p>

          <button
            type="button"
            onClick={() => setPickerMonth(new Date(pickerYear, pickerMonthIndex + 1, 1))}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Tháng sau"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
          {weekDays.map((day) => (
            <span key={day} className="py-1">
              {day}
            </span>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: firstDayOfMonth }, (_, index) => (
            <span key={`empty-${index}`} className="h-9 w-9" />
          ))}

          {Array.from({ length: daysInMonth }, (_, index) => {
            const day = index + 1;
            const date = new Date(pickerYear, pickerMonthIndex, day);
            const isSelected = value && date.toDateString() === value.toDateString();
            const isToday = date.toDateString() === today.toDateString();

            return (
              <button
                key={day}
                type="button"
                onClick={() => {
                  onChange(date);
                  setOpen(false);
                }}
                className={`grid h-9 w-9 place-items-center rounded-lg text-xs font-medium transition ${
                  isSelected
                    ? "bg-blue-600 text-white shadow-sm"
                    : isToday
                      ? "border border-blue-200 bg-blue-50 font-bold text-blue-700"
                      : "text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            const current = new Date();
            onChange(current);
            setPickerMonth(new Date(current.getFullYear(), current.getMonth(), 1));
            setOpen(false);
          }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-50 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
        >
          <Check size={14} />
          Hôm nay
        </button>
      </PopoverContent>
    </Popover>
  );
}
