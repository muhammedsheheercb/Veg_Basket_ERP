'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Filter,
  HardHat,
  Landmark,
  LayoutList,
  Printer,
  RefreshCw,
  Search,
  ShoppingCart,
  Truck,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { AppSidebar } from '@/components/app-sidebar';
import { MobileNavigation } from '@/components/mobile-navigation';
import { money, shortDate } from '@/components/financial-documents';

type ReportType =
  | 'sales'
  | 'purchases'
  | 'expenses'
  | 'customer_outstanding'
  | 'supplier_outstanding'
  | 'worker_expenses'
  | 'loan_outstanding'
  | 'payment_methods';

type DatePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'this_year' | 'all_time' | 'custom';

const REPORT_TABS: Array<{ id: ReportType; label: string; icon: any; desc: string }> = [
  { id: 'sales', label: 'Sales Report', icon: FileText, desc: 'Customer sales, revenue & collections' },
  { id: 'purchases', label: 'Purchase Report', icon: ShoppingCart, desc: 'Supplier purchases & bill payables' },
  { id: 'expenses', label: 'Expense Report', icon: WalletCards, desc: 'General business operational expenses' },
  { id: 'customer_outstanding', label: 'Customer Outstanding', icon: Users, desc: 'Customer receivable balances' },
  { id: 'supplier_outstanding', label: 'Supplier Outstanding', icon: Truck, desc: 'Supplier payable balances' },
  { id: 'worker_expenses', label: 'Worker Expenses', icon: HardHat, desc: 'Worker payouts & wage expenses' },
  { id: 'loan_outstanding', label: 'Loan Outstanding', icon: Landmark, desc: 'Bank & lender loan liabilities' },
  { id: 'payment_methods', label: 'Payment Method Report', icon: LayoutList, desc: 'Cashflow breakdown by payment mode' },
];

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
  if (preset === 'this_week') {
    const d = new Date(now);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return { startDate: monday.toISOString().slice(0, 10), endDate: today };
  }
  if (preset === 'this_month') {
    return { startDate: `${today.slice(0, 7)}-01`, endDate: today };
  }
  if (preset === 'last_month') {
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      startDate: prevMonthDate.toISOString().slice(0, 10),
      endDate: lastDayPrevMonth.toISOString().slice(0, 10),
    };
  }
  if (preset === 'this_year') {
    return { startDate: `${now.getFullYear()}-01-01`, endDate: today };
  }
  if (preset === 'all_time') {
    return { startDate: '', endDate: '' };
  }
  return { startDate: `${today.slice(0, 7)}-01`, endDate: today };
}

