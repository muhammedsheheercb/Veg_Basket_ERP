'use client';
import { useEffect, useState } from 'react';
import { Eye, Pencil, Plus, Printer, Trash2, WalletCards, X } from 'lucide-react';
import { FinancialDocument, money } from '@/components/financial-documents';
import { ListFilters, ListPagination, useListControls } from '@/components/list-controls';

const today = new Date().toISOString().slice(0, 10);

export default function Customers() {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState<any>(undefined);
  const [ledger, setLedger] = useState<any>(null);
  const [remove, setRemove] = useState<any>(null);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const load = () => fetch('/api/customers').then(r => r.json()).then(x => Array.isArray(x) && setRows(x));
  useEffect(() => { void load(); }, []);

  const controls = useListControls(rows, c => `${c.name} ${c.mobile} ${c.address || ''} ${c.outstanding || ''}`, () => null);

  const get = (id: string) => fetch('/api/customers/' + id).then(r => r.ok ? r.json() : null);

  const open = async (id: string) => {
    setError('');
    setSelected('');
    const d = await get(id);
    if (d) setLedger(d);
  };

  const sale = ledger?.sales?.find((x: any) => x.id === selected);
  const due = sale ? +sale.total - +sale.paid : 0;

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const d = new FormData(e.currentTarget);
    const r = await fetch(form?.id ? '/api/customers/' + form.id : '/api/customers', {
      method: form?.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(d))
    });
    setBusy(false);
    if (r.ok) {
      setForm(undefined);
      load();
    } else {
      setError((await r.json()).error);
    }
  }

  async function pay(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ledger || !sale) return;
    const d = new FormData(e.currentTarget);
    const amount = Number(d.get('amount'));
    if (!Number.isFinite(amount) || amount <= 0 || amount > due) {
      return setError('Payment must be greater than AED 0.00 and cannot exceed the invoice balance.');
    }
    setBusy(true);
    const r = await fetch('/api/customers/' + ledger.customer.id + '/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saleId: selected, date: d.get('date'), amount, method: d.get('method'), notes: d.get('notes') })
    });
    setBusy(false);
    if (r.ok) {
      const fresh = await get(ledger.customer.id);
      setLedger(fresh);
      setSelected('');
      load();
    } else {
      setError((await r.json()).error);
    }
  }

  return (
    <main className="management">
      <header className="management-head">
        <div>
          <p className="eyebrow">CUSTOMER MANAGEMENT</p>
          <h1>Customers</h1>
          <p>Manage customers, sales balances, and collections.</p>
        </div>
        <button className="primary" onClick={() => setForm(null)}>
          <Plus size={17} /> Add customer
        </button>
      </header>

      <section className="card data-panel">
        <ListFilters controls={controls} placeholder="Search customer, mobile, or balance…" />
        <div className="supplier-row labels">
          <span>Customer</span>
          <span>Mobile</span>
          <span>Sales</span>
          <span>Paid</span>
          <span>Outstanding</span>
          <span>Actions</span>
        </div>
        {controls.pageRows.map(c => (
          <div className="supplier-row" key={c.id}>
            <b>{c.name}</b>
            <span>{c.mobile}</span>
            <span>{money(c.totalSales)}</span>
            <span>{money(c.totalPaid)}</span>
            <b className={c.outstanding ? 'payable' : ''}>{money(c.outstanding)}</b>
            <span className="row-actions">
              <button
                title="View statement"
                disabled={loadingId === c.id + '-statement'}
                onClick={async () => {
                  setLoadingId(c.id + '-statement');
                  const d = await get(c.id);
                  if (d) setLedger({ ...d, statement: true });
                  setLoadingId(null);
                }}
              >
                {loadingId === c.id + '-statement' ? <span className="button-spinner" /> : <Eye size={16} />}
              </button>
              <button title="Edit" onClick={() => setForm(c)}>
                <Pencil size={16} />
              </button>
              <button className="danger" title="Delete" onClick={() => setRemove(c)}>
                <Trash2 size={16} />
              </button>
              <button
                title="Customer ledger / collect payment"
                disabled={loadingId === c.id + '-ledger'}
                onClick={async () => {
                  setLoadingId(c.id + '-ledger');
                  await open(c.id);
                  setLoadingId(null);
                }}
              >
                {loadingId === c.id + '-ledger' ? <span className="button-spinner" /> : <WalletCards size={16} />}
              </button>
            </span>
          </div>
        ))}
        {!controls.filtered.length && <p className="empty">No customers match these filters.</p>}
        <div className="list-footer-pagination">
          <ListPagination controls={controls} />
        </div>
      </section>

      {form !== undefined && (
        <div className="modal">
          <div className="modal-backdrop" />
          <section className="supplier-form card">
            <button className="sheet-close" onClick={() => setForm(undefined)}>
              <X />
            </button>
            <h2>{form ? 'Edit customer' : 'Add customer'}</h2>
            <form onSubmit={save}>
              <label>Customer name<input name="name" required defaultValue={form?.name} /></label>
              <label>Mobile<input name="mobile" required defaultValue={form?.mobile} /></label>
              <label>Address<textarea name="address" defaultValue={form?.address} /></label>
              <label>Opening balance (AED)<input name="openingBalance" type="number" min="0" step=".01" defaultValue={form?.openingBalance || '0'} required /></label>
              {error && <div className="form-error">{error}</div>}
              <button className="primary" disabled={busy}>{busy ? 'Saving…' : form ? 'Update customer' : 'Save customer'}</button>
            </form>
          </section>
        </div>
      )}

      {remove && (
        <div className="modal">
          <div className="modal-backdrop" />
          <section className="supplier-form card">
            <h2>Delete customer?</h2>
            <p>{remove.name} can only be deleted when it has no sales history.</p>
            <div className="confirm-actions">
              <button className="outline" onClick={() => setRemove(null)}>Cancel</button>
              <button
                className="delete-button"
                onClick={async () => {
                  const r = await fetch('/api/customers/' + remove.id, { method: 'DELETE' });
                  if (r.ok) {
                    setRemove(null);
                    load();
                  } else {
                    setError((await r.json()).error);
                  }
                }}
              >
                Delete
              </button>
            </div>
          </section>
        </div>
      )}

      {ledger && (
        ledger.statement ? (
          <Statement ledger={ledger} close={() => setLedger(null)} />
        ) : (
          <CustomerLedger
            ledger={ledger}
            close={() => setLedger(null)}
            selected={selected}
            setSelected={setSelected}
            sale={sale}
            due={due}
            pay={pay}
            error={error}
            busy={busy}
          />
        )
      )}
    </main>
  );
}

