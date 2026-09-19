'use client';

import { useEffect, useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already running as standalone PWA
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    ) {
      setIsStandalone(true);
      return;
    }

    // Check session storage if user dismissed it earlier
    const dismissed = sessionStorage.getItem('pwa_install_dismissed');
    if (dismissed === 'true') {
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted PWA installation prompt');
    }
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem('pwa_install_dismissed', 'true');
  };

  if (!showPrompt || isStandalone) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '80px',
        right: '20px',
        zIndex: 90,
        maxWidth: '360px',
        width: 'calc(100% - 40px)',
        background: '#ffffff',
        border: '1px solid #168d65',
        borderRadius: '14px',
        padding: '14px 16px',
        boxShadow: '0 12px 32px rgba(22, 141, 101, 0.18)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        animation: 'pwaSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: '#ecfdf5',
          color: '#168d65',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <Smartphone size={22} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <b style={{ fontSize: '13px', color: '#0f172a', display: 'block', margin: '0 0 2px' }}>
          Install Veg Basket App
        </b>
        <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
          Quick access from home screen & desktop
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          type="button"
          onClick={handleInstallClick}
          style={{
            height: '32px',
            padding: '0 12px',
            border: 0,
            borderRadius: '6px',
            background: '#168d65',
            color: '#ffffff',
            fontSize: '11.5px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Download size={14} />
          <span>Install</span>
        </button>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss install prompt"
          style={{
            width: '28px',
            height: '28px',
            border: 0,
            borderRadius: '6px',
            background: '#f1f5f9',
            color: '#64748b',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={15} />
        </button>
      </div>

      <style>{`
        @keyframes pwaSlideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @media (max-width: 700px) {
          div[style*="bottom: 80px"] {
            bottom: calc(75px + env(safe-area-inset-bottom)) !important;
            left: 20px !important;
            right: 20px !important;
          }
        }
      `}</style>
    </div>
  );
}
