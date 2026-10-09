// @ts-nocheck
import { detail } from '@/lib/sale-detail';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customerPayments, customerSales, customers, items, saleItems } from '@/lib/schema';

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
    if (v.paid < payments.reduce((n, p) => n + Number(p.amount) * 1000, 0)) {
      return NextResponse.json({ error: 'Paid amount cannot be lower than recorded payments.' }, { status: 400 });
    }
    await db.transaction(async tx => {
      await tx.update(customerSales).set({
        customerId: v.customerId,
        saleDate: v.date,
        subtotal: (v.subtotal / 1000).toFixed(3),
        discount: (v.discount / 1000).toFixed(3),
        total: (v.total / 1000).toFixed(3),
        paid: (v.paid / 1000).toFixed(3),
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
        unitPrice: (x.unitPrice / 1000).toFixed(3),
        lineTotal: (x.lineTotal / 1000).toFixed(3)
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
