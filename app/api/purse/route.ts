import { NextResponse } from 'next/server';
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  customerPayments,
  customerSales,
  customers,
  expenses,
  loanPayments,
  loans,
  purchases,
  purseAdditions,
  supplierPayments,
  suppliers,
  workerExpenses,
  workers,
} from '@/lib/schema';

const asNum = (v: unknown) => Number(v ?? 0);

const addMoneySchema = z.object({
  amount: z.coerce.number().positive({ message: 'Amount must be greater than zero.' }),
  method: z.enum(['Cash', 'Bank'], { message: 'Method must be Cash or Bank.' }),
  date: z
    .string()
    .date()
    .refine((d) => d <= new Date().toISOString().slice(0, 10), { message: 'Date cannot be in the future.' }),
  description: z.string().trim().max(500).optional(),
});

function isCash(method?: string | null): boolean {
  if (!method) return true;
  const m = method.toLowerCase().trim();
  return m === 'cash';
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const startDate = url.searchParams.get('startDate') || '';
    const endDate = url.searchParams.get('endDate') || '';
    const month = url.searchParams.get('month') || ''; // '1'..'12'
    const year = url.searchParams.get('year') || ''; // '2026'
    const search = url.searchParams.get('search')?.trim().toLowerCase() || '';
    const typeFilter = url.searchParams.get('typeFilter') || 'All';
    const methodFilter = url.searchParams.get('methodFilter') || 'All'; // 'All' | 'Cash' | 'Bank'
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = 10;

    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    // Fetch all transaction sources from DB
    const [
      additions,
      cSales,
      cPayments,
      purchasesList,
      sPayments,
      expensesList,
      wExpenses,
      lPayments,
    ] = await Promise.all([
      db.select().from(purseAdditions).orderBy(asc(purseAdditions.date), asc(purseAdditions.createdAt)),

      db
        .select({
          id: customerSales.id,
          date: customerSales.saleDate,
          ref: customerSales.invoiceNumber,
          party: customers.name,
          // `customerSales.paid` includes both the initial sale payment and later customer-payment records.
          // Show only the initial portion here; later payments are listed from customerPayments below.
          amount: sql<string>`greatest(${customerSales.paid} - coalesce((select sum(${customerPayments.amount}) from ${customerPayments} where ${customerPayments.saleId} = ${customerSales.id}), 0), 0)`,
          method: customerSales.paymentMethod,
          createdAt: customerSales.createdAt,
        })
        .from(customerSales)
        .innerJoin(customers, eq(customerSales.customerId, customers.id))
        .orderBy(asc(customerSales.saleDate), asc(customerSales.createdAt)),

      db
        .select({
          id: customerPayments.id,
          date: customerPayments.paymentDate,
          ref: sql<string>`'PAY-' || substr(${customerPayments.id}::text, 1, 8)`,
          party: customers.name,
          amount: customerPayments.amount,
          method: customerPayments.method,
          notes: customerPayments.notes,
          createdAt: customerPayments.createdAt,
        })
        .from(customerPayments)
        .innerJoin(customers, eq(customerPayments.customerId, customers.id))
        .orderBy(asc(customerPayments.paymentDate), asc(customerPayments.createdAt)),

      db
        .select({
          id: purchases.id,
          date: purchases.purchaseDate,
          ref: purchases.invoiceNumber,
          party: suppliers.name,
          // `purchases.paid` includes both the initial payment and later supplier-payment records.
          // Show only the initial portion here; later payments are listed from supplierPayments below.
          amount: sql<string>`greatest(${purchases.paid} - coalesce((select sum(${supplierPayments.amount}) from ${supplierPayments} where ${supplierPayments.purchaseId} = ${purchases.id}), 0), 0)`,
          method: purchases.paymentMethod,
          desc: purchases.description,
          createdAt: purchases.createdAt,
        })
        .from(purchases)
        .innerJoin(suppliers, eq(purchases.supplierId, suppliers.id))
        .orderBy(asc(purchases.purchaseDate), asc(purchases.createdAt)),

      db
        .select({
          id: supplierPayments.id,
          date: supplierPayments.paymentDate,
          ref: sql<string>`'SPAY-' || substr(${supplierPayments.id}::text, 1, 8)`,
          party: suppliers.name,
          amount: supplierPayments.amount,
          method: supplierPayments.method,
          notes: supplierPayments.notes,
          createdAt: supplierPayments.createdAt,
        })
        .from(supplierPayments)
        .innerJoin(suppliers, eq(supplierPayments.supplierId, suppliers.id))
        .orderBy(asc(supplierPayments.paymentDate), asc(supplierPayments.createdAt)),

      db
        .select({
          id: expenses.id,
          date: expenses.expenseDate,
          category: expenses.category,
          amount: expenses.amount,
          notes: expenses.notes,
        })
        .from(expenses)
        .where(sql`not exists (select 1 from ${workerExpenses} where ${workerExpenses.expenseId} = ${expenses.id})`)
        .orderBy(asc(expenses.expenseDate)),

      db
        .select({
          id: workerExpenses.id,
          date: workerExpenses.expenseDate,
          party: workers.name,
          purpose: workerExpenses.purpose,
          description: workerExpenses.description,
          amount: workerExpenses.amount,
          method: workerExpenses.method,
          createdAt: workerExpenses.createdAt,
        })
        .from(workerExpenses)
        .innerJoin(workers, eq(workerExpenses.workerId, workers.id))
        .orderBy(asc(workerExpenses.expenseDate), asc(workerExpenses.createdAt)),

      db
        .select({
          id: loanPayments.id,
          date: loanPayments.paymentDate,
          party: loans.lender,
          amount: loanPayments.amount,
          method: loanPayments.method,
          notes: loanPayments.notes,
          createdAt: loanPayments.createdAt,
        })
        .from(loanPayments)
        .innerJoin(loans, eq(loanPayments.loanId, loans.id))
        .orderBy(asc(loanPayments.paymentDate), asc(loanPayments.createdAt)),
    ]);

    // Build standardized transaction items
    type PurseTx = {
      id: string;
      date: string;
      type: string;
      description: string;
      party: string;
      method: string;
      isCash: boolean;
      direction: 'In' | 'Out';
      moneyIn: number;
      moneyOut: number;
      createdAt: string;
      isManual: boolean;
      cashBalance?: number;
      bankBalance?: number;
      totalBalance?: number;
    };

    const allTx: PurseTx[] = [];

    // 1. Manual Purse Additions (Money In)
    additions.forEach((r) => {
      const amt = asNum(r.amount);
      if (amt > 0) {
        const cashFlag = isCash(r.method);
        allTx.push({
          id: r.id,
          date: r.date,
          type: 'Money Added',
          description: r.description || 'Added to Purse',
          party: 'Self / Owner',
          method: cashFlag ? 'Cash' : 'Bank',
          isCash: cashFlag,
          direction: 'In',
          moneyIn: amt,
          moneyOut: 0,
          createdAt: new Date(r.createdAt).toISOString(),
          isManual: true,
        });
      }
    });

    // 2. Customer Sales (Money In)
    cSales.forEach((r) => {
      const amt = asNum(r.amount);
      if (amt > 0) {
        const cashFlag = isCash(r.method);
        allTx.push({
          id: r.id,
          date: r.date,
          type: 'Customer Sale',
          description: `Invoice ${r.ref}`,
          party: r.party,
          method: cashFlag ? 'Cash' : r.method || 'Bank',
          isCash: cashFlag,
          direction: 'In',
          moneyIn: amt,
          moneyOut: 0,
          createdAt: new Date(r.createdAt).toISOString(),
          isManual: false,
        });
      }
    });

    // 3. Customer Payments (Money In)
    cPayments.forEach((r) => {
      const amt = asNum(r.amount);
      if (amt > 0) {
        const cashFlag = isCash(r.method);
        allTx.push({
          id: r.id,
          date: r.date,
          type: 'Customer Payment',
          description: r.notes || `Receipt ${r.ref}`,
          party: r.party,
          method: cashFlag ? 'Cash' : r.method || 'Bank',
          isCash: cashFlag,
          direction: 'In',
          moneyIn: amt,
          moneyOut: 0,
          createdAt: new Date(r.createdAt).toISOString(),
          isManual: false,
        });
      }
    });

    // 4. Purchases (Money Out)
    purchasesList.forEach((r) => {
      const amt = asNum(r.amount);
      if (amt > 0) {
        const cashFlag = isCash(r.method);
        allTx.push({
          id: r.id,
          date: r.date,
          type: 'Purchase Payment',
          description: `Bill ${r.ref}${r.desc ? ` - ${r.desc}` : ''}`,
          party: r.party,
          method: cashFlag ? 'Cash' : r.method || 'Bank',
          isCash: cashFlag,
          direction: 'Out',
          moneyIn: 0,
          moneyOut: amt,
          createdAt: new Date(r.createdAt).toISOString(),
          isManual: false,
        });
      }
    });

    // 5. Supplier Payments (Money Out)
    sPayments.forEach((r) => {
      const amt = asNum(r.amount);
      if (amt > 0) {
        const cashFlag = isCash(r.method);
        allTx.push({
          id: r.id,
          date: r.date,
          type: 'Supplier Payment',
          description: r.notes || `Payment ${r.ref}`,
          party: r.party,
          method: cashFlag ? 'Cash' : r.method || 'Bank',
          isCash: cashFlag,
          direction: 'Out',
          moneyIn: 0,
          moneyOut: amt,
          createdAt: new Date(r.createdAt).toISOString(),
          isManual: false,
        });
      }
    });

    // 6. General Expenses (Money Out)
    expensesList.forEach((r) => {
      const amt = asNum(r.amount);
      if (amt > 0) {
        const cashFlag = true; // default cash for general expenses unless specified
        allTx.push({
          id: r.id,
          date: r.date,
          type: 'Expense',
          description: `${r.category}${r.notes ? `: ${r.notes}` : ''}`,
          party: r.category,
          method: 'Cash',
          isCash: cashFlag,
          direction: 'Out',
          moneyIn: 0,
          moneyOut: amt,
          createdAt: r.date + 'T00:00:00.000Z',
          isManual: false,
        });
      }
    });

    // 7. Worker Expenses (Money Out)
    wExpenses.forEach((r) => {
      const amt = asNum(r.amount);
      if (amt > 0) {
        const cashFlag = isCash(r.method);
        allTx.push({
          id: r.id,
          date: r.date,
          type: 'Worker Payment',
          description: `${r.purpose}${r.description ? ` - ${r.description}` : ''}`,
          party: r.party,
          method: cashFlag ? 'Cash' : r.method || 'Bank',
          isCash: cashFlag,
          direction: 'Out',
          moneyIn: 0,
          moneyOut: amt,
          createdAt: new Date(r.createdAt).toISOString(),
          isManual: false,
        });
      }
    });

    // 8. Loan Payments (Money Out)
    lPayments.forEach((r) => {
      const amt = asNum(r.amount);
      if (amt > 0) {
        const cashFlag = isCash(r.method);
        allTx.push({
          id: r.id,
          date: r.date,
          type: 'Loan Payment',
          description: `EMI Payment${r.notes ? `: ${r.notes}` : ''}`,
          party: r.party,
          method: cashFlag ? 'Cash' : r.method || 'Bank',
          isCash: cashFlag,
          direction: 'Out',
          moneyIn: 0,
          moneyOut: amt,
          createdAt: new Date(r.createdAt).toISOString(),
          isManual: false,
        });
      }
    });

    // Sort chronologically ascending to calculate correct historical running balances
    allTx.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.createdAt.localeCompare(b.createdAt);
    });

    let currentCash = 0;
    let currentBank = 0;

    let todayAdded = 0;
    let todaySpent = 0;

    // Calculate running balance per row across time
    const computedTx = allTx.map((tx) => {
      if (tx.isCash) {
        if (tx.direction === 'In') currentCash += tx.moneyIn;
        else currentCash -= tx.moneyOut;
      } else {
        if (tx.direction === 'In') currentBank += tx.moneyIn;
        else currentBank -= tx.moneyOut;
      }

      if (tx.date === today) {
        if (tx.direction === 'In') todayAdded += tx.moneyIn;
        else todaySpent += tx.moneyOut;
      }

      return {
        ...tx,
        cashBalance: currentCash,
        bankBalance: currentBank,
        totalBalance: currentCash + currentBank,
      };
    });

    // Reverse for displaying newest transactions first in history table
    const sortedNewestFirst = [...computedTx].reverse();

    // APPLY FILTERS to history table
    let filtered = sortedNewestFirst;

    // Date range filter
    if (startDate) {
      filtered = filtered.filter((t) => t.date >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((t) => t.date <= endDate);
    }

    // Month & Year filter
    if (month && year) {
      const mPadded = month.padStart(2, '0');
      const targetPrefix = `${year}-${mPadded}`;
      filtered = filtered.filter((t) => t.date.startsWith(targetPrefix));
    } else if (year) {
      filtered = filtered.filter((t) => t.date.startsWith(year));
    } else if (month) {
      const mPadded = month.padStart(2, '0');
      filtered = filtered.filter((t) => t.date.slice(5, 7) === mPadded);
    }

    // Transaction type filter
    if (typeFilter && typeFilter !== 'All') {
      filtered = filtered.filter((t) => t.type.toLowerCase() === typeFilter.toLowerCase());
    }

    // Method filter
    if (methodFilter && methodFilter !== 'All') {
      if (methodFilter === 'Cash') {
        filtered = filtered.filter((t) => t.isCash);
      } else if (methodFilter === 'Bank') {
        filtered = filtered.filter((t) => !t.isCash);
      }
    }

    // Search query filter
    if (search) {
      filtered = filtered.filter(
        (t) =>
          t.type.toLowerCase().includes(search) ||
          t.description.toLowerCase().includes(search) ||
          t.party.toLowerCase().includes(search) ||
          t.method.toLowerCase().includes(search)
      );
    }

    // Period metrics calculated from filtered set
    const periodMoneyIn = filtered.reduce((acc, t) => acc + t.moneyIn, 0);
    const periodMoneyOut = filtered.reduce((acc, t) => acc + t.moneyOut, 0);

    // Pagination
    const totalCount = filtered.length;
    const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
    const currentPage = Math.min(page, pageCount);
    const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    return NextResponse.json({
      summary: {
        totalBalance: currentCash + currentBank,
        cashBalance: currentCash,
        bankBalance: currentBank,
        todayAdded,
        todaySpent,
        periodMoneyIn,
        periodMoneyOut,
      },
      pagination: {
        page: currentPage,
        pageCount,
        pageSize,
        totalCount,
      },
      rows: pageRows,
    });
  } catch (error) {
    console.error('Purse API GET Error:', error);
    return NextResponse.json({ error: 'Failed to load purse balance & transactions.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const raw = await req.json();
    const parsed = addMoneySchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Enter valid money details.' },
        { status: 400 }
      );
    }

    const [row] = await db
      .insert(purseAdditions)
      .values({
        amount: String(parsed.data.amount),
        method: parsed.data.method,
        date: parsed.data.date,
        description: parsed.data.description || null,
      })
      .returning();

    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    console.error('Purse API POST Error:', error);
    return NextResponse.json({ error: 'Unable to add money to purse.' }, { status: 500 });
  }
}
