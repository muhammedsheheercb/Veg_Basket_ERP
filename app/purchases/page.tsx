'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Download, Eye, Pencil, Plus, Trash2, X } from 'lucide-react';
import { money, shortDate } from '@/components/financial-documents';
import { ListFilters, ListPagination, useListControls } from '@/components/list-controls';
import { downloadPdf } from '@/components/pdf-download';
import { FormSearchableSelect } from '@/components/price-list-item-picker';

type P = { id: string; invoice: string; supplier: string; date: string; total: string; paid: string; balancePayable: string };
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
  existingBalance?: string | number;
  accountPaid?: string | number;
  items?: PurchaseLine[];
};
type PurchaseLine = { itemId: string; itemName: string; quantity: string; unit: string; unitPrice: string; lineTotal: string };
const blankLine = (): PurchaseLine => ({ itemId:'', itemName:'', quantity:'1', unit:'', unitPrice:'0.000', lineTotal:'0.000' });
const money3 = (amount: number) => `AED ${(amount/1000).toLocaleString('en-AE',{minimumFractionDigits:3,maximumFractionDigits:3})}`;
const toMilli = (value: string|number) => { const [whole,fraction='']=String(value||'0').split('.');return (Number(whole)||0)*1000+Number((fraction+'000').slice(0,3)); };
const moneyPurchase = (value: string|number) => money3(toMilli(value));

const status = (p: D) => { const paid=Number(p.paid)+Number(p.accountPaid||0),grand=Number(p.total)+Number(p.existingBalance||0);return paid>=grand?'Paid':paid>0?'Partial':'Unpaid'; };

