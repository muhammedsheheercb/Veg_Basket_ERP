'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Download, Eye, Pencil, Plus, Trash2, WalletCards, X } from 'lucide-react';
import { FinancialDocument, downloadDocumentPdf, money, shortDate } from '@/components/financial-documents';
import { ListFilters, ListPagination, useListControls } from '@/components/list-controls';
import { downloadPdf } from '@/components/pdf-download';

type S = { id: string; name: string; mobile: string; address?: string; openingBalance: string; totalPurchases: string; totalPaid: string; payable: number };
type Bill = { id: string; invoiceNumber: string; purchaseDate: string; description?: string; total: string; paid: string; paymentMethod?: string; notes?: string };
type Pay = { id: string; purchaseId: string; paymentDate: string; amount: string; method: string; notes?: string };
type L = { supplier: S; bills: Bill[]; payments: Pay[]; summary: { openingBalance: number; totalPurchases: number; totalPaid: number; payable: number } };

const status = (paid: number, total: number) => paid >= total ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid';
const today = new Date().toISOString().slice(0, 10);

function makeEntries(l: L) {
  const items: any[] = [];
  if (l.summary.openingBalance) {
    items.push({ date: '', type: 'Opening Balance', reference: 'OPENING', description: 'Opening balance', purchase: l.summary.openingBalance, payment: 0, status: 'Unpaid' });
  }
  for (const b of l.bills) {
    items.push({ date: b.purchaseDate, type: 'Purchase', reference: b.invoiceNumber, description: b.description || 'Purchase bill', purchase: +b.total, payment: 0, method: b.paymentMethod, status: status(+b.paid, +b.total), notes: b.notes });
    const later = l.payments.filter(p => p.purchaseId === b.id).reduce((n, p) => n + (+p.amount), 0);
    const initial = +b.paid - later;
    if (initial > 0) {
      items.push({ date: b.purchaseDate, type: 'Initial Payment', reference: b.invoiceNumber, description: `Initial payment for ${b.invoiceNumber}`, purchase: 0, payment: initial, method: b.paymentMethod, status: status(+b.paid, +b.total) });
    }
  }
  for (const p of l.payments) {
    const b = l.bills.find(x => x.id === p.purchaseId);
    const ref = b ? b.invoiceNumber : 'PAYMENT';
    items.push({ date: p.paymentDate, type: 'Supplier Payment', reference: ref, description: `Payment for ${ref}`, purchase: 0, payment: +p.amount, method: p.method, status: b ? status(+b.paid, +b.total) : undefined, notes: p.notes });
  }
  items.sort((a, b) => {
    if (!a.date) return -1;
    if (!b.date) return 1;
    return String(a.date).localeCompare(String(b.date));
  });
  let running = 0;
  return items.map(x => {
    running += (x.purchase || 0) - (x.payment || 0);
    return { ...x, balance: running };
  });
}