function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const csvText =
    [headers.join(','), ...rows.map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    if (document.body.contains(link)) {
      document.body.removeChild(link);
    }
    URL.revokeObjectURL(url);
  }, 100);
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportType>('sales');
  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [startDate, setStartDate] = useState(() => `${new Date().toISOString().slice(0, 7)}-01`);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [workerFilter, setWorkerFilter] = useState('All');
  const [methodFilter, setMethodFilter] = useState('All');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportData, setReportData] = useState<any>(null);

  // Workers dropdown list
  const [workersList, setWorkersList] = useState<Array<{ id: string; name: string }>>([]);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Load workers for worker filter dropdown
  useEffect(() => {
    fetch('/api/workers')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setWorkersList(data.map((w) => ({ id: w.id, name: w.name })));
        }
      })
      .catch(() => {});
  }, []);

  const handlePresetChange = (newPreset: DatePreset) => {
    setPreset(newPreset);
    if (newPreset !== 'custom') {
      const dates = getPresetDates(newPreset);
      setStartDate(dates.startDate);
      setEndDate(dates.endDate);
    }
  };

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('type', activeTab);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (search) params.set('search', search);
      if (activeTab === 'expenses' && categoryFilter !== 'All') params.set('category', categoryFilter);
      if (activeTab === 'worker_expenses' && workerFilter !== 'All') params.set('workerId', workerFilter);
      if (activeTab === 'payment_methods' && methodFilter !== 'All') params.set('paymentMethod', methodFilter);

      const res = await fetch(`/api/reports?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to load report data');
      }
      const data = await res.json();
      setReportData(data);
      setPage(1);
    } catch (err: any) {
      setError(err.message || 'Error loading report.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, startDate, endDate, search, categoryFilter, workerFilter, methodFilter]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const activeTabMeta = REPORT_TABS.find((t) => t.id === activeTab)!;

  // Pagination for rows
  const rows: any[] = reportData?.rows || [];
  const totalRows = rows.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  const handleExportCsv = () => {
    if (!rows.length) return;
    const dateTag = startDate && endDate ? `${startDate}_to_${endDate}` : 'all_time';
    const filename = `VegBasket_${activeTab.toUpperCase()}_Report_${dateTag}.csv`;

    let headers: string[] = [];
    let csvRows: (string | number)[][] = [];

    if (activeTab === 'sales') {
      headers = ['Sale Date', 'Invoice Number', 'Customer Name', 'Payment Method', 'Total (AED)', 'Paid (AED)', 'Balance (AED)', 'Status'];
      csvRows = rows.map((r) => [r.saleDate, r.invoiceNumber, r.customerName, r.paymentMethod, r.total, r.paid, r.balance, r.status]);
    } else if (activeTab === 'purchases') {
      headers = ['Purchase Date', 'Invoice Number', 'Supplier Name', 'Description', 'Payment Method', 'Total (AED)', 'Paid (AED)', 'Balance (AED)', 'Status'];
      csvRows = rows.map((r) => [r.purchaseDate, r.invoiceNumber, r.supplierName, r.description, r.paymentMethod, r.total, r.paid, r.balance, r.status]);
    } else if (activeTab === 'expenses') {
      headers = ['Expense Date', 'Category', 'Notes', 'Amount (AED)'];
      csvRows = rows.map((r) => [r.expenseDate, r.category, r.notes, r.amount]);
    } else if (activeTab === 'customer_outstanding') {
      headers = ['Customer Name', 'Mobile', 'Address', 'Opening Balance (AED)', 'Total Sales (AED)', 'Total Paid (AED)', 'Outstanding Balance (AED)', 'Status'];
      csvRows = rows.map((r) => [r.customerName, r.mobile, r.address, r.openingBalance, r.totalSales, r.totalPaid, r.balance, r.status]);
    } else if (activeTab === 'supplier_outstanding') {
      headers = ['Supplier Name', 'Mobile', 'Address', 'Opening Balance (AED)', 'Total Purchases (AED)', 'Total Paid (AED)', 'Payable Balance (AED)', 'Status'];
      csvRows = rows.map((r) => [r.supplierName, r.mobile, r.address, r.openingBalance, r.totalPurchases, r.totalPaid, r.balance, r.status]);
    } else if (activeTab === 'worker_expenses') {
      headers = ['Date', 'Worker Name', 'Purpose', 'Description', 'Payment Method', 'Amount (AED)'];
      csvRows = rows.map((r) => [r.expenseDate, r.workerName, r.purpose, r.description, r.method, r.amount]);
    } else if (activeTab === 'loan_outstanding') {
      headers = ['Lender', 'Original Amount (AED)', 'Outstanding Balance (AED)', 'Minimum EMI (AED)', 'Next EMI Date', 'Paid in Period (AED)', 'Status'];
      csvRows = rows.map((r) => [r.lender, r.originalAmount, r.outstanding, r.minimumEmi, r.nextEmiDate, r.totalPaidInPeriod, r.status]);
    } else if (activeTab === 'payment_methods') {
      headers = ['Date', 'Type', 'Source', 'Reference', 'Party / Category', 'Payment Method', 'Amount (AED)'];
      csvRows = rows.map((r) => [r.date, r.type, r.source, r.reference, r.party, r.method, r.amount]);
    }

    exportToCsv(filename, headers, csvRows);
  };

  const handleTriggerPrint = () => {
    window.print();
  };

  return (
    <div className="app-shell">
      <AppSidebar active="Reports" />

      <main className="management">
        <header className="management-head">
          <div>
            <p className="eyebrow">FINANCIAL ANALYTICS & LEDGERS</p>
            <h1>Business Reports</h1>
            <p>Generate, filter, print, and export comprehensive business and financial statements.</p>
          </div>
          <div className="reports-actions-header">
            <button className="reports-action-btn print" onClick={() => setPrintModalOpen(true)}>
              <Printer size={16} />
              <span>Print Statement</span>
            </button>
            <button className="reports-action-btn export" onClick={handleExportCsv} disabled={!rows.length}>
              <Download size={16} />
              <span>Export CSV</span>
            </button>
          </div>
        </header>

        {/* TOP REPORT TABS NAVIGATION */}
        <nav className="reports-nav-tabs" aria-label="Reports Categories">
          {REPORT_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`reports-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSearch('');
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* TOOLBAR & FILTERS */}
        <section className="data-panel reports-toolbar" style={{ marginBottom: '20px' }}>
          {/* Preset buttons */}
          <div className="reports-preset-bar">
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', marginRight: '4px' }}>
              Date Filter:
            </span>
            {(
              [
                ['today', 'Today'],
                ['yesterday', 'Yesterday'],
                ['this_week', 'This Week'],
                ['this_month', 'This Month'],
                ['last_month', 'Last Month'],
                ['this_year', 'This Year'],
                ['all_time', 'All Time'],
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
          </div>

          {/* Filter Controls Row */}
          <div className="reports-filters-grid">
            <div className="reports-search-box">
              <Search size={16} style={{ color: '#94a3b8' }} />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${activeTabMeta.label} records...`}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={15} style={{ color: '#64748b' }} />
              <input
                type="date"
                className="reports-date-input"
                aria-label="From Date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPreset('custom');
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
                }}
              />
            </div>

            {/* Type Specific Dropdowns */}
            {activeTab === 'expenses' && (
              <select
                className="reports-select-input"
                aria-label="Filter by Category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="All">All Categories</option>
                <option value="Labor & Wages">Labor & Wages</option>
                <option value="Vehicle & Transport">Vehicle & Transport</option>
                <option value="Shop Maintenance">Shop Maintenance</option>
                <option value="Utilities & Bills">Utilities & Bills</option>
                <option value="Packaging & Supplies">Packaging & Supplies</option>
                <option value="Other">Other</option>
              </select>
            )}

            {activeTab === 'worker_expenses' && (
              <select
                className="reports-select-input"
                aria-label="Filter by Worker"
                value={workerFilter}
                onChange={(e) => setWorkerFilter(e.target.value)}
              >
                <option value="All">All Workers</option>
                {workersList.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            )}

            {activeTab === 'payment_methods' && (
              <select
                className="reports-select-input"
                aria-label="Filter by Payment Method"
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
              >
                <option value="All">All Methods</option>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Card">Card</option>
                <option value="UPI">UPI</option>
                <option value="Cheque">Cheque</option>
              </select>
            )}

            {(search || preset !== 'this_month' || categoryFilter !== 'All' || workerFilter !== 'All' || methodFilter !== 'All') && (
              <button
                type="button"
                className="reports-action-btn clear"
                onClick={() => {
                  setSearch('');
                  setCategoryFilter('All');
                  setWorkerFilter('All');
                  setMethodFilter('All');
                  handlePresetChange('this_month');
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        </section>

        {/* METRICS SUMMARY CARDS */}
        {reportData?.metrics && (
          <section className="reports-metrics-grid">
            {activeTab === 'sales' && (
              <>
                <div className="reports-metric-card">
                  <div className="reports-metric-icon" style={{ background: '#e3f7ee', color: '#119c69' }}>
                    <FileText size={20} />
                  </div>
                  <div className="reports-metric-info">
                    <small>Total Sales Revenue</small>
                    <b>{money(reportData.metrics.totalSales)}</b>
                    <span>{reportData.metrics.count} total invoices</span>
                  </div>
                </div>
                <div className="reports-metric-card">
                  <div className="reports-metric-icon" style={{ background: '#e9efff', color: '#4a73dc' }}>
                    <ArrowDownLeft size={20} />
                  </div>
                  <div className="reports-metric-info">
                    <small>Total Amount Paid</small>
                    <b style={{ color: '#15803d' }}>{money(reportData.metrics.totalPaid)}</b>
                    <span>Collected revenue</span>
                  </div>
                </div>
                <div className="reports-metric-card">
                  <div className="reports-metric-icon" style={{ background: '#fff0e5', color: '#e37726' }}>
                    <ArrowUpRight size={20} />
                  </div>
                  <div className="reports-metric-info">
                    <small>Customer Outstanding</small>
                    <b style={{ color: '#b45309' }}>{money(reportData.metrics.totalOutstanding)}</b>
                    <span>Uncollected credit</span>
                  </div>
                </div>
                <div className="reports-metric-card">
                  <div className="reports-metric-icon" style={{ background: '#f1ecff', color: '#805dd1' }}>
                    <Boxes size={20} />
                  </div>
                  <div className="reports-metric-info">
                    <small>Average Sale Value</small>
                    <b>{money(reportData.metrics.avgInvoiceValue)}</b>
                    <span>Per sales invoice</span>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'purchases' && (
              <>
                <div className="reports-metric-card">
                  <div className="reports-metric-icon" style={{ background: '#e9efff', color: '#4a73dc' }}>
                    <ShoppingCart size={20} />
                  </div>
                  <div className="reports-metric-info">
                    <small>Total Purchases</small>
                    <b>{money(reportData.metrics.totalPurchases)}</b>
                    <span>{reportData.metrics.count} purchase bills</span>
                  </div>
                </div>
                <div className="reports-metric-card">
                  <div className="reports-metric-icon" style={{ background: '#e3f7ee', color: '#119c69' }}>
                    <ArrowDownLeft size={20} />
                  </div>
                  <div className="reports-metric-info">
                    <small>Total Paid to Suppliers</small>
                    <b style={{ color: '#15803d' }}>{money(reportData.metrics.totalPaid)}</b>
                    <span>Settled purchases</span>
                  </div>
                </div>
                <div className="reports-metric-card">
                  <div className="reports-metric-icon" style={{ background: '#fff0e5', color: '#e37726' }}>
                    <ArrowUpRight size={20} />
                  </div>
                  <div className="reports-metric-info">
                    <small>Supplier Payables</small>
                    <b style={{ color: '#b91c1c' }}>{money(reportData.metrics.totalOutstanding)}</b>
                    <span>Unpaid bills balance</span>
                  </div>
                </div>
                <div className="reports-metric-card">
                  <div className="reports-metric-icon" style={{ background: '#f1ecff', color: '#805dd1' }}>
                    <Truck size={20} />
                  </div>
                  <div className="reports-metric-info">
                    <small>Average Bill Value</small>
                    <b>{money(reportData.metrics.avgPurchaseValue)}</b>
                    <span>Per purchase order</span>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'expenses' && (
              <>
                <div className="reports-metric-card">
                  <div className="reports-metric-icon" style={{ background: '#fff0e5', color: '#e37726' }}>
                    <WalletCards size={20} />
                  </div>
                  <div className="reports-metric-info">
                    <small>Total General Expenses</small>
                    <b style={{ color: '#b91c1c' }}>{money(reportData.metrics.totalExpenses)}</b>
                    <span>{reportData.metrics.count} total expense items</span>
                  </div>
                </div>
                <div className="reports-metric-card">
                  <div className="reports-metric-icon" style={{ background: '#f1ecff', color: '#805dd1' }}>
                    <LayoutList size={20} />
                  </div>
                  <div className="reports-metric-info">
                    <small>Average Expense</small>
                    <b>{money(reportData.metrics.avgExpense)}</b>
                    <span>Per transaction</span>
                  </div>
                </div>
                <div className="reports-metric-card">
                  <div className="reports-metric-icon" style={{ background: '#e3f7ee', color: '#119c69' }}>
                    <Filter size={20} />
                  </div>
                  <div className="reports-metric-info">
                    <small>Categories Count</small>
                    <b>{reportData.categoryBreakdown?.length || 0} Categories</b>
                    <span>Expense breakdown</span>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'customer_outstanding' && (
              <>
                <div className="reports-metric-card">
                  <div className="reports-metric-icon" style={{ background: '#fff0e5', color: '#e37726' }}>
                    <Users size={20} />
                  </div>
                  <div className="reports-metric-info">
                    <small>Total Net Receivables</small>
                    <b style={{ color: '#b45309' }}>{money(reportData.metrics.totalOutstanding)}</b>
                    <span>Across {reportData.metrics.customerCount} customers with balance</span>
                  </div>
                </div>
                <div className="reports-metric-card">
                  <div className="reports-metric-icon" style={{ background: '#e3f7ee', color: '#119c69' }}>
                    <FileText size={20} />
                  </div>
                  <div className="reports-metric-info">
                    <small>Total Invoiced Sales</small>
                    <b>{money(reportData.metrics.totalSales)}</b>
                    <span>Lifetime sales</span>
                  </div>
                </div>
                <div className="reports-metric-card">
                  <div className="reports-metric-icon" style={{ background: '#e9efff', color: '#4a73dc' }}>
                    <ArrowDownLeft size={20} />
                  </div>
                  <div className="reports-metric-info">
                    <small>Total Received Collections</small>
                    <b style={{ color: '#15803d' }}>{money(reportData.metrics.totalPaid)}</b>
                    <span>Total customer payments</span>
                  </div>
                </div>
                <div className="reports-metric-card">
                  <div className="reports-metric-icon" style={{ background: '#f1ecff', color: '#805dd1' }}>
                    <Landmark size={20} />
                  </div>
                  <div className="reports-metric-info">
                    <small>Opening Balance Sum</small>
                    <b>{money(reportData.metrics.totalOpeningBalance)}</b>
                    <span>Initial customer debt</span>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'supplier_outstanding' && (
              <>
                <div className="reports-metric-card">
                  <div className="reports-metric-icon" style={{ background: '#fff0e5', color: '#e37726' }}>
                    <Truck size={20} />
                  </div>
                  <div className="reports-metric-info">
                    <small>Total Net Payables</small>
                    <b style={{ color: '#b91c1c' }}>{money(reportData.metrics.totalOutstanding)}</b>
                    <span>Owed to {reportData.metrics.supplierCount} suppliers</span>
                  </div>
                </div>
                <div className="reports-metric-card">
                  <div className="reports-metric-icon" style={{ background: '#e9efff', color: '#4a73dc' }}>
                    <ShoppingCart size={20} />
                  </div>
                  <div className="reports-metric-info">
                    <small>Total Purchases Amount</small>
                    <b>{money(reportData.metrics.totalPurchases)}</b>
                    <span>Total bills purchased</span>
                  </div>
                </div>
                <div className="reports-metric-card">
                  <div className="reports-metric-icon" style={{ background: '#e3f7ee', color: '#119c69' }}>
                    <ArrowDownLeft size={20} />
                  </div>
                  <div className="reports-metric-info">
                    <small>Total Paid to Suppliers</small>
                    <b style={{ color: '#15803d' }}>{money(reportData.metrics.totalPaid)}</b>
                    <span>Total disbursements</span>
                  </div>
                </div>
                <div className="reports-metric-card">
                  <div className="reports-metric-icon" style={{ background: '#f1ecff', color: '#805dd1' }}>
                    <Landmark size={20} />
                  </div>
                  <div className="reports-metric-info">
                    <small>Opening Payables Sum</small>
                    <b>{money(reportData.metrics.totalOpeningBalance)}</b>
                    <span>Initial supplier debt</span>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'worker_expenses' && (
              <>
                <div className="reports-metric-card">
                  <div className="reports-metric-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                    <HardHat size={20} />
                  </div>
                  <div className="reports-metric-info">
                    <small>Total Worker Expenses</small>
                    <b style={{ color: '#b45309' }}>{money(reportData.metrics.totalWorkerExpenses)}</b>
                    <span>{reportData.metrics.count} payouts</span>
                  </div>
                </div>
                <div className="reports-metric-card">
                  <div className="reports-metric-icon" style={{ background: '#e9efff', color: '#4a73dc' }}>
                    <Users size={20} />
                  </div>
                  <div className="reports-metric-info">
                    <small>Active Workers Count</small>
                    <b>{reportData.workerBreakdown?.length || 0} Workers</b>
                    <span>Paid in period</span>
                  </div>
                </div>
                <div className="reports-metric-card">
                  <div className="reports-metric-icon" style={{ background: '#f1ecff', color: '#805dd1' }}>
                    <LayoutList size={20} />
                  </div>
                  <div className="reports-metric-info">
                    <small>Avg per Payout</small>
                    <b>{money(reportData.metrics.avgPerEntry)}</b>
                    <span>Per expense entry</span>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'loan_outstanding' && (
              <>
                <div className="reports-metric-card">
                  <div className="reports-metric-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                    <Landmark size={20} />
                  </div>
                  <div className="reports-metric-info">
                    <small>Current Loan Liabilities</small>
                    <b style={{ color: '#b91c1c' }}>{money(reportData.metrics.totalOutstanding)}</b>
                    <span>Across {reportData.metrics.activeLoanCount} active loans</span>
                  </div>
                </div>
                <div className="reports-metric-card">
                  <div className="reports-metric-icon" style={{ background: '#e9efff', color: '#4a73dc' }}>
                    <FileText size={20} />
                  </div>
                  <div className="reports-metric-info">
                    <small>Original Loan Principal</small>
                    <b>{money(reportData.metrics.totalOriginalAmount)}</b>
                    <span>Initial total borrowed</span>
                  </div>
                </div>
                <div className="reports-metric-card">
                  <div className="reports-metric-icon" style={{ background: '#e3f7ee', color: '#119c69' }}>
                    <ArrowDownLeft size={20} />
                  </div>
                  <div className="reports-metric-info">
                    <small>Paid in Period</small>
                    <b style={{ color: '#15803d' }}>{money(reportData.metrics.totalPaidInPeriod)}</b>
                    <span>EMI repayments in date filter</span>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'payment_methods' && (
              <>
                <div className="reports-metric-card">
                  <div className="reports-metric-icon" style={{ background: '#e3f7ee', color: '#119c69' }}>
                    <ArrowDownLeft size={20} />
                  </div>
                  <div className="reports-metric-info">
                    <small>Total Cash Inflow</small>
                    <b style={{ color: '#15803d' }}>{money(reportData.metrics.totalInflow)}</b>
                    <span>Collections & income</span>
                  </div>
                </div>
                <div className="reports-metric-card">
                  <div className="reports-metric-icon" style={{ background: '#fee2e2', color: '#b91c1c' }}>
                    <ArrowUpRight size={20} />
                  </div>
                  <div className="reports-metric-info">
                    <small>Total Cash Outflow</small>
                    <b style={{ color: '#b91c1c' }}>{money(reportData.metrics.totalOutflow)}</b>
                    <span>Expenses & payments</span>
                  </div>
                </div>
                <div className="reports-metric-card">
                  <div
                    className="reports-metric-icon"
                    style={{
                      background: reportData.metrics.netCashFlow >= 0 ? '#e3f7ee' : '#fee2e2',
                      color: reportData.metrics.netCashFlow >= 0 ? '#119c69' : '#b91c1c',
                    }}
                  >
                    <Landmark size={20} />
                  </div>
                  <div className="reports-metric-info">
                    <small>Net Cash Flow</small>
                    <b style={{ color: reportData.metrics.netCashFlow >= 0 ? '#15803d' : '#b91c1c' }}>
                      {money(reportData.metrics.netCashFlow)}
                    </b>
                    <span>Inflow minus Outflow</span>
                  </div>
                </div>
                <div className="reports-metric-card">
                  <div className="reports-metric-icon" style={{ background: '#f1ecff', color: '#805dd1' }}>
                    <LayoutList size={20} />
                  </div>
                  <div className="reports-metric-info">
                    <small>Transactions Count</small>
                    <b>{reportData.metrics.count} Entries</b>
                    <span>Total payment records</span>
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {/* BREAKDOWN SECTION IF APPLICABLE */}
        {activeTab === 'expenses' && reportData?.categoryBreakdown?.length > 0 && (
          <section className="reports-breakdown-card">
            <h3>Expense Breakdown by Category</h3>
            <div className="reports-breakdown-list">
              {reportData.categoryBreakdown.map((cat: any) => (
                <div key={cat.category} className="reports-breakdown-item">
                  <b>{cat.category}</b>
                  <div className="reports-progress-bar">
                    <div className="reports-progress-fill" style={{ width: `${Math.min(100, cat.percentage)}%` }} />
                  </div>
                  <span style={{ fontWeight: 700 }}>{money(cat.total)}</span>
                  <span style={{ color: 'var(--muted)', textAlign: 'right' }}>{cat.percentage}%</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'worker_expenses' && reportData?.workerBreakdown?.length > 0 && (
          <section className="reports-breakdown-card">
            <h3>Expense Breakdown by Worker</h3>
            <div className="reports-breakdown-list">
              {reportData.workerBreakdown.map((w: any) => (
                <div key={w.workerName} className="reports-breakdown-item">
                  <b>{w.workerName}</b>
                  <div className="reports-progress-bar">
                    <div
                      className="reports-progress-fill"
                      style={{ width: `${Math.min(100, w.percentage)}%`, background: '#d97706' }}
                    />
                  </div>
                  <span style={{ fontWeight: 700 }}>{money(w.total)}</span>
                  <span style={{ color: 'var(--muted)', textAlign: 'right' }}>{w.percentage}%</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'payment_methods' && reportData?.methodBreakdown?.length > 0 && (
          <section className="reports-breakdown-card">
            <h3>Cashflow Breakdown by Payment Method</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>Payment Method</th>
                    <th className="num">Total Inflow (+)</th>
                    <th className="num">Total Outflow (-)</th>
                    <th className="num">Net Cash Flow</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.methodBreakdown.map((m: any) => (
                    <tr key={m.method}>
                      <td>
                        <b>{m.method}</b>
                      </td>
                      <td className="num" style={{ color: '#15803d', fontWeight: 600 }}>
                        {money(m.inflow)}
                      </td>
                      <td className="num" style={{ color: '#b91c1c', fontWeight: 600 }}>
                        {money(m.outflow)}
                      </td>
                      <td className="num" style={{ fontWeight: 700, color: m.net >= 0 ? '#15803d' : '#b91c1c' }}>
                        {money(m.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* MAIN DATA TABLE */}
        <section className="reports-table-wrap">
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
              <RefreshCw className="button-spinner" size={24} style={{ marginBottom: '8px' }} />
              <p>Loading {activeTabMeta.label} data...</p>
            </div>
          ) : error ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#b91c1c' }}>
              <p>{error}</p>
              <button className="reports-action-btn print" onClick={() => fetchReport()}>
                Retry
              </button>
            </div>
          ) : !rows.length ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
              <p>No records found matching your date range and search filter.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="reports-table">
                <thead>
                  {activeTab === 'sales' && (
                    <tr>
                      <th>Sale Date</th>
                      <th>Invoice #</th>
                      <th>Customer Name</th>
                      <th>Payment Method</th>
                      <th className="num">Total</th>
                      <th className="num">Paid</th>
                      <th className="num">Balance</th>
                      <th>Status</th>
                    </tr>
                  )}
                  {activeTab === 'purchases' && (
                    <tr>
                      <th>Purchase Date</th>
                      <th>Invoice #</th>
                      <th>Supplier Name</th>
                      <th>Description</th>
                      <th>Method</th>
                      <th className="num">Total</th>
                      <th className="num">Paid</th>
                      <th className="num">Balance</th>
                      <th>Status</th>
                    </tr>
                  )}
                  {activeTab === 'expenses' && (
                    <tr>
                      <th>Expense Date</th>
                      <th>Category</th>
                      <th>Notes / Description</th>
                      <th className="num">Amount</th>
                    </tr>
                  )}
                  {activeTab === 'customer_outstanding' && (
                    <tr>
                      <th>Customer Name</th>
                      <th>Mobile</th>
                      <th>Address</th>
                      <th className="num">Opening Bal</th>
                      <th className="num">Total Sales</th>
                      <th className="num">Total Paid</th>
                      <th className="num">Outstanding Bal</th>
                      <th>Status</th>
                    </tr>
                  )}
                  {activeTab === 'supplier_outstanding' && (
                    <tr>
                      <th>Supplier Name</th>
                      <th>Mobile</th>
                      <th>Address</th>
                      <th className="num">Opening Bal</th>
                      <th className="num">Total Purchases</th>
                      <th className="num">Total Paid</th>
                      <th className="num">Payable Bal</th>
                      <th>Status</th>
                    </tr>
                  )}
                  {activeTab === 'worker_expenses' && (
                    <tr>
                      <th>Date</th>
                      <th>Worker Name</th>
                      <th>Purpose</th>
                      <th>Description</th>
                      <th>Payment Method</th>
                      <th className="num">Amount</th>
                    </tr>
                  )}
                  {activeTab === 'loan_outstanding' && (
                    <tr>
                      <th>Lender</th>
                      <th className="num">Original Amount</th>
                      <th className="num">Outstanding Bal</th>
                      <th className="num">Min EMI</th>
                      <th>Next EMI Date</th>
                      <th className="num">Paid in Period</th>
                      <th>Status</th>
                    </tr>
                  )}
                  {activeTab === 'payment_methods' && (
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Source Category</th>
                      <th>Reference</th>
                      <th>Party / Details</th>
                      <th>Method</th>
                      <th className="num">Amount</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {currentPageRows.map((r: any, idx: number) => {
                    const rowKey = r.id || `${idx}`;
                    if (activeTab === 'sales') {
                      return (
                        <tr key={rowKey}>
                          <td>{shortDate(r.saleDate)}</td>
                          <td>
                            <b>{r.invoiceNumber}</b>
                          </td>
                          <td>{r.customerName}</td>
                          <td>{r.paymentMethod}</td>
                          <td className="num">{money(r.total)}</td>
                          <td className="num">{money(r.paid)}</td>
                          <td className="num" style={{ fontWeight: 700, color: r.balance > 0 ? '#b45309' : '#15803d' }}>
                            {money(r.balance)}
                          </td>
                          <td>
                            <span className={`reports-badge ${r.status.toLowerCase()}`}>{r.status}</span>
                          </td>
                        </tr>
                      );
                    }
                    if (activeTab === 'purchases') {
                      return (
                        <tr key={rowKey}>
                          <td>{shortDate(r.purchaseDate)}</td>
                          <td>
                            <b>{r.invoiceNumber}</b>
                          </td>
                          <td>{r.supplierName}</td>
                          <td>{r.description || '—'}</td>
                          <td>{r.paymentMethod}</td>
                          <td className="num">{money(r.total)}</td>
                          <td className="num">{money(r.paid)}</td>
                          <td className="num" style={{ fontWeight: 700, color: r.balance > 0 ? '#b91c1c' : '#15803d' }}>
                            {money(r.balance)}
                          </td>
                          <td>
                            <span className={`reports-badge ${r.status.toLowerCase()}`}>{r.status}</span>
                          </td>
                        </tr>
                      );
                    }
                    if (activeTab === 'expenses') {
                      return (
                        <tr key={rowKey}>
                          <td>{shortDate(r.expenseDate)}</td>
                          <td>
                            <b>{r.category}</b>
                          </td>
                          <td>{r.notes || '—'}</td>
                          <td className="num" style={{ fontWeight: 700, color: '#b91c1c' }}>
                            {money(r.amount)}
                          </td>
                        </tr>
                      );
                    }
                    if (activeTab === 'customer_outstanding') {
                      return (
                        <tr key={rowKey}>
                          <td>
                            <b>{r.customerName}</b>
                          </td>
                          <td>{r.mobile}</td>
                          <td>{r.address || '—'}</td>
                          <td className="num">{money(r.openingBalance)}</td>
                          <td className="num">{money(r.totalSales)}</td>
                          <td className="num">{money(r.totalPaid)}</td>
                          <td className="num" style={{ fontWeight: 700, color: r.balance > 0 ? '#b45309' : '#15803d' }}>
                            {money(r.balance)}
                          </td>
                          <td>
                            <span className={`reports-badge ${r.status.toLowerCase()}`}>{r.status}</span>
                          </td>
                        </tr>
                      );
                    }
                    if (activeTab === 'supplier_outstanding') {
                      return (
                        <tr key={rowKey}>
                          <td>
                            <b>{r.supplierName}</b>
                          </td>
                          <td>{r.mobile}</td>
                          <td>{r.address || '—'}</td>
                          <td className="num">{money(r.openingBalance)}</td>
                          <td className="num">{money(r.totalPurchases)}</td>
                          <td className="num">{money(r.totalPaid)}</td>
                          <td className="num" style={{ fontWeight: 700, color: r.balance > 0 ? '#b91c1c' : '#15803d' }}>
                            {money(r.balance)}
                          </td>
                          <td>
                            <span className={`reports-badge ${r.status.toLowerCase()}`}>{r.status}</span>
                          </td>
                        </tr>
                      );
                    }
                    if (activeTab === 'worker_expenses') {
                      return (
                        <tr key={rowKey}>
                          <td>{shortDate(r.expenseDate)}</td>
                          <td>
                            <b>{r.workerName}</b>
                          </td>
                          <td>{r.purpose}</td>
                          <td>{r.description || '—'}</td>
                          <td>{r.method}</td>
                          <td className="num" style={{ fontWeight: 700, color: '#b45309' }}>
                            {money(r.amount)}
                          </td>
                        </tr>
                      );
                    }
                    if (activeTab === 'loan_outstanding') {
                      return (
                        <tr key={rowKey}>
                          <td>
                            <b>{r.lender}</b>
                          </td>
                          <td className="num">{money(r.originalAmount)}</td>
                          <td className="num" style={{ fontWeight: 700, color: r.outstanding > 0 ? '#b91c1c' : '#15803d' }}>
                            {money(r.outstanding)}
                          </td>
                          <td className="num">{money(r.minimumEmi)}</td>
                          <td>{shortDate(r.nextEmiDate)}</td>
                          <td className="num" style={{ color: '#15803d' }}>
                            {money(r.totalPaidInPeriod)}
                          </td>
                          <td>
                            <span className={`reports-badge ${r.status === 'Active' ? 'outstanding' : 'clear'}`}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      );
                    }
                    if (activeTab === 'payment_methods') {
                      return (
                        <tr key={rowKey}>
                          <td>{shortDate(r.date)}</td>
                          <td>
                            <span className={`reports-badge ${r.type.toLowerCase()}`}>{r.type}</span>
                          </td>
                          <td>{r.source}</td>
                          <td>
                            <b>{r.reference}</b>
                          </td>
                          <td>{r.party}</td>
                          <td>{r.method}</td>
                          <td
                            className="num"
                            style={{ fontWeight: 700, color: r.type === 'Inflow' ? '#15803d' : '#b91c1c' }}
                          >
                            {r.type === 'Inflow' ? '+' : '-'} {money(r.amount)}
                          </td>
                        </tr>
                      );
                    }
                    return null;
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* TABLE PAGINATION FOOTER */}
          {totalRows > pageSize && (
            <div className="list-footer-pagination" style={{ padding: '12px 16px' }}>
              <div className="list-pagination">
                <span className="list-count">
                  Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalRows)} of {totalRows} records
                </span>
                <div className="pagination-actions">
                  <button type="button" onClick={() => setPage(1)} disabled={page <= 1}>
                    First
                  </button>
                  <button type="button" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
                    <ChevronLeft size={16} />
                  </button>
                  <span className="pagination-current">
                    Page {page} of {pageCount}
                  </span>
                  <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= pageCount}>
                    <ChevronRight size={16} />
                  </button>
                  <button type="button" onClick={() => setPage(pageCount)} disabled={page >= pageCount}>
                    Last
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      <MobileNavigation />

      {/* PRINTABLE FINANCIAL STATEMENT MODAL */}
      {printModalOpen && (
        <div className="modal document-modal">
          <div className="modal-backdrop" onClick={() => setPrintModalOpen(false)} />
          <div className="document-modal-card">
            <button className="sheet-close" onClick={() => setPrintModalOpen(false)} aria-label="Close document">
              <X size={18} />
            </button>
            <div className="document-actions">
              <button type="button" className="primary" onClick={handleTriggerPrint}>
                <Printer size={16} />
                <span>Print Document</span>
              </button>
            </div>

            <article className="financial-document">
              <header className="document-header">
                <Image src="/images/logo.webp" alt="Veg Basket" width={62} height={68} />
                <div>
                  <h1>Veg Basket ERP</h1>
                  <p>UAE Vegetable & Fruit Trading</p>
                </div>
                <div className="document-title">
                  <b>OFFICIAL FINANCIAL REPORT</b>
                  <strong>{activeTabMeta.label}</strong>
                  <small>
                    Filter Period:{' '}
                    {startDate && endDate ? `${shortDate(startDate)} to ${shortDate(endDate)}` : 'All Time'}
                    <br />
                    Generated: {shortDate(new Date().toISOString())}
                  </small>
                </div>
              </header>

              <section className="document-summary" style={{ margin: '20px 0' }}>
                <div>
                  <small>Report Type</small>
                  <b>{activeTabMeta.label}</b>
                </div>
                <div>
                  <small>Total Records</small>
                  <b>{rows.length} Entries</b>
                </div>
                <div>
                  <small>Date Range</small>
                  <b>{startDate && endDate ? `${startDate} / ${endDate}` : 'All Time'}</b>
                </div>
                <div>
                  <small>Generated By</small>
                  <b>Veg Basket System</b>
                </div>
              </section>

              <section className="document-history">
                <h2>Detailed Report Records ({rows.length})</h2>
                <div className="document-table-wrap">
                  <table>
                    <thead>
                      {activeTab === 'sales' && (
                        <tr>
                          <th>Date</th>
                          <th>Invoice #</th>
                          <th>Customer</th>
                          <th>Method</th>
                          <th>Total</th>
                          <th>Paid</th>
                          <th>Balance</th>
                        </tr>
                      )}
                      {activeTab === 'purchases' && (
                        <tr>
                          <th>Date</th>
                          <th>Invoice #</th>
                          <th>Supplier</th>
                          <th>Method</th>
                          <th>Total</th>
                          <th>Paid</th>
                          <th>Balance</th>
                        </tr>
                      )}
                      {activeTab === 'expenses' && (
                        <tr>
                          <th>Date</th>
                          <th>Category</th>
                          <th>Notes</th>
                          <th>Amount</th>
                        </tr>
                      )}
                      {activeTab === 'customer_outstanding' && (
                        <tr>
                          <th>Customer</th>
                          <th>Mobile</th>
                          <th>Opening</th>
                          <th>Sales</th>
                          <th>Paid</th>
                          <th>Balance</th>
                        </tr>
                      )}
                      {activeTab === 'supplier_outstanding' && (
                        <tr>
                          <th>Supplier</th>
                          <th>Mobile</th>
                          <th>Opening</th>
                          <th>Purchases</th>
                          <th>Paid</th>
                          <th>Balance</th>
                        </tr>
                      )}
                      {activeTab === 'worker_expenses' && (
                        <tr>
                          <th>Date</th>
                          <th>Worker</th>
                          <th>Purpose</th>
                          <th>Method</th>
                          <th>Amount</th>
                        </tr>
                      )}
                      {activeTab === 'loan_outstanding' && (
                        <tr>
                          <th>Lender</th>
                          <th>Original</th>
                          <th>Outstanding</th>
                          <th>Min EMI</th>
                          <th>Paid in Period</th>
                        </tr>
                      )}
                      {activeTab === 'payment_methods' && (
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Source</th>
                          <th>Reference</th>
                          <th>Party</th>
                          <th>Amount</th>
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {rows.map((r: any, i: number) => (
                        <tr key={`${r.id || i}`}>
                          {activeTab === 'sales' && (
                            <>
                              <td>{shortDate(r.saleDate)}</td>
                              <td>{r.invoiceNumber}</td>
                              <td>{r.customerName}</td>
                              <td>{r.paymentMethod}</td>
                              <td>{money(r.total)}</td>
                              <td>{money(r.paid)}</td>
                              <td>
                                <b>{money(r.balance)}</b>
                              </td>
                            </>
                          )}
                          {activeTab === 'purchases' && (
                            <>
                              <td>{shortDate(r.purchaseDate)}</td>
                              <td>{r.invoiceNumber}</td>
                              <td>{r.supplierName}</td>
                              <td>{r.paymentMethod}</td>
                              <td>{money(r.total)}</td>
                              <td>{money(r.paid)}</td>
                              <td>
                                <b>{money(r.balance)}</b>
                              </td>
                            </>
                          )}
                          {activeTab === 'expenses' && (
                            <>
                              <td>{shortDate(r.expenseDate)}</td>
                              <td>{r.category}</td>
                              <td>{r.notes || '—'}</td>
                              <td>
                                <b>{money(r.amount)}</b>
                              </td>
                            </>
                          )}
                          {activeTab === 'customer_outstanding' && (
                            <>
                              <td>{r.customerName}</td>
                              <td>{r.mobile}</td>
                              <td>{money(r.openingBalance)}</td>
                              <td>{money(r.totalSales)}</td>
                              <td>{money(r.totalPaid)}</td>
                              <td>
                                <b>{money(r.balance)}</b>
                              </td>
                            </>
                          )}
                          {activeTab === 'supplier_outstanding' && (
                            <>
                              <td>{r.supplierName}</td>
                              <td>{r.mobile}</td>
                              <td>{money(r.openingBalance)}</td>
                              <td>{money(r.totalPurchases)}</td>
                              <td>{money(r.totalPaid)}</td>
                              <td>
                                <b>{money(r.balance)}</b>
                              </td>
                            </>
                          )}
                          {activeTab === 'worker_expenses' && (
                            <>
                              <td>{shortDate(r.expenseDate)}</td>
                              <td>{r.workerName}</td>
                              <td>{r.purpose}</td>
                              <td>{r.method}</td>
                              <td>
                                <b>{money(r.amount)}</b>
                              </td>
                            </>
                          )}
                          {activeTab === 'loan_outstanding' && (
                            <>
                              <td>{r.lender}</td>
                              <td>{money(r.originalAmount)}</td>
                              <td>
                                <b>{money(r.outstanding)}</b>
                              </td>
                              <td>{money(r.minimumEmi)}</td>
                              <td>{money(r.totalPaidInPeriod)}</td>
                            </>
                          )}
                          {activeTab === 'payment_methods' && (
                            <>
                              <td>{shortDate(r.date)}</td>
                              <td>{r.type}</td>
                              <td>{r.source}</td>
                              <td>{r.reference}</td>
                              <td>{r.party}</td>
                              <td>
                                <b>{money(r.amount)}</b>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <footer>Generated automatically by Veg Basket ERP System. Confidential Business Report.</footer>
            </article>
          </div>
        </div>
      )}
    </div>
  );
}