export default function Purchases() {
  const [rows, setRows] = useState<P[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [form, setForm] = useState<D | null | undefined>();
  const [details, setDetails] = useState<D | null>(null);
  const [print, setPrint] = useState<D | null>(null);
  const [remove, setRemove] = useState<P | null>(null);
  const [error, setError] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [lines, setLines] = useState<PurchaseLine[]>([blankLine()]);
  const [paid, setPaid] = useState('0.000');
  const [supplierId, setSupplierId] = useState('');
  const [supplierBalance, setSupplierBalance] = useState<number | null>(null);
  const [supplierBalanceError, setSupplierBalanceError] = useState('');

  useEffect(() => { fetch('/api/items?all=1').then(r=>r.ok?r.json():[]).then(x=>Array.isArray(x)&&setItems(x)); }, []);

  const load = () => {
    fetch('/api/purchases', { cache: 'no-store' }).then((r) => r.json()).then((x) => Array.isArray(x) && setRows(x));
    fetch('/api/suppliers', { cache: 'no-store' }).then((r) => r.json()).then((x) => Array.isArray(x) && setSuppliers(x));
  };
  useEffect(() => {
    void load();
    const refresh = () => void load();
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!supplierId || form === undefined) { setSupplierBalance(null); setSupplierBalanceError(''); return; }
    if(form?.supplierId===supplierId&&form.existingBalance!=null){setSupplierBalance(toMilli(form.existingBalance));setSupplierBalanceError('');return;}
    const controller = new AbortController();
    setSupplierBalance(null); setSupplierBalanceError('');
    fetch('/api/suppliers/' + supplierId, { signal:controller.signal, cache:'no-store' })
      .then(async response=>{if(!response.ok)throw new Error();return response.json();})
      .then(data=>{
        const currentBillDue=form?.supplierId===supplierId?Math.max(0,Number(form.total)-Number(form.paid)):0;
        const priorAccountPayment=form?.supplierId===supplierId?Number(form.accountPaid||0):0;
        setSupplierBalance(Math.max(0,Math.round((Number(data.summary.payable)-currentBillDue+priorAccountPayment)*1000)));
      })
      .catch(error=>{if(error.name!=='AbortError')setSupplierBalanceError('Unable to load supplier balance. Reselect the supplier to retry.');});
    return ()=>controller.abort();
  },[supplierId,form]);

  const controls = useListControls(
    rows,
    (p) => p.invoice + ' ' + p.supplier + ' ' + p.date + ' ' + p.total + ' ' + p.paid,
    (p) => p.date
  );

  const get = async (id: string) => {
    const r = await fetch('/api/purchases/' + id);
    return r.ok ? r.json() : null;
  };

  function changeLine(index:number, field:'quantity'|'unitPrice', value:string) {
    if(!/^\d*(?:\.\d{0,3})?$/.test(value)) return;
    if(field==='quantity'&&value!==''&&Number(value)<1)return;
    setLines(current=>current.map((line,i)=>{if(i!==index)return line;const next={...line,[field]:value};return{...next,lineTotal:(Math.round(Number(next.quantity||1)*toMilli(next.unitPrice))/1000).toFixed(3)};}));
  }
  const subtotal=lines.reduce((sum,line)=>sum+toMilli(line.lineTotal),0);
  const existingBalance=supplierBalance ?? 0;
  const grandTotal=subtotal+existingBalance;
  const balance=grandTotal-toMilli(paid);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!lines.length) { setError('Add at least one purchase item.'); return; }
    if (lines.some(line=>!line.itemName.trim()||Number(line.quantity)<1||!/^\d+(\.\d{1,3})?$/.test(line.unitPrice))) { setError('Enter an item, quantity and valid rate for every row.'); return; }
    if (grandTotal - toMilli(paid) < 0) { setError('Paid amount cannot exceed grand total.'); return; }
    const d = new FormData(e.currentTarget);
    const r = await fetch(form?.id ? '/api/purchases/' + form.id : '/api/purchases', {
      method: form?.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        supplierId: d.get('supplierId'),
        date: d.get('date'),
        items: lines,
        paid,
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
        <button className="primary" onClick={() => { setError(''); setPaid('0.000'); setLines([blankLine()]); setSupplierId(''); setForm(null); }}>
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
              <b>{money(p.balancePayable)}</b>
              <span className="row-actions">
                <button title="View" onClick={async () => setDetails(await get(p.id))}>
                  <Eye size={16} />
                </button>
                <button title="Edit" onClick={async () => { const purchase=await get(p.id); if(!purchase)return; setSupplierId(purchase.supplierId); setForm(purchase); setPaid((Number(purchase.paid||0)+Number(purchase.accountPaid||0)).toFixed(3)); setLines(purchase.items?.length?purchase.items.map((line:PurchaseLine)=>({...line,quantity:String(line.quantity),unitPrice:String(line.unitPrice),lineTotal:String(line.lineTotal)})):[{...blankLine(),itemName:purchase.description||'Purchase item',quantity:'1',unitPrice:(Number(purchase.total)/1000).toFixed(3),lineTotal:(Number(purchase.total)/1000).toFixed(3)}]); }}>
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
            const bal = Number(p.balancePayable);
            const st = bal <= 0 ? 'Paid' : bal < Number(p.total) ? 'Partial' : 'Unpaid';
            const stCls = bal <= 0 ? 'paid' : bal < Number(p.total) ? 'partial' : 'pending';
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
                  <button title="Edit" onClick={async () => { const purchase=await get(p.id); if(!purchase)return; setSupplierId(purchase.supplierId); setForm(purchase); setPaid((Number(purchase.paid||0)+Number(purchase.accountPaid||0)).toFixed(3)); setLines(purchase.items?.length?purchase.items.map((line:PurchaseLine)=>({...line,quantity:String(line.quantity),unitPrice:String(line.unitPrice),lineTotal:String(line.lineTotal)})):[{...blankLine(),itemName:purchase.description||'Purchase item',quantity:'1',unitPrice:(Number(purchase.total)/1000).toFixed(3),lineTotal:(Number(purchase.total)/1000).toFixed(3)}]); }}>
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
        <div className="modal sales-editor-modal no-print">
          <div className="modal-backdrop" onClick={() => setForm(undefined)} />
          <section className="supplier-form card purchase-editor sales-editor">
            <button className="sheet-close" onClick={() => setForm(undefined)}>
              <X />
            </button>
            <h2>{form ? 'Edit purchase' : 'Add purchase'}</h2>
            <form onSubmit={save}>
              <FormSearchableSelect
                key={`${form?.id || 'new'}-${form?.supplierId || ''}`}
                items={suppliers}
                initialValue={form?.supplierId || ''}
                onSelect={setSupplierId}
                label="Supplier"
                placeholder="Search or choose a supplier…"
                name="supplierId"
              />
              <label>Existing Balance Amount (AED)<input readOnly value={supplierBalanceError || (supplierId ? supplierBalance===null ? 'Loading…' : money3(existingBalance) : 'Select a supplier')} aria-live="polite" /></label>
              <label>
                Date
                <input name="date" type="date" required defaultValue={form?.purchaseDate || new Date().toISOString().slice(0, 10)} />
              </label>
              <div className="sale-lines">
                <div className="sale-lines-head"><b>Purchase items</b><button type="button" className="outline" onClick={()=>setLines(current=>[...current,blankLine()])}><Plus size={15}/> Add item</button></div>
                <table className="sales-entry-table"><colgroup><col className="entry-item"/><col className="entry-qty"/><col className="entry-rate"/><col className="entry-amount"/><col className="entry-action"/></colgroup>
                  <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th><th>Action</th></tr></thead>
                  <tbody>{lines.map((line,index)=><tr className="sale-line" key={index}>
                    <td><input aria-label={`Item name ${index+1}`} type="text" required maxLength={250} autoCapitalize="characters" spellCheck={false} value={line.itemName} list="purchase-item-options" placeholder="Enter item name" onChange={e=>{const value=e.target.value.toUpperCase();setLines(current=>current.map((x,i)=>i===index?{...x,itemName:value,itemId:items.find(item=>item.name.toLowerCase()===value.toLowerCase())?.id||''}:x));}} /></td>
                    <td><input aria-label={`Quantity ${index+1}`} type="text" inputMode="decimal" required pattern="[0-9]+(\.[0-9]{1,3})?" value={line.quantity} onChange={e=>changeLine(index,'quantity',e.target.value)}/></td>
                    <td><input aria-label={`Rate ${index+1}`} type="text" inputMode="decimal" required pattern="[0-9]+(\.[0-9]{1,3})?" value={line.unitPrice} onChange={e=>changeLine(index,'unitPrice',e.target.value)} onFocus={e=>e.currentTarget.select()}/></td>
                    <td><input aria-label={`Amount ${index+1}`} readOnly value={line.lineTotal}/></td>
                    <td><div className="entry-actions"><button type="button" className="line-remove danger" data-delete-confirmation-ignore="true" aria-label="Remove purchase item" title="Remove item" onClick={()=>setLines(current=>current.filter((_,i)=>i!==index))}><Trash2 size={14}/></button><button type="button" className="outline line-next" aria-label="Add another purchase item" onClick={()=>setLines(current=>[...current.slice(0,index+1),blankLine(),...current.slice(index+1)])}><Plus size={14}/></button></div></td>
                  </tr>)}</tbody>
                </table>
                <datalist id="purchase-item-options">{items.map(item=><option key={item.id} value={item.name}>{item.code}</option>)}</datalist>
              </div>
              <div className="sale-form-grid">
                <label>Purchase total (AED)<input readOnly value={money3(subtotal)} /></label>
                <label>Paid amount (AED)<input name="paid" type="number" min="0" max={(grandTotal/1000).toFixed(3)} step="any" required value={paid} onChange={e=>setPaid(e.target.value)} /></label>
              </div>
              <label>
                Method
                <select name="method" defaultValue={form?.paymentMethod || 'Cash'}>
                  <option>Cash</option>
                  <option>Card</option>
                  <option>Bank Transfer</option>
                </select>
              </label>
              <label>Notes<textarea name="notes" defaultValue={form?.notes} /></label>
              <div className="sale-totals purchase-totals"><span>Total Item Amount<b>{money3(subtotal)}</b></span><span>Existing Balance Amount<b>{money3(existingBalance)}</b></span><span>Grand Total<b>{money3(grandTotal)}</b></span><span>Paid Amount<b>{money3(toMilli(paid))}</b></span><span>Remaining Balance<b>{money3(balance)}</b></span></div>
              {supplierBalanceError && <div className="form-error" role="alert">{supplierBalanceError}</div>}
              {error && <div className="form-error">{error}</div>}
              <button className="primary" disabled={supplierBalance===null||!!supplierBalanceError}>{form ? 'Update purchase' : 'Create purchase'}</button>
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
            {details.items?.length ? <div className="sale-item-table"><table><thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Rate (AED)</th><th>Total (AED)</th></tr></thead><tbody>{details.items.map((line,index)=><tr key={line.id}><td>{index+1}</td><td>{line.itemName}</td><td>{Number(line.quantity)} {line.unit||''}</td><td>{moneyPurchase(line.unitPrice)}</td><td>{moneyPurchase(line.lineTotal)}</td></tr>)}</tbody></table></div> : <p className="detail-note">{details.description || 'No description provided.'}</p>}
            {details.notes && <p className="detail-note">{details.notes}</p>}
              <div className="sale-totals purchase-detail-totals">
              <span>Total Item Amount<b>{moneyPurchase(details.total)}</b></span>
              <span>Existing Balance Amount<b>{moneyPurchase(details.existingBalance || 0)}</b></span>
              <span>Grand Total<b>{moneyPurchase(Number(details.total)+Number(details.existingBalance||0))}</b></span>
              <span>Paid Amount<b>{moneyPurchase(Number(details.paid)+Number(details.accountPaid||0))}</b></span>
              <span>Remaining Balance<b>{moneyPurchase(Number(details.total)+Number(details.existingBalance||0)-Number(details.paid)-Number(details.accountPaid||0))}</b></span>
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
  const itemsKey = JSON.stringify(purchase.items || []);
  useEffect(() => {
    const download = async () => {
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
            ['Total Item Amount', moneyPurchase(purchase.total)],
            ['Existing Balance Amount', moneyPurchase(purchase.existingBalance || 0)],
            ['Grand Total', moneyPurchase(Number(purchase.total)+Number(purchase.existingBalance||0))],
            ['Paid Amount', moneyPurchase(Number(purchase.paid)+Number(purchase.accountPaid||0))],
            ['Remaining Balance', moneyPurchase(Number(purchase.total)+Number(purchase.existingBalance||0)-Number(purchase.paid)-Number(purchase.accountPaid||0))],
          ],
          sales: { date:shortDate(purchase.purchaseDate), status:status(purchase), method:purchase.paymentMethod||'—', contact:purchase.supplierMobile||'', address:purchase.supplierAddress||'' },
          headers: ['#', 'Item Description', 'Qty', 'Rate (AED)', 'Total (AED)'],
          rows: purchase.items?.length ? purchase.items.map((line,index)=>[String(index+1),line.itemName,`${Number(line.quantity)} ${line.unit||''}`.trim(),Number(line.unitPrice).toFixed(3),Number(line.lineTotal).toFixed(3)]) : [['1',purchase.description||'Purchase bill','1',Number(purchase.total).toFixed(3),Number(purchase.total).toFixed(3)]],
          notes: purchase.notes,
        },
        `${purchase.invoiceNumber}.pdf`
      );
      close();
    };
    void download();
  }, [purchase, close, itemsKey]);
  return null;
}
