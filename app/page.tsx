'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Bell, Boxes, ChevronDown, ChevronRight, FileText, HandCoins, Home, LayoutList, Menu, MoreHorizontal, PackagePlus, Search, Settings, ShoppingCart, Truck, Users, WalletCards, X } from 'lucide-react';

const money = (value: number) => `AED ${value.toLocaleString('en-AE', { minimumFractionDigits: 2 })}`;
const sales = Array(12).fill(0);
const purchases = Array(12).fill(0);
const nav = [{ label: 'Dashboard', icon: Home }, { label: 'Sales', icon: FileText }, { label: 'Purchases', icon: ShoppingCart }, { label: 'Suppliers', icon: Truck }, { label: 'Customers', icon: Users }, { label: 'Items', icon: Boxes }, { label: 'Expenses', icon: WalletCards }, { label: 'Reports', icon: LayoutList }];
const transactions: [string, string, string, number, string][] = [];

function Logo() { return <div className="brand"><Image src="/images/logo.webp" alt="Veg Basket" width={38} height={42} priority /></div> }
function IconButton({ children }: { children: React.ReactNode }) { return <button className="icon-button" aria-label="Action">{children}</button> }

export default function Dashboard() {
  const [mobileNav, setMobileNav] = useState(false);
  const [active, setActive] = useState('Dashboard');
  const [metrics, setMetrics] = useState({ todaySales: 0, todayPurchases: 0, todayExpenses: 0, receivables: 0, payables: 0, loanBalance: 0, monthSales: 0, monthPurchases: 0, monthExpenses: 0, netMovement: 0 });
  useEffect(() => { fetch('/api/dashboard').then(r => r.ok ? r.json() : null).then(data => data && setMetrics(data.metrics)).catch(() => undefined); }, []);
  return <main className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
      <div className="side-top"><Logo /><button className="close-nav" onClick={() => setMobileNav(false)}><X size={19}/></button></div>
      <nav>{nav.map(({ label, icon: Icon }) => <button key={label} onClick={() => { if (label === 'Suppliers') window.location.assign('/suppliers'); if (label === 'Purchases') window.location.assign('/purchases'); setActive(label); setMobileNav(false); }} className={active === label ? 'active' : ''}><Icon size={17}/><span>{label}</span></button>)}</nav>
      <div className="side-bottom"><button><Settings size={17}/><span>Settings</span></button><div className="help">Need help? <b>Contact support</b></div></div>
    </aside>
    {mobileNav && <button className="backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
    <section className="content">
      <header><button className="hamburger" onClick={() => setMobileNav(true)}><Menu size={21}/></button><div className="search"><Search size={17}/><input placeholder="Search invoices, customers, items..."/></div><div className="top-actions"><IconButton><Bell size={18}/><i/></IconButton><div className="avatar">AM</div><div className="profile"><b>Ahmed M.</b><small>Administrator</small></div><ChevronDown size={16}/></div></header>
      <div className="page-heading"><div><p className="eyebrow">THURSDAY, 18 SEPTEMBER</p><h1>Good morning, Ahmed <span>👋</span></h1><p>Here’s what’s happening with Veg Basket today.</p></div><button className="primary"><PackagePlus size={17}/> New sale</button></div>
      <section className="metrics">
        <Metric tone="green" label="Today’s Sales" value={metrics.todaySales} icon={<WalletCards size={18}/>}/><Metric tone="blue" label="Today’s Purchases" value={metrics.todayPurchases} icon={<ShoppingCart size={18}/>}/><Metric tone="orange" label="Today’s Expenses" value={metrics.todayExpenses} icon={<HandCoins size={18}/>}/><Metric tone="purple" label="Customer Receivables" value={metrics.receivables} icon={<Users size={18}/>}/>
      </section>
      <section className="charts">
        <div className="card chart-card"><div className="card-head"><div><h2>Sales vs Purchases</h2><p>Daily business activity</p></div><button className="select">This month <ChevronDown size={14}/></button></div><div className="legend"><span className="sales-dot"/>Sales <span className="purchase-dot"/>Purchases</div><Chart values={sales} second={purchases}/><div className="axis"><span>01 Sep</span><span>07 Sep</span><span>14 Sep</span><span>21 Sep</span><span>28 Sep</span></div></div>
        <div className="card cash-card"><div className="card-head"><div><h2>Monthly movement</h2><p>Sales less purchases and expenses</p></div><MoreHorizontal size={19}/></div><div className="cash-total">{money(metrics.netMovement)}</div><div className="cash-change">Supplier payables <span>{money(metrics.payables)}</span></div><div className="cash-bars"><div><span>This month’s sales</span><b>{money(metrics.monthSales)}</b><i><em style={{width:'0%'}}/></i></div><div><span>Loan balance</span><b>{money(metrics.loanBalance)}</b><i><em style={{width:'0%'}}/></i></div></div><button className="outline">View cash flow <ChevronRight size={16}/></button></div>
      </section>
      <section className="lower-grid"><div className="card table-card"><div className="card-head"><div><h2>Recent sales</h2><p>Latest invoices from your customers</p></div><button className="text-btn">View all</button></div><div className="desktop-table"><div className="table-row labels"><span>Invoice</span><span>Customer</span><span>Date</span><span>Amount</span><span>Status</span></div>{transactions.map(t=><div className="table-row" key={t[0]}><b>{t[0]}</b><span>{t[1]}</span><span>{t[2]}</span><b>{money(t[3] as number)}</b><span className={`status ${(t[4] as string).toLowerCase()}`}>{t[4]}</span></div>)}</div><div className="mobile-list">{transactions.map(t=><div className="mobile-sale" key={t[0]}><div><b>{t[1]}</b><small>{t[0]} · {t[2]}</small></div><div><b>{money(t[3] as number)}</b><span className={`status ${(t[4] as string).toLowerCase()}`}>{t[4]}</span></div></div>)}</div></div>
        <div className="card quick-card"><div className="card-head"><div><h2>Quick actions</h2><p>Frequently used tasks</p></div></div><div className="quick-grid"><Quick icon={<FileText/>} label="Create sale"/><Quick icon={<ShoppingCart/>} label="New purchase"/><Quick icon={<Users/>} label="Add customer"/><Quick icon={<Truck/>} label="Add supplier"/></div></div>
      </section>
    </section>
    <nav className="bottom-nav">{nav.slice(0,4).map(({label,icon:Icon})=><button key={label} className={active===label?'chosen':''} onClick={()=>setActive(label)}><Icon size={19}/><span>{label}</span></button>)}<button><MoreHorizontal size={21}/><span>More</span></button></nav>
  </main>
}
function Metric({ tone, label, value, icon }: { tone: string; label: string; value: number; icon: React.ReactNode }) { return <article className="metric card"><div className={`metric-icon ${tone}`}>{icon}</div><div><p>{label}</p><h3>{money(value)}</h3><small className={tone === 'orange' ? 'down' : 'up'}>{tone === 'orange' ? '↓ 3.1%' : '↑ 12.5%'} <span>vs yesterday</span></small></div></article> }
function Chart({values, second}:{values:number[];second:number[]}) { const points=(v:number[])=>v.map((x,i)=>`${i*9.09},${72-x}`).join(' '); return <svg className="line-chart" viewBox="0 0 100 76" preserveAspectRatio="none"><path d="M0 12H100M0 34H100M0 56H100M0 76H100" className="guides"/><polyline points={points(second)} className="purchases-line"/><polyline points={points(values)} className="sales-line"/></svg> }
function Quick({icon,label}:{icon:React.ReactNode;label:string}) { return <button className="quick"><span>{icon}</span><b>{label}</b><ChevronRight size={15}/></button> }