function CustomerLedger({ ledger, close, selected, setSelected, sale, due, pay, error, busy }: any) {
  const s = ledger.summary;
  return (
    <div className="modal ledger-modal">
      <div className="modal-backdrop" onClick={close} />
      <section className="ledger card">
        <button className="sheet-close" onClick={close}><X /></button>
        <div className="card-head">
          <div>
            <p className="eyebrow">CUSTOMER LEDGER</p>
            <h2>{ledger.customer.name}</h2>
            <p>{ledger.customer.mobile}</p>
          </div>
        </div>
        <div className="ledger-totals">
          <span>Opening<b>{money(s.openingBalance)}</b></span>
          <span>Sales<b>{money(s.totalSales)}</b></span>
          <span>Payments<b>{money(s.totalPaid)}</b></span>
          <span>Outstanding<b>{money(s.outstanding)}</b></span>
        </div>
        {ledger.sales.map((x: any) => (
          <div className="ledger-line" key={x.id}>
            <span><b>{x.invoiceNumber}</b><small>{x.saleDate}</small></span>
            <span>{money(x.total)}</span>
            <span>Paid {money(x.paid)}</span>
            <b>{money(+x.total - +x.paid)}</b>
          </div>
        ))}
        <h3>Record payment</h3>
        <form className="pay-form" onSubmit={pay}>
          <select name="saleId" required value={selected} onChange={e => setSelected(e.target.value)}>
            <option value="">Select sales invoice</option>
            {ledger.sales.filter((x: any) => +x.paid < +x.total).map((x: any) => (
              <option key={x.id} value={x.id}>{x.invoiceNumber} · outstanding {money(+x.total - +x.paid)}</option>
            ))}
          </select>
          {sale && (
            <p className="payment-hint">
              Invoice {sale.invoiceNumber} · Total {money(sale.total)} · Paid {money(sale.paid)} · Outstanding <b>{money(due)}</b>
            </p>
          )}
          <input name="date" type="date" max={today} defaultValue={today} required />
          <input name="amount" type="number" min=".01" max={due || undefined} step=".01" required disabled={!sale} placeholder="Amount" />
          <select name="method">
            <option>Cash</option>
            <option>Card</option>
            <option>Bank Transfer</option>
          </select>
          <input name="notes" placeholder="Notes" />
          {error && <div className="form-error">{error}</div>}
          <button className="primary" disabled={busy || !sale}>{busy ? 'Processing…' : 'Record payment'}</button>
        </form>
      </section>
    </div>
  );
}

