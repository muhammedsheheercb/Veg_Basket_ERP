'use client';
import { usePathname } from 'next/navigation';
import { AppSidebar } from './app-sidebar';
import { MobileNavigation } from './mobile-navigation';
export function RouteSidebar(){const pathname=usePathname();const active=pathname==='/suppliers'?'Suppliers':pathname==='/purchases'?'Purchases':pathname==='/customers'?'Customers':pathname==='/items'?'Items':pathname==='/sales'?'Sales':pathname==='/expenses'?'Expenses':pathname==='/loans'?'Loans':pathname==='/workers'||pathname.startsWith('/workers/')?'Workers':'';return <>{active&&<AppSidebar active={active}/>}<MobileNavigation/></>}
