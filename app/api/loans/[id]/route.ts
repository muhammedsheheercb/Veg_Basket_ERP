import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { loanPayments, loans } from '@/lib/schema';

const updateSchema = z.object({
  name: z.string().trim().min(1, 'Lender or loan name is required.'),
  date: z.string().min(10, 'Valid loan date is required.'),
  emi: z.coerce.number().min(0, 'EMI cannot be negative.').default(0),
  nextEmiDate: z.string().date().optional().nullable().refine(value => !value || value >= new Date().toISOString().slice(0, 10), 'Next EMI date cannot be in the past.'),
  description: z.string().trim().max(1000).optional().nullable(),
  originalAmount: z.coerce.number().positive().optional(),
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [loan] = await db.select().from(loans).where(eq(loans.id, id));
    if (!loan) return NextResponse.json({ error: 'Loan not found.' }, { status: 404 });

    const payments = await db
      .select()
      .from(loanPayments)
      .where(eq(loanPayments.loanId, id))
      .orderBy(asc(loanPayments.paymentDate), asc(loanPayments.createdAt));

    // Calculate running balance for statement/ledger
    const original = Number(loan.originalAmount || loan.outstanding);
    let runningBalance = original;
    const paymentsWithBalance = payments.map((p) => {
      runningBalance -= Number(p.amount);
      return {
        ...p,
        balanceAfter: runningBalance < 0 ? 0 : runningBalance,
      };
    });

    return NextResponse.json({
      loan: {
        ...loan,
        originalAmount: loan.originalAmount || loan.outstanding,
      },
      payments: paymentsWithBalance,
    });
  } catch (err) {
    console.error('Failed to get loan details:', err);
    return NextResponse.json({ error: 'Failed to retrieve loan details.' }, { status: 500 });
  }
}

export async function PUT(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await r.json();
    const d = updateSchema.safeParse(body);
    if (!d.success) {
      const firstError = d.error.issues[0]?.message || 'Enter valid loan details.';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const [existing] = await db.select().from(loans).where(eq(loans.id, id));
    if (!existing) return NextResponse.json({ error: 'Loan not found.' }, { status: 404 });

    // Check if any payments have been recorded
    const existingPayments = await db
      .select({ id: loanPayments.id, amount: loanPayments.amount })
      .from(loanPayments)
      .where(eq(loanPayments.loanId, id));

    const totalPaid = existingPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    const updateData: Record<string, any> = {
      lender: d.data.name,
      loanDate: d.data.date,
      minimumEmi: String(d.data.emi),
      nextEmiAmount: String(d.data.emi),
      nextEmiDate: d.data.nextEmiDate || null,
      description: d.data.description || null,
    };

    // If originalAmount is provided
    if (d.data.originalAmount !== undefined) {
      if (d.data.originalAmount < totalPaid) {
        return NextResponse.json(
          { error: `Loan amount cannot be less than total paid amount (AED ${totalPaid.toFixed(2)}).` },
          { status: 400 }
        );
      }
      updateData.originalAmount = String(d.data.originalAmount);
      updateData.outstanding = String(d.data.originalAmount - totalPaid);
    }

    const [updated] = await db.update(loans).set(updateData).where(eq(loans.id, id)).returning();

    return NextResponse.json(updated);
  } catch (err) {
    console.error('Failed to update loan:', err);
    return NextResponse.json({ error: 'Failed to update loan details.' }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.transaction(async (tx) => {
      await tx.delete(loanPayments).where(eq(loanPayments.loanId, id));
      await tx.delete(loans).where(eq(loans.id, id));
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Failed to delete loan:', err);
    return NextResponse.json({ error: 'Failed to delete loan.' }, { status: 500 });
  }
}
