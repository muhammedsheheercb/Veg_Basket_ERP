'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Boxes,
  ChevronRight,
  FileText,
  HardHat,
  Home,
  Landmark,
  LayoutGrid,
  LayoutList,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  WalletCards,
  Settings,
  X,
} from 'lucide-react';

const primaryItems = [
  ['Home', '/', Home],
  ['Purse', '/purse', Wallet],
  ['Sales', '/sales', FileText],
  ['Purchases', '/purchases', ShoppingCart],
] as const;

const moreItems = [
  { label: 'Suppliers', href: '/suppliers', icon: Truck, desc: 'Manage suppliers & vendor balances', bg: '#f0fdf4', color: '#16a34a' },
  { label: 'My Purse', href: '/purse', icon: Wallet, desc: 'Cash & bank balance tracker', bg: '#e0f2fe', color: '#0284c7' },
  { label: 'Loans', href: '/loans', icon: Landmark, desc: 'Track loan liabilities & EMI payments', bg: '#ecfdf5', color: '#059669' },
  { label: 'Workers', href: '/workers', icon: HardHat, desc: 'Worker wages & expense ledger', bg: '#fef3c7', color: '#d97706' },
  { label: 'Customers', href: '/customers', icon: Users, desc: 'Manage clients & receivable balances', bg: '#eff6ff', color: '#2563eb' },
  { label: 'Expenses', href: '/expenses', icon: WalletCards, desc: 'Operating & daily shop expenses', bg: '#f5f3ff', color: '#7c3aed' },
  { label: 'Items', href: '/items', icon: Boxes, desc: 'Inventory products & item codes', bg: '#ecfeff', color: '#0891b2' },
  { label: 'Reports', href: '/reports', icon: LayoutList, desc: 'Financial summaries & ledger reports', bg: '#f1f5f9', color: '#475569' },
  { label: 'Settings', href: '/settings', icon: Settings, desc: 'User profile name & password change', bg: '#f1f5f9', color: '#0f172a' },
] as const;

export function MobileNavigation() {
  const path = usePathname();
  const [openMore, setOpenMore] = useState(false);

  if (path === '/login') return null;

  const isMoreActive =
    openMore ||
    moreItems.some((item) => path === item.href || path.startsWith(`${item.href}/`));

  return (
    <>
      <nav className="global-bottom-nav" aria-label="Primary navigation">
        {primaryItems.map(([label, href, Icon]) => {
          const active = href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
          return (
            <Link key={label} href={href} className={active ? 'active' : ''} onClick={() => setOpenMore(false)}>
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          className={`global-bottom-nav-btn ${isMoreActive ? 'active' : ''}`}
          onClick={() => setOpenMore((prev) => !prev)}
          aria-label="Open more navigation"
        >
          <LayoutGrid size={20} />
          <span>More</span>
        </button>
      </nav>

      {/* MORE MODULES MODAL / BOTTOM SHEET */}
      {openMore && (
        <div className="mobile-more-modal">
          <div className="mobile-more-backdrop" onClick={() => setOpenMore(false)} />
          <section className="mobile-more-sheet card">
            <button className="sheet-close" onClick={() => setOpenMore(false)} aria-label="Close menu">
              <X size={18} />
            </button>

            <div className="mobile-more-header">
              <h3>More Modules</h3>
            </div>
            <p className="mobile-more-subtitle">Quickly access other Veg Basket ERP modules</p>

            <div className="mobile-more-grid">
              {moreItems.map((item) => {
                const active = path === item.href || path.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`mobile-more-item ${active ? 'active' : ''}`}
                    onClick={() => setOpenMore(false)}
                  >
                    <div className="mobile-more-icon" style={{ background: item.bg, color: item.color }}>
                      <Icon size={20} />
                    </div>
                    <div className="mobile-more-item-info">
                      <b>{item.label}</b>
                      <small>{item.desc}</small>
                    </div>
                    <ChevronRight size={16} style={{ color: '#94a3b8', flexShrink: 0 }} />
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
