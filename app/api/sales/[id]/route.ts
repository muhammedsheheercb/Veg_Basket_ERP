// @ts-nocheck
import { detail } from '@/lib/sale-detail';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customerPayments, customerSales, customers, items, saleItems } from '@/lib/schema';

const cents = (v: any) => {
  const s = String(v ?? '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [a, b = ''] = s.split('.');
  const amount = +a * 100 + +(b + '00').slice(0, 2);
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
  if (!Number.isFinite(numQty) || numQty <= 0 || numQty >= 100000000000) return null;

  const unitStr = (match && match[2] ? match[2].trim() : (x.unit ? String(x.unit).trim() : '')) || null;
  let totalCents = cents(x.lineTotal);
  let priceCents = cents(x.unitPrice);

  if (totalCents === null && priceCents !== null) {
    totalCents = Math.round(numQty * priceCents);
  } else if (totalCents !== null && (priceCents === null || priceCents === 0)) {
    priceCents = Math.round(totalCents / numQty);
  }

  if (totalCents === null || priceCents === null) return null;
  priceCents = Math.round(totalCents / numQty);
  if (priceCents >= 100000000000000) return null;

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
  const total = subtotal - discount;
  if (discount > subtotal || paid > total) return null;
  return { ...b, discount, paid, subtotal, total, lines };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await detail((await params).id);
  return s ? NextResponse.json(s) : NextResponse.json({ error: 'Sale not found.' }, { status: 404 });
}

export async function PUT(r: Request, { params }: { params: Promise<{ id: string }> }) {
  const v = parse(await r.json());
  if (!v) return NextResponse.json({ error: 'Enter valid invoice data.' }, { status: 400 });
  try {
    const id = (await params).id;
    const payments = await db.select().from(customerPayments).where(eq(customerPayments.saleId, id));
    if (v.paid < payments.reduce((n, p) => n + Number(p.amount) * 100, 0)) {
      return NextResponse.json({ error: 'Paid amount cannot be lower than recorded payments.' }, { status: 400 });
    }
    await db.transaction(async tx => {
      await tx.update(customerSales).set({
        customerId: v.customerId,
        saleDate: v.date,
        subtotal: (v.subtotal / 100).toFixed(2),
        discount: (v.discount / 100).toFixed(2),
        total: (v.total / 100).toFixed(2),
        paid: (v.paid / 100).toFixed(2),
        paymentMethod: v.method || null,
        notes: v.notes || null
      }).where(eq(customerSales.id, id));
      await tx.delete(saleItems).where(eq(saleItems.saleId, id));
      await tx.insert(saleItems).values(v.lines.map((x, position) => ({
        saleId: id,
        itemId: x.itemId,
        itemName: x.itemName,
        position,
        quantity: (x.quantity / 1000).toFixed(3),
        unit: x.unit || null,
        unitPrice: (x.unitPrice / 100).toFixed(2),
        lineTotal: (x.lineTotal / 100).toFixed(2)
      })));
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Unable to update sale.' }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id;
    await db.transaction(async tx => {
      await tx.delete(customerPayments).where(eq(customerPayments.saleId, id));
      await tx.delete(saleItems).where(eq(saleItems.saleId, id));
      await tx.delete(customerSales).where(eq(customerSales.id, id));
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Unable to delete sale.' }, { status: 500 });
  }
}
