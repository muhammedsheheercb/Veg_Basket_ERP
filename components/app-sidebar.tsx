'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Boxes, FileText, HardHat, Home, Landmark, LayoutList, LogOut, Menu, Settings, ShoppingCart, Truck, Users, Wallet, WalletCards, X } from 'lucide-react';
import { useState } from 'react';
import { LogoutConfirmation } from './logout-confirmation';

const links = [['Dashboard', '/', Home], ['My Purse', '/purse', Wallet], ['Sales', '/sales', FileText], ['Purchases', '/purchases', ShoppingCart], ['Suppliers', '/suppliers', Truck], ['Customers', '/customers', Users], ['Items', '/items', Boxes], ['Workers', '/workers', HardHat], ['Expenses', '/expenses', WalletCards], ['Loans', '/loans', Landmark], ['Reports', '/reports', LayoutList]] as const;

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
          <Image src="/images/logo.webp" alt="Veg Basket" width={38} height={42} priority />
          <button onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={19} />
          </button>
        </div>

        <nav>
          {links.map(([label, href, Icon]) => (
            <Link key={label} href={href} className={active === label ? 'active' : ''} onClick={() => setOpen(false)}>
              <Icon size={17} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div className="app-sidebar-footer">
          <Link className={`settings-link ${active === 'Settings' ? 'active' : ''}`} href="/settings" onClick={() => setOpen(false)}>
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
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <LogoutConfirmation open={logoutOpen} onCancel={() => setLogoutOpen(false)} />
    </>
  );
}

