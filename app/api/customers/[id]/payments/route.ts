import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { customerPayments, customerSales, customers } from '@/lib/schema';

const schema = z.object({ saleId: z.union([z.string().uuid(), z.literal('opening')]), date: z.string().date(), amount: z.coerce.number().positive(), method: z.enum(['Cash', 'Card', 'Bank Transfer']), notes: z.string().max(1000).optional() });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid payment.' }, { status: 400 });
  try { const { id } = await params; const result = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${id + parsed.data.saleId}))`);
    if (parsed.data.saleId === 'opening') { const [customer] = await tx.select().from(customers).where(eq(customers.id, id)); if (!customer) throw Error('Customer was not found.'); const previous = await tx.select({ amount: customerPayments.amount }).from(customerPayments).where(sql`${customerPayments.customerId} = ${id} and ${customerPayments.saleId} is null`); const due = Number(customer.openingBalance) - previous.reduce((total, payment) => total + Number(payment.amount), 0); if (parsed.data.amount > due + .00001) throw Error(`Payment cannot exceed AED ${due.toFixed(2)}.`); await tx.insert(customerPayments).values({ customerId: id, saleId: null, paymentDate: parsed.data.date, amount: String(parsed.data.amount), method: parsed.data.method, notes: parsed.data.notes || null }); return { outstanding: due - parsed.data.amount }; }
    const [sale] = await tx.select().from(customerSales).where(eq(customerSales.id, parsed.data.saleId)); if (!sale || sale.customerId !== id) throw Error('Sales invoice not found.'); const due = Number(sale.total) - Number(sale.paid); if (parsed.data.amount > due + .00001) throw Error(`Payment cannot exceed AED ${due.toFixed(2)}.`); await tx.insert(customerPayments).values({ customerId: id, saleId: sale.id, paymentDate: parsed.data.date, amount: String(parsed.data.amount), method: parsed.data.method, notes: parsed.data.notes || null }); await tx.update(customerSales).set({ paid: String(Number(sale.paid) + parsed.data.amount) }).where(eq(customerSales.id, sale.id)); return { outstanding: due - parsed.data.amount };
  }); return NextResponse.json(result, { status: 201 }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to collect payment.' }, { status: 400 }); }
}
