'use client';

import { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { usePathname } from 'next/navigation';
import { DateRangePicker, MonthPicker } from '@/components/filter-date-pickers';

function setNativeValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function PickerPair({ fromInput, toInput, monthInput }: { fromInput: HTMLInputElement; toInput: HTMLInputElement; monthInput: HTMLInputElement }) {
  const [from, setFrom] = useState(fromInput.value);
  const [to, setTo] = useState(toInput.value);
  const [month, setMonth] = useState(monthInput.value);
  return <><DateRangePicker from={from} to={to} onChange={(nextFrom, nextTo) => { setFrom(nextFrom); setTo(nextTo); setNativeValue(fromInput, nextFrom); setNativeValue(toInput, nextTo); }}/><MonthPicker value={month} onChange={(nextMonth) => { setMonth(nextMonth); setNativeValue(monthInput, nextMonth); }}/></>;
}

export function NativeFilterPickerUpgrade() {
  const pathname = usePathname();
  useEffect(() => {
    const roots: Array<{ root: Root; host: HTMLDivElement; inputs: HTMLInputElement[] }> = [];
    document.querySelectorAll<HTMLElement>('.expense-filters, .worker-filter-grid').forEach((group) => {
      const dates = Array.from(group.querySelectorAll<HTMLInputElement>('input[type="date"]'));
      const month = group.querySelector<HTMLInputElement>('input[type="month"]');
      if (dates.length < 2 || !month || group.querySelector('.native-filter-picker-upgrade')) return;
      const host = document.createElement('div');
      host.className = 'native-filter-picker-upgrade';
      group.insertBefore(host, dates[0]);
      dates.forEach((input) => { input.hidden = true; });
      month.hidden = true;
      const root = createRoot(host);
      root.render(<PickerPair fromInput={dates[0]} toInput={dates[1]} monthInput={month}/>);
      roots.push({ root, host, inputs: [...dates, month] });
    });
    return () => roots.forEach(({ root, host, inputs }) => { root.unmount(); host.remove(); inputs.forEach((input) => { input.hidden = false; }); });
  }, [pathname]);
  return null;
}
