import { NextResponse } from 'next/server';
import { desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { items, priceListItems, priceLists } from '@/lib/schema';

const schema = z.object({ customerName: z.string().trim().min(1).max(150), date: z.string().date(), items: z.array(z.object({ itemId: z.string().uuid(), quantity: z.string().trim().min(1).max(80), amount: z.coerce.number().min(0).max(99999999) })).min(1) });

function lines(value: z.infer<typeof schema>) { return value.items.map(x => ({ ...x, amount: Math.round(x.amount * 100) / 100 })); }

export async function GET() {
  try {
    const rows = await db.select({ id: priceLists.id, number: priceLists.priceListNumber, customerName: priceLists.customerName, date: priceLists.priceListDate, grandTotal: priceLists.grandTotal }).from(priceLists).orderBy(desc(priceLists.priceListDate), desc(priceLists.createdAt));
    return NextResponse.json(rows);
  } catch { return NextResponse.json({ error: 'Unable to load price lists. Run the price-list database migration first.' }, { status: 503 }); }
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Enter a customer, date, and at least one valid item.' }, { status: 400 });
  try {
    const row = await db.transaction(async tx => {
      const listLines = lines(parsed.data);
      const validItems = await tx.select({ id: items.id }).from(items);
      if (listLines.some(line => !validItems.some(item => item.id === line.itemId))) throw new Error('Invalid item');
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('price_list_number'))`);
      const existing = await tx.select({ number: priceLists.priceListNumber }).from(priceLists);
      const high = existing.reduce((n, x) => Math.max(n, Number(/^PL-(\d+)$/.exec(x.number)?.[1] || 0)), 0);
      const total = listLines.reduce((n, line) => n + line.amount, 0);
      const [created] = await tx.insert(priceLists).values({ priceListNumber: `PL-${String(high + 1).padStart(5, '0')}`, customerName: parsed.data.customerName, priceListDate: parsed.data.date, grandTotal: total.toFixed(2) }).returning();
      await tx.insert(priceListItems).values(listLines.map(line => ({ priceListId: created.id, itemId: line.itemId, quantity: line.quantity, unitPrice: '0.00', lineTotal: line.amount.toFixed(2) })));
      return created;
    });
    return NextResponse.json(row, { status: 201 });
  } catch { return NextResponse.json({ error: 'Unable to create price list. Please try again.' }, { status: 500 }); }
}
