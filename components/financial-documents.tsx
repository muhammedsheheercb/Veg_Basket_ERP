'use client';

import Image from 'next/image';

export const money=(value:number|string)=>`AED ${Number(value).toLocaleString('en-AE',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
export const shortDate=(value?:string)=>value?String(value).slice(0,10):'—';

type Entry={date:string;type:string;reference:string;description:string;purchase:number;payment:number;balance:number;method?:string;status?:string;notes?:string};
export function FinancialDocument({kind,title,party,contact,address,summary,entries,description,notes}:{kind:'Supplier Statement'|'Customer Statement'|'Purchase Bill';title:string;party:string;contact?:string;address?:string;summary:[string,string][];entries:Entry[];description?:string;notes?:string}){
 return <article className="financial-document">
  <header className="document-header"><Image src="/images/logo.webp" alt="Veg Basket" width={62} height={68}/><div><h1>Veg Basket</h1><p>UAE Vegetable Trading</p></div><div className="document-title"><b>{kind}</b><strong>{title}</strong><small>Statement date: {shortDate(new Date().toISOString())}</small></div></header>
  <section className="document-party"><div><small>{kind==='Purchase Bill'?'Supplier':kind==='Customer Statement'?'Customer statement for':'Supplier statement for'}</small><b>{party}</b>{contact&&<span>{contact}</span>}{address&&<span>{address}</span>}</div>{description&&<div><small>Purchase description</small><p>{description}</p>{notes&&<><small>Notes</small><p>{notes}</p></>}</div>}</section>
  <section className="document-summary">{summary.map(([label,value])=><div key={label}><small>{label}</small><b>{value}</b></div>)}</section>
  <section className="document-history"><h2>{kind==='Purchase Bill'?'Financial Details':'Complete Transaction History'}</h2><div className="document-table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Description</th><th>{kind==='Customer Statement'?'Sale Amount':'Purchase'}</th><th>Payment</th><th>Balance</th><th>Method / Status</th></tr></thead><tbody>{entries.map((e,i)=><tr key={`${e.reference}-${i}`}><td>{shortDate(e.date)}</td><td>{e.type}</td><td>{e.reference}</td><td>{e.description}{e.notes&&<small className="doc-notes">{e.notes}</small>}</td><td>{e.purchase?money(e.purchase):'—'}</td><td>{e.payment?money(e.payment):'—'}</td><td><b>{money(e.balance)}</b></td><td>{e.method||'—'}{e.status&&<small className={`status ${e.status.toLowerCase()}`}>{e.status}</small>}</td></tr>)}</tbody></table></div></section>
  <footer>Thank you for doing business with Veg Basket.</footer>
 </article>
}
/** @deprecated PDF export is no longer available. */
export async function downloadDocumentPdf(_element?:HTMLElement,_fileName?:string){ return; }
