import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { customerPayments, customerSales } from '@/lib/schema';
import { customerPaymentError } from '@/lib/customer-payment';
import { customerBalance, milli } from '@/lib/customer-balance';

const schema = z.object({ saleId: z.union([z.string().uuid(), z.literal('opening')]).optional(), date: z.string().date(), amount: z.coerce.number().positive().max(999999999999.99).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < .001), method: z.enum(['Cash', 'Card', 'Bank Transfer']), notes: z.string().max(1000).optional() });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json();
    const paymentError = customerPaymentError(body.amount);
    if (paymentError) return NextResponse.json({ error: paymentError }, { status: 400 });
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Enter a valid date and a payment greater than zero, with at most two decimal places.' }, { status: 400 });
    const { id } = await params;
    const data = parsed.data;
    const result = await db.transaction(async tx => {
      const balance = await customerBalance(tx, id);
      const amount = milli(data.amount);
      const invalid = customerPaymentError(data.amount, balance / 1000);
      if (invalid) throw Error(invalid);
      let saleId: string | null = null;
      if (data.saleId && data.saleId !== 'opening') {
        const [sale] = await tx.select().from(customerSales).where(eq(customerSales.id, data.saleId));
        if (!sale || sale.customerId !== id) throw Error('Sales invoice not found.');
        const due = milli(sale.total) - milli(sale.paid);
        if (amount > due) throw Error(`Payment cannot exceed AED ${(due / 1000).toFixed(3)}.`);
        saleId = sale.id;
        await tx.update(customerSales).set({ paid: ((milli(sale.paid) + amount) / 1000).toFixed(3) }).where(eq(customerSales.id, sale.id));
      }
      await tx.insert(customerPayments).values({ customerId: id, saleId, paymentDate: data.date, amount: (amount / 1000).toFixed(2), method: data.method, notes: data.notes || null });
      return { outstanding: (balance - amount) / 1000 };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to collect payment.' }, { status: 400 });
  }
}
