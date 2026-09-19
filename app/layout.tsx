import type { Metadata, Viewport } from 'next';
import './globals.css';
import { RouteSidebar } from '@/components/route-sidebar';
import { MutationGuard } from '@/components/mutation-guard';
import { LedgerDefaults } from '@/components/ledger-defaults';
import { DeleteConfirmation } from '@/components/delete-confirmation';
import { LegacyListControls } from '@/components/legacy-list-controls';
import { NetworkStatus } from '@/components/network-status';
import { NativeFilterPickerUpgrade } from '@/components/native-filter-picker-upgrade';
import { PwaRegister } from '@/components/pwa-register';
import { PwaInstallPrompt } from '@/components/pwa-install-prompt';

export const metadata: Metadata = {
  title: 'Veg Basket',
  description: 'UAE vegetable trading ERP & Financial Management System',
  applicationName: 'Veg Basket',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Veg Basket',
  },
  icons: {
    icon: [
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#168d65',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <RouteSidebar />
        <MutationGuard />
        <LedgerDefaults />
        <DeleteConfirmation />
        <NetworkStatus />
        <LegacyListControls />
        <NativeFilterPickerUpgrade />
        <PwaRegister />
        <PwaInstallPrompt />
        {children}
      </body>
    </html>
  );
}
