'use client';

import { WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

export function NetworkStatus() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return offline ? <div className="network-status" role="alert"><WifiOff size={16}/> You’re offline. Changes cannot be saved until your connection returns.</div> : null;
}