function Statement({ ledger, close }: any) {
  const items: any[] = [];
  const opening = +ledger.summary.openingBalance;
  if (opening) {
    items.push({
      date: '',
      type: 'Opening balance',
      reference: 'Opening',
      description: 'Opening customer balance',
      purchase: opening,
      payment: 0
    });
  }
  for (const s of (ledger.sales || [])) {
    items.push({
      date: s.saleDate,
      type: 'Sale',
      reference: s.invoiceNumber,
      description: 'Sales invoice',
      purchase: +s.total,
      payment: 0,
      status: +s.paid >= +s.total ? 'Paid' : +s.paid > 0 ? 'Partial' : 'Unpaid'
    });
    const later = (ledger.payments || []).filter((p: any) => p.saleId === s.id).reduce((n: number, p: any) => n + (+p.amount), 0);
    const initial = +s.paid - later;
    if (initial > 0) {
      items.push({
        date: s.saleDate,
        type: 'Initial Payment',
        reference: s.invoiceNumber,
        description: `Initial payment for ${s.invoiceNumber}`,
        purchase: 0,
        payment: initial,
        method: s.paymentMethod
      });
    }
  }
  for (const p of (ledger.payments || [])) {
    const s = (ledger.sales || []).find((x: any) => x.id === p.saleId);
    const ref = p.invoiceNumber || (s ? s.invoiceNumber : 'PAYMENT');
    items.push({
      date: p.paymentDate,
      type: 'Customer Payment',
      reference: ref,
      description: `Payment for ${ref}`,
      purchase: 0,
      payment: +p.amount,
      method: p.method,
      notes: p.notes
    });
  }

  items.sort((a, b) => {
    if (!a.date) return -1;
    if (!b.date) return 1;
    return String(a.date).localeCompare(String(b.date));
  });

  let running = 0;
  const entries = items.map(x => {
    running += (x.purchase || 0) - (x.payment || 0);
    return { ...x, balance: running };
  });

  return (
    <div className="modal document-modal">
      <div className="modal-backdrop" onClick={close} />
      <section className="document-modal-card card">
        <button className="sheet-close no-print" onClick={close}><X /></button>
        <div className="document-actions no-print">
          <button className="outline" onClick={() => window.print()}><Printer size={15} /> Print statement</button>
        </div>
        <FinancialDocument
          kind="Customer Statement"
          title={'Customer statement · ' + ledger.customer.name}
          party={ledger.customer.name}
          contact={ledger.customer.mobile}
          address={ledger.customer.address}
          summary={[
            ['Opening Balance', money(ledger.summary.openingBalance)],
            ['Total Sales', money(ledger.summary.totalSales)],
            ['Total Payments', money(ledger.summary.totalPaid)],
            ['Outstanding Balance', money(ledger.summary.outstanding)]
          ]}
          entries={entries}
        />
      </section>
    </div>
  );
}
