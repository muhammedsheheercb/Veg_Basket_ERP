import { NextResponse } from 'next/server';
import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { loanPayments, loans } from '@/lib/schema';

const schema = z.object({
  name: z.string().trim().min(1, 'Lender or loan name is required.'),
  amount: z.coerce.number().positive('Loan amount must be greater than 0.'),
  date: z.string().min(10, 'Valid loan date is required.'),
  emi: z.coerce.number().min(0, 'EMI cannot be negative.').default(0),
  nextEmiDate: z.string().date().optional().nullable().refine(value => !value || value >= new Date().toISOString().slice(0, 10), 'Next EMI date cannot be in the past.'),
  description: z.string().trim().max(1000).optional().nullable(),
});

export async function GET() {
  try {
    const rows = await db
      .select({
        id: loans.id,
        name: loans.lender,
        original: sql<string>`coalesce(${loans.originalAmount}, ${loans.outstanding})`,
        outstanding: loans.outstanding,
        date: loans.loanDate,
        emi: sql<string>`coalesce(${loans.minimumEmi}, '0')`,
        nextEmiDate: loans.nextEmiDate,
        nextEmiAmount: sql<string>`coalesce(${loans.nextEmiAmount}, ${loans.minimumEmi}, '0')`,
        description: loans.description,
        payments: sql<number>`coalesce(count(${loanPayments.id}), 0)::int`,
        paid: sql<string>`coalesce(sum(${loanPayments.amount}), '0')`,
      })
      .from(loans)
      .leftJoin(loanPayments, eq(loanPayments.loanId, loans.id))
      .groupBy(loans.id)
      .orderBy(desc(loans.loanDate), desc(loans.id));

    return NextResponse.json(rows);
  } catch (err) {
    console.error('Failed to fetch loans:', err);
    return NextResponse.json({ error: 'Failed to load loans.' }, { status: 500 });
  }
}

export async function POST(r: Request) {
  try {
    const body = await r.json();
    const d = schema.safeParse(body);
    if (!d.success) {
      const firstError = d.error.issues[0]?.message || 'Enter valid loan details.';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const [created] = await db
      .insert(loans)
      .values({
        lender: d.data.name,
        originalAmount: String(d.data.amount),
        outstanding: String(d.data.amount),
        loanDate: d.data.date,
        minimumEmi: String(d.data.emi),
        nextEmiAmount: String(d.data.emi),
        nextEmiDate: d.data.nextEmiDate || null,
        description: d.data.description || null,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('Failed to create loan:', err);
    return NextResponse.json({ error: 'Failed to create loan. Please try again.' }, { status: 500 });
  }
}
