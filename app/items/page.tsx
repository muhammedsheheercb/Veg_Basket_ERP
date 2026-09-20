'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { ListFilters, ListPagination, useListControls } from '@/components/list-controls';

type I = { id: string; code: string; name: string; description?: string; active: boolean };

export default function Items() {
  const [rows, setRows] = useState<I[]>([]);
  const [form, setForm] = useState<I | null | undefined>();
  const [error, setError] = useState('');

  const load = () => fetch('/api/items').then((r) => r.json()).then(setRows);
  useEffect(() => {
    void load();
  }, []);

  const controls = useListControls(rows, (x) => `${x.code} ${x.name} ${x.description || ''}`);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const r = await fetch(form ? `/api/items/${form.id}` : '/api/items', {
      method: form ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: d.get('name'),
        description: d.get('description'),
        active: d.get('active') === 'on',
      }),
    });
    if (r.ok) {
      setForm(undefined);
      load();
    } else setError((await r.json()).error);
  }

  return (
    <main className="management">
      <header className="management-head">
        <div>
          <p className="eyebrow">ITEM MANAGEMENT</p>
          <h1>Items</h1>
          <p>Reusable sale items and item codes.</p>
        </div>
        <button className="primary" onClick={() => { setError(''); setForm(null); }}>
          <Plus size={16} /> <span>Add item</span>
        </button>
      </header>

      <section className="card data-panel">
        <ListFilters controls={controls} placeholder="Search item code, name, or description…" />

        {/* DESKTOP TABLE VIEW */}
        <div className="desktop-only">
          <div className="supplier-row item-row labels">
            <span>Code</span>
            <span>Item</span>
            <span>Description</span>
            <span>Status</span>
            <span></span>
            <span>Actions</span>
          </div>
          {controls.pageRows.map((x) => (
            <div className="supplier-row item-row" key={x.id}>
              <b>{x.code}</b>
              <span>{x.name}</span>
              <span>{x.description || '—'}</span>
              <span>{x.active ? 'Active' : 'Inactive'}</span>
              <span />
              <span className="row-actions">
                <button onClick={() => setForm(x)}>
                  <Pencil size={16} />
                </button>
                <button
                  className="danger"
                  onClick={async () => {
                    await fetch(`/api/items/${x.id}`, { method: 'DELETE' });
                    load();
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </span>
            </div>
          ))}
        </div>

        {/* MOBILE CARDS VIEW */}
        <div className="mobile-only" style={{ marginTop: '12px' }}>
          {controls.pageRows.map((x) => (
            <div key={x.id} className="erp-mobile-card">
              <div className="erp-mobile-card-header">
                <div>
                  <b style={{ color: '#168d65', fontSize: '12.5px' }}>{x.code}</b>
                  <div className="erp-mobile-card-title" style={{ marginTop: '2px' }}>
                    {x.name}
                  </div>
                </div>
                <span className={`status ${x.active ? 'paid' : 'pending'}`}>
                  {x.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              {x.description && (
                <div className="erp-mobile-card-body full-width">
                  <div className="erp-mobile-field">
                    <label>Description</label>
                    <span>{x.description}</span>
                  </div>
                </div>
              )}
              <div className="erp-mobile-card-actions">
                <button title="Edit Item" onClick={() => setForm(x)}>
                  <Pencil size={16} /> <span>Edit</span>
                </button>
                <button
                  className="danger"
                  title="Delete Item"
                  onClick={async () => {
                    await fetch(`/api/items/${x.id}`, { method: 'DELETE' });
                    load();
                  }}
                >
                  <Trash2 size={16} /> <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {!controls.filtered.length && <p className="empty">No items match these filters.</p>}
        <div className="list-footer-pagination">
          <ListPagination controls={controls} />
        </div>
      </section>

      {form !== undefined && (
        <div className="modal">
          <div className="modal-backdrop" onClick={() => setForm(undefined)} />
          <section className="supplier-form item-form card">
            <button className="sheet-close" onClick={() => setForm(undefined)}>
              <X />
            </button>
            <h2>{form ? 'Edit item' : 'Add item'}</h2>
            <form onSubmit={save}>
              <label>
                Item code
                <input value={form?.code || 'Generated automatically when saved'} disabled />
                <small style={{ color: 'var(--muted)', fontSize: '11px' }}>
                  Unique system code. It cannot be edited.
                </small>
              </label>
              <label>
                Item name
                <input name="name" required defaultValue={form?.name} />
              </label>
              <label>
                Description
                <textarea name="description" defaultValue={form?.description} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input name="active" type="checkbox" defaultChecked={form?.active ?? true} /> Active item
              </label>
              {error && <div className="form-error">{error}</div>}
              <button className="primary">{form ? 'Update item' : 'Save item'}</button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
