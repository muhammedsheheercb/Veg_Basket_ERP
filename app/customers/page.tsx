"use client";
import { customerPaymentError } from '@/lib/customer-payment';
import { useEffect, useRef, useState } from "react";
import {
  Download,
  Eye,
  Pencil,
  Plus,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import { downloadPdf, downloadPdfFromElement } from "@/components/pdf-download";
import { FinancialDocument, money } from "@/components/financial-documents";
import {
  ListFilters,
  ListPagination,
  useListControls,
} from "@/components/list-controls";

const today = new Date().toISOString().slice(0, 10);

export default function Customers() {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState<any>(undefined);
  const [ledger, setLedger] = useState<any>(null);
  const [remove, setRemove] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentTouched, setPaymentTouched] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const load = () =>
    fetch(`/api/customers?updatedAt=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((x) => Array.isArray(x) && setRows(x));
  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, []);

  const controls = useListControls(
    rows,
    (c) => `${c.name} ${c.mobile} ${c.address || ""} ${c.outstanding || ""}`,
    () => null,
  );

  const get = (id: string) =>
    fetch("/api/customers/" + id).then((r) => (r.ok ? r.json() : null));

  const downloadStatement = async (data: any) => {
    const items: any[] = [];
    if (+data.summary.openingBalance)
      items.push({
        date: "",
        type: "Opening Balance",
        reference: "OPENING",
        description: "Opening customer balance",
        amount: +data.summary.openingBalance,
        payment: 0,
      });
    data.sales.forEach((sale: any) => {
      const later = data.payments
        .filter((payment: any) => payment.saleId === sale.id)
        .reduce((sum: number, payment: any) => sum + +payment.amount, 0);
      const initial = +sale.paid - later;
      items.push({
        date: sale.saleDate,
        type: "Sale",
        reference: sale.invoiceNumber,
        description: "Sales invoice",
        amount: +sale.total,
        payment: 0,
      });
      if (initial > 0)
        items.push({
          date: sale.saleDate,
          type: "Initial Payment",
          reference: sale.invoiceNumber,
          description: `Initial payment for ${sale.invoiceNumber}`,
          amount: 0,
          payment: initial,
        });
    });
    data.payments.forEach((payment: any) => {
      const sale = data.sales.find((x: any) => x.id === payment.saleId);
      items.push({
        date: payment.paymentDate,
        type: "Customer Payment",
        reference: sale?.invoiceNumber || "PAYMENT",
        description: `Payment for ${sale?.invoiceNumber || "account"}`,
        amount: 0,
        payment: +payment.amount,
      });
    });
    items.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    let balance = 0;
    const business = await fetch("/api/business-settings")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    await downloadPdf(
      {
        kind: "Customer Statement",
        title: "Customer Statement",
        party: data.customer.name,
        business: [
          business?.address,
          business?.contactNumber,
          business?.email,
        ].filter(Boolean),
        summary: [
          ["Opening Balance", money(data.summary.openingBalance)],
          ["Total Sales", money(data.summary.totalSales)],
          ["Total Payments", money(data.summary.totalPaid)],
          ["Outstanding Balance", money(data.summary.outstanding)],
        ],
        headers: [
          "Date",
          "Type",
          "Reference",
          "Description",
          "Sale Amount",
          "Payment",
          "Balance",
          "Method / Status",
        ],
        rows: items.map((item) => {
          balance += item.amount - item.payment;
          return [
            item.date || "—",
            item.type,
            item.reference,
            item.description,
            item.amount ? money(item.amount) : "—",
            item.payment ? money(item.payment) : "—",
            money(balance),
            "—",
          ];
        }),
      },
      `${data.customer.name}-statement.pdf`,
    );
  };

  const open = async (id: string) => {
    setError("");
    setPaymentAmount("");
    setPaymentTouched(false);
    const d = await get(id);
    if (d) setLedger(d);
  };

  const due = Math.round(Number(ledger?.summary?.outstanding || 0) * 1000) / 1000;

  function closeLedger() {
    setLedger(null);
    setError("");
    setPaymentAmount("");
    setPaymentTouched(false);
  }

  const paymentError = customerPaymentError(paymentAmount, due);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const d = new FormData(e.currentTarget);
    const r = await fetch(
      form?.id ? "/api/customers/" + form.id : "/api/customers",
      {
        method: form?.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(d)),
      },
    );
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
    if (!ledger || busy) return;
    const paymentForm = e.currentTarget;
    const d = new FormData(paymentForm);
    const amount = Number(d.get("amount"));
    setPaymentTouched(true);
    const invalid = customerPaymentError(d.get("amount"), due);
    if (invalid) { setError(invalid); return; }
    setBusy(true);
    setError("");
    try {
    const r = await fetch(
      "/api/customers/" + ledger.customer.id + "/payments",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: d.get("date"),
          amount,
          method: d.get("method"),
          notes: d.get("notes"),
        }),
      },
    );
    if (r.ok) {
      const updated = await get(ledger.customer.id);
      if (updated) setLedger(updated);
      paymentForm.reset();
      setPaymentAmount("");
      setPaymentTouched(false);
      await load();
    } else {
      setError((await r.json()).error);
    }
    } catch { setError("Unable to save payment. Please check your connection and refresh the ledger before retrying."); }
    finally { setBusy(false); }
  }

  return (
    <main className="management">
      <header className="management-head">
        <div>
          <p className="eyebrow">CUSTOMER MANAGEMENT</p>
          <h1>Customers</h1>
          <p>Manage customers and payments.</p>
        </div>
        <button className="primary" onClick={() => setForm(null)}>
          <Plus size={17} /> Add customer
        </button>
      </header>

      <section className="card data-panel">
        <ListFilters
          controls={controls}
          placeholder="Search customer, mobile, or balance…"
        />
        {/* DESKTOP VIEW */}
        <div className="desktop-only">
          <div className="supplier-row labels">
            <span>Customer</span>
            <span>Mobile</span>
            <span>Sales</span>
            <span>Paid</span>
            <span>Outstanding</span>
            <span>Actions</span>
          </div>
          {controls.pageRows.map((c) => (
            <div className="supplier-row" key={c.id}>
              <b>{c.name}</b>
              <span>{c.mobile}</span>
              <span>{money(c.totalSales)}</span>
              <span>{money(c.totalPaid)}</span>
              <b className={c.outstanding ? "payable" : ""}>
                {money(c.outstanding)}
              </b>
              <span className="row-actions">
                <button
                  title="View statement"
                  disabled={loadingId === c.id + "-statement"}
                  onClick={async () => {
                    setLoadingId(c.id + "-statement");
                    const d = await get(c.id);
                    if (d) setLedger({ ...d, statement: true });
                    setLoadingId(null);
                  }}
                >
                  {loadingId === c.id + "-statement" ? (
                    <span className="button-spinner" />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
                <button title="Edit" onClick={() => setForm(c)}>
                  <Pencil size={16} />
                </button>
                <button
                  className="danger"
                  title="Delete"
                  onClick={() => setRemove(c)}
                >
                  <Trash2 size={16} />
                </button>
                <button
                  title="Customer ledger / collect payment"
                  disabled={loadingId === c.id + "-ledger"}
                  onClick={async () => {
                    setLoadingId(c.id + "-ledger");
                    await open(c.id);
                    setLoadingId(null);
                  }}
                >
                  {loadingId === c.id + "-ledger" ? (
                    <span className="button-spinner" />
                  ) : (
                    <WalletCards size={16} />
                  )}
                </button>
                <button
                  className="statement-download"
                  title="Download customer statement PDF"
                  onClick={async () => {
                    const data = await get(c.id);
                    if (data) await downloadStatement(data);
                  }}
                >
                  <Download size={16} />
                </button>
              </span>
            </div>
          ))}
        </div>

        {/* MOBILE CARDS VIEW */}
        <div className="mobile-only" style={{ marginTop: "12px" }}>
          {controls.pageRows.map((c) => (
            <div key={c.id} className="erp-mobile-card">
              <div className="erp-mobile-card-header">
                <div>
                  <div className="erp-mobile-card-title">{c.name}</div>
                  <div className="erp-mobile-card-subtitle">{c.mobile || 'No mobile listed'}</div>
                </div>
                <b className={c.outstanding ? "payable" : ""} style={{ fontSize: "14px" }}>
                  {money(c.outstanding)}
                </b>
              </div>

              <div className="erp-mobile-card-body">
                <div className="erp-mobile-field">
                  <label>Total Sales</label>
                  <span>{money(c.totalSales)}</span>
                </div>
                <div className="erp-mobile-field">
                  <label>Total Received</label>
                  <span>{money(c.totalPaid)}</span>
                </div>
              </div>

              <div className="erp-mobile-card-actions">
                <button
                  title="View Statement"
                  disabled={loadingId === c.id + "-statement"}
                  onClick={async () => {
                    setLoadingId(c.id + "-statement");
                    const d = await get(c.id);
                    if (d) setLedger({ ...d, statement: true });
                    setLoadingId(null);
                  }}
                >
                  {loadingId === c.id + "-statement" ? <span className="button-spinner" /> : <Eye size={16} />}
                  <span>Statement</span>
                </button>

                <button
                  title="Receive Payment"
                  disabled={loadingId === c.id + "-ledger"}
                  onClick={async () => {
                    setLoadingId(c.id + "-ledger");
                    await open(c.id);
                    setLoadingId(null);
                  }}
                >
                  {loadingId === c.id + "-ledger" ? <span className="button-spinner" /> : <WalletCards size={16} />}
                  <span>Collect</span>
                </button>

                <button title="Edit" onClick={() => setForm(c)}>
                  <Pencil size={16} />
                </button>

                <button className="danger" title="Delete" onClick={() => setRemove(c)}>
                  <Trash2 size={16} />
                </button>

                <button
                  title="Download Statement"
                  onClick={async () => {
                    const data = await get(c.id);
                    if (data) await downloadStatement(data);
                  }}
                >
                  <Download size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {!controls.filtered.length && (
          <p className="empty">No customers match these filters.</p>
        )}
        <div className="list-footer-pagination">
          <ListPagination controls={controls} />
        </div>
      </section>

      {form !== undefined && (
        <div className="modal">
          <div className="modal-backdrop" />
          <section className="supplier-form party-form-modal card">
            <button className="sheet-close" onClick={() => setForm(undefined)}>
              <X />
            </button>
            <h2>{form ? "Edit customer" : "Add customer"}</h2>
            <form onSubmit={save}>
              <label>
                Customer name
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
                Opening balance (AED)
                <input
                  name="openingBalance"
                  type="number"
                  min="0"
                  step=".01"
                  defaultValue={form?.openingBalance || "0"}
                  required
                />
              </label>
              {error && <div className="form-error">{error}</div>}
              <button className="primary" disabled={busy}>
                {busy ? "Saving…" : form ? "Update customer" : "Save customer"}
              </button>
            </form>
          </section>
        </div>
      )}

      {remove && (
        <div className="modal">
          <div className="modal-backdrop" />
          <section className="supplier-form card">
            <h2>Delete customer?</h2>
            <p>
              Deleting {remove.name} will permanently remove this customer,
              their sales invoices, invoice items, and payment records.
            </p>
            <div className="confirm-actions">
              <button className="outline" onClick={() => setRemove(null)}>
                Cancel
              </button>
              <button
                className="delete-button"
                onClick={async () => {
                  const r = await fetch("/api/customers/" + remove.id, {
                    method: "DELETE",
                  });
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

      {ledger &&
        (ledger.statement ? (
          <Statement ledger={ledger} close={closeLedger} />
        ) : (
          <CustomerLedger
            ledger={ledger}
            close={closeLedger}
            due={due}
            pay={pay}
            paymentAmount={paymentAmount}
            paymentError={paymentError}
            paymentTouched={paymentTouched}
            changePayment={(value: string) => { setPaymentAmount(value); setPaymentTouched(true); setError(""); }}
            error={error}
            busy={busy}
          />
        ))}
    </main>
  );
}

function CustomerLedger({
  ledger,
  close,
  due,
  pay,
  paymentAmount,
  paymentError,
  paymentTouched,
  changePayment,
  error,
  busy,
}: any) {
  const s = ledger.summary;
  return (
    <div className="modal ledger-modal">
      <div className="modal-backdrop" onClick={close} />
      <section className="ledger card">
        <button className="sheet-close" onClick={close}>
          <X />
        </button>
        <div className="card-head">
          <div>
            <p className="eyebrow">CUSTOMER LEDGER</p>
            <h2>{ledger.customer.name}</h2>
            <p>{ledger.customer.mobile}</p>
          </div>
        </div>
        <div className="ledger-totals">
          <span>
            Opening<b>{money(s.openingBalance)}</b>
          </span>
          <span>
            Sales<b>{money(s.totalSales)}</b>
          </span>
          <span>
            Payments<b>{money(s.totalPaid)}</b>
          </span>
          <span>
            Outstanding<b>{money(s.outstanding)}</b>
          </span>
        </div>
        {ledger.sales.map((x: any) => (
          <div className="ledger-line" key={x.id}>
            <span>
              <b>{x.invoiceNumber}</b>
              <small>{x.saleDate}</small>
            </span>
            <span>{money(x.total)}</span>
            <span>Paid {money(x.paid)}</span>
            <b>{money(+x.total - +x.paid)}</b>
          </div>
        ))}
        <h3>Record payment</h3>
        <form className="pay-form" onSubmit={pay} noValidate>
          <p className="payment-hint">Current Outstanding Balance <b>{money(due)}</b></p>
          <input
            name="date"
            type="date"
            max={today}
            defaultValue={today}
            required
          />
          <input
            name="amount"
            type="number"
            min=".01"
            aria-label="Payment amount"
            value={paymentAmount}
            onChange={(e) => changePayment(e.target.value)}
            aria-invalid={paymentTouched && !!paymentError}
            aria-describedby={paymentTouched && paymentError ? 'customer-payment-error' : undefined}
            step=".01"
            required
            disabled={due <= 0}
            placeholder="Amount"
          />
          <select name="method">
            <option>Cash</option>
            <option>Card</option>
            <option>Bank Transfer</option>
          </select>
          <input name="notes" placeholder="Notes" />
          {((paymentTouched && paymentError) || error) && <div id="customer-payment-error" className="form-error" role="alert">{(paymentTouched && paymentError) || error}</div>}
          {!paymentError && <button className="primary" disabled={busy}>
            {busy ? "Processing…" : "Record payment"}
          </button>}
        </form>
        <h3>Payment history</h3>
        {(ledger.payments || []).map((payment: any) => (
          <div className="ledger-line" key={payment.id}>
            <span><b>{payment.paymentDate}</b><small>{payment.notes || 'Customer payment'}</small></span>
            <span>{money(payment.amount)}</span>
            <span>{payment.method}</span>
            <span>{payment.invoiceNumber || 'Account payment'}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

function Statement({ ledger, close }: any) {
  const statementRef = useRef<HTMLDivElement>(null);
  const items: any[] = [];
  const opening = +ledger.summary.openingBalance;
  if (opening) {
    items.push({
      date: "",
      type: "Opening balance",
      reference: "Opening",
      description: "Opening customer balance",
      purchase: opening,
      payment: 0,
    });
  }
  for (const s of ledger.sales || []) {
    items.push({
      date: s.saleDate,
      type: "Sale",
      reference: s.invoiceNumber,
      description: "Sales invoice",
      purchase: +s.total,
      payment: 0,
      status: +s.paid >= +s.total ? "Paid" : +s.paid > 0 ? "Partial" : "Unpaid",
    });
    const later = (ledger.payments || [])
      .filter((p: any) => p.saleId === s.id)
      .reduce((n: number, p: any) => n + +p.amount, 0);
    const initial = +s.paid - later;
    if (initial > 0) {
      items.push({
        date: s.saleDate,
        type: "Initial Payment",
        reference: s.invoiceNumber,
        description: `Initial payment for ${s.invoiceNumber}`,
        purchase: 0,
        payment: initial,
        method: s.paymentMethod,
      });
    }
  }
  for (const p of ledger.payments || []) {
    const s = (ledger.sales || []).find((x: any) => x.id === p.saleId);
    const ref = p.invoiceNumber || (s ? s.invoiceNumber : "PAYMENT");
    items.push({
      date: p.paymentDate,
      type: "Customer Payment",
      reference: ref,
      description: `Payment for ${ref}`,
      purchase: 0,
      payment: +p.amount,
      method: p.method,
      notes: p.notes,
    });
  }

  items.sort((a, b) => {
    if (!a.date) return -1;
    if (!b.date) return 1;
    return String(a.date).localeCompare(String(b.date));
  });

  let running = 0;
  const entries = items.map((x) => {
    running += (x.purchase || 0) - (x.payment || 0);
    return { ...x, balance: running };
  });

  return (
    <div className="modal document-modal">
      <div className="modal-backdrop" onClick={close} />
      <section className="document-modal-card card">
        <div className="document-actions no-print">
          <button
            className="primary"
            title="Download PDF"
            aria-label="Download customer statement PDF"
            onClick={() =>
              statementRef.current &&
              downloadPdfFromElement(
                statementRef.current,
                `${ledger.customer.name}-statement.pdf`,
              )
            }
          >
            <Download size={15} />
            <span>Download PDF</span>
          </button>
          <button className="outline statement-close-button" onClick={close}>
            <X size={15} />
            <span>Close</span>
          </button>
        </div>
        <div className="statement-document-content" ref={statementRef}>
          <FinancialDocument
            kind="Customer Statement"
            title={"Customer statement · " + ledger.customer.name}
            party={ledger.customer.name}
            contact={ledger.customer.mobile}
            address={ledger.customer.address}
            summary={[
              ["Opening Balance", money(ledger.summary.openingBalance)],
              ["Total Sales", money(ledger.summary.totalSales)],
              ["Total Payments", money(ledger.summary.totalPaid)],
              ["Outstanding Balance", money(ledger.summary.outstanding)],
            ]}
            entries={entries}
          />
        </div>
      </section>
    </div>
  );
}
