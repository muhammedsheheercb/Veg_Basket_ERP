'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { AppSidebar } from '@/components/app-sidebar';
import { MobileNavigation } from '@/components/mobile-navigation';
import { money, shortDate } from '@/components/financial-documents';

type DatePreset = 'today' | 'yesterday' | 'custom' | 'date_range' | 'all';

function getPresetDates(preset: DatePreset): { startDate: string; endDate: string } {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  if (preset === 'today') {
    return { startDate: today, endDate: today };
  }
  if (preset === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const yStr = y.toISOString().slice(0, 10);
    return { startDate: yStr, endDate: yStr };
  }
  if (preset === 'all') {
    return { startDate: '', endDate: '' };
  }
  return { startDate: '', endDate: '' };
}

export default function MyPursePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [purseData, setPurseData] = useState<any>(null);

  // Filters State
  const [preset, setPreset] = useState<DatePreset>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [selectedMonth, setSelectedMonth] = useState(''); // '1'..'12' or ''
  const [selectedYear, setSelectedYear] = useState(''); // '2026' or ''

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [typeFilter, setTypeFilter] = useState('All');
  const [methodFilter, setMethodFilter] = useState('All');

  const [page, setPage] = useState(1);

  // Add Money Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addAmount, setAddAmount] = useState('');
  const [addMethod, setAddMethod] = useState<'Cash' | 'Bank'>('Cash');
  const [addDate, setAddDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [addDesc, setAddDesc] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  // Delete Confirmation Modal State
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const handlePresetChange = (newPreset: DatePreset) => {
    setPreset(newPreset);
    setSelectedMonth('');
    setSelectedYear('');
    const dates = getPresetDates(newPreset);
    setStartDate(dates.startDate);
    setEndDate(dates.endDate);
    setPage(1);
  };

  const handleMonthChange = (m: string) => {
    setSelectedMonth(m);
    if (m && !selectedYear) {
      setSelectedYear(String(new Date().getFullYear()));
    }
    setPreset('all');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const handleYearChange = (y: string) => {
    setSelectedYear(y);
    setPreset('all');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const fetchPurseData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (selectedMonth) params.set('month', selectedMonth);
      if (selectedYear) params.set('year', selectedYear);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (typeFilter !== 'All') params.set('typeFilter', typeFilter);
      if (methodFilter !== 'All') params.set('methodFilter', methodFilter);
      params.set('page', String(page));

      const res = await fetch(`/api/purse?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to load purse details');
      }
      const data = await res.json();
      setPurseData(data);
    } catch (err: any) {
      setError(err.message || 'Error loading purse balance.');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedMonth, selectedYear, debouncedSearch, typeFilter, methodFilter, page]);

  useEffect(() => {
    fetchPurseData();
  }, [fetchPurseData]);

  const handleAddMoneySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    const numAmt = Number(addAmount);
    if (!numAmt || numAmt <= 0) {
      setAddError('Enter a valid positive amount.');
      return;
    }
    if (!addDate) {
      setAddError('Please select a date.');
      return;
    }

    setAddLoading(true);
    try {
      const res = await fetch('/api/purse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: numAmt,
          method: addMethod,
          date: addDate,
          description: addDesc,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add money.');
      }

      setAddLoading(false);
      setAddModalOpen(false);
      setAddAmount('');
      setAddDesc('');
      setAddDate(new Date().toISOString().slice(0, 10));
      fetchPurseData();
    } catch (err: any) {
      setAddError(err.message || 'Error saving money addition.');
      setAddLoading(false);
    }
  };

  const handleDeleteAddition = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/purse/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete entry.');
      }
      setDeleteLoading(false);
      setDeleteId(null);
      fetchPurseData();
    } catch (err: any) {
      alert(err.message || 'Error deleting manual money record.');
      setDeleteLoading(false);
    }
  };

  const summary = purseData?.summary || {
    totalBalance: 0,
    cashBalance: 0,
    bankBalance: 0,
    todayAdded: 0,
    todaySpent: 0,
    periodMoneyIn: 0,
    periodMoneyOut: 0,
  };

  const pagination = purseData?.pagination || { page: 1, pageCount: 1, pageSize: 10, totalCount: 0 };
  const rows: any[] = purseData?.rows || [];

  return (
    <div className="app-shell">
      <AppSidebar active="My Purse" />

      <main className="management">
        <header className="management-head">
          <div className='pb-4'>
            <p className="eyebrow">MONEY FLOW & CASH MANAGEMENT</p>
            <h1>My Purse</h1>
            <p>Track Cash, Bank, income, expenses, and transactions.</p>
          </div>
          <button className="primary" onClick={() => setAddModalOpen(true)}>
            <Plus size={18} />
            <span>Add Money</span>
          </button>
        </header>

        {/* SUMMARY CARDS */}
        <section className="purse-summary-grid">
          {/* Total Balance */}
          <div className="purse-card" style={{ borderLeft: '4px solid #168d65' }}>
            <div className="purse-card-top">
              <small>Total Balance</small>
              <div className="purse-card-icon" style={{ background: '#e3f7ee', color: '#168d65' }}>
                <Wallet size={20} />
              </div>
            </div>
            <div className="purse-card-info">
              <b style={{ fontSize: '22px', color: '#168d65' }}>{money(summary.totalBalance)}</b>
              <span>Current Cash + Bank</span>
            </div>
          </div>

          {/* Cash Balance */}
          <div className="purse-card" style={{ borderLeft: '4px solid #059669' }}>
            <div className="purse-card-top">
              <small>Cash Balance</small>
              <div className="purse-card-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                <Wallet size={20} />
              </div>
            </div>
            <div className="purse-card-info">
              <b>{money(summary.cashBalance)}</b>
              <span>Available Cash in hand</span>
            </div>
          </div>

          {/* Bank Balance */}
          <div className="purse-card" style={{ borderLeft: '4px solid #2563eb' }}>
            <div className="purse-card-top">
              <small>Bank Balance</small>
              <div className="purse-card-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
                <Wallet size={20} />
              </div>
            </div>
            <div className="purse-card-info">
              <b>{money(summary.bankBalance)}</b>
              <span>Available Bank / Card</span>
            </div>
          </div>

          {/* Today's Money Added */}
          <div className="purse-card" style={{ borderLeft: '4px solid #15803d' }}>
            <div className="purse-card-top">
              <small>Today&apos;s Money Added</small>
              <div className="purse-card-icon" style={{ background: '#dcfce7', color: '#15803d' }}>
                <ArrowDownLeft size={20} />
              </div>
            </div>
            <div className="purse-card-info">
              <b style={{ color: '#15803d' }}>+ {money(summary.todayAdded)}</b>
              <span>Total added today</span>
            </div>
          </div>

          {/* Today's Money Spent */}
          <div className="purse-card" style={{ borderLeft: '4px solid #b91c1c' }}>
            <div className="purse-card-top">
              <small>Today&apos;s Money Spent</small>
              <div className="purse-card-icon" style={{ background: '#fee2e2', color: '#b91c1c' }}>
                <ArrowUpRight size={20} />
              </div>
            </div>
            <div className="purse-card-info">
              <b style={{ color: '#b91c1c' }}>- {money(summary.todaySpent)}</b>
              <span>Total spent today</span>
            </div>
          </div>
        </section>

        {/* FILTERING PANEL */}
        <section className="purse-filter-section">
          {/* Group 1: Date Filter */}
          <div>
            <div className="purse-filter-group-title">
              <Calendar size={15} style={{ color: '#168d65' }} />
              <span>Filter by Date / Range</span>
            </div>
            <div className="purse-filter-row">
              {(
                [
                  ['all', 'All Dates'],
                  ['today', 'Today'],
                  ['yesterday', 'Yesterday'],
                  ['custom', 'Custom Range'],
                ] as const
              ).map(([pId, label]) => (
                <button
                  key={pId}
                  type="button"
                  className={`reports-preset-btn ${preset === pId ? 'active' : ''}`}
                  onClick={() => handlePresetChange(pId)}
                >
                  {label}
                </button>
              ))}

              <input
                type="date"
                className="reports-date-input"
                aria-label="From Date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPreset('custom');
                  setSelectedMonth('');
                  setPage(1);
                }}
              />
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>to</span>
              <input
                type="date"
                className="reports-date-input"
                aria-label="To Date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPreset('custom');
                  setSelectedMonth('');
                  setPage(1);
                }}
              />
            </div>
          </div>

          {/* Group 2: Month / Year Filter */}
          <div>
            <div className="purse-filter-group-title">
              <Calendar size={15} style={{ color: '#2563eb' }} />
              <span>Filter by Month / Year</span>
            </div>
            <div className="purse-filter-row">
              <select
                className="reports-select-input"
                aria-label="Select Month"
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
              >
                <option value="">All Months</option>
                <option value="1">January</option>
                <option value="2">February</option>
                <option value="3">March</option>
                <option value="4">April</option>
                <option value="5">May</option>
                <option value="6">June</option>
                <option value="7">July</option>
                <option value="8">August</option>
                <option value="9">September</option>
                <option value="10">October</option>
                <option value="11">November</option>
                <option value="12">December</option>
              </select>

              <select
                className="reports-select-input"
                aria-label="Select Year"
                value={selectedYear}
                onChange={(e) => handleYearChange(e.target.value)}
              >
                <option value="">All Years</option>
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
            </div>
          </div>

          {/* Group 3: Search, Type & Method */}
          <div className="purse-filter-row">
            <div className="reports-search-box" style={{ flex: 1, minWidth: '220px' }}>
              <Search size={16} style={{ color: '#94a3b8' }} />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search transactions by description, party, reference..."
              />
            </div>

            <select
              className="reports-select-input"
              aria-label="Filter by Type"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="All">All Transaction Types</option>
              <option value="Money Added">Money Added</option>
              <option value="Customer Sale">Customer Sale</option>
              <option value="Customer Payment">Customer Payment</option>
              <option value="Purchase Payment">Purchase Payment</option>
              <option value="Supplier Payment">Supplier Payment</option>
              <option value="Expense">Expense</option>
              <option value="Worker Payment">Worker Payment</option>
              <option value="Loan Payment">Loan Payment</option>
            </select>

            <select
              className="reports-select-input"
              aria-label="Filter by Payment Method"
              value={methodFilter}
              onChange={(e) => {
                setMethodFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="All">All Payment Methods</option>
              <option value="Cash">Cash Only</option>
              <option value="Bank">Bank / Transfer / Card</option>
            </select>

            {(search ||
              preset !== 'all' ||
              startDate ||
              endDate ||
              selectedMonth ||
              selectedYear ||
              typeFilter !== 'All' ||
              methodFilter !== 'All') && (
                <button
                  type="button"
                  className="reports-action-btn clear"
                  onClick={() => {
                    setSearch('');
                    setPreset('all');
                    setStartDate('');
                    setEndDate('');
                    setSelectedMonth('');
                    setSelectedYear('');
                    setTypeFilter('All');
                    setMethodFilter('All');
                    setPage(1);
                  }}
                >
                  Reset Filters
                </button>
              )}
          </div>
        </section>

        {/* PURSE TRANSACTION HISTORY TABLE */}
        <section className="reports-table-wrap">
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '14px', color: '#0f172a' }}>
              Purse Transaction History ({pagination.totalCount} Records)
            </h3>
            {pagination.totalCount > 0 && (
              <small style={{ color: 'var(--muted)', fontSize: '11px' }}>
                Period In: <b style={{ color: '#15803d' }}>+ {money(summary.periodMoneyIn)}</b> | Period Out:{' '}
                <b style={{ color: '#b91c1c' }}>- {money(summary.periodMoneyOut)}</b>
              </small>
            )}
          </div>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
              <RefreshCw className="button-spinner" size={24} style={{ marginBottom: '8px' }} />
              <p>Loading purse transaction history...</p>
            </div>
          ) : error ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#b91c1c' }}>
              <p>{error}</p>
              <button className="reports-action-btn print" onClick={() => fetchPurseData()}>
                Retry
              </button>
            </div>
          ) : !rows.length ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
              <p>No purse transactions found matching your filters.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Transaction Type</th>
                    <th>Description / Details</th>
                    <th>Party / Source</th>
                    <th>Payment Method</th>
                    <th className="num">Money In (+)</th>
                    <th className="num">Money Out (-)</th>
                    <th className="num">Purse Balance</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t: any) => (
                    <tr key={t.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{shortDate(t.date)}</td>
                      <td>
                        <span className={`reports-badge ${t.direction === 'In' ? 'inflow' : 'outflow'}`}>
                          {t.type}
                        </span>
                      </td>
                      <td>
                        <b>{t.description}</b>
                      </td>
                      <td>{t.party}</td>
                      <td>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: t.isCash ? '#059669' : '#2563eb' }}>
                          {t.method}
                        </span>
                      </td>
                      <td className="num">
                        {t.moneyIn > 0 ? (
                          <span className="purse-money-in">+ {money(t.moneyIn)}</span>
                        ) : (
                          <span style={{ color: '#cbd5e1' }}>—</span>
                        )}
                      </td>
                      <td className="num">
                        {t.moneyOut > 0 ? (
                          <span className="purse-money-out">- {money(t.moneyOut)}</span>
                        ) : (
                          <span style={{ color: '#cbd5e1' }}>—</span>
                        )}
                      </td>
                      <td className="num" style={{ fontWeight: 700, color: '#0f172a' }}>
                        {money(t.totalBalance)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {t.isManual ? (
                          <button
                            type="button"
                            title="Delete manual money addition"
                            style={{
                              border: 0,
                              background: '#ffedef',
                              color: '#d64c55',
                              borderRadius: '6px',
                              padding: '5px',
                              cursor: 'pointer',
                            }}
                            onClick={() => setDeleteId(t.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        ) : (
                          <span style={{ fontSize: '10px', color: '#94a3b8' }}>System</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* PAGINATION FOOTER */}
          {pagination.totalCount > 10 && (
            <div className="list-footer-pagination" style={{ padding: '12px 16px' }}>
              <div className="list-pagination">
                <span className="list-count">
                  Showing {(pagination.page - 1) * pagination.pageSize + 1}–
                  {Math.min(pagination.page * pagination.pageSize, pagination.totalCount)} of {pagination.totalCount}{' '}
                  transactions
                </span>
                <div className="pagination-actions">
                  <button
                    type="button"
                    title="First page"
                    onClick={() => setPage(1)}
                    disabled={pagination.page <= 1}
                  >
                    <ChevronsLeft size={16} />
                  </button>
                  <button
                    type="button"
                    title="Previous page"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={pagination.page <= 1}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="pagination-current">
                    Page {pagination.page} of {pagination.pageCount}
                  </span>
                  <button
                    type="button"
                    title="Next page"
                    onClick={() => setPage((p) => Math.min(pagination.pageCount, p + 1))}
                    disabled={pagination.page >= pagination.pageCount}
                  >
                    <ChevronRight size={16} />
                  </button>
                  <button
                    type="button"
                    title="Last page"
                    onClick={() => setPage(pagination.pageCount)}
                    disabled={pagination.page >= pagination.pageCount}
                  >
                    <ChevronsRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      <MobileNavigation />

      {/* ADD MONEY MODAL */}
      {addModalOpen && (
        <div className="modal">
          <div className="modal-backdrop" onClick={() => setAddModalOpen(false)} />
          <section className="supplier-form" style={{ width: 'min(450px, 100%)', background: '#fff', borderRadius: '12px' }}>
            <button className="sheet-close" onClick={() => setAddModalOpen(false)} aria-label="Close modal">
              <X size={18} />
            </button>
            <h2 style={{ fontSize: '18px', margin: '0 0 4px', color: '#0f172a' }}>Add Money to Purse</h2>
            <p style={{ margin: '0 0 16px', color: 'var(--muted)', fontSize: '12px' }}>
              Add cash or bank funds directly to your purse. Balances will update automatically.
            </p>

            {addError && <div className="form-error" style={{ marginBottom: '14px' }}>{addError}</div>}

            <form onSubmit={handleAddMoneySubmit}>
              <label>
                Amount (AED / ₹)
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="e.g. 10000"
                  required
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                />
              </label>

              <label>
                Add To / Payment Method
                <select value={addMethod} onChange={(e) => setAddMethod(e.target.value as 'Cash' | 'Bank')}>
                  <option value="Cash">Cash Balance</option>
                  <option value="Bank">Bank Balance</option>
                </select>
              </label>

              <label>
                Date
                <input
                  type="date"
                  required
                  value={addDate}
                  onChange={(e) => setAddDate(e.target.value)}
                />
              </label>

              <label>
                Description / Note
                <textarea
                  placeholder="e.g. Owner capital deposit, Cash withdrawal from bank, etc."
                  value={addDesc}
                  onChange={(e) => setAddDesc(e.target.value)}
                />
              </label>

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="outline"
                  style={{ flex: 1 }}
                  onClick={() => setAddModalOpen(false)}
                  disabled={addLoading}
                >
                  Cancel
                </button>
                <button type="submit" className="primary" style={{ flex: 1, justifyContent: 'center' }} disabled={addLoading}>
                  {addLoading ? <RefreshCw className="button-spinner" size={16} /> : <Plus size={16} />}
                  <span>Add Money</span>
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteId && (
        <div className="modal delete-confirm-modal">
          <div className="modal-backdrop" onClick={() => setDeleteId(null)} />
          <section className="supplier-form card">
            <h2>Delete Money Record?</h2>
            <p>
              Are you sure you want to delete this manual money addition? This action will reverse the money entry from your purse balance.
            </p>
            <div className="confirm-actions">
              <button type="button" className="outline" onClick={() => setDeleteId(null)} disabled={deleteLoading}>
                Cancel
              </button>
              <button
                type="button"
                className="delete-button"
                onClick={handleDeleteAddition}
                disabled={deleteLoading}
              >
                {deleteLoading ? <RefreshCw className="button-spinner" size={16} /> : 'Delete Entry'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
