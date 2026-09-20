// @ts-nocheck
'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Eye, Pencil, Plus, Trash2, X } from 'lucide-react';
import { ListFilters, ListPagination, useListControls } from '@/components/list-controls';

export default function Workers() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(undefined);
  const [remove, setRemove] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => fetch('/api/workers').then(r => r.json()).then(setRows);
  useEffect(() => { void load() }, []);

  const controls = useListControls(rows, w => `${w.name} ${w.mobile} ${w.address || ''} ${w.notes || ''}`, w => w.joiningDate);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const d = new FormData(e.currentTarget);
    const r = await fetch(form?.id ? '/api/workers/' + form.id : '/api/workers', {
      method: form?.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(d))
    });
    setBusy(false);
    if (r.ok) {
      setForm(undefined);
      load();
    } else setError((await r.json()).error);
  }

  return (
    <main className="management">
      <header className="management-head">
        <div>
          <p className="eyebrow">WORKER MANAGEMENT</p>
          <h1>Workers</h1>
          <p>Manage worker details and expense history.</p>
        </div>
        <button className="primary" onClick={() => { setError(''); setForm(null) }}>
          <Plus size={17} /> <span>Add worker</span>
        </button>
      </header>

      <section className="card data-panel">
        <ListFilters controls={controls} dateFilter placeholder="Search worker, mobile, address, or notes…" />

        {/* DESKTOP TABLE VIEW */}
        <div className="desktop-only">
          <div className="supplier-row labels">
            <span>Worker</span>
            <span>Mobile</span>
            <span>Joining date</span>
            <span></span>
            <span></span>
            <span>Actions</span>
          </div>
          {controls.pageRows.map(w => (
            <div className="supplier-row" key={w.id}>
              <b>{w.name}</b>
              <span>{w.mobile}</span>
              <span>{w.joiningDate || '—'}</span>
              <span />
              <span />
              <span className="row-actions">
                <Link className="worker-view" title="View worker details" href={'/workers/' + w.id}>
                  <Eye size={16} />
                </Link>
                <button title="Edit worker" onClick={() => setForm(w)}>
                  <Pencil size={16} />
                </button>
                <button className="danger" title="Delete worker" onClick={() => setRemove(w)}>
                  <Trash2 size={16} />
                </button>
              </span>
            </div>
          ))}
        </div>

        {/* MOBILE CARDS VIEW */}
        <div className="mobile-only" style={{ marginTop: "12px" }}>
          {controls.pageRows.map(w => (
            <div key={w.id} className="erp-mobile-card">
              <div className="erp-mobile-card-header">
                <div>
                  <div className="erp-mobile-card-title">{w.name}</div>
                  <div className="erp-mobile-card-subtitle">{w.mobile || 'No mobile listed'}</div>
                </div>
              </div>

              <div className="erp-mobile-card-body">
                <div className="erp-mobile-field">
                  <label>Joining Date</label>
                  <span>{w.joiningDate || '—'}</span>
                </div>
                {w.address && (
                  <div className="erp-mobile-field">
                    <label>Address</label>
                    <span>{w.address}</span>
                  </div>
                )}
              </div>

              <div className="erp-mobile-card-actions">
                <Link className="worker-view" title="View worker details" href={'/workers/' + w.id} style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                  <Eye size={16} /> <span>View Ledger</span>
                </Link>
                <button title="Edit worker" onClick={() => setForm(w)}>
                  <Pencil size={16} /> <span>Edit</span>
                </button>
                <button className="danger" title="Delete worker" onClick={() => setRemove(w)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {!controls.filtered.length && <p className="empty">No workers match these filters.</p>}
        <div className="list-footer-pagination">
          <ListPagination controls={controls} />
        </div>
      </section>

      {form !== undefined && (
        <div className="modal">
          <div className="modal-backdrop" onClick={() => setForm(undefined)} />
          <section className="supplier-form worker-form card">
            <button className="sheet-close" onClick={() => setForm(undefined)}>
              <X />
            </button>
            <h2>{form ? 'Edit worker' : 'Add worker'}</h2>
            <form onSubmit={save}>
              <label>
                Worker name
                <input name="name" required defaultValue={form?.name} />
              </label>
              <label>
                Mobile
                <input name="mobile" required defaultValue={form?.mobile} />
              </label>
              <label>
                Address
                <textarea name="address" defaultValue={form?.address} />
              </label>
              <label>
                Joining date
                <input name="joiningDate" type="date" defaultValue={form?.joiningDate || new Date().toISOString().slice(0, 10)} />
              </label>
              <label>
                Notes
                <textarea name="notes" defaultValue={form?.notes} />
              </label>
              {error && <div className="form-error">{error}</div>}
              <button className="primary" disabled={busy}>
                {busy ? 'Saving…' : form ? 'Update worker' : 'Save worker'}
              </button>
            </form>
          </section>
        </div>
      )}

      {remove && (
        <div className="modal delete-confirm-modal">
          <div className="modal-backdrop" onClick={() => setRemove(null)} />
          <section className="supplier-form card">
            <h2>Delete worker?</h2>
            <p>Workers with expense history cannot be deleted.</p>
            {error && <div className="form-error">{error}</div>}
            <div className="confirm-actions">
              <button className="outline" onClick={() => setRemove(null)}>Cancel</button>
              <button className="delete-button" disabled={busy} onClick={async () => {
                setBusy(true);
                const r = await fetch('/api/workers/' + remove.id, { method: 'DELETE' });
                setBusy(false);
                if (r.ok) { setRemove(null); load(); }
                else setError((await r.json()).error);
              }}>
                {busy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
