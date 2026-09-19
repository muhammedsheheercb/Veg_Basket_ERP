// @ts-nocheck
import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customerSales, customers, saleItems } from '@/lib/schema';

const cents = (v: any) => {
  const s = String(v ?? '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [a, b = ''] = s.split('.');
  return +a * 100 + +(b + '00').slice(0, 2);
};
const valid = (x: string) => /^[0-9a-f-]{36}$/i.test(x);

function parseLine(x: any) {
  const itemId = String(x.itemId || '');
  if (!valid(itemId)) return null;
  const rawQty = String(x.quantity ?? '').trim();
  const match = rawQty.match(/^([\d.]+)\s*(.*)$/);
  const numQty = match ? parseFloat(match[1]) : 0;
  if (!numQty || numQty <= 0) return null;

  const unitStr = (match && match[2] ? match[2].trim() : (x.unit ? String(x.unit).trim() : '')) || null;
  let totalCents = cents(x.lineTotal);
  let priceCents = cents(x.unitPrice);

  if (totalCents === null && priceCents !== null) {
    totalCents = Math.round(numQty * priceCents);
  } else if (totalCents !== null && (priceCents === null || priceCents === 0)) {
    priceCents = Math.round(totalCents / numQty);
  }

  if (totalCents === null || priceCents === null) return null;

  return {
    itemId,
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
  const total = subtotal - discount;
  if (discount > subtotal || paid > total) return null;
  return { customerId: b.customerId, date: b.date, discount, paid, subtotal, total, method: b.method || null, notes: b.notes || null, lines };
}

export async function GET() {
  return NextResponse.json(await db.select({ id: customerSales.id, invoice: customerSales.invoiceNumber, date: customerSales.saleDate, total: customerSales.total, paid: customerSales.paid, customer: customers.name }).from(customerSales).innerJoin(customers, eq(customerSales.customerId, customers.id)).orderBy(desc(customerSales.saleDate)).limit(50));
}

export async function POST(r: Request) {
  try {
    const v = parse(await r.json());
    if (!v) return NextResponse.json({ error: 'Enter a customer, date, valid items and amounts.' }, { status: 400 });
    const sale = await db.transaction(async tx => {
      const c = await tx.select({ id: customerSales.id }).from(customerSales);
      const [row] = await tx.insert(customerSales).values({
        invoiceNumber: `SAL-${String(c.length + 1).padStart(5, '0')}`,
        customerId: v.customerId,
        saleDate: v.date,
        subtotal: (v.subtotal / 100).toFixed(2),
        discount: (v.discount / 100).toFixed(2),
        total: (v.total / 100).toFixed(2),
        paid: (v.paid / 100).toFixed(2),
        paymentMethod: v.method,
        notes: v.notes
      }).returning();
      await tx.insert(saleItems).values(v.lines.map(x => ({
        saleId: row.id,
        itemId: x.itemId,
        quantity: (x.quantity / 1000).toFixed(3),
        unit: x.unit || null,
        unitPrice: (x.unitPrice / 100).toFixed(2),
        lineTotal: (x.lineTotal / 100).toFixed(2)
      })));
      return row;
    });
    return NextResponse.json(sale, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Unable to create sale.' }, { status: 500 });
  }
}
