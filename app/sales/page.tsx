'use client';
import { useEffect, useRef, useState, FormEvent } from 'react';
import Image from 'next/image';
import { flushSync } from 'react-dom';
import { cancelSalesInputScroll, revealSalesInput } from '@/lib/sales-editor-focus';
import { ArrowRight, MessageCircle, CheckCircle2, Download, Eye, FileText, Leaf, Mail, MapPin, Pencil, Phone, Plus, Trash2, WalletCards, X } from 'lucide-react';
import { ListFilters, ListPagination, useListControls } from '@/components/list-controls';
import { createPdfBlob, downloadPdf, downloadPdfFromElement } from '@/components/pdf-download';
import { SearchableSelect } from '@/components/price-list-item-picker';

import { salesPdfData } from '@/lib/sales-pdf';

type L = { itemName: string; itemId: string; quantity: string; unit: string; unitPrice: string; lineTotal: string };
type R = { id: string; invoice: string; customer: string; date: string; total: string; paid: string };
type S = {
  id: string;
  invoiceNumber: string;
  customerId: string;
  saleDate: string;
  subtotal: string;
  discount: string;
  total: string;
  paid: string;
  paymentMethod?: string;
  notes?: string;
  customerName: string;
  customerMobile?: string;
  customerAddress?: string;
  items: (L & { id: string; itemCode: string; itemName: string })[];
};
type Business = { address: string; contactNumber: string; email: string };

