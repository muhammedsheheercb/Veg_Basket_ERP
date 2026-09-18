import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { loanPayments, loans } from '@/lib/schema';

const paymentSchema = z.object({
  date: z.string().min(10, 'Valid payment date is required.'),
  amount: z.coerce.number().positive('Payment amount must be greater than 0.'),
  method: z.string().trim().min(1).default('Cash'),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export async function POST(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await r.json();
    const d = paymentSchema.safeParse(body);
    if (!d.success) {
      const firstError = d.error.issues[0]?.message || 'Enter a valid EMI payment.';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${id}))`);
      const [loan] = await tx.select().from(loans).where(eq(loans.id, id));
      if (!loan) throw new Error('Loan not found.');

      const outstandingNum = Number(loan.outstanding);
      if (d.data.amount > outstandingNum) {
        throw new Error(`Payment cannot exceed outstanding balance of AED ${outstandingNum.toFixed(2)}.`);
      }

      const [payment] = await tx
        .insert(loanPayments)
        .values({
          loanId: id,
          paymentDate: d.data.date,
          amount: String(d.data.amount),
          method: d.data.method,
          notes: d.data.notes || null,
        })
        .returning();

      const newOutstanding = Math.max(0, outstandingNum - d.data.amount);
      const [updatedLoan] = await tx
        .update(loans)
        .set({
          outstanding: String(newOutstanding),
        })
        .where(eq(loans.id, id))
        .returning();

      return { loan: updatedLoan, payment };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('Failed to record EMI payment:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unable to record payment.' },
      { status: 400 }
    );
  }
}

export async function DELETE(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(r.url);
    let paymentId = searchParams.get('paymentId');

    if (!paymentId) {
      try {
        const body = await r.json();
        paymentId = body.paymentId;
      } catch {
        // searchParams fallback
      }
    }

    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID is required to reverse payment.' }, { status: 400 });
    }

    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${id}))`);

      const [payment] = await tx
        .select()
        .from(loanPayments)
        .where(and(eq(loanPayments.id, paymentId), eq(loanPayments.loanId, id)));

      if (!payment) {
        throw new Error('Payment record not found.');
      }

      const [loan] = await tx.select().from(loans).where(eq(loans.id, id));
      if (!loan) throw new Error('Loan not found.');

      await tx.delete(loanPayments).where(eq(loanPayments.id, paymentId));

      const newOutstanding = Number(loan.outstanding) + Number(payment.amount);
      const maxOriginal = Number(loan.originalAmount || newOutstanding);
      const safeOutstanding = Math.min(newOutstanding, maxOriginal);

      const [updatedLoan] = await tx
        .update(loans)
        .set({
          outstanding: String(safeOutstanding),
        })
        .where(eq(loans.id, id))
        .returning();

      return { loan: updatedLoan, reversedPaymentId: paymentId };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('Failed to reverse EMI payment:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unable to reverse payment.' },
      { status: 400 }
    );
  }
}
