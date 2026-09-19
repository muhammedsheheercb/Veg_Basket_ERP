'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from 'lucide-react';
import { DateRangePicker, MonthPicker } from '@/components/filter-date-pickers';

const PAGE_SIZE = 10;

export function useListControls<T>(rows: T[], searchText: (row: T) => string, dateValue?: (row: T) => string | null) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [month, setMonth] = useState('');
  const [page, setPage] = useState(1);

  // Filtering local, already-loaded rows is inexpensive. Apply it immediately
  // so the visible result and current page cannot become out of sync.
  const updateQuery = (value: string) => {
    setQuery(value);
    setDebouncedQuery(value.trim().toLowerCase());
    setPage(1);
  };
  useEffect(() => setPage(1), [from, to, month]);
  useEffect(() => setPage(1), [rows]);

  const filtered = useMemo(() => rows.filter((row) => {
    const matchesSearch = !debouncedQuery || searchText(row).toLowerCase().includes(debouncedQuery);
    const date = dateValue?.(row) || '';
    return matchesSearch && (!from || date >= from) && (!to || date <= to) && (!month || date.startsWith(month));
  }), [rows, debouncedQuery, from, to, month, searchText, dateValue]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const reset = () => { setQuery(''); setDebouncedQuery(''); setFrom(''); setTo(''); setMonth(''); setPage(1); };

  return { query, setQuery: updateQuery, from, setFrom, to, setTo, month, setMonth, page: currentPage, setPage, filtered, pageRows, pageCount, reset, hasFilters: !!(query || from || to || month) };
}

export function ListFilters({ controls, dateFilter = false, placeholder = 'Search records…' }: { controls: any; dateFilter?: boolean; placeholder?: string }) {
  return <div className="list-filters">
    <label className="list-search"><Search size={16} /><input type="search" value={controls.query} onChange={(event) => controls.setQuery(event.target.value)} placeholder={placeholder} /></label>
    {dateFilter && <><DateRangePicker from={controls.from} to={controls.to} onChange={(from, to) => { controls.setFrom(from); controls.setTo(to); }} /><MonthPicker value={controls.month} onChange={controls.setMonth} /></>}
    {controls.hasFilters && <button type="button" className="outline" onClick={controls.reset}>Clear filters</button>}
  </div>;
}

export function ListPagination({ controls }: { controls: any }) {
  const pages = Array.from(new Set([1, 2, controls.page - 1, controls.page, controls.page + 1, controls.pageCount - 1, controls.pageCount]))
    .filter((page) => page >= 1 && page <= controls.pageCount)
    .sort((a, b) => a - b);
  const total = controls.total ?? controls.filtered?.length ?? 0;
  const pageSize = controls.pageSize ?? PAGE_SIZE;
  const start = total ? (controls.page - 1) * pageSize + 1 : 0;
  const end = Math.min(controls.page * pageSize, total);
  return <div className="list-pagination">
      <span className="list-count">Showing {start}–{end} of {total} records</span>
      <div className="pagination-actions" aria-label="Pagination">
        <button type="button" className="pagination-nav" aria-label="First page" title="First page" onClick={() => controls.setPage(1)} disabled={controls.page <= 1}><ChevronsLeft size={15}/><span>First</span></button>
        <button type="button" className="pagination-nav" aria-label="Previous page" title="Previous page" onClick={() => controls.setPage(controls.page - 1)} disabled={controls.page <= 1}><ChevronLeft size={15}/><span>Previous</span></button>
        <span className="pagination-page-links">{pages.map((number, index) => <span key={number}>{index > 0 && number > pages[index - 1] + 1 && <i className="pagination-gap">…</i>}<button type="button" className={number === controls.page ? 'active' : ''} aria-current={number === controls.page ? 'page' : undefined} onClick={() => controls.setPage(number)}>{number}</button></span>)}</span>
        <span className="pagination-current" aria-current="page">Page {controls.page} of {controls.pageCount}</span>
        <button type="button" className="pagination-nav" aria-label="Next page" title="Next page" onClick={() => controls.setPage(controls.page + 1)} disabled={controls.page >= controls.pageCount}><span>Next</span><ChevronRight size={15}/></button>
        <button type="button" className="pagination-nav" aria-label="Last page" title="Last page" onClick={() => controls.setPage(controls.pageCount)} disabled={controls.page >= controls.pageCount}><span>Last</span><ChevronsRight size={15}/></button>
      </div>
  </div>;
}

export function ServerListPagination({ page, pageCount, total, pageSize = PAGE_SIZE, setPage }: { page: number; pageCount: number; total: number; pageSize?: number; setPage: (page: number) => void }) {
  return <ListPagination controls={{ page, pageCount: Math.max(1, pageCount), total, pageSize, setPage, filtered: [] }} />;
}

export function ListControls({ controls, dateFilter = false, placeholder = 'Search records…' }: { controls: any; dateFilter?: boolean; placeholder?: string }) {
  return <div className="list-controls">
    <ListFilters controls={controls} dateFilter={dateFilter} placeholder={placeholder} />
    <ListPagination controls={controls} />
  </div>;
}