const today = new Date().toISOString().slice(0, 10);
const money = (n: number | string) =>
  `AED ${Number(n).toLocaleString('en-AE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;

const blank = (): L => ({ itemName: '', itemId: '', quantity: '1', unit: '', unitPrice: '0.0', lineTotal: '0.000' });

const cent = (x: string | number) => {
  const [a, b = ''] = String(x || '0').split('.');
  return (Number(a) || 0) * 1000 + Number((b + '000').slice(0, 3));
};

export default function Sales() {
  const [rows, setRows] = useState<R[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [ledgerError, setLedgerError] = useState('');
  const nameRefs = useRef<(HTMLInputElement | null)[]>([]);
  const editorRef = useRef<HTMLElement | null>(null);
  const editorModalRef = useRef<HTMLDivElement | null>(null);
  const [share, setShare] = useState<{ file: File; message: string; phone: string; path: string } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState('');
  const [form, setForm] = useState<S | null | undefined>();
  const [lines, setLines] = useState<L[]>([blank()]);
  const [discount, setDiscount] = useState('0.00');
  const [paid, setPaid] = useState('0.00');
  const [detail, setDetail] = useState<S | null>(null);
  const [remove, setRemove] = useState<R | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    fetch('/api/sales').then(r => r.json()).then(setRows);
    fetch('/api/customers').then(r => r.json()).then(setCustomers);

  };
  useEffect(load, []);

  const controls = useListControls(
    rows,
    r => `${r.invoice} ${r.customer} ${r.date} ${r.total} ${r.paid}`,
    r => r.date
  );

  const get = async (id: string) => {
    const r = await fetch('/api/sales/' + id);
    return r.ok ? r.json() : null;
  };

  const downloadSale = async (sale: S) => {
    const business = await fetch('/api/business-settings').then(r => r.ok ? r.json() : null);
    await downloadPdf(salesPdfData(sale, business), `${sale.invoiceNumber}.pdf`);
  };

  useEffect(() => {
    setPending(null); setLedgerError('');
    if (!customerId || form === undefined) return;
    const controller = new AbortController();
    fetch('/api/customers/' + customerId, { signal: controller.signal, cache: 'no-store' })
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => setPending(String(data.summary.outstanding)))
      .catch(e => { if (e.name !== 'AbortError') setLedgerError('Unable to load customer balance. Reselect the customer to retry.'); });
    return () => controller.abort();
  }, [customerId, form]);

  useEffect(() => {
    if (form === undefined) return;
    const editor = editorRef.current;
    const modal = editorModalRef.current;
    if (!editor || !modal) return;
    const viewport = window.visualViewport;
    const mobile = window.matchMedia('(max-width: 700px)');
    const formElement = editor.querySelector('form');
    let layoutWidth = window.innerWidth;
    let layoutHeight = window.innerHeight;
    let frame = 0;
    const pageScroll = window.scrollY;
    const bodyStyle = document.body.style.cssText;
    const rootOverflow = document.documentElement.style.overflow;
    const lockPageScroll = mobile.matches;
    if (lockPageScroll) {
      document.body.style.position = 'fixed';
      document.body.style.top = `-${pageScroll}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }
    const update = () => {
      if (mobile.matches) {
        // Keyboard changes only the content's visible scroll area. Keep the
        // panel's top, width and outer height independent of those changes.
        if (layoutWidth !== window.innerWidth) {
          layoutWidth = window.innerWidth;
          layoutHeight = window.innerHeight;
        }
        modal.style.setProperty('--sales-layout-height', `${layoutHeight}px`);
        if (formElement) {
          const bottom = Math.min(layoutHeight, (viewport?.offsetTop || 0) + (viewport?.height || window.innerHeight));
          const top = formElement.getBoundingClientRect().top;
          modal.style.setProperty('--sales-content-height', `${Math.max(0, bottom - top - 24)}px`);
        }
      } else {
        modal.style.setProperty('--sales-viewport-top', `${viewport?.offsetTop || 0}px`);
        modal.style.setProperty('--sales-viewport-height', `${viewport?.height || window.innerHeight}px`);
      }
      const input = document.activeElement;
      if (input instanceof HTMLInputElement && editor.contains(input)) revealSalesInput(editor, input);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const cancelScroll = () => cancelSalesInputScroll(editor);
    update();
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    editor.addEventListener('focusin', schedule);
    editor.addEventListener('touchstart', cancelScroll, { passive: true });
    editor.addEventListener('wheel', cancelScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      cancelSalesInputScroll(editor);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      editor.removeEventListener('focusin', schedule);
      editor.removeEventListener('touchstart', cancelScroll);
      editor.removeEventListener('wheel', cancelScroll);
      if (lockPageScroll) {
        document.body.style.cssText = bodyStyle;
        document.documentElement.style.overflow = rootOverflow;
        window.scrollTo({ top: pageScroll, behavior: 'instant' });
      }
    };
  }, [form]);

  function nextItem(index: number) {
    // Commit and focus within the click gesture so mobile browsers open/retain
    // the keyboard. Delayed effect-based focus can lose that user activation.
    flushSync(() => {
      setLines(current => [...current.slice(0, index + 1), blank(), ...current.slice(index + 1)]);
    });
    const input = nameRefs.current[index + 1];
    const editor = editorRef.current;
    if (input && editor) {
      input.focus({ preventScroll: true });
      revealSalesInput(editor, input, true);
    }
  }

  async function prepareShare(sale: S) {
    setSharing(true); setShareError(''); setShare(null);
    try {
      let phone = (sale.customerMobile || '').replace(/[\s()+-]/g, '').replace(/^00/, '');
      if (/^05\d{8}$/.test(phone)) phone = '971' + phone.slice(1);
      if (!/^[1-9]\d{7,14}$/.test(phone)) throw new Error('Update the customer WhatsApp number with its country code before sharing.');
      const businessResponse = await fetch('/api/business-settings');
      if (!businessResponse.ok) throw new Error('Unable to load business settings.');
      const blob = await createPdfBlob(salesPdfData(sale, await businessResponse.json()));
      const response = await fetch('/api/sales/' + sale.id + '/share', { method: 'POST' });
      if (!response.ok) throw new Error('Unable to prepare secure invoice link.');
      const { path } = await response.json();
      setShare({ file: new File([blob], sale.invoiceNumber + '.pdf', { type: 'application/pdf' }), phone, path,
        message: `Dear ${sale.customerName}, please find invoice ${sale.invoiceNumber} from Veg Basket for ${money(sale.total)}. Thank you for your business.` });
    } catch (e) { setShareError(e instanceof Error ? e.message : 'Unable to prepare invoice.'); }
    finally { setSharing(false); }
  }

  async function nativeShare() {
    if (!share) return;
    try { await navigator.share({ files: [share.file], title: 'Veg Basket invoice', text: share.message }); }
    catch (e) { if (!(e instanceof Error && e.name === 'AbortError')) setShareError('File sharing was unavailable. Use the WhatsApp link below.'); }
  }

  const edit = async (r: R) => {
    const s = await get(r.id);
    if (s) {
      setLines(
        s.items.map((x: any) => ({
          itemId: x.itemId || '',
          itemName: x.itemName.toUpperCase(),
          quantity: String(Math.max(1, Number(x.quantity))),
          unit: x.unit || '',
          unitPrice: String(x.unitPrice),
          lineTotal: String(x.lineTotal)
        }))
      );
      setDiscount(String(s.discount || '0.00'));
      setPaid(String(s.paid || '0.00'));
      setCustomerId(s.customerId);
      setForm(s);
    }
  };

  const changeNumber = (i: number, field: 'quantity' | 'unitPrice', value: string) => {
    if (!/^\d*(?:\.\d{0,3})?$/.test(value)) return;
    if (field === 'quantity' && value !== '' && Number(value) < 1) return;
    setLines(arr => arr.map((x, n) => {
      if (n !== i) return x;
      const updated = { ...x, [field]: value };
      return { ...updated, lineTotal: (Math.round(Number(updated.quantity || 1) * cent(updated.unitPrice)) / 1000).toFixed(3) };
    }));
  };

  const changeItem = (i: number, input: HTMLInputElement) => {
    const value = input.value;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    flushSync(() => {
      setLines(arr => arr.map((x, n) => (n === i ? { ...x, itemId: '', itemName: value.toUpperCase() } : x)));
    });
    if (start !== null && end !== null) {
      input.setSelectionRange(value.slice(0, start).toUpperCase().length, value.slice(0, end).toUpperCase().length);
    }
  };

  const subtotal = lines.reduce((n, x) => n + cent(x.lineTotal), 0);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!lines.length) { setError('Add at least one invoice item.'); return; }
    setBusy(true);
    setError('');
    const d = new FormData(e.currentTarget);
    try {
    const r = await fetch(form?.id ? '/api/sales/' + form.id : '/api/sales', {
      method: form?.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: d.get('customerId'),
        date: d.get('date'),
        discount: d.get('discount'),
        paid: d.get('paid'),
        method: d.get('method'),
        notes: d.get('notes'),
        items: lines
      })
    });
    setBusy(false);
    if (r.ok) {
      setForm(undefined);
      load();
    } else setError((await r.json()).error);
    } catch { setError('Unable to save sale. Please check your connection and try again.'); }
    finally { setBusy(false); }
  }

  async function del() {
    if (!remove) return;
    setBusy(true);
    const r = await fetch('/api/sales/' + remove.id, { method: 'DELETE' });
    setBusy(false);
    if (r.ok) {
      setRemove(null);
      load();
    } else setError((await r.json()).error);
  }

  return (
    <main className="management">
      <header className="management-head no-print">
        <div>
          <p className="eyebrow">SALES MANAGEMENT</p>
          <h1>Sales</h1>
          <p>Create invoices and track customer receivables.</p>
        </div>
        <button
          className="primary"
          onClick={() => {
            setLines([blank()]);
            setDiscount('0.00');
            setPaid('0.00');
            setCustomerId(''); setError('');
            setForm(null);
          }}
        >
          <Plus size={16} /> Add sale
        </button>
      </header>

      <section className="card data-panel no-print">
        <ListFilters controls={controls} dateFilter placeholder="Search invoice, customer, or amount…" />
        
        {/* DESKTOP TABLE VIEW */}
        <div className="desktop-only">
          <div className="supplier-row labels sale-row">
            <span>Invoice</span>
            <span>Customer</span>
            <span>Date</span>
            <span>Total</span>
            <span>Balance</span>
            <span>Actions</span>
          </div>
          {controls.pageRows.map(r => (
            <div className="supplier-row sale-row" key={r.id}>
              <b>{r.invoice}</b>
              <span>{r.customer}</span>
              <span>{r.date}</span>
              <span>{money(r.total)}</span>
              <b className="payable">{money(+r.total - +r.paid)}</b>
              <span className="row-actions">
                <button title="Send via WhatsApp" disabled={sharing} onClick={async () => { const sale = await get(r.id); if (sale) await prepareShare(sale); }}><MessageCircle size={16} /></button>
                <button title="View" onClick={async () => setDetail(await get(r.id))}>
                  <Eye size={16} />
                </button>
                <button title="Edit" onClick={() => edit(r)}>
                  <Pencil size={16} />
                </button>
                <button className="danger" title="Delete" onClick={() => { setError(''); setRemove(r); }}>
                  <Trash2 size={16} />
                </button>
                <button title="Download PDF" onClick={async () => { const sale = await get(r.id); if (sale) await downloadSale(sale); }}>
                  <Download size={16} />
                </button>
              </span>
            </div>
          ))}
        </div>

        {/* MOBILE CARDS VIEW */}
        <div className="mobile-only" style={{ marginTop: "12px" }}>
          {controls.pageRows.map(r => {
            const balance = +r.total - +r.paid;
            const statusLabel = balance <= 0 ? 'Paid' : +r.paid > 0 ? 'Partial' : 'Unpaid';
            const statusClass = balance <= 0 ? 'paid' : +r.paid > 0 ? 'partial' : 'pending';
            return (
              <div key={r.id} className="erp-mobile-card">
                <div className="erp-mobile-card-header">
                  <div>
                    <div className="erp-mobile-card-title">{r.invoice}</div>
                    <div className="erp-mobile-card-subtitle">{r.date}</div>
                  </div>
                  <span className={`status ${statusClass}`}>{statusLabel}</span>
                </div>

                <div className="erp-mobile-card-body">
                  <div className="erp-mobile-field" style={{ gridColumn: "1 / -1" }}>
                    <label>Customer</label>
                    <b style={{ fontSize: "13px" }}>{r.customer}</b>
                  </div>
                  <div className="erp-mobile-field">
                    <label>Total Sales Amount</label>
                    <span>{money(r.total)}</span>
                  </div>
                  <div className="erp-mobile-field">
                    <label>Balance Payable</label>
                    <b className="payable">{money(balance)}</b>
                  </div>
                </div>

                <div className="erp-mobile-card-actions">
                  <button title="Send via WhatsApp" disabled={sharing} onClick={async () => { const sale = await get(r.id); if (sale) await prepareShare(sale); }}><MessageCircle size={16} /></button>
                  <button title="View Details" onClick={async () => setDetail(await get(r.id))}>
                    <Eye size={16} /> <span>View</span>
                  </button>
                  <button title="Edit Invoice" onClick={() => edit(r)}>
                    <Pencil size={16} /> <span>Edit</span>
                  </button>
                  <button className="danger" title="Delete Sale" onClick={() => { setError(''); setRemove(r); }}>
                    <Trash2 size={16} />
                  </button>
                  <button title="Download Invoice PDF" onClick={async () => { const sale = await get(r.id); if (sale) await downloadSale(sale); }}>
                    <Download size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {!controls.filtered.length && <p className="empty">No sales invoices match these filters.</p>}
        <div className="list-footer-pagination">
          <ListPagination controls={controls} />
        </div>
      </section>

      {form !== undefined && (
        <div className="modal sales-editor-modal" ref={editorModalRef}>
          <div className="modal-backdrop" />
          <section className="supplier-form card sales-editor" ref={editorRef}>
            <button className="sheet-close" onClick={() => setForm(undefined)}>
              <X />
            </button>
            <h2>{form ? 'Edit sale' : 'Add sale'}</h2>
            <form onSubmit={save}>
              <div className="sale-form-grid">
                <SearchableSelect
                  key={form?.id || 'new'}
                  items={customers}
                  selectedId={customerId}
                  onSelect={setCustomerId}
                  label="Customer"
                  placeholder="Search or choose a customer…"
                  name="customerId"
                />
                <label>Customer pending balance (AED)
                  <input readOnly value={ledgerError || (customerId ? pending === null ? 'Loading…' : money(pending) : 'Select a customer')} aria-live="polite" />
                </label>
                <label>
                  Date
                  <input
                    name="date"
                    type="date"
                    required
                    max={today}
                    defaultValue={(form?.saleDate || today).slice(0, 10)}
                  />
                </label>
              </div>

              <div className="sale-lines">
                <div className="sale-lines-head">
                  <b>Invoice items</b>
                  <button type="button" className="outline" onClick={() => nextItem(lines.length - 1)}>
                    <Plus size={15} /> Add item
                  </button>
                </div>
                <table className="sales-entry-table">
                  <colgroup><col className="entry-item" /><col className="entry-qty" /><col className="entry-rate" /><col className="entry-amount" /><col className="entry-action" /></colgroup>
                  <thead><tr><th scope="col">Item</th><th scope="col">Qty</th><th scope="col">Rate</th><th scope="col">Amount</th><th scope="col">Action</th></tr></thead>
                  <tbody>{lines.map((x, i) => (
                    <tr className="sale-line" key={i}>
                      <td><input aria-label={`Item name ${i + 1}`} ref={node => { nameRefs.current[i] = node; }} type="text" required maxLength={250}
                        autoCapitalize="characters" spellCheck={false} placeholder="Enter item name" value={x.itemName} onChange={e => changeItem(i, e.currentTarget)} /></td>
                      <td><div className="entry-quantity">
                        <button type="button" aria-label={`Decrease quantity ${i + 1}`} disabled={Number(x.quantity || 1) <= 1} onClick={() => changeNumber(i, 'quantity', String(Math.max(1, Number(x.quantity || 1) - 1)))}>−</button>
                        <input aria-label={`Quantity ${i + 1}`} type="text" inputMode="decimal" required pattern="[0-9]+(\.[0-9]{1,3})?" value={x.quantity} onChange={e => changeNumber(i, 'quantity', e.target.value)} onBlur={() => { if (!x.quantity) changeNumber(i, 'quantity', '1'); }} />
                        <button type="button" aria-label={`Increase quantity ${i + 1}`} onClick={() => changeNumber(i, 'quantity', String(Number(x.quantity || 1) + 1))}>+</button>
                      </div></td>
                      <td><input aria-label={`Rate ${i + 1}`} type="text" inputMode="decimal" required pattern="[0-9]+(\.[0-9]{1,3})?" value={x.unitPrice} onChange={e => changeNumber(i, 'unitPrice', e.target.value)} onFocus={e => e.currentTarget.select()} onClick={e => e.currentTarget.select()} /></td>
                      <td><input aria-label={`Amount ${i + 1}`} readOnly value={x.lineTotal} tabIndex={-1} /></td>
                      <td><div className="entry-actions">
                        <button type="button" className="line-remove danger" data-delete-confirmation-ignore="true" aria-label="Remove invoice item" title="Remove invoice item" onClick={() => setLines(a => a.filter((_, n) => n !== i))}><Trash2 size={14} /></button>
                        <button type="button" className="outline line-next" title="Next Item (→)" aria-label="Next Item (→)" onClick={() => nextItem(i)}><ArrowRight size={14} /></button>
                      </div></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>

              <div className="sale-form-grid">
                <label>
                  Discount (AED)
                  <input name="discount" type="number" min="0" step=".01" max={subtotal / 1000} value={discount} onChange={e => setDiscount(e.target.value)} />
                </label>
                <label>
                  Paid amount (AED)
                  <input name="paid" type="number" min="0" step=".01" max={Math.max(0, subtotal - cent(discount)) / 1000} value={paid} onChange={e => setPaid(e.target.value)} />
                </label>
                <label>
                  Payment method
                  <select name="method" defaultValue={form?.paymentMethod || 'Cash'}>
                    <option>Cash</option>
                    <option>Card</option>
                    <option>Bank Transfer</option>
                  </select>
                </label>
                <label>
                  Notes
                  <textarea name="notes" defaultValue={form?.notes || ''} />
                </label>
              </div>

              <Totals subtotal={subtotal} discount={discount} paid={paid} />
              {error && <div className="form-error">{error}</div>}
              <button className="primary sales-submit" disabled={busy}>
                {busy ? 'Saving…' : form ? 'Update sale' : 'Create sale'}
              </button>
            </form>
          </section>
        </div>
      )}

      {detail && <Details sale={detail} share={() => void prepareShare(detail)} close={() => setDetail(null)} print={() => { void downloadSale(detail); setDetail(null); }} />}
      {(sharing || share || shareError) && <div className="modal"><div className="modal-backdrop" /><section className="supplier-form card">
        <button className="sheet-close" onClick={() => { if (!sharing) { setShare(null); setShareError(''); } }} disabled={sharing}><X /></button>
        <h2>Send via WhatsApp</h2>
        {sharing && <p>Preparing invoice PDF…</p>}
        {shareError && <p className="form-error">{shareError}</p>}
        {share && <><p>Customer WhatsApp: +{share.phone}</p><p>{share.message}</p>
          {typeof navigator !== 'undefined' && navigator.canShare?.({ files: [share.file] }) && <button className="primary" onClick={nativeShare}><MessageCircle size={16} /> Share PDF file</button>}
          <p>For file sharing, choose WhatsApp and this customer in your device’s share sheet.</p>
          <a className="outline" target="_blank" rel="noopener noreferrer" href={'https://wa.me/' + share.phone + '?text=' + encodeURIComponent(share.message + '\n' + window.location.origin + share.path)}>Open customer WhatsApp with PDF link</a>
          <small>The private invoice link expires in 7 days. Anyone with the link can view the current saved invoice.</small>
        </>}
      </section></div>}
      {remove && (
        <div className="modal delete-confirm-modal">
          <div className="modal-backdrop" />
          <section className="supplier-form card">
            <h2>Delete sale?</h2>
            <p>Are you sure you want to delete this sale? Its related payment records will also be removed. This action cannot be undone.</p>
            {error && <div className="form-error">{error}</div>}
            <div className="confirm-actions">
              <button className="outline" onClick={() => setRemove(null)}>Cancel</button>
              <button className="delete-button" disabled={busy} onClick={del}>
                {busy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function Totals({ subtotal, discount, paid }: { subtotal: number; discount: string; paid: string }) {
  const d = cent(discount),
    p = cent(paid),
    total = Math.max(0, subtotal - d);
  return (
    <div className="sale-totals">
      {[
        ['Subtotal', subtotal],
        ['Discount', d],
        ['Grand total', total],
        ['Paid amount', p],
        ['Balance amount', Math.max(0, total - p)]
      ].map(([a, b]) => (
        <span key={String(a)}>
          {a}
          <b>{money(Number(b) / 1000)}</b>
        </span>
      ))}
    </div>
  );
}

function Table({ sale }: { sale: S }) {
  return (
    <div className="sale-item-table">
      <table>
        <thead>
          <tr>
            <th className="item-index">#</th>
            <th>Item Description</th>
            <th className="num">Qty</th>
            <th className="num">Rate (AED)</th><th className="num">Total (AED)</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((x, index) => (
            <tr key={x.id}>
              <td data-label="#" className="item-index">{index + 1}</td>
              <td data-label="Item Description">
                {x.itemCode ? x.itemCode + ' · ' : ''}{x.itemName}
              </td>
              <td data-label="Qty" className="num">
                {Number(x.quantity)} {x.unit || ''}
              </td>
              <td data-label="Rate (AED)" className="num">{Number(x.unitPrice).toFixed(3)}</td><td data-label="Total (AED)" className="num">{Number(x.lineTotal).toLocaleString('en-AE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Details({ sale, close, print, share }: { sale: S; close: () => void; print: () => void; share: () => void }) {
  const balance = +sale.total - +sale.paid;
  return (
    <div className="modal">
      <div className="modal-backdrop" onClick={close} />
      <section className="purchase-details card sale-details">
        <button className="sheet-close" onClick={close}>
          <X />
        </button>
        <p className="eyebrow">SALE DETAILS</p>
        <h2>{sale.invoiceNumber}</h2>
        <div className="detail-grid">
          <span>
            Customer<b>{sale.customerName}</b>
            <small>{sale.customerMobile}</small>
            <small>{sale.customerAddress}</small>
          </span>
          <span>
            Sale date<b>{sale.saleDate}</b>
          </span>
          <span>
            Payment method<b>{sale.paymentMethod || '—'}</b>
          </span>
          <span>
            Payment status<b>{balance <= 0 ? 'Paid' : +sale.paid ? 'Partial' : 'Unpaid'}</b>
          </span>
        </div>
        {sale.notes && (
          <p className="detail-note">
            <b>Notes:</b> {sale.notes}
          </p>
        )}
        <Table sale={sale} />
        <Totals subtotal={cent(sale.subtotal)} discount={sale.discount} paid={sale.paid} />
        <button className="outline" onClick={share}><MessageCircle size={16} /> Send via WhatsApp</button>
        <button className="primary" onClick={print}>
          <Download size={16} /> Download PDF
        </button>
      </section>
    </div>
  );
}

function Invoice({ sale, close }: { sale: S; close: () => void }) {
  const balance = +sale.total - +sale.paid;
  const invoiceRef = useRef<HTMLElement>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  useEffect(() => {
    fetch('/api/business-settings').then(r => r.ok ? r.json() : null).then(setBusiness).catch(() => setBusiness(null));
  }, []);
  const paymentStatus = balance <= 0 ? 'Paid' : +sale.paid > 0 ? 'Partial' : 'Unpaid';
  return (
    <div className="invoice-preview-modal" role="dialog" aria-modal="true" aria-label="Sales invoice preview">
      <button className="invoice-preview-backdrop no-print" aria-label="Close invoice preview" onClick={close} />
      <div className="invoice-preview-shell">
        <div className="invoice-preview-actions no-print">
          <span>Sales Invoice Preview</span>
          <div>
            <button className="primary" onClick={() => invoiceRef.current && downloadPdfFromElement(invoiceRef.current, `${sale.invoiceNumber}.pdf`)}><Download size={16} /> Download PDF</button>
            <button className="outline" onClick={close}>Close</button>
          </div>
        </div>
        <section ref={invoiceRef} className="print-bill sale-invoice">
      <div className="invoice-top-accent" />
      <div className="invoice-produce-banner" aria-hidden="true">
        <Image src="/images/invoice-produce-banner.png" alt="" fill sizes="(max-width: 700px) 100vw, 480px" />
      </div>
      <header className="invoice-branding">
        <div className="invoice-company">
          <Image src="/images/logo.webp" alt="Veg Basket" width={76} height={84} priority />
          <div>
            <h1>Veg Basket</h1>
            <p className="invoice-tagline">Fresh Choices&nbsp; · &nbsp;Healthier Tomorrow</p>
            <p className="invoice-contact"><MapPin />{business?.address || 'Loading business address…'}</p>
            <p className="invoice-contact"><Phone />{business?.contactNumber || 'Loading contact number…'}</p>
            <p className="invoice-contact"><Mail />{business?.email || 'Loading email address…'}</p>
          </div>
        </div>
        <div className="invoice-title"><Leaf size={26} /><span>Sales Invoice</span><small>Fresh produce · better living</small></div>
      </header>
      <div className="invoice-categories">Fresh Vegetables <i /> Fresh Fruits <i /> Quality Produce</div>
      <div className="invoice-overview">
        <section className="invoice-panel bill-to">
          <h2><MapPin /> Bill To</h2>
          <div><strong>{sale.customerName}</strong><span><Phone /> {sale.customerMobile || 'No contact number'}</span>{sale.customerAddress && <span className="customer-address">{sale.customerAddress}</span>}</div>
        </section>
        <section className="invoice-panel invoice-facts">
          <p><span>Invoice No</span><b>{sale.invoiceNumber}</b></p>
          <p><span>Invoice Date</span><b>{sale.saleDate}</b></p>
          <p><span>Payment Status</span><b className={`invoice-status ${paymentStatus.toLowerCase()}`}>{paymentStatus === 'Paid' && <CheckCircle2 />} {paymentStatus}</b></p>
        </section>
        <section className="invoice-panel payment-panel">
          <h2><WalletCards /> Payment Information</h2>
          <div><p><span>Payment Method</span><b>{sale.paymentMethod || '—'}</b></p><p><span>Payment Status</span><b>{paymentStatus}</b></p></div>
        </section>
      </div>
      <Table sale={sale} />
      <div className="invoice-bottom">
        <div className="invoice-thanks"><Leaf /><p>Thank you<br />for your business!</p><small>Fresh produce<br />better living</small></div>
        <div className="bill-summary invoice-summary">
          <span>Subtotal<strong>{money(sale.subtotal)}</strong></span>
          <span>Discount<strong>{money(sale.discount)}</strong></span>
          <span>Grand Total<strong>{money(sale.total)}</strong></span>
          <span>Paid Amount<strong>{money(sale.paid)}</strong></span>
          <span>Balance Amount<strong>{money(balance)}</strong></span>
        </div>
      </div>
      <section className="invoice-notes"><h2><FileText /> Notes</h2><p>{sale.notes || 'Thank you for doing business with Veg Basket.'}</p></section>
      <footer className="invoice-footer"><span><Leaf /> Fresh Produce<br />Better Living</span><span><CheckCircle2 /> Quality Products<br />On Time</span><span><WalletCards /> Healthy Choices<br />Happier Families</span><span><Leaf /> Sustainable<br />For A Greener Tomorrow</span></footer>
        </section>
      </div>
    </div>
  );
}
