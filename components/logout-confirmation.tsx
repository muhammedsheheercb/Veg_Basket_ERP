'use client';

import { useState } from 'react';
import { LogOut } from 'lucide-react';

export function LogoutConfirmation({ open, onCancel }: { open: boolean; onCancel: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const logout = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error();
      window.location.assign('/login');
    } catch {
      setError('Unable to log out. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div className="modal logout-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="logout-confirm-title">
      <div className="modal-backdrop" onClick={busy ? undefined : onCancel} />
      <section className="supplier-form card">
        <h2 id="logout-confirm-title">Logout?</h2>
        <p>Are you sure you want to log out?</p>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="confirm-actions">
          <button className="outline" type="button" disabled={busy} onClick={onCancel}>Cancel</button>
          <button className="logout-button" type="button" disabled={busy} onClick={logout}>
            <LogOut size={16} /> {busy ? 'Logging out…' : 'Logout'}
          </button>
        </div>
      </section>
    </div>
  );
}
