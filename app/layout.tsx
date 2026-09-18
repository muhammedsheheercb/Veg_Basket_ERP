import type { Metadata } from 'next';
import './globals.css';
import { RouteSidebar } from '@/components/route-sidebar';
import { MutationGuard } from '@/components/mutation-guard';
import { LedgerDefaults } from '@/components/ledger-defaults';
import { DeleteConfirmation } from '@/components/delete-confirmation';

export const metadata: Metadata = { title: 'Veg Basket', description: 'UAE vegetable trading ERP', applicationName: 'Veg Basket' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><RouteSidebar /><MutationGuard /><LedgerDefaults /><DeleteConfirmation />{children}</body></html>; }
