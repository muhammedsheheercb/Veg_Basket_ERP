'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Boxes, FileText, HardHat, Home, Landmark, LayoutList, LogOut, Menu, Settings, ShoppingCart, Truck, Users, Wallet, WalletCards, X } from 'lucide-react';
import { useState } from 'react';
import { LogoutConfirmation } from './logout-confirmation';

const navGroups = [
  {
    title: 'OVERVIEW',
    items: [
      ['Dashboard', '/', Home],
      ['My Purse', '/purse', Wallet],
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      ['Sales', '/sales', FileText],
      ['Purchases', '/purchases', ShoppingCart],
      ['Suppliers', '/suppliers', Truck],
      ['Customers', '/customers', Users],
      ['Items', '/items', Boxes],
    ],
  },
  {
    title: 'MANAGEMENT',
    items: [
      ['Workers', '/workers', HardHat],
      ['Expenses', '/expenses', WalletCards],
      ['Loans', '/loans', Landmark],
      ['Reports', '/reports', LayoutList],
    ],
  },
] as const;

export function AppSidebar({ active }: { active: string }) {
  const [open, setOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  return (
    <>
      <button className="app-menu" onClick={() => setOpen(true)} aria-label="Open menu">
        <Menu size={21} />
      </button>
      {open && <button className="app-scrim" onClick={() => setOpen(false)} aria-label="Close menu" />}

      <aside className={`app-sidebar ${open ? 'is-open' : ''}`}>
        <div className="app-brand">
          <div className="app-brand-logo-wrap">
            <Image src="/images/logo.webp" alt="Veg Basket Logo" width={30} height={34} priority className="app-brand-logo" />
          </div>
          <div className="app-brand-info">
            <div className="app-brand-title">
              Veg <span>Basket</span>
            </div>
            <span className="app-brand-badge">ERP</span>
          </div>
          <button className="app-brand-close" onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={19} />
          </button>
        </div>

        <nav className="app-sidebar-nav">
          {navGroups.map((group) => (
            <div key={group.title} className="nav-group">
              <div className="nav-group-title">{group.title}</div>
              {group.items.map(([label, href, Icon]) => (
                <Link
                  key={label}
                  href={href}
                  className={`nav-link ${active === label ? 'active' : ''}`}
                  onClick={() => setOpen(false)}
                >
                  <Icon size={17} className="nav-icon" />
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="app-sidebar-footer">
          <Link
            className={`settings-link ${active === 'Settings' ? 'active' : ''}`}
            href="/settings"
            onClick={() => setOpen(false)}
          >
            <Settings size={17} />
            <span>Settings</span>
          </Link>
          <button
            type="button"
            className="logout-link"
            onClick={() => {
              setOpen(false);
              setLogoutOpen(true);
            }}
          >
            <LogOut size={17} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <LogoutConfirmation open={logoutOpen} onCancel={() => setLogoutOpen(false)} />
    </>
  );
}


