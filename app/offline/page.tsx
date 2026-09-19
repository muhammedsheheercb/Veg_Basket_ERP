'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { RefreshCw, WifiOff, Home } from 'lucide-react';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : false);
  const [rechecking, setRechecking] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = () => {
    setRechecking(true);
    setTimeout(() => {
      if (navigator.onLine) {
        window.location.reload();
      } else {
        setIsOnline(false);
        setRechecking(false);
      }
    }, 600);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      padding: '24px',
      background: '#f8fafc',
      fontFamily: 'inherit'
    }}>
      <div style={{
        maxWidth: '460px',
        width: '100%',
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '36px 28px',
        textAlign: 'center',
        boxShadow: '0 10px 30px rgba(15,23,42,0.06)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <Image src="/images/logo.webp" alt="Veg Basket" width={64} height={72} priority />
        </div>

        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: '#fee2e2',
          color: '#b91c1c',
          display: 'grid',
          placeItems: 'center',
          margin: '0 auto 16px'
        }}>
          <WifiOff size={28} />
        </div>

        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
          You Are Currently Offline
        </h1>

        <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, margin: '0 0 20px' }}>
          Veg Basket ERP requires a network connection to load real-time financial records, ledger balances, and transactions accurately.
        </p>

        {isOnline && (
          <div style={{
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#047857',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 600,
            marginBottom: '20px'
          }}>
            Connection restored! Click &quot;Try Reconnecting&quot; below.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            className="primary"
            onClick={handleRetry}
            disabled={rechecking}
            style={{
              width: '100%',
              height: '42px',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: 600,
              gap: '8px'
            }}
          >
            <RefreshCw size={16} className={rechecking ? 'button-spinner' : ''} />
            <span>{rechecking ? 'Checking connection...' : 'Try Reconnecting'}</span>
          </button>

          <Link
            href="/"
            className="outline"
            style={{
              width: '100%',
              height: '42px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: 600,
              gap: '8px',
              textDecoration: 'none'
            }}
          >
            <Home size={16} />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
