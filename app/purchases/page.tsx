'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Download, Eye, Pencil, Plus, Trash2, X } from 'lucide-react';
import { money, shortDate } from '@/components/financial-documents';
import { ListFilters, ListPagination, useListControls } from '@/components/list-controls';
import { downloadPdf } from '@/components/pdf-download';

type P = { id: string; invoice: string; supplier: string; date: string; total: string; paid: string };
type D = {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  purchaseDate: string;
  description?: string;
  total: string;
  paid: string;
  paymentMethod?: string;
  notes?: string;
  supplierName: string;
  supplierMobile?: string;
  supplierAddress?: string;
};

const status = (p: D) => (Number(p.paid) >= Number(p.total) ? 'Paid' : Number(p.paid) > 0 ? 'Partial' : 'Unpaid');

export default function Purchases() {
  const [rows, setRows] = useState<P[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [form, setForm] = useState<D | null | undefined>();
  const [details, setDetails] = useState<D | null>(null);
  const [print, setPrint] = useState<D | null>(null);
  const [remove, setRemove] = useState<P | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    fetch('/api/purchases').then((r) => r.json()).then((x) => Array.isArray(x) && setRows(x));
    fetch('/api/suppliers').then((r) => r.json()).then((x) => Array.isArray(x) && setSuppliers(x));
  };
  useEffect(load, []);

  const controls = useListControls(
    rows,
    (p) => p.invoice + ' ' + p.supplier + ' ' + p.date + ' ' + p.total + ' ' + p.paid,
    (p) => p.date
  );

  const get = async (id: string) => {
    const r = await fetch('/api/purchases/' + id);
    return r.ok ? r.json() : null;
  };

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const r = await fetch(form?.id ? '/api/purchases/' + form.id : '/api/purchases', {
      method: form?.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId: d.get('supplierId'),
        date: d.get('date'),
        description: d.get('description'),
        total: d.get('total'),
        paid: d.get('paid'),
        method: d.get('method'),
        notes: d.get('notes'),
      }),
    });
    if (!r.ok) setError((await r.json()).error);
    else {
      setForm(undefined);
      setError('');
      load();
    }
  }

  async function del() {
    if (!remove) return;
    const r = await fetch('/api/purchases/' + remove.id, { method: 'DELETE' });
    if (!r.ok) setError((await r.json()).error);
    else {
      setRemove(null);
      load();
    }
  }

  return (
    <main className="management">
      <header className="management-head no-print">
        <div>
          <p className="eyebrow">PURCHASE MANAGEMENT</p>
          <h1>Purchases</h1>
          <p>Purchase bills and supplier balances.</p>
        </div>
        <button className="primary" onClick={() => { setError(''); setForm(null); }}>
          <Plus size={17} /> <span>Add purchase</span>
        </button>
      </header>

      <section className="card data-panel no-print">
        <ListFilters controls={controls} dateFilter placeholder="Search bill, supplier, or reference…" />

        {/* DESKTOP VIEW */}
        <div className="desktop-only">
          <div className="supplier-row labels purchase-row">
            <span>Bill</span>
            <span>Supplier</span>
            <span>Date</span>
            <span>Total</span>
            <span>Balance</span>
            <span>Actions</span>
          </div>
          {controls.pageRows.map((p) => (
            <div className="supplier-row purchase-row" key={p.id}>
              <b>{p.invoice}</b>
              <span>{p.supplier}</span>
              <span>{shortDate(p.date)}</span>
              <span>{money(p.total)}</span>
              <b>{money(Number(p.total) - Number(p.paid))}</b>
              <span className="row-actions">
                <button title="View" onClick={async () => setDetails(await get(p.id))}>
                  <Eye size={16} />
                </button>
                <button title="Edit" onClick={async () => setForm(await get(p.id))}>
                  <Pencil size={16} />
                </button>
                <button className="danger" title="Delete" onClick={() => setRemove(p)}>
                  <Trash2 size={16} />
                </button>
                <button title="Download PDF" onClick={async () => setPrint(await get(p.id))}>
                  <Download size={16} />
                </button>
              </span>
            </div>
          ))}
        </div>

        {/* MOBILE CARDS VIEW */}
        <div className="mobile-only" style={{ marginTop: '12px' }}>
          {controls.pageRows.map((p) => {
            const bal = Number(p.total) - Number(p.paid);
            const st = Number(p.paid) >= Number(p.total) ? 'Paid' : Number(p.paid) > 0 ? 'Partial' : 'Unpaid';
            const stCls = Number(p.paid) >= Number(p.total) ? 'paid' : Number(p.paid) > 0 ? 'partial' : 'pending';
            return (
              <div key={p.id} className="erp-mobile-card">
                <div className="erp-mobile-card-header">
                  <div>
                    <div className="erp-mobile-card-title">{p.invoice}</div>
                    <div className="erp-mobile-card-subtitle">{shortDate(p.date)}</div>
                  </div>
                  <span className={`status ${stCls}`}>{st}</span>
                </div>
                <div className="erp-mobile-card-body">
                  <div className="erp-mobile-field" style={{ gridColumn: '1 / -1' }}>
                    <label>Supplier</label>
                    <b style={{ fontSize: '13px' }}>{p.supplier}</b>
                  </div>
                  <div className="erp-mobile-field">
                    <label>Purchase Total</label>
                    <span>{money(p.total)}</span>
                  </div>
                  <div className="erp-mobile-field">
                    <label>Balance Payable</label>
                    <b className="payable">{money(bal)}</b>
                  </div>
                </div>
                <div className="erp-mobile-card-actions">
                  <button title="View" onClick={async () => setDetails(await get(p.id))}>
                    <Eye size={16} /> <span>View</span>
                  </button>
                  <button title="Edit" onClick={async () => setForm(await get(p.id))}>
                    <Pencil size={16} /> <span>Edit</span>
                  </button>
                  <button className="danger" title="Delete" onClick={() => setRemove(p)}>
                    <Trash2 size={16} />
                  </button>
                  <button title="Download PDF" onClick={async () => setPrint(await get(p.id))}>
                    <Download size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {!controls.filtered.length && <p className="empty">No purchase bills match these filters.</p>}
        <div className="list-footer-pagination">
          <ListPagination controls={controls} />
        </div>
      </section>

      {form !== undefined && (
        <div className="modal no-print">
          <div className="modal-backdrop" onClick={() => setForm(undefined)} />
          <section className="supplier-form card">
            <button className="sheet-close" onClick={() => setForm(undefined)}>
              <X />
            </button>
            <h2>{form ? 'Edit purchase' : 'Add purchase'}</h2>
            <form onSubmit={save}>
              <label>
                Supplier
                <select name="supplierId" required defaultValue={form?.supplierId}>
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Date
                <input name="date" type="date" required defaultValue={form?.purchaseDate || new Date().toISOString().slice(0, 10)} />
              </label>
              <label>
                Description
                <textarea name="description" defaultValue={form?.description} />
              </label>
              <label>
                Purchase amount (AED)
                <input name="total" type="number" min=".01" step=".01" required defaultValue={form?.total} />
              </label>
              <label>
                Paid amount (AED)
                <input name="paid" type="number" min="0" step=".01" required defaultValue={form?.paid ?? '0'} />
              </label>
              <label>
                Method
                <select name="method" defaultValue={form?.paymentMethod || 'Cash'}>
                  <option>Cash</option>
                  <option>Card</option>
                  <option>Bank Transfer</option>
                </select>
              </label>
              <label>
                Notes
                <input name="notes" defaultValue={form?.notes} />
              </label>
              {error && <div className="form-error">{error}</div>}
              <button className="primary">{form ? 'Update purchase' : 'Create purchase'}</button>
            </form>
          </section>
        </div>
      )}

      {details && (
        <div className="modal no-print">
          <div className="modal-backdrop" onClick={() => setDetails(null)} />
          <section className="purchase-details card">
            <button className="sheet-close" onClick={() => setDetails(null)}>
              <X />
            </button>
            <p className="eyebrow">PURCHASE DETAILS</p>
            <h2>{details.invoiceNumber}</h2>
            <div className="detail-grid">
              <span>
                Supplier<b>{details.supplierName}</b>
                <small>{details.supplierMobile || 'No mobile available'}</small>
              </span>
              <span>
                Purchase date<b>{shortDate(details.purchaseDate)}</b>
              </span>
              <span>
                Payment method<b>{details.paymentMethod || '—'}</b>
              </span>
              <span>
                Status<b className={'status ' + status(details).toLowerCase()}>{status(details)}</b>
              </span>
            </div>
            <p className="detail-note">{details.description || 'No description provided.'}</p>
            <div className="financial-flow" style={{ flexWrap: 'wrap' }}>
              <span>
                Total<b>{money(details.total)}</b>
              </span>
              <i>→</i>
              <span>
                Paid<b>{money(details.paid)}</b>
              </span>
              <i>→</i>
              <span>
                Balance<b>{money(Number(details.total) - Number(details.paid))}</b>
              </span>
            </div>
            <button
              className="primary"
              onClick={() => {
                setPrint(details);
                setDetails(null);
              }}
            >
              <Download size={16} /> Download PDF
            </button>
          </section>
        </div>
      )}

      {remove && (
        <div className="modal no-print">
          <div className="modal-backdrop" onClick={() => setRemove(null)} />
          <section className="supplier-form card">
            <h2>Delete purchase?</h2>
            <p>{remove.invoice} will be permanently removed if it has no recorded payments.</p>
            {error && <div className="form-error">{error}</div>}
            <div className="confirm-actions">
              <button className="outline" onClick={() => setRemove(null)}>
                Cancel
              </button>
              <button className="delete-button" onClick={del}>
                Delete
              </button>
            </div>
          </section>
        </div>
      )}

      {print && <PurchaseDocument purchase={print} close={() => setPrint(null)} />}
    </main>
  );
}

function PurchaseDocument({ purchase, close }: { purchase: D; close: () => void }) {
  useEffect(() => {
    const download = async () => {
      const balance = Number(purchase.total) - Number(purchase.paid);
      const business = await fetch('/api/business-settings')
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      await downloadPdf(
        {
          kind: 'Purchase Bill',
          title: purchase.invoiceNumber,
          party: purchase.supplierName,
          business: [business?.address, business?.contactNumber, business?.email].filter(Boolean),
          details: [
            ['Bill Date', shortDate(purchase.purchaseDate)],
            ['Type', 'Purchase Bill'],
            ['Reference', purchase.invoiceNumber],
          ],
          summary: [
            ['Purchase Total', money(purchase.total)],
            ['Paid Amount', money(purchase.paid)],
            ['Balance Amount', money(balance)],
          ],
          headers: ['Description', 'Purchase Amount', 'Payment', 'Balance', 'Method / Status'],
          rows: [
            [
              purchase.description || 'Purchase bill',
              money(purchase.total),
              money(purchase.paid),
              money(balance),
              `${purchase.paymentMethod || '—'} · ${status(purchase)}`,
            ],
          ],
          notes: purchase.notes,
        },
        `${purchase.invoiceNumber}.pdf`
      );
      close();
    };
    void download();
  }, [purchase, close]);
  return null;
}
