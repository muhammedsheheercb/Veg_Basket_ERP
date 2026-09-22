'use client';
import { usePathname } from 'next/navigation';
import { AppSidebar } from './app-sidebar';
import { MobileNavigation } from './mobile-navigation';
export function RouteSidebar() { const pathname = usePathname(); const active = pathname === '/' ? 'Dashboard' : pathname === '/purse' ? 'My Purse' : pathname === '/reports' ? 'Reports' : pathname === '/suppliers' ? 'Suppliers' : pathname === '/purchases' ? 'Purchases' : pathname === '/customers' ? 'Customers' : pathname === '/items' ? 'Items' : pathname === '/price-lists' ? 'Price List' : pathname === '/sales' ? 'Sales' : pathname === '/expenses' ? 'Expenses' : pathname === '/loans' ? 'Loans' : pathname === '/settings' ? 'Settings' : pathname === '/workers' || pathname.startsWith('/workers/') ? 'Workers' : ''; return <>{active && <AppSidebar active={active} />}<MobileNavigation /></> }
