'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Bell,
  Boxes,
  ChevronDown,
  ChevronRight,
  FileText,
  HandCoins,
  HardHat,
  Home,
  Landmark,
  LayoutList,
  Menu,
  MoreHorizontal,
  PackagePlus,
  RefreshCw,
  Search,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  WalletCards,
  X,
} from 'lucide-react';

const money = (value: number) => `AED ${Number(value || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const nav = [
  { label: 'Dashboard', icon: Home, href: '/' },
  { label: 'My Purse', icon: Wallet, href: '/purse' },
  { label: 'Sales', icon: FileText, href: '/sales' },
  { label: 'Purchases', icon: ShoppingCart, href: '/purchases' },
  { label: 'Suppliers', icon: Truck, href: '/suppliers' },
  { label: 'Customers', icon: Users, href: '/customers' },
  { label: 'Items', icon: Boxes, href: '/items' },
  { label: 'Workers', icon: HardHat, href: '/workers' },
  { label: 'Expenses', icon: WalletCards, href: '/expenses' },
  { label: 'Loans', icon: Landmark, href: '/loans' },
  { label: 'Reports', icon: LayoutList, href: '/reports' },
];

function Logo() {
  return (
    <div className="brand">
      <Image src="/images/logo.webp" alt="Veg Basket" width={38} height={42} priority />
    </div>
  );
}

function IconButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button className="icon-button" aria-label="Action" onClick={onClick}>
      {children}
    </button>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [mobileNav, setMobileNav] = useState(false);
  const [activeNav, setActiveNav] = useState('Dashboard');
  const [range, setRange] = useState<'this_month' | '30_days' | 'last_month'>('this_month');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');

  const [dashboard, setDashboard] = useState<{
    metrics: {
      todaySales: number;
      todaySalesChangePct: number;
      todayPurchases: number;
      todayPurchasesChangePct: number;
      todayExpenses: number;
      todayExpensesChangePct: number;
      receivables: number;
      payables: number;
      loanBalance: number;
      monthSales: number;
      monthPurchases: number;
      monthExpenses: number;
      netMovement: number;
    };
    chart: {
      sales: number[];
      purchases: number[];
      labels: string[];
      maxVal: number;
    };
    recentSales: Array<{
      id: string;
      invoice: string;
      customer: string;
      date: string;
      total: number;
      paid: number;
      balance: number;
      status: string;
    }>;
    counts: {
      customers: number;
      suppliers: number;
      items: number;
      workers: number;
    };
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/dashboard?range=${range}`);
      if (!res.ok) throw new Error('Unable to load live dashboard statistics.');
      const data = await res.json();
      setDashboard(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to backend server.');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void loadData();
    fetch('/api/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.name) {
          setUserName(data.user.name);
          setUserRole(data.user.role || 'admin');
        }
      })
      .catch(() => {});
  }, [loadData]);

  const handleNavigate = (href: string, label?: string) => {
    if (label) setActiveNav(label);
    setMobileNav(false);
    if (href && href !== '#') {
      router.push(href);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/sales?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const now = new Date();
  const dateFormatted = now
    .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .toUpperCase();

  const hour = now.getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const metrics = dashboard?.metrics || {
    todaySales: 0,
    todaySalesChangePct: 0,
    todayPurchases: 0,
    todayPurchasesChangePct: 0,
    todayExpenses: 0,
    todayExpensesChangePct: 0,
    receivables: 0,
    payables: 0,
    loanBalance: 0,
    monthSales: 0,
    monthPurchases: 0,
    monthExpenses: 0,
    netMovement: 0,
  };

  const rangeLabelMap = {
    this_month: 'This month',
    '30_days': 'Last 30 days',
    last_month: 'Last month',
  };

  return (
    <main className="app-shell">
      {/* Sidebar */}
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="side-top">
          <Logo />
          <button className="close-nav" onClick={() => setMobileNav(false)} aria-label="Close navigation">
            <X size={19} />
          </button>
        </div>
        <nav>
          {nav.map(({ label, icon: Icon, href }) => (
            <button
              key={label}
              onClick={() => handleNavigate(href, label)}
              className={activeNav === label ? 'active' : ''}
              type="button"
            >
              <Icon size={17} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <button type="button" onClick={() => handleNavigate('/settings')}>
            <Settings size={17} />
            <span>Settings</span>
          </button>
          <div className="help">
            Need help? <b>Contact support</b>
          </div>
        </div>
      </aside>
      {mobileNav && <button className="backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}

      {/* Main Content Area */}
      <section className="content">
        <header>
          <button className="hamburger" onClick={() => setMobileNav(true)} aria-label="Open menu">
            <Menu size={21} />
          </button>
          <form className="search" onSubmit={handleSearchSubmit}>
            <Search size={17} />
            <input
              type="search"
              placeholder="Search invoices, customers, items…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>
          <div className="top-actions">
            <IconButton onClick={() => setNotificationsOpen((open) => !open)}>
              <Bell size={18} />
              <i />
            </IconButton>
            {notificationsOpen && <div className="notification-panel" role="status"><b>Notifications</b>{metrics.receivables > 0 || metrics.payables > 0 || metrics.loanBalance > 0 ? <div>{metrics.receivables > 0 && <button onClick={() => handleNavigate('/customers')}>Customer receivables: {money(metrics.receivables)}</button>}{metrics.payables > 0 && <button onClick={() => handleNavigate('/suppliers')}>Supplier payables: {money(metrics.payables)}</button>}{metrics.loanBalance > 0 && <button onClick={() => handleNavigate('/loans')}>Loan balance due: {money(metrics.loanBalance)}</button>}</div> : <p>No new notifications.</p>}</div>}
            <div className="avatar">
              {userName
                ? userName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()
                : 'VB'}
            </div>
            <div className="profile">
              <b>{userName || 'Veg Basket'}</b>
              <small>{userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : 'Administrator'}</small>
            </div>
          </div>
        </header>

        {/* Page Heading */}
        <div className="page-heading">
          <div>
            <p className="eyebrow">{dateFormatted}</p>
            <h1>
              {timeGreeting}, {userName || 'Admin'} <span>👋</span>
            </h1>
            <p>Here’s what’s happening with Veg Basket today.</p>
          </div>
          <button className="primary" onClick={() => handleNavigate('/sales')}>
            <PackagePlus size={17} /> New sale
          </button>
        </div>

        {/* Error State Banner */}
        {error && (
          <div className="form-error" style={{ marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={18} /> {error}
            </span>
            <button className="outline" onClick={loadData} style={{ minHeight: 32, padding: '0 10px' }}>
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        )}

        {/* Metrics Grid */}
        <section className="metrics">
          <MetricCard
            tone="green"
            label="Today’s Sales"
            value={metrics.todaySales}
            changePct={metrics.todaySalesChangePct}
            icon={<WalletCards size={18} />}
            onClick={() => handleNavigate('/sales')}
            loading={loading}
          />
          <MetricCard
            tone="blue"
            label="Today’s Purchases"
            value={metrics.todayPurchases}
            changePct={metrics.todayPurchasesChangePct}
            icon={<ShoppingCart size={18} />}
            onClick={() => handleNavigate('/purchases')}
            loading={loading}
          />
          <MetricCard
            tone="orange"
            label="Today’s Expenses"
            value={metrics.todayExpenses}
            changePct={metrics.todayExpensesChangePct}
            icon={<HandCoins size={18} />}
            onClick={() => handleNavigate('/expenses')}
            loading={loading}
          />
          <MetricCard
            tone="purple"
            label="Customer Receivables"
            value={metrics.receivables}
            icon={<Users size={18} />}
            subtext={`${dashboard?.counts.customers || 0} Customers`}
            onClick={() => handleNavigate('/customers')}
            loading={loading}
          />
        </section>

        {/* Charts & Movement Grid */}
        <section className="charts">
          {/* Sales vs Purchases Dynamic SVG Line Chart */}
          <div className="card chart-card">
            <div className="card-head">
              <div>
                <h2>Sales vs Purchases</h2>
                <p>Daily business activity ({rangeLabelMap[range]})</p>
              </div>
              <select
                className="select"
                value={range}
                onChange={(e) => setRange(e.target.value as any)}
                aria-label="Filter range"
                style={{ border: '1px solid var(--line,#dbe3eb)', borderRadius: 7, padding: '4px 8px', font: 'inherit', background: '#fff' }}
              >
                <option value="this_month">This month</option>
                <option value="30_days">Last 30 days</option>
                <option value="last_month">Last month</option>
              </select>
            </div>
            <div className="legend">
              <span className="sales-dot" /> Sales <span className="purchase-dot" /> Purchases
            </div>
            {loading ? (
              <div style={{ height: 125, display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 12 }}>
                Loading trend chart…
              </div>
            ) : (
              <Chart chart={dashboard?.chart || { sales: [], purchases: [], labels: [], maxVal: 100 }} />
            )}
            <div className="axis">
              {(dashboard?.chart.labels || ['Start', 'Mid', 'End']).map((lbl, idx) => (
                <span key={idx}>{lbl}</span>
              ))}
            </div>
          </div>

          {/* Monthly Movement Cash Summary Card */}
          <div className="card cash-card">
            <div className="card-head">
              <div>
                <h2>Period Movement</h2>
                <p>Sales less purchases and expenses</p>
              </div>
              <IconButton onClick={() => handleNavigate('/expenses')}>
                <MoreHorizontal size={19} />
              </IconButton>
            </div>
            <div className="cash-total">{money(metrics.netMovement)}</div>
            <div className="cash-change" onClick={() => handleNavigate('/suppliers')} style={{ cursor: 'pointer' }}>
              Supplier payables <span>{money(metrics.payables)}</span>
            </div>
            <div className="cash-bars">
              <div onClick={() => handleNavigate('/sales')} style={{ cursor: 'pointer' }}>
                <span>Period Sales</span>
                <b>{money(metrics.monthSales)}</b>
                <i>
                  <em
                    style={{
                      width: `${Math.min(100, Math.round((metrics.monthSales / Math.max(1, metrics.monthSales + metrics.monthPurchases + metrics.monthExpenses)) * 100))}%`,
                    }}
                  />
                </i>
              </div>
              <div onClick={() => handleNavigate('/loans')} style={{ cursor: 'pointer' }}>
                <span>Loan Balance</span>
                <b>{money(metrics.loanBalance)}</b>
                <i>
                  <em
                    style={{
                      width: `${Math.min(100, Math.round((metrics.loanBalance / Math.max(1, metrics.loanBalance + metrics.receivables)) * 100))}%`,
                    }}
                  />
                </i>
              </div>
            </div>
            <button className="outline" type="button" onClick={() => handleNavigate('/expenses')}>
              View cash flow <ChevronRight size={16} />
            </button>
          </div>
        </section>

        {/* Lower Grid: Recent Sales & Quick Actions */}
        <section className="lower-grid">
          <div className="card table-card">
            <div className="card-head">
              <div>
                <h2>Recent sales</h2>
                <p>Latest invoices from your customers</p>
              </div>
              <button className="text-btn" type="button" onClick={() => handleNavigate('/sales')}>
                View all
              </button>
            </div>

            {loading ? (
              <p className="empty">Loading recent transactions…</p>
            ) : !dashboard?.recentSales.length ? (
              <p className="empty">No recent sales invoices recorded yet.</p>
            ) : (
              <>
                <div className="desktop-table">
                  <div className="table-row labels">
                    <span>Invoice</span>
                    <span>Customer</span>
                    <span>Date</span>
                    <span>Amount</span>
                    <span>Status</span>
                  </div>
                  {dashboard.recentSales.map((t) => (
                    <div
                      className="table-row"
                      key={t.id || t.invoice}
                      onClick={() => handleNavigate('/sales')}
                      style={{ cursor: 'pointer' }}
                    >
                      <b>{t.invoice}</b>
                      <span>{t.customer}</span>
                      <span>{t.date}</span>
                      <b>{money(t.total)}</b>
                      <span className={`status ${t.status.toLowerCase()}`}>{t.status}</span>
                    </div>
                  ))}
                </div>

                <div className="mobile-list">
                  {dashboard.recentSales.map((t) => (
                    <div
                      className="mobile-sale"
                      key={t.id || t.invoice}
                      onClick={() => handleNavigate('/sales')}
                      style={{ cursor: 'pointer' }}
                    >
                      <div>
                        <b>{t.customer}</b>
                        <small>
                          {t.invoice} · {t.date}
                        </small>
                      </div>
                      <div>
                        <b>{money(t.total)}</b>
                        <span className={`status ${t.status.toLowerCase()}`}>{t.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Quick Actions Grid */}
          <div className="card quick-card">
            <div className="card-head">
              <div>
                <h2>Quick actions</h2>
                <p>Frequently used tasks</p>
              </div>
            </div>
            <div className="quick-grid">
              <Quick icon={<FileText />} label="Create sale" onClick={() => handleNavigate('/sales')} />
              <Quick icon={<ShoppingCart />} label="New purchase" onClick={() => handleNavigate('/purchases')} />
              <Quick icon={<Users />} label="Add customer" onClick={() => handleNavigate('/customers')} />
              <Quick icon={<Truck />} label="Add supplier" onClick={() => handleNavigate('/suppliers')} />
            </div>
          </div>
        </section>
      </section>

      {/* Global Bottom Navigation on Mobile */}
      <nav className="bottom-nav no-print" suppressHydrationWarning>
        {nav.slice(0, 4).map(({ label, icon: Icon, href }) => (
          <button
            key={label}
            className={activeNav === label ? 'chosen' : ''}
            onClick={() => handleNavigate(href, label)}
            type="button"
          >
            <Icon size={19} />
            <span>{label}</span>
          </button>
        ))}
        <button type="button" onClick={() => setMobileNav(true)}>
          <MoreHorizontal size={21} />
          <span>More</span>
        </button>
      </nav>
    </main>
  );
}

function MetricCard({
  tone,
  label,
  value,
  changePct,
  icon,
  subtext,
  onClick,
  loading,
}: {
  tone: string;
  label: string;
  value: number;
  changePct?: number;
  icon: React.ReactNode;
  subtext?: string;
  onClick?: () => void;
  loading?: boolean;
}) {
  const isUp = (changePct ?? 0) >= 0;
  return (
    <article className="metric card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className={`metric-icon ${tone}`}>{icon}</div>
      <div>
        <p>{label}</p>
        <h3>{loading ? '…' : money(value)}</h3>
        {changePct !== undefined ? (
          <small className={isUp ? 'up' : 'down'}>
            {isUp ? `↑ ${changePct}%` : `↓ ${Math.abs(changePct)}%`} <span>vs yesterday</span>
          </small>
        ) : subtext ? (
          <small style={{ color: 'var(--muted)' }}>{subtext}</small>
        ) : null}
      </div>
    </article>
  );
}

function Chart({ chart }: { chart: { sales: number[]; purchases: number[]; maxVal: number } }) {
  const { sales, purchases, maxVal } = chart;
  const count = Math.max(1, Math.max(sales.length, purchases.length) - 1);

  const getPoints = (arr: number[]) => {
    if (!arr.length) return '0,72 100,72';
    return arr
      .map((val, idx) => {
        const x = (idx / count) * 100;
        const y = Math.max(6, Math.min(72, 72 - (val / Math.max(1, maxVal)) * 66));
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  };

  return (
    <svg className="line-chart" viewBox="0 0 100 76" preserveAspectRatio="none">
      <path d="M0 12H100M0 34H100M0 56H100M0 76H100" className="guides" />
      <polyline points={getPoints(purchases)} className="purchases-line" />
      <polyline points={getPoints(sales)} className="sales-line" />
    </svg>
  );
}

function Quick({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button className="quick" type="button" onClick={onClick}>
      <span>{icon}</span>
      <b>{label}</b>
      <ChevronRight size={15} />
    </button>
  );
}
