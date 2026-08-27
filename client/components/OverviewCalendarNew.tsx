import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const rows = [
  { id: "A-1-1", name: "standardRoom", guest: "Nguyễn Minh Anh", start: 0, end: 2 },
  { id: "A-1-2", name: "standardRoom", guest: "Trần Thùy Dương", start: 1, end: 4 },
  { id: "B-3-2", name: "deluxeRoom", guest: "Phạm Gia Huy", start: 0, end: 4 },
  { id: "C-4-1", name: "suiteRoom", guest: "Công ty VinaTech", start: 2, end: 4 },
  { id: "D-2-1", name: "superiorRoom", guest: "Đỗ Khánh Linh", start: 5, end: 7 },
];

const formatDate = (value: string, fallback: string, language: string) => value
  ? new Date(`${value}T00:00:00`).toLocaleDateString(language === "en" ? "en-US" : "vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
  : fallback;

export default function OverviewCalendarNew() {
  const { t, i18n } = useTranslation();
  const [selectedDate, setSelectedDate] = useState("2026-08-21");
  const [weekOffset, setWeekOffset] = useState(0);
  const dateInput = useRef<HTMLInputElement>(null);
  const startDate = new Date(2026, 7, 17 + weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const labels = ["sunShort", "monShort", "tueShort", "wedShort", "thuShort", "friShort", "satShort"];
    return { date: date.toISOString().slice(0, 10), number: date.getDate(), label: t(`calendar.${labels[date.getDay()]}`) };
  });
  const openDatePicker = () => { dateInput.current?.showPicker?.(); dateInput.current?.click(); };
  const selectDate = (value: string) => { const picked = new Date(`${value}T00:00:00`); const base = new Date(2026, 7, 17); setSelectedDate(value); setWeekOffset(Math.floor((picked.getTime() - base.getTime()) / 604800000)); };
  useEffect(() => { const picked = new Date(`${selectedDate}T00:00:00`); const base = new Date(2026, 7, 17); setWeekOffset(Math.floor((picked.getTime() - base.getTime()) / 604800000)); }, [selectedDate]);

  return <section className="mt-7 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><CalendarDays size={17} className="text-blue-600" /><h3 className="font-bold text-slate-900">{t("calendar.title")}</h3></div><p className="mt-1 text-xs text-slate-400">{t("calendar.subtitle")}</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => setWeekOffset((value) => value - 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-blue-50 hover:text-blue-600"><ChevronLeft size={16} /></button><button type="button" onClick={openDatePicker} className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-700"><CalendarDays size={14} className="text-blue-600" />{formatDate(selectedDate, t("common.noDateSelected", "No date selected"), i18n.language)}</button><input ref={dateInput} type="date" value={selectedDate} onChange={(event) => selectDate(event.target.value)} className="pointer-events-none absolute h-0 w-0 opacity-0" tabIndex={-1} /><button type="button" onClick={() => setWeekOffset((value) => value + 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-blue-50 hover:text-blue-600"><ChevronRight size={16} /></button></div></div><div className="overflow-x-auto"><div className="min-w-[800px]"><div className="grid grid-cols-[175px_repeat(7,minmax(90px,1fr))] border-b border-slate-100 bg-slate-50"><div className="p-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("calendar.room")}</div>{days.map((day) => <div key={day.date} className={`border-l border-slate-100 p-3 text-center ${day.date === selectedDate ? "bg-blue-50" : ""}`}><p className="text-[10px] font-bold uppercase text-slate-400">{day.label}</p><p className={`mt-1 text-sm font-bold ${day.date === selectedDate ? "text-blue-700" : "text-slate-700"}`}>{day.number}</p></div>)}</div>{rows.map((row) => <div key={row.id} className="grid min-h-[74px] grid-cols-[175px_repeat(7,minmax(90px,1fr))] border-b border-slate-100 last:border-0"><div className="flex items-center gap-2.5 px-4"><span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-600">{row.id}</span><span><b className="block text-xs text-slate-800">{t(`calendar.${row.name}`)}</b><small className="text-[10px] text-slate-400">{row.guest}</small></span></div>{days.map((day, index) => <div key={day.date} className="border-l border-slate-100 p-1.5">{index >= row.start && index < row.end ? <div className="flex h-full min-h-12 items-center rounded-lg bg-blue-50 px-2 text-[10px] font-semibold text-blue-800">{t("calendar.booked")}</div> : <div className="h-full min-h-12 rounded-lg bg-emerald-50/50" />}</div>)}</div>)}</div></div></section>;
}