export default function Suppliers() {
  const [rows, setRows] = useState<S[]>([]);
  const [form, setForm] = useState<S | null | undefined>();
  const [view, setView] = useState<L | null>(null);
  const [ledger, setLedger] = useState<L | null>(null);
  const [remove, setRemove] = useState<S | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const statementRef = useRef<HTMLElement>(null);

  const load = () => fetch(`/api/suppliers?updatedAt=${Date.now()}`, { cache: 'no-store' }).then(r => r.json()).then(x => Array.isArray(x) && setRows(x));
  useEffect(() => {
    void load();
    // A page restored from browser history can retain its old client state.
    // Re-read the list when it becomes visible so purchases/payments appear
    // without the user having to manually refresh the browser.
    const refresh = () => void load();
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
    };
  }, []);

  const controls = useListControls(rows, s => `${s.name} ${s.mobile} ${s.address || ''} ${s.payable || ''}`, () => null);
  const get = async (id: string) => {
    const r = await fetch(`/api/suppliers/${id}`);
    return r.ok ? r.json() : null;
  };
  const pdf = () => statementRef.current && downloadDocumentPdf(statementRef.current, `${(view || ledger)!.supplier.name}-statement.pdf`);
  const downloadStatement = async (data: L) => {
    const business = await fetch('/api/business-settings').then(r => r.ok ? r.json() : null).catch(() => null);
    await downloadPdf({ kind: 'Supplier Statement', title: 'Supplier Statement', party: data.supplier.name, business: [business?.address, business?.contactNumber, business?.email].filter(Boolean), summary: [['Opening Balance', money(data.summary.openingBalance)], ['Total Purchases', money(data.summary.totalPurchases)], ['Total Payments', money(data.summary.totalPaid)], ['Current Outstanding', money(data.summary.payable)]], headers: ['Date', 'Type', 'Description', 'Purchase Amount', 'Payment', 'Balance', 'Method / Status'], rows: makeEntries(data).map(entry => [shortDate(entry.date), entry.type, entry.description, entry.purchase ? money(entry.purchase) : '—', entry.payment ? money(entry.payment) : '—', money(entry.balance), [entry.method, entry.status].filter(Boolean).join(' · ') || '—']) }, `${data.supplier.name}-statement.pdf`);
  };

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const r = await fetch(form?.id ? `/api/suppliers/${form.id}` : '/api/suppliers', {
      method: form?.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: d.get('name'), mobile: d.get('mobile'), address: d.get('address'), openingBalance: d.get('openingBalance') })
    });
    if (!r.ok) setError((await r.json()).error);
    else { setForm(undefined); setError(''); load(); }
  }

  async function del() {
    if (!remove) return;
    const r = await fetch(`/api/suppliers/${remove.id}`, { method: 'DELETE' });
    if (!r.ok) setError((await r.json()).error);
    else { setRemove(null); load(); }
  }

  const openingPaid = ledger ? ledger.payments.filter(payment => !payment.purchaseId).reduce((sum, payment) => sum + +payment.amount, 0) : 0;
  const outstanding = ledger && selected ? selected === 'opening' ? +ledger.summary.openingBalance - openingPaid : +ledger.bills.find(b => b.id === selected)!.total - +ledger.bills.find(b => b.id === selected)!.paid : 0;

  return (
    <main className="management">
      <header className="management-head">
        <div>
          <p className="eyebrow">SUPPLIER MANAGEMENT</p>
          <h1>Suppliers</h1>
          <p>Manage partners and payments.</p>
        </div>
        <button className="primary" onClick={() => setForm(null)}>
          <Plus size={17} /> <span>Add supplier</span>
        </button>
      </header>
      <section className="card data-panel">
        <ListFilters
          controls={controls}
          placeholder="Search supplier, mobile, or balance…"
        />
        <div className="supplier-table">
          <div className="supplier-row labels">
            <span>Supplier</span>
            <span>Mobile</span>
            <span>Purchases</span>
            <span>Paid</span>
            <span>Payable</span>
            <span>Actions</span>
          </div>
          {controls.pageRows.map((s) => (
            <div className="supplier-row" key={s.id}>
              <b>{s.name}</b>
              <span>{s.mobile}</span>
              <span>{money(s.totalPurchases)}</span>
              <span>{money(s.totalPaid)}</span>
              <b className={s.payable ? "payable" : ""}>{money(s.payable)}</b>
              <span className="row-actions">
                <button
                  title="View transaction history"
                  disabled={loadingId === s.id + "-view"}
                  onClick={async () => {
                    setLoadingId(s.id + "-view");
                    const data = await get(s.id);
                    setView(data);
                    setLoadingId(null);
                  }}
                >
                  {loadingId === s.id + "-view" ? (
                    <span className="button-spinner" />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
                <button title="Edit" onClick={() => setForm(s)}>
                  <Pencil size={16} />
                </button>
                <button
                  className="danger"
                  title="Delete"
                  onClick={() => setRemove(s)}
                >
                  <Trash2 size={16} />
                </button>
                <button
                  title="Purse / ledger"
                  disabled={loadingId === s.id + "-ledger"}
                  onClick={async () => {
                    setLoadingId(s.id + "-ledger");
                    setSelected("");
                    const data = await get(s.id);
                    setLedger(data);
                    setLoadingId(null);
                  }}
                >
                  {loadingId === s.id + "-ledger" ? (
                    <span className="button-spinner" />
                  ) : (
                    <WalletCards size={16} />
                  )}
                </button>
                <button
                  className="statement-download"
                  title="Download supplier statement PDF"
                  onClick={async () => {
                    const data = await get(s.id);
                    if (data) await downloadStatement(data);
                  }}
                >
                  <Download size={16} />
                </button>
              </span>
            </div>
          ))}
          {!controls.filtered.length && (
            <p className="empty">No suppliers match these filters.</p>
          )}
        </div>
        <div className="list-footer-pagination">
          <ListPagination controls={controls} />
        </div>
      </section>

      {form !== undefined && (
        <div className="modal">
          <div className="modal-backdrop" onClick={() => setForm(undefined)} />
          <section className="supplier-form party-form-modal card">
            <button className="sheet-close" onClick={() => setForm(undefined)}>
              <X />
            </button>
            <h2>{form ? "Edit supplier" : "Add supplier"}</h2>
            <form onSubmit={submit}>
              <label>
                Supplier name
                <input name="name" required defaultValue={form?.name} />
              </label>
              <label>
                Mobile number
                <input name="mobile" required defaultValue={form?.mobile} />
              </label>
              <label>
                Address
                <textarea name="address" defaultValue={form?.address} />
              </label>
              <label>
                Opening balance (AED)
                <input
                  name="openingBalance"
                  type="number"
                  min="0"
                  step=".01"
                  required
                  defaultValue={form?.openingBalance ?? "0"}
                />
              </label>
              {error && <div className="form-error">{error}</div>}
              <button className="primary">
                {form ? "Update supplier" : "Save supplier"}
              </button>
            </form>
          </section>
        </div>
      )}

      {view && (
        <div className="modal document-modal">
          <div className="modal-backdrop" onClick={() => setView(null)} />
          <section className="document-modal-card card">
            <button
              className="sheet-close no-print"
              onClick={() => setView(null)}
            >
              <X />
            </button>
            <div className="document-actions no-print">
              <button
                className="primary"
                title="Download PDF"
                aria-label="Download supplier statement PDF"
                onClick={pdf}
              >
                <Download size={15} />
              </button>
            </div>
            <div ref={statementRef as any}>
              <FinancialDocument
                kind="Supplier Statement"
                title={`Supplier statement · ${view.supplier.name}`}
                party={view.supplier.name}
                contact={view.supplier.mobile}
                address={view.supplier.address}
                summary={[
                  ["Opening Balance", money(view.summary.openingBalance)],
                  ["Total Purchases", money(view.summary.totalPurchases)],
                  ["Total Payments", money(view.summary.totalPaid)],
                  ["Current Outstanding", money(view.summary.payable)],
                ]}
                entries={makeEntries(view)}
              />
            </div>
          </section>
        </div>
      )}

      {remove && (
        <div className="modal">
          <div className="modal-backdrop" onClick={() => setRemove(null)} />
          <section className="supplier-form card">
            <h2>Delete supplier?</h2>
            <p>
              This will permanently remove {remove.name} if it has no purchase
              history.
            </p>
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

      {ledger && (
        <div className="modal ledger-modal">
          <div className="modal-backdrop" onClick={() => setLedger(null)} />
          <section className="ledger card">
            <button className="sheet-close" onClick={() => setLedger(null)}>
              <X />
            </button>
            <div className="card-head">
              <div>
                <p className="eyebrow">SUPPLIER LEDGER</p>
                <h2>{ledger.supplier.name}</h2>
              </div>
            </div>
            <div className="ledger-totals">
              <span>
                Opening<b>{money(ledger.summary.openingBalance)}</b>
              </span>
              <span>
                Purchases<b>{money(ledger.summary.totalPurchases)}</b>
              </span>
              <span>
                Payments<b>{money(ledger.summary.totalPaid)}</b>
              </span>
              <span>
                Payable<b>{money(ledger.summary.payable)}</b>
              </span>
            </div>
            {ledger.bills.map((b) => (
              <div className="ledger-line" key={b.id}>
                <span>
                  <b>{b.invoiceNumber}</b>
                  <small>{shortDate(b.purchaseDate)}</small>
                </span>
                <span>{money(b.total)}</span>
                <span>Paid {money(b.paid)}</span>
                <b>{money(+b.total - +b.paid)}</b>
              </div>
            ))}
            <h3>Make payment</h3>
            <form
              className="pay-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setError("");
                const d = new FormData(e.currentTarget),
                  amount = Number(d.get("amount"));
                if (!Number.isFinite(amount) || amount <= 0)
                  return setError(
                    "Payment amount must be greater than AED 0.00.",
                  );
                if (amount > outstanding)
                  return setError(
                    `Payment cannot exceed the outstanding balance of ${money(outstanding)}.`,
                  );
                const r = await fetch(
                  `/api/suppliers/${ledger.supplier.id}/payments`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      purchaseId: d.get("purchaseId"),
                      date: d.get("date"),
                      amount,
                      method: d.get("method"),
                      notes: d.get("notes"),
                    }),
                  },
                );
                if (r.ok) {
                  setSelected("");
                  setLedger(null);
                  // Close the payment form and its enclosing ledger before
                  // refreshing the list. Replacing `ledger` with refreshed
                  // data here briefly mounted the modal again after saving.
                  void load();
                } else setError((await r.json()).error);
              }}
            >
              <select
                name="purchaseId"
                required
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">Select purchase bill</option>
                {+ledger.summary.openingBalance > openingPaid && <option value="opening">Opening Balance · outstanding {money(+ledger.summary.openingBalance - openingPaid)}</option>}
                {ledger.bills
                  .filter((b) => +b.paid < +b.total)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.invoiceNumber} · outstanding{" "}
                      {money(+b.total - +b.paid)}
                    </option>
                  ))}
              </select>
              {selected && (
                <p className="payment-hint">
                  Outstanding for selected bill: <b>{money(outstanding)}</b>
                </p>
              )}
              <input name="date" type="date" required defaultValue={today} />
              <input
                name="amount"
                type="number"
                min=".01"
                max={selected ? outstanding : undefined}
                step=".01"
                required
                placeholder="Amount"
              />
              <select name="method">
                <option>Cash</option>
                <option>Card</option>
                <option>Bank Transfer</option>
              </select>
              <input name="notes" placeholder="Notes" />
              {error && <div className="form-error">{error}</div>}
              <button className="primary">Record payment</button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
