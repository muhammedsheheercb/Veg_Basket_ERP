// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { Eye, Pencil, Plus, Trash2, X } from 'lucide-react';
import { ListFilters, ListPagination, useListControls } from '@/components/list-controls';
import { DateRangePicker, MonthPicker } from '@/components/filter-date-pickers';

const money = (x) => `AED ${Number(x).toLocaleString('en-AE', { minimumFractionDigits: 2 })}`;
const today = new Date().toISOString().slice(0, 10);
const cats = ['Salary', 'Petrol/Fuel', 'Food', 'Grocery', 'Vehicle Maintenance', 'Other'];

export default function Expenses() {
  const [data, setData] = useState({ rows: [], total: 0 });
  const [f, setF] = useState({ from: '', to: '', month: '', category: 'All', method: 'All' });
  const [form, setForm] = useState(undefined);
  const [view, setView] = useState(null);
  const [remove, setRemove] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const controls = useListControls(
    data.rows,
    (x) => `${x.category} ${x.description || ''} ${x.workerName || ''} ${x.method || ''} ${x.amount || ''}`,
    (x) => x.date
  );

  const load = () =>
    fetch('/api/expenses?' + new URLSearchParams(f))
      .then((r) => r.json())
      .then((x) => x.rows && setData(x));

  useEffect(() => {
    void load();
  }, [f]);

  useEffect(() => {
    controls.setPage(1);
  }, [f]);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const d = new FormData(e.currentTarget);
    const r = await fetch(form?.id ? '/api/expenses/' + form.id : '/api/expenses', {
      method: form?.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(d)),
    });
    setBusy(false);
    if (r.ok) {
      setForm(undefined);
      load();
    } else setError((await r.json()).error);
  }

  const active = Object.values(f).some((x) => x && x !== 'All');

  return (
    <main className="management">
      <header className="management-head">
        <div>
          <p className="eyebrow">EXPENSE MANAGEMENT</p>
          <h1>Expenses</h1>
          <p>Record and monitor operating expenses.</p>
        </div>
        <button className="primary" onClick={() => { setError(''); setForm(null); }}>
          <Plus size={16} /> <span>Add expense</span>
        </button>
      </header>

      <section className="expense-total">
        <span>
          Filtered expense total<b>{money(data.total)}</b>
        </span>
        <small>
          {controls.filtered.length} expense record{controls.filtered.length === 1 ? '' : 's'}
        </small>
      </section>

      <section className="card data-panel">
        <ListFilters controls={controls} placeholder="Search category, description, worker, or amount…" />

        <div className="expense-filters">
          <DateRangePicker from={f.from} to={f.to} onChange={(from, to) => setF((x) => ({ ...x, from, to }))} />
          <MonthPicker value={f.month} onChange={(month) => setF((x) => ({ ...x, month }))} />
          <select aria-label="Expense category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            <option>All</option>
            {cats.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select aria-label="Payment method" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
            <option>All</option>
            <option>Cash</option>
            <option>Card</option>
            <option>Bank Transfer</option>
          </select>
          {active && (
            <button className="outline" onClick={() => setF({ from: '', to: '', month: '', category: 'All', method: 'All' })}>
              Clear filters
            </button>
          )}
        </div>

        {/* DESKTOP TABLE VIEW */}
        <div className="desktop-only">
          <div className="expense-row labels">
            <span>Date</span>
            <span>Category</span>
            <span>Description</span>
            <span>Amount</span>
            <span>Payment method</span>
            <span>Actions</span>
          </div>
          {controls.pageRows.map((x) => (
            <div className="expense-row" key={x.id}>
              <span>{x.date}</span>
              <b>{x.category}</b>
              <span>
                {x.description || '—'}
                {x.workerName && <small style={{ display: 'block' }}>Worker: {x.workerName}</small>}
              </span>
              <b>{money(x.amount)}</b>
              <span>{x.method}</span>
              <span className="row-actions">
                <button title="View expense" onClick={() => setView(x)}>
                  <Eye size={15} />
                </button>
                <button title="Edit expense" onClick={() => { setError(''); setForm(x); }}>
                  <Pencil size={15} />
                </button>
                <button className="danger" title="Delete expense" onClick={() => setRemove(x)}>
                  <Trash2 size={15} />
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
                  <span className="status paid" style={{ fontSize: '10.5px' }}>
                    {x.category}
                  </span>
                  <div className="erp-mobile-card-subtitle" style={{ marginTop: '4px' }}>
                    {x.date} · {x.method}
                  </div>
                </div>
                <b style={{ fontSize: '14px', color: '#b91c1c' }}>{money(x.amount)}</b>
              </div>

              <div className="erp-mobile-card-body full-width">
                <div className="erp-mobile-field">
                  <label>Description</label>
                  <span>{x.description || '—'}</span>
                </div>
                {x.workerName && (
                  <div className="erp-mobile-field">
                    <label>Linked Worker</label>
                    <b>{x.workerName}</b>
                  </div>
                )}
              </div>

              <div className="erp-mobile-card-actions">
                <button title="View Expense" onClick={() => setView(x)}>
                  <Eye size={15} /> <span>View</span>
                </button>
                <button title="Edit Expense" onClick={() => { setError(''); setForm(x); }}>
                  <Pencil size={15} /> <span>Edit</span>
                </button>
                <button className="danger" title="Delete Expense" onClick={() => setRemove(x)}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {!controls.filtered.length && <p className="empty">No expenses match these filters.</p>}
        <div className="list-footer-pagination">
          <ListPagination controls={controls} />
        </div>
      </section>

      {form !== undefined && (
        <ExpenseForm form={form} close={() => setForm(undefined)} save={save} busy={busy} error={error} />
      )}

      {view && (
        <div className="modal">
          <div className="modal-backdrop" onClick={() => setView(null)} />
          <section className="purchase-details card">
            <button className="sheet-close" onClick={() => setView(null)}>
              <X />
            </button>
            <p className="eyebrow">EXPENSE DETAILS</p>
            <h2>{view.category}</h2>
            <div className="detail-grid">
              <span>
                Date<b>{view.date}</b>
              </span>
              <span>
                Payment method<b>{view.method}</b>
              </span>
              <span>
                Amount<b>{money(view.amount)}</b>
              </span>
              {view.workerName && (
                <span>
                  Worker<b>{view.workerName}</b>
                </span>
              )}
            </div>
            <p className="detail-note">{view.description || 'No description provided.'}</p>
          </section>
        </div>
      )}

      {remove && (
        <div className="modal delete-confirm-modal">
          <div className="modal-backdrop" onClick={() => setRemove(null)} />
          <section className="supplier-form card">
            <h2>Delete expense?</h2>
            <p>This action cannot be undone.</p>
            <div className="confirm-actions">
              <button className="outline" onClick={() => setRemove(null)}>
                Cancel
              </button>
              <button
                className="delete-button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const r = await fetch('/api/expenses/' + remove.id, { method: 'DELETE' });
                  setBusy(false);
                  if (r.ok) {
                    setRemove(null);
                    load();
                  } else setError((await r.json()).error);
                }}
              >
                {busy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function ExpenseForm({ form, close, save, busy, error }) {
  return (
    <div className="modal">
      <div className="modal-backdrop" onClick={close} />
      <section className="supplier-form card expense-form">
        <button className="sheet-close" onClick={close}>
          <X />
        </button>
        <h2>{form ? 'Edit expense' : 'Add expense'}</h2>
        <form onSubmit={save}>
          <label>
            Date
            <input name="date" type="date" max={today} defaultValue={form?.date || today} required />
          </label>
          <label>
            Category
            <select name="category" defaultValue={form?.category || 'Salary'}>
              {cats.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Description <small>(required for Other)</small>
            <textarea name="description" defaultValue={form?.description} />
          </label>
          <label>
            Amount (AED)
            <input name="amount" type="number" min=".01" step=".01" defaultValue={form?.amount} required />
          </label>
          <label>
            Payment method
            <select name="method" defaultValue={form?.method || 'Cash'}>
              <option>Cash</option>
              <option>Card</option>
              <option>Bank Transfer</option>
            </select>
          </label>
          {error && <div className="form-error">{error}</div>}
          <button className="primary" disabled={busy}>
            {busy ? (form ? 'Updating…' : 'Creating…') : form ? 'Update expense' : 'Create expense'}
          </button>
        </form>
      </section>
    </div>
  );
}
