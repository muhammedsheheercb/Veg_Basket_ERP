'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { ListFilters, ListPagination, useListControls } from '@/components/list-controls';

const config: Record<string, { selector: string; dateIndex?: number; placeholder: string }> = {
  '/sales': { selector: '.supplier-row:not(.labels)', dateIndex: 2, placeholder: 'Search invoice, customer, or amount…' },
  '/purchases': { selector: '.supplier-row:not(.labels)', dateIndex: 2, placeholder: 'Search bill, supplier, or reference…' },
  '/suppliers': { selector: '.supplier-row:not(.labels)', placeholder: 'Search supplier, mobile, or balance…' },
  '/customers': { selector: '.supplier-row:not(.labels)', placeholder: 'Search customer, mobile, or balance…' },
};

export function LegacyListControls() {
  const pathname = usePathname();
  const settings = config[pathname];
  const [ready, setReady] = useState(false);
  const [positioned, setPositioned] = useState(false);
  const [revision, setRevision] = useState(0);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const paginationRef = useRef<HTMLDivElement>(null);

  // These controls enhance legacy tables by moving DOM nodes. Delay that work
  // until all streamed page segments have had time to hydrate.
  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 750);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => setPositioned(false), [pathname]);

  useEffect(() => {
    if (!ready || !settings) return;
    const root = document.querySelector('main.management');
    setHost(root as HTMLElement | null);
    const observer = new MutationObserver(() => setRevision((value) => value + 1));
    if (root) observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname, ready, settings]);

  const rows = useMemo(() => {
    if (!host || !settings) return [];
    return Array.from(host.querySelectorAll<HTMLElement>(settings.selector)).map((element) => ({
      element,
      text: element.textContent || '',
      date: settings.dateIndex === undefined ? '' : (element.children[settings.dateIndex]?.textContent || '').trim().slice(0, 10)
    }));
  }, [host, revision, settings]);
  const controls = useListControls(rows, (row) => row.text, (row) => row.date);

  useEffect(() => {
    rows.forEach((row) => { row.element.style.display = controls.pageRows.includes(row) ? '' : 'none'; });
    return () => rows.forEach((row) => { row.element.style.display = ''; });
  }, [rows, controls.pageRows]);

  useLayoutEffect(() => {
    if (!ready) return;
    const panel = host?.querySelector('.data-panel');
    if (panel?.querySelector('.list-filters:not(.legacy-list-filters .list-filters)')) return;
    const filters = filtersRef.current;
    const pagination = paginationRef.current;
    if (panel && filters && panel.firstChild !== filters) panel.prepend(filters);
    if (panel && pagination && panel.lastChild !== pagination) panel.append(pagination);
    if (panel && filters && pagination) setPositioned(true);
  }, [host, pathname, ready, revision]);

  if (!ready || !settings || !host) return null;
  const panel = host.querySelector('.data-panel');
  if (!panel || panel.querySelector('.list-filters:not(.legacy-list-filters .list-filters)')) return null;
  return <>
    {createPortal(<div ref={filtersRef} className={`legacy-list-controls legacy-list-filters${positioned ? ' is-positioned' : ''}`}><ListFilters controls={controls} dateFilter={settings.dateIndex !== undefined} placeholder={settings.placeholder} /></div>, panel)}
    {createPortal(<div ref={paginationRef} className={`legacy-list-controls legacy-list-pagination${positioned ? ' is-positioned' : ''}`}><ListPagination controls={controls} /></div>, panel)}
  </>;
}
