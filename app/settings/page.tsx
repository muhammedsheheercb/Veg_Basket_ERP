'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  KeyRound,
  Lock,
  RefreshCw,
  Save,
  ShieldCheck,
  User,
} from 'lucide-react';
import { AppSidebar } from '@/components/app-sidebar';
import { MobileNavigation } from '@/components/mobile-navigation';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Profile Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const fetchProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/profile');
      if (!res.ok) {
        throw new Error('Failed to load profile details');
      }
      const data = await res.json();
      if (data.user) {
        setName(data.user.name || '');
        setEmail(data.user.email || '');
        setRole(data.user.role || 'admin');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess('');
    setError('');

    if (!name.trim()) {
      setError('Name cannot be empty.');
      return;
    }

    setSavingProfile(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile.');
      }

      setSuccess('Profile updated successfully!');
      if (data.user?.name) {
        setName(data.user.name);
      }
    } catch (err: any) {
      setError(err.message || 'Error updating profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to change password.');
      }

      setPasswordSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.message || 'Error changing password.');
    } finally {
      setSavingPassword(false);
    }
  };

  // Get initials for avatar badge
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'VB';

  return (
    <div className="app-shell">
      <AppSidebar active="Settings" />

      <main className="management">
        <header className="management-head">
          <div>
            <p className="eyebrow">ACCOUNT & SYSTEM PREFERENCES</p>
            <h1>Settings</h1>
            <p>Manage your user profile display name, login credentials, and account security settings.</p>
          </div>
        </header>

        {loading ? (
          <div style={{ padding: '50px', textAlign: 'center', color: 'var(--muted)' }}>
            <RefreshCw className="button-spinner" size={28} style={{ marginBottom: '12px' }} />
            <p>Loading account settings...</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px', maxWidth: '1200px' }}>
            
            {/* CARD 1: USER PROFILE INFORMATION */}
            <section className="data-panel card" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '22px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
                <div
                  style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #10b981, #047857)',
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 700,
                    fontSize: '20px',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                    flexShrink: 0,
                  }}
                >
                  {initials}
                </div>
                <div>
                  <h2 style={{ margin: '0 0 4px', fontSize: '18px', color: '#0f172a' }}>Account Profile</h2>
                  <p style={{ margin: 0, color: 'var(--muted)', fontSize: '12px' }}>
                    This name will be displayed across your dashboard, sidebar, and transactions.
                  </p>
                </div>
              </div>

              {success && (
                <div className="form-error" style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: '#047857', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={16} /> {success}
                </div>
              )}

              {error && (
                <div className="form-error" style={{ marginBottom: '16px' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleUpdateProfile} className="supplier-form" style={{ padding: 0 }}>
                <label>
                  Full Name / Display Name
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Muhammed Sheheer or Administrator"
                    required
                  />
                  <small style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '2px' }}>
                    Displayed as greeting on Dashboard and Top Bar
                  </small>
                </label>

                <label style={{ marginTop: '14px' }}>
                  Email Address
                  <input
                    type="email"
                    value={email}
                    disabled
                    style={{ background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' }}
                  />
                  <small style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '2px' }}>
                    Login email address (Contact admin to change email)
                  </small>
                </label>

                <label style={{ marginTop: '14px' }}>
                  User Role
                  <input
                    type="text"
                    value={role.toUpperCase()}
                    disabled
                    style={{ background: '#f8fafc', color: '#64748b', cursor: 'not-allowed', fontWeight: 600 }}
                  />
                </label>

                <div style={{ marginTop: '24px' }}>
                  <button type="submit" className="primary" style={{ width: '100%', justifyContent: 'center' }} disabled={savingProfile}>
                    {savingProfile ? <RefreshCw className="button-spinner" size={16} /> : <Save size={16} />}
                    <span>Save Name & Profile</span>
                  </button>
                </div>
              </form>
            </section>

            {/* CARD 2: CHANGE PASSWORD */}
            <section className="data-panel card" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '22px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
                <div
                  style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '12px',
                    background: '#eff6ff',
                    color: '#2563eb',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <KeyRound size={26} />
                </div>
                <div>
                  <h2 style={{ margin: '0 0 4px', fontSize: '18px', color: '#0f172a' }}>Security & Password</h2>
                  <p style={{ margin: 0, color: 'var(--muted)', fontSize: '12px' }}>
                    Update your password to keep your Veg Basket ERP account secure.
                  </p>
                </div>
              </div>

              {passwordSuccess && (
                <div className="form-error" style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: '#047857', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={16} /> {passwordSuccess}
                </div>
              )}

              {passwordError && (
                <div className="form-error" style={{ marginBottom: '16px' }}>
                  {passwordError}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="supplier-form" style={{ padding: 0 }}>
                <label>
                  Current Password
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    required
                  />
                </label>

                <label style={{ marginTop: '14px' }}>
                  New Password
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 6 chars)"
                    required
                  />
                </label>

                <label style={{ marginTop: '14px' }}>
                  Confirm New Password
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                  />
                </label>

                <div style={{ marginTop: '24px' }}>
                  <button type="submit" className="primary" style={{ width: '100%', justifyContent: 'center', background: '#1e293b' }} disabled={savingPassword}>
                    {savingPassword ? <RefreshCw className="button-spinner" size={16} /> : <Lock size={16} />}
                    <span>Update Password</span>
                  </button>
                </div>
              </form>
            </section>

          </div>
        )}
      </main>

      <MobileNavigation />
    </div>
  );
}
