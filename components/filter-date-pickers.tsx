'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const toDate = (value: string) => { if (!value) return null; const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day); };
const toValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const sameDay = (a: Date | null, b: Date | null) => !!a && !!b && toValue(a) === toValue(b);
const inRange = (date: Date, start: Date | null, end: Date | null) => !!start && !!end && date > start && date < end;

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const dismiss = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) close(); }; document.addEventListener('mousedown', dismiss); return () => document.removeEventListener('mousedown', dismiss); }, [open, close]);
  return ref;
}

function CalendarMonth({ month, start, end, onSelect }: { month: Date; start: Date | null; end: Date | null; onSelect: (date: Date) => void }) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((first + count) / 7) * 7 }, (_, index) => { const day = index - first + 1; return day < 1 || day > count ? null : new Date(month.getFullYear(), month.getMonth(), day); });
  return <section className="filter-calendar-month"><h3>{monthNames[month.getMonth()]} {month.getFullYear()}</h3><div className="filter-calendar-week">{weekDays.map(day => <span key={day}>{day}</span>)}</div><div className="filter-calendar-days">{cells.map((date, index) => date ? <button type="button" key={toValue(date)} className={`${sameDay(date, start) || sameDay(date, end) ? 'selected' : ''} ${inRange(date, start, end) ? 'in-range' : ''}`} onClick={() => onSelect(date)}>{date.getDate()}</button> : <span key={index}/>)}</div></section>;
}

export function DateRangePicker({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  const [open, setOpen] = useState(false), [draftFrom, setDraftFrom] = useState(from), [draftTo, setDraftTo] = useState(to);
  const initial = toDate(from) || new Date();
  const [visible, setVisible] = useState(() => new Date(initial.getFullYear(), initial.getMonth(), 1));
  const ref = useDismiss(open, () => setOpen(false));
  const start = toDate(draftFrom), end = toDate(draftTo), next = new Date(visible.getFullYear(), visible.getMonth() + 1, 1);
  const label = from && to ? `${from} — ${to}` : from ? `From ${from}` : to ? `Until ${to}` : 'Pick a date range';
  const select = (date: Date) => { const value = toValue(date); if (!start || end || date < start) { setDraftFrom(value); setDraftTo(''); } else setDraftTo(value); };
  return <div className="filter-picker" ref={ref}><button type="button" className="filter-picker-trigger" aria-label="Pick a date range" aria-expanded={open} onClick={() => { setDraftFrom(from); setDraftTo(to); const date = toDate(from) || new Date(); setVisible(new Date(date.getFullYear(), date.getMonth(), 1)); setOpen(true); }}><CalendarDays size={17}/><span>{label}</span></button>{open && <div className="filter-picker-popover filter-range-popover" role="dialog" aria-label="Choose date range"><div className="filter-calendar-nav"><button type="button" aria-label="Previous month" onClick={() => setVisible(month => new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={18}/></button><button type="button" aria-label="Next month" onClick={() => setVisible(month => new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={18}/></button></div><div className="filter-calendar-pair"><CalendarMonth month={visible} start={start} end={end} onSelect={select}/><CalendarMonth month={next} start={start} end={end} onSelect={select}/></div><footer><button type="button" onClick={() => { setDraftFrom(''); setDraftTo(''); }}>Clear</button><button type="button" className="apply" onClick={() => { onChange(draftFrom, draftTo); setOpen(false); }}>Apply</button></footer></div>}</div>;
}

export function MonthPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false), [year, setYear] = useState(() => Number(value.slice(0, 4)) || new Date().getFullYear());
  const ref = useDismiss(open, () => setOpen(false));
  const label = value ? `${monthNames[Number(value.slice(5, 7)) - 1]} ${value.slice(0, 4)}` : 'Pick a month';
  return <div className="filter-picker" ref={ref}><button type="button" className="filter-picker-trigger" aria-label="Pick a month" aria-expanded={open} onClick={() => { setYear(Number(value.slice(0, 4)) || new Date().getFullYear()); setOpen(true); }}><CalendarDays size={17}/><span>{label}</span></button>{open && <div className="filter-picker-popover filter-month-popover" role="dialog" aria-label="Choose month"><header><button type="button" aria-label="Previous year" onClick={() => setYear(current => current - 1)}><ChevronLeft size={18}/></button><b>{year}</b><button type="button" aria-label="Next year" onClick={() => setYear(current => current + 1)}><ChevronRight size={18}/></button></header><div className="filter-month-grid">{monthNames.map((month, index) => <button type="button" key={month} className={value === `${year}-${String(index + 1).padStart(2, '0')}` ? 'selected' : ''} onClick={() => { onChange(`${year}-${String(index + 1).padStart(2, '0')}`); setOpen(false); }}>{month.slice(0, 3)}</button>)}</div>{value && <footer><button type="button" onClick={() => { onChange(''); setOpen(false); }}>Clear</button></footer>}</div>}</div>;
}
