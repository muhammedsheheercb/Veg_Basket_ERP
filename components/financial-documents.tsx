'use client';

import Image from 'next/image';
import { FileText, Leaf, Mail, MapPin, Phone, WalletCards } from 'lucide-react';
import { useEffect, useState } from 'react';
import { downloadPdfFromElement } from '@/components/pdf-download';

export const money = (value: number | string) => `AED ${Number(value).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const shortDate = (value?: string) => value ? String(value).slice(0, 10) : '—';
type Entry = { date: string; type: string; reference: string; description: string; purchase: number; payment: number; balance: number; method?: string; status?: string; notes?: string };
type Business = { address: string; contactNumber: string; email: string };

export function FinancialDocument({ kind, title, party, contact, address, summary, entries, description, notes }: { kind: 'Supplier Statement' | 'Customer Statement' | 'Purchase Bill'; title: string; party: string; contact?: string; address?: string; summary: [string, string][]; entries: Entry[]; description?: string; notes?: string }) {
  const [business, setBusiness] = useState<Business | null>(null);
  const [preparedDate, setPreparedDate] = useState('');
  useEffect(() => { fetch('/api/business-settings').then(r => r.ok ? r.json() : null).then(setBusiness).catch(() => setBusiness(null)); setPreparedDate(shortDate(new Date().toISOString())); }, []);
  const partyLabel = kind === 'Customer Statement' ? 'Customer' : 'Supplier';
  const amountLabel = kind === 'Customer Statement' ? 'Sale Amount' : 'Purchase Amount';
  return <article className="financial-document branded-document">
    <header className="document-header">
      <div className="document-business"><Image src="/images/logo.webp" alt="Veg Basket" width={70} height={78} /><div><h1>Veg Basket</h1>{business?.address && <small><MapPin /> {business.address}</small>}{business?.contactNumber && <small><Phone /> {business.contactNumber}</small>}{business?.email && <small><Mail /> {business.email}</small>}</div></div>
      <div className="document-title"><b>{kind}</b><strong>{title}</strong>{preparedDate && <small>Prepared {preparedDate}</small>}</div>
    </header>
    <section className="document-party"><div><small>{partyLabel}</small><b>{party}</b>{contact && <span><Phone /> {contact}</span>}{address && <span><MapPin /> {address}</span>}</div><div className="document-description"><small>{kind === 'Purchase Bill' ? 'Purchase Details' : 'Statement Information'}</small><p>{description || `${kind} prepared for ${party}.`}</p>{notes && <p className="document-note"><FileText /> {notes}</p>}</div></section>
    <section className="document-summary">{summary.map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b></div>)}</section>
    <section className="document-history"><h2><WalletCards /> {kind === 'Purchase Bill' ? 'Financial Details' : 'Transaction History'}</h2><div className="document-table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Description</th><th>{amountLabel}</th><th>Payment</th><th>Balance</th><th>Method / Status</th></tr></thead><tbody>{entries.map((entry, index) => <tr key={`${entry.reference}-${index}`}><td data-label="Date">{shortDate(entry.date)}</td><td data-label="Type">{entry.type}</td><td data-label="Reference">{entry.reference}</td><td data-label="Description">{entry.description}{entry.notes && <small className="doc-notes">{entry.notes}</small>}</td><td data-label={amountLabel}>{entry.purchase ? money(entry.purchase) : '—'}</td><td data-label="Payment">{entry.payment ? money(entry.payment) : '—'}</td><td data-label="Balance"><b>{money(entry.balance)}</b></td><td data-label="Method / Status">{entry.method || '—'}{entry.status && <small className={`status ${entry.status.toLowerCase()}`}>{entry.status}</small>}</td></tr>)}</tbody></table></div></section>
    <footer className="document-footer"><span><Leaf /> Fresh Produce · Better Living</span><span>Thank you for doing business with Veg Basket.</span></footer>
  </article>;
}

export async function downloadDocumentPdf(element?: HTMLElement, fileName = 'veg-basket-document.pdf') {
  if (!element) return;
  await downloadPdfFromElement(element, fileName);
}
