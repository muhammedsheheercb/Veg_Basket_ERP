import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { items, priceListItems, priceLists } from '@/lib/schema';

const schema = z.object({ customerName: z.string().trim().min(1).max(150), date: z.string().date(), items: z.array(z.object({ itemId: z.string().uuid(), quantity: z.string().trim().min(1).max(80), amount: z.coerce.number().min(0) })).min(1) });
const detail = async (id: string) => { const [list] = await db.select().from(priceLists).where(eq(priceLists.id, id)); if (!list) return null; const rows = await db.select({ id: priceListItems.id, itemId: items.id, itemName: items.name, itemCode: items.code, quantity: priceListItems.quantity, amount: priceListItems.lineTotal }).from(priceListItems).innerJoin(items, eq(priceListItems.itemId, items.id)).where(eq(priceListItems.priceListId, id)); return { ...list, items: rows }; };

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const row = await detail(id); return row ? NextResponse.json(row) : NextResponse.json({ error: 'Price list not found.' }, { status: 404 }); }

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = schema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: 'Enter a customer, date, and valid items.' }, { status: 400 });
  const { id } = await params;
  try { await db.transaction(async tx => { const listLines = parsed.data.items.map(x => ({ ...x, amount: Math.round(x.amount * 100) / 100 })); const all = await tx.select({ id: items.id }).from(items); if (listLines.some(line => !all.some(item => item.id === line.itemId))) throw new Error(); await tx.update(priceLists).set({ customerName: parsed.data.customerName, priceListDate: parsed.data.date, grandTotal: listLines.reduce((n, x) => n + x.amount, 0).toFixed(2) }).where(eq(priceLists.id, id)); await tx.delete(priceListItems).where(eq(priceListItems.priceListId, id)); await tx.insert(priceListItems).values(listLines.map(line => ({ priceListId: id, itemId: line.itemId, quantity: line.quantity, unitPrice: '0.00', lineTotal: line.amount.toFixed(2) }))); }); return NextResponse.json(await detail(id)); } catch { return NextResponse.json({ error: 'Unable to update price list.' }, { status: 500 }); }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const deleted = await db.transaction(async tx => {
      // Delete child rows explicitly so this works with price-list tables created
      // before the foreign-key cascade was added.
      await tx.delete(priceListItems).where(eq(priceListItems.priceListId, id));
      return tx.delete(priceLists).where(eq(priceLists.id, id)).returning({ id: priceLists.id });
    });

    return deleted.length
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: 'Price list not found.' }, { status: 404 });
  } catch {
    return NextResponse.json({ error: 'Unable to delete price list.' }, { status: 500 });
  }
}
