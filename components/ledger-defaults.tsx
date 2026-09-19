'use client';
import { useEffect } from 'react';

export function LedgerDefaults() {
  useEffect(() => {
    const apply = () => {
      const today = new Date().toISOString().slice(0, 10);
      document.querySelectorAll<HTMLInputElement>('form input[type="date"]:not(.list-filters input)').forEach((input) => {
        if (!input.max && !input.hasAttribute('data-allow-future')) {
          input.max = today;
        }
      });
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}

