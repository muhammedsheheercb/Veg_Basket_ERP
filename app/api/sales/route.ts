// @ts-nocheck
import { NextResponse } from 'next/server';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { splitSalePayment } from '@/lib/customer-balance';
import { salesPaymentError } from '@/lib/sales-payment';
import { customerSales, customers, saleItems } from '@/lib/schema';

const cents = (v: any) => {
  const s = String(v ?? '');
  if (!/^\d+(\.\d{1,3})?$/.test(s)) return null;
  const [a, b = ''] = s.split('.');
  const amount = +a * 1000 + +(b + '000').slice(0, 3);
  return Number.isSafeInteger(amount) && amount < 100000000000000 ? amount : null;
};
const valid = (x: string) => /^[0-9a-f-]{36}$/i.test(x);

function parseLine(x: any) {
  const itemId = String(x.itemId || '');
  const itemName = String(x.itemName || '').trim().toUpperCase();
  if (!itemName || itemName.length > 250 || (itemId && !valid(itemId))) return null;
  const rawQty = String(x.quantity ?? '').trim();
  const match = rawQty.match(/^(\d+(?:\.\d{1,3})?)\s*([^\d.].*)?$/);
  const numQty = match ? parseFloat(match[1]) : 0;
  if (!Number.isFinite(numQty) || numQty < 1 || numQty >= 100000000000) return null;

  const unitStr = (match && match[2] ? match[2].trim() : (x.unit ? String(x.unit).trim() : '')) || null;
  let totalCents = cents(x.lineTotal);
  let priceCents = cents(x.unitPrice);

  if (priceCents !== null) {
    // The server owns calculated amounts; never trust a submitted line total.
    totalCents = Math.round(numQty * priceCents);
  } else if (totalCents !== null) {
    // Preserve compatibility with older clients submitting only an amount.
    priceCents = Math.round(totalCents / numQty);
  }
  if (totalCents === null || priceCents === null || !Number.isSafeInteger(totalCents) || totalCents >= 100000000000000 || priceCents >= 100000000000000) return null;

  return {
    itemId: itemId || null,
    itemName,
    quantity: Math.round(numQty * 1000),
    unit: unitStr,
    unitPrice: priceCents,
    lineTotal: totalCents
  };
}

function parse(b: any) {
  const discount = cents(b.discount || '0'), paid = cents(b.paid || '0');
  const rawLines = Array.isArray(b.items) ? b.items : [];
  const lines = rawLines.map(parseLine);
  if (!valid(String(b.customerId)) || !/^\d{4}-\d{2}-\d{2}$/.test(b.date) || !lines.length || lines.some(x => !x) || discount === null || paid === null) return null;
  const subtotal = lines.reduce((n: number, x) => n + x.lineTotal, 0);
  if (!Number.isSafeInteger(subtotal) || subtotal >= 100000000000000) return null;
  const total = subtotal - discount;
  if (discount > subtotal || (b.accountPayment !== true && paid > total)) return null;
  return { customerId: b.customerId, date: b.date, discount, paid, subtotal, total, method: b.method || null, notes: b.notes || null, accountPayment: b.accountPayment === true, lines };
}

export async function GET() {
  return NextResponse.json(await db.select({ id: customerSales.id, invoice: customerSales.invoiceNumber, date: customerSales.saleDate, total: customerSales.total, paid: customerSales.paid, customer: customers.name }).from(customerSales).innerJoin(customers, eq(customerSales.customerId, customers.id)).orderBy(desc(customerSales.createdAt), desc(customerSales.invoiceNumber), desc(customerSales.id)), { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(r: Request) {
  try {
    const body = await r.json();
    const paymentError = salesPaymentError(body.paid);
    if (paymentError) return NextResponse.json({ error: paymentError }, { status: 400 });
    const v = parse(body);
    if (!v && body.accountPayment !== true) {
      const invoice = parse({ ...body, accountPayment: true });
      if (invoice && salesPaymentError(body.paid, invoice.total)) return NextResponse.json({ error: salesPaymentError(body.paid, invoice.total) }, { status: 400 });
    }
    if (!v) return NextResponse.json({ error: 'Enter a customer, date, valid items and amounts.' }, { status: 400 });
    const sale = await db.transaction(async tx => {
      // A count is not an invoice sequence: deleted invoices or historic gaps
      // would cause a duplicate number. The transaction lock also prevents two
      // simultaneous requests from choosing the same next number.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('customer_sales_invoice_number'))`);
      const existing = await tx.select({ invoiceNumber: customerSales.invoiceNumber }).from(customerSales);
      const highestInvoice = existing.reduce((highest, { invoiceNumber }) => {
        const match = /^SAL-(\d+)$/.exec(invoiceNumber);
        return match ? Math.max(highest, Number(match[1])) : highest;
      }, 0);
      const summary = v.accountPayment ? await splitSalePayment(tx, v) : { invoicePaid: v.paid, existingBalance: 0, accountPaid: 0, accountPaymentId: null };
      const [row] = await tx.insert(customerSales).values({
        invoiceNumber: `SAL-${String(highestInvoice + 1).padStart(5, '0')}`,
        customerId: v.customerId,
        saleDate: v.date,
        subtotal: (v.subtotal / 1000).toFixed(3),
        discount: (v.discount / 1000).toFixed(3),
        total: (v.total / 1000).toFixed(3),
        paid: (summary.invoicePaid / 1000).toFixed(3),
        existingBalance: (summary.existingBalance / 1000).toFixed(3),
        accountPaid: (summary.accountPaid / 1000).toFixed(3),
        accountPaymentId: summary.accountPaymentId,
        paymentMethod: v.method,
        notes: v.notes
      }).returning();
      await tx.insert(saleItems).values(v.lines.map((x, position) => ({
        saleId: row.id,
        itemId: x.itemId,
        itemName: x.itemName,
        position,
        quantity: (x.quantity / 1000).toFixed(3),
        unit: x.unit || null,
        unitPrice: (x.unitPrice / 1000).toFixed(3),
        lineTotal: (x.lineTotal / 1000).toFixed(3)
      })));
      return row;
    });
    return NextResponse.json(sale, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create sale.' }, { status: 400 });
  }
}
