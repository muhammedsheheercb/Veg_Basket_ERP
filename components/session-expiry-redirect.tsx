'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function SessionExpiryRedirect() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/login') return;

    let redirected = false;
    const validate = async () => {
      try {
        const response = await fetch('/api/profile', { cache: 'no-store' });
        if (response.status === 401 && !redirected) {
          redirected = true;
          window.location.replace('/login');
        }
      } catch {
        // A network outage is not an authentication failure.
      }
    };

    void validate();
    const interval = window.setInterval(() => void validate(), 5 * 60 * 1000);
    window.addEventListener('focus', validate);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', validate);
    };
  }, [pathname]);

  return null;
}
