import { NextResponse } from 'next/server';
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  customerPayments,
  customerSales,
  customers,
  expenses,
  loanPayments,
  loans,
  purchases,
  sales,
  supplierPayments,
  suppliers,
  workerExpenses,
  workers,
} from '@/lib/schema';

const asNum = (v: unknown) => Number(v ?? 0);
const sum = (field: any) => sql<string>`coalesce(sum(${field}), 0)`;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'sales';
    const startDate = url.searchParams.get('startDate') || '';
    const endDate = url.searchParams.get('endDate') || '';
    const search = url.searchParams.get('search')?.trim().toLowerCase() || '';
    const category = url.searchParams.get('category') || '';
    const workerId = url.searchParams.get('workerId') || '';
    const paymentMethod = url.searchParams.get('paymentMethod') || '';

    // 1. SALES REPORT
    if (type === 'sales') {
      const conditions = [];
      if (startDate) conditions.push(gte(customerSales.saleDate, startDate));
      if (endDate) conditions.push(lte(customerSales.saleDate, endDate));

      const rows = await db
        .select({
          id: customerSales.id,
          invoiceNumber: customerSales.invoiceNumber,
          customerName: customers.name,
          saleDate: customerSales.saleDate,
          subtotal: customerSales.subtotal,
          discount: customerSales.discount,
          total: customerSales.total,
          paid: customerSales.paid,
          paymentMethod: customerSales.paymentMethod,
          notes: customerSales.notes,
        })
        .from(customerSales)
        .innerJoin(customers, eq(customerSales.customerId, customers.id))
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(customerSales.saleDate), desc(customerSales.createdAt));

      // Legacy sales
      const legacyConditions = [];
      if (startDate) legacyConditions.push(gte(sales.saleDate, startDate));
      if (endDate) legacyConditions.push(lte(sales.saleDate, endDate));

      const legacyRows = await db
        .select({
          id: sales.id,
          invoiceNumber: sales.invoiceNumber,
          customerName: sales.customerName,
          saleDate: sales.saleDate,
          subtotal: sales.total,
          discount: sql<string>`'0'`,
          total: sales.total,
          paid: sales.paid,
          paymentMethod: sql<string>`'Cash'`,
          notes: sql<string>`''`,
        })
        .from(sales)
        .where(legacyConditions.length ? and(...legacyConditions) : undefined)
        .orderBy(desc(sales.saleDate));

      let allRows = [...rows, ...legacyRows].map((r) => {
        const totalNum = asNum(r.total);
        const paidNum = asNum(r.paid);
        const balanceNum = Math.max(0, totalNum - paidNum);
        const status = paidNum >= totalNum ? 'Paid' : paidNum > 0 ? 'Partial' : 'Unpaid';
        return {
          id: r.id,
          invoiceNumber: r.invoiceNumber,
          customerName: r.customerName,
          saleDate: r.saleDate,
          subtotal: asNum(r.subtotal),
          discount: asNum(r.discount),
          total: totalNum,
          paid: paidNum,
          balance: balanceNum,
          paymentMethod: r.paymentMethod || 'Unspecified',
          status,
          notes: r.notes || '',
        };
      });

      if (search) {
        allRows = allRows.filter(
          (r) =>
            r.invoiceNumber.toLowerCase().includes(search) ||
            r.customerName.toLowerCase().includes(search) ||
            r.paymentMethod.toLowerCase().includes(search)
        );
      }

      const totalSales = allRows.reduce((acc, r) => acc + r.total, 0);
      const totalPaid = allRows.reduce((acc, r) => acc + r.paid, 0);
      const totalOutstanding = allRows.reduce((acc, r) => acc + r.balance, 0);
      const count = allRows.length;
      const avgInvoiceValue = count > 0 ? totalSales / count : 0;

      return NextResponse.json({
        type: 'sales',
        startDate,
        endDate,
        metrics: {
          totalSales,
          totalPaid,
          totalOutstanding,
          count,
          avgInvoiceValue,
        },
        rows: allRows,
      });
    }

    // 2. PURCHASE REPORT
    if (type === 'purchases') {
      const conditions = [];
      if (startDate) conditions.push(gte(purchases.purchaseDate, startDate));
      if (endDate) conditions.push(lte(purchases.purchaseDate, endDate));

      const rows = await db
        .select({
          id: purchases.id,
          invoiceNumber: purchases.invoiceNumber,
          supplierName: suppliers.name,
          purchaseDate: purchases.purchaseDate,
          description: purchases.description,
          total: purchases.total,
          paid: purchases.paid,
          paymentMethod: purchases.paymentMethod,
          notes: purchases.notes,
        })
        .from(purchases)
        .innerJoin(suppliers, eq(purchases.supplierId, suppliers.id))
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(purchases.purchaseDate), desc(purchases.createdAt));

      let processed = rows.map((r) => {
        const totalNum = asNum(r.total);
        const paidNum = asNum(r.paid);
        const balanceNum = Math.max(0, totalNum - paidNum);
        const status = paidNum >= totalNum ? 'Paid' : paidNum > 0 ? 'Partial' : 'Unpaid';
        return {
          id: r.id,
          invoiceNumber: r.invoiceNumber,
          supplierName: r.supplierName,
          purchaseDate: r.purchaseDate,
          description: r.description || '',
          total: totalNum,
          paid: paidNum,
          balance: balanceNum,
          paymentMethod: r.paymentMethod || 'Unspecified',
          status,
          notes: r.notes || '',
        };
      });

      if (search) {
        processed = processed.filter(
          (r) =>
            r.invoiceNumber.toLowerCase().includes(search) ||
            r.supplierName.toLowerCase().includes(search) ||
            r.description.toLowerCase().includes(search) ||
            r.paymentMethod.toLowerCase().includes(search)
        );
      }

      const totalPurchases = processed.reduce((acc, r) => acc + r.total, 0);
      const totalPaid = processed.reduce((acc, r) => acc + r.paid, 0);
      const totalOutstanding = processed.reduce((acc, r) => acc + r.balance, 0);
      const count = processed.length;
      const avgPurchaseValue = count > 0 ? totalPurchases / count : 0;

      return NextResponse.json({
        type: 'purchases',
        startDate,
        endDate,
        metrics: {
          totalPurchases,
          totalPaid,
          totalOutstanding,
          count,
          avgPurchaseValue,
        },
        rows: processed,
      });
    }

    // 3. EXPENSE REPORT
    if (type === 'expenses') {
      const conditions = [];
      if (startDate) conditions.push(gte(expenses.expenseDate, startDate));
      if (endDate) conditions.push(lte(expenses.expenseDate, endDate));
      if (category && category !== 'All') conditions.push(eq(expenses.category, category));

      const rows = await db
        .select({
          id: expenses.id,
          category: expenses.category,
          expenseDate: expenses.expenseDate,
          amount: expenses.amount,
          notes: expenses.notes,
        })
        .from(expenses)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(expenses.expenseDate));

      let processed = rows.map((r) => ({
        id: r.id,
        category: r.category,
        expenseDate: r.expenseDate,
        amount: asNum(r.amount),
        notes: r.notes || '',
      }));

      if (search) {
        processed = processed.filter(
          (r) => r.category.toLowerCase().includes(search) || r.notes.toLowerCase().includes(search)
        );
      }

      const totalExpenses = processed.reduce((acc, r) => acc + r.amount, 0);
      const count = processed.length;
      const avgExpense = count > 0 ? totalExpenses / count : 0;

      // Category breakdown
      const catMap = new Map<string, { total: number; count: number }>();
      processed.forEach((r) => {
        const existing = catMap.get(r.category) || { total: 0, count: 0 };
        catMap.set(r.category, {
          total: existing.total + r.amount,
          count: existing.count + 1,
        });
      });

      const categoryBreakdown = Array.from(catMap.entries())
        .map(([catName, data]) => ({
          category: catName,
          total: data.total,
          count: data.count,
          percentage: totalExpenses > 0 ? Math.round((data.total / totalExpenses) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.total - a.total);

      return NextResponse.json({
        type: 'expenses',
        startDate,
        endDate,
        metrics: {
          totalExpenses,
          count,
          avgExpense,
        },
        categoryBreakdown,
        rows: processed,
      });
    }

    // 4. CUSTOMER OUTSTANDING REPORT
    if (type === 'customer_outstanding') {
      const custList = await db
        .select({
          id: customers.id,
          name: customers.name,
          mobile: customers.mobile,
          address: customers.address,
          openingBalance: customers.openingBalance,
          totalSales: sum(customerSales.total),
          totalPaidOnSales: sum(customerSales.paid),
        })
        .from(customers)
        .leftJoin(customerSales, eq(customerSales.customerId, customers.id))
        .groupBy(customers.id)
        .orderBy(asc(customers.name));

      // Get direct customer payments
      const extraPayments = await db
        .select({
          customerId: customerPayments.customerId,
          totalExtraPaid: sum(customerPayments.amount),
        })
        .from(customerPayments)
        .groupBy(customerPayments.customerId);

      const extraMap = new Map<string, number>();
      extraPayments.forEach((p) => extraMap.set(p.customerId, asNum(p.totalExtraPaid)));

      let processed = custList.map((c) => {
        const opening = asNum(c.openingBalance);
        const tSales = asNum(c.totalSales);
        // Note: customerSales.paid already accounts for sales-attached paid, extra payments are in customerPayments
        // Avoid double counting if customerPayments.saleId is attached to customerSales.
        // Actually: total Paid = tSales - unpaid balances or max(tSales, totalPaidOnSales + extraPayments)
        const tSalesPaid = asNum(c.totalPaidOnSales);
        const extraPaid = extraMap.get(c.id) || 0;
        const totalPaid = tSalesPaid; // in this schema customerSales.paid stores current paid amount on sales
        const balance = Math.max(0, opening + tSales - totalPaid);
        const status = balance <= 0 ? 'Clear' : 'Outstanding';

        return {
          id: c.id,
          customerName: c.name,
          mobile: c.mobile,
          address: c.address || '',
          openingBalance: opening,
          totalSales: tSales,
          totalPaid: totalPaid,
          balance: balance,
          status,
        };
      });

      if (search) {
        processed = processed.filter(
          (c) =>
            c.customerName.toLowerCase().includes(search) ||
            c.mobile.toLowerCase().includes(search) ||
            c.address.toLowerCase().includes(search)
        );
      }

      const totalOpeningBalance = processed.reduce((acc, c) => acc + c.openingBalance, 0);
      const totalSales = processed.reduce((acc, c) => acc + c.totalSales, 0);
      const totalPaid = processed.reduce((acc, c) => acc + c.totalPaid, 0);
      const totalOutstanding = processed.reduce((acc, c) => acc + c.balance, 0);
      const customerCount = processed.filter((c) => c.balance > 0).length;

      return NextResponse.json({
        type: 'customer_outstanding',
        startDate,
        endDate,
        metrics: {
          totalOpeningBalance,
          totalSales,
          totalPaid,
          totalOutstanding,
          customerCount,
          totalCustomers: processed.length,
        },
        rows: processed.sort((a, b) => b.balance - a.balance),
      });
    }

    // 5. SUPPLIER OUTSTANDING REPORT
    if (type === 'supplier_outstanding') {
      const suppList = await db
        .select({
          id: suppliers.id,
          name: suppliers.name,
          mobile: suppliers.mobile,
          address: suppliers.address,
          openingBalance: suppliers.openingBalance,
          totalPurchases: sum(purchases.total),
          totalPaidOnPurchases: sum(purchases.paid),
        })
        .from(suppliers)
        .leftJoin(purchases, eq(purchases.supplierId, suppliers.id))
        .groupBy(suppliers.id)
        .orderBy(asc(suppliers.name));

      let processed = suppList.map((s) => {
        const opening = asNum(s.openingBalance);
        const tPurchases = asNum(s.totalPurchases);
        const tPaid = asNum(s.totalPaidOnPurchases);
        const balance = Math.max(0, opening + tPurchases - tPaid);
        const status = balance <= 0 ? 'Clear' : 'Payable';

        return {
          id: s.id,
          supplierName: s.name,
          mobile: s.mobile,
          address: s.address || '',
          openingBalance: opening,
          totalPurchases: tPurchases,
          totalPaid: tPaid,
          balance: balance,
          status,
        };
      });

      if (search) {
        processed = processed.filter(
          (s) =>
            s.supplierName.toLowerCase().includes(search) ||
            s.mobile.toLowerCase().includes(search) ||
            s.address.toLowerCase().includes(search)
        );
      }

      const totalOpeningBalance = processed.reduce((acc, s) => acc + s.openingBalance, 0);
      const totalPurchases = processed.reduce((acc, s) => acc + s.totalPurchases, 0);
      const totalPaid = processed.reduce((acc, s) => acc + s.totalPaid, 0);
      const totalOutstanding = processed.reduce((acc, s) => acc + s.balance, 0);
      const supplierCount = processed.filter((s) => s.balance > 0).length;

      return NextResponse.json({
        type: 'supplier_outstanding',
        startDate,
        endDate,
        metrics: {
          totalOpeningBalance,
          totalPurchases,
          totalPaid,
          totalOutstanding,
          supplierCount,
          totalSuppliers: processed.length,
        },
        rows: processed.sort((a, b) => b.balance - a.balance),
      });
    }

    // 6. WORKER EXPENSE REPORT
    if (type === 'worker_expenses') {
      const conditions = [];
      if (startDate) conditions.push(gte(workerExpenses.expenseDate, startDate));
      if (endDate) conditions.push(lte(workerExpenses.expenseDate, endDate));
      if (workerId && workerId !== 'All') conditions.push(eq(workerExpenses.workerId, workerId));

      const rows = await db
        .select({
          id: workerExpenses.id,
          workerId: workerExpenses.workerId,
          workerName: workers.name,
          expenseDate: workerExpenses.expenseDate,
          purpose: workerExpenses.purpose,
          description: workerExpenses.description,
          amount: workerExpenses.amount,
          method: workerExpenses.method,
        })
        .from(workerExpenses)
        .innerJoin(workers, eq(workerExpenses.workerId, workers.id))
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(workerExpenses.expenseDate), desc(workerExpenses.createdAt));

      let processed = rows.map((r) => ({
        id: r.id,
        workerId: r.workerId,
        workerName: r.workerName,
        expenseDate: r.expenseDate,
        purpose: r.purpose,
        description: r.description || '',
        amount: asNum(r.amount),
        method: r.method,
      }));

      if (search) {
        processed = processed.filter(
          (r) =>
            r.workerName.toLowerCase().includes(search) ||
            r.purpose.toLowerCase().includes(search) ||
            r.description.toLowerCase().includes(search) ||
            r.method.toLowerCase().includes(search)
        );
      }

      const totalWorkerExpenses = processed.reduce((acc, r) => acc + r.amount, 0);
      const count = processed.length;

      // Worker breakdown
      const wMap = new Map<string, { total: number; count: number }>();
      processed.forEach((r) => {
        const existing = wMap.get(r.workerName) || { total: 0, count: 0 };
        wMap.set(r.workerName, {
          total: existing.total + r.amount,
          count: existing.count + 1,
        });
      });

      const workerBreakdown = Array.from(wMap.entries())
        .map(([wName, data]) => ({
          workerName: wName,
          total: data.total,
          count: data.count,
          percentage: totalWorkerExpenses > 0 ? Math.round((data.total / totalWorkerExpenses) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.total - a.total);

      return NextResponse.json({
        type: 'worker_expenses',
        startDate,
        endDate,
        metrics: {
          totalWorkerExpenses,
          count,
          avgPerEntry: count > 0 ? totalWorkerExpenses / count : 0,
        },
        workerBreakdown,
        rows: processed,
      });
    }

    // 7. LOAN OUTSTANDING REPORT
    if (type === 'loan_outstanding') {
      const loanList = await db.select().from(loans).orderBy(asc(loans.lender));

      // Get payments during date range or overall
      const payConditions = [];
      if (startDate) payConditions.push(gte(loanPayments.paymentDate, startDate));
      if (endDate) payConditions.push(lte(loanPayments.paymentDate, endDate));

      const periodPayments = await db
        .select({
          loanId: loanPayments.loanId,
          totalPaid: sum(loanPayments.amount),
        })
        .from(loanPayments)
        .where(payConditions.length ? and(...payConditions) : undefined)
        .groupBy(loanPayments.loanId);

      const periodPayMap = new Map<string, number>();
      periodPayments.forEach((p) => periodPayMap.set(p.loanId, asNum(p.totalPaid)));

      let processed = loanList.map((l) => {
        const orig = asNum(l.originalAmount);
        const out = asNum(l.outstanding);
        const paidInPeriod = periodPayMap.get(l.id) || 0;
        const status = out <= 0 ? 'Closed' : 'Active';

        return {
          id: l.id,
          lender: l.lender,
          originalAmount: orig,
          outstanding: out,
          loanDate: l.loanDate || '',
          minimumEmi: asNum(l.minimumEmi),
          description: l.description || '',
          nextEmiDate: l.nextEmiDate || '',
          nextEmiAmount: asNum(l.nextEmiAmount),
          totalPaidInPeriod: paidInPeriod,
          status,
        };
      });

      if (search) {
        processed = processed.filter(
          (l) => l.lender.toLowerCase().includes(search) || l.description.toLowerCase().includes(search)
        );
      }

      const totalOriginalAmount = processed.reduce((acc, l) => acc + l.originalAmount, 0);
      const totalOutstanding = processed.reduce((acc, l) => acc + l.outstanding, 0);
      const totalPaidInPeriod = processed.reduce((acc, l) => acc + l.totalPaidInPeriod, 0);
      const activeLoanCount = processed.filter((l) => l.outstanding > 0).length;

      return NextResponse.json({
        type: 'loan_outstanding',
        startDate,
        endDate,
        metrics: {
          totalOriginalAmount,
          totalOutstanding,
          totalPaidInPeriod,
          activeLoanCount,
          totalLoans: processed.length,
        },
        rows: processed.sort((a, b) => b.outstanding - a.outstanding),
      });
    }

    // 8. PAYMENT-METHOD REPORT
    if (type === 'payment_methods') {
      const cSalesCond = [];
      if (startDate) cSalesCond.push(gte(customerSales.saleDate, startDate));
      if (endDate) cSalesCond.push(lte(customerSales.saleDate, endDate));

      const cPayCond = [];
      if (startDate) cPayCond.push(gte(customerPayments.paymentDate, startDate));
      if (endDate) cPayCond.push(lte(customerPayments.paymentDate, endDate));

      const purCond = [];
      if (startDate) purCond.push(gte(purchases.purchaseDate, startDate));
      if (endDate) purCond.push(lte(purchases.purchaseDate, endDate));

      const sPayCond = [];
      if (startDate) sPayCond.push(gte(supplierPayments.paymentDate, startDate));
      if (endDate) sPayCond.push(lte(supplierPayments.paymentDate, endDate));

      const expCond = [];
      if (startDate) expCond.push(gte(expenses.expenseDate, startDate));
      if (endDate) expCond.push(lte(expenses.expenseDate, endDate));

      const wExpCond = [];
      if (startDate) wExpCond.push(gte(workerExpenses.expenseDate, startDate));
      if (endDate) wExpCond.push(lte(workerExpenses.expenseDate, endDate));

      const lPayCond = [];
      if (startDate) lPayCond.push(gte(loanPayments.paymentDate, startDate));
      if (endDate) lPayCond.push(lte(loanPayments.paymentDate, endDate));

      const [cSalesRows, cPayRows, purRows, sPayRows, expRows, wExpRows, lPayRows] = await Promise.all([
        db
          .select({
            id: customerSales.id,
            date: customerSales.saleDate,
            ref: customerSales.invoiceNumber,
            party: customers.name,
            method: customerSales.paymentMethod,
            amount: customerSales.paid,
          })
          .from(customerSales)
          .innerJoin(customers, eq(customerSales.customerId, customers.id))
          .where(cSalesCond.length ? and(...cSalesCond) : undefined),

        db
          .select({
            id: customerPayments.id,
            date: customerPayments.paymentDate,
            ref: sql<string>`'PAY-' || substr(${customerPayments.id}::text, 1, 8)`,
            party: customers.name,
            method: customerPayments.method,
            amount: customerPayments.amount,
          })
          .from(customerPayments)
          .innerJoin(customers, eq(customerPayments.customerId, customers.id))
          .where(cPayCond.length ? and(...cPayCond) : undefined),

        db
          .select({
            id: purchases.id,
            date: purchases.purchaseDate,
            ref: purchases.invoiceNumber,
            party: suppliers.name,
            method: purchases.paymentMethod,
            amount: purchases.paid,
          })
          .from(purchases)
          .innerJoin(suppliers, eq(purchases.supplierId, suppliers.id))
          .where(purCond.length ? and(...purCond) : undefined),

        db
          .select({
            id: supplierPayments.id,
            date: supplierPayments.paymentDate,
            ref: sql<string>`'SPAY-' || substr(${supplierPayments.id}::text, 1, 8)`,
            party: suppliers.name,
            method: supplierPayments.method,
            amount: supplierPayments.amount,
          })
          .from(supplierPayments)
          .innerJoin(suppliers, eq(supplierPayments.supplierId, suppliers.id))
          .where(sPayCond.length ? and(...sPayCond) : undefined),

        db
          .select({
            id: expenses.id,
            date: expenses.expenseDate,
            ref: sql<string>`'EXP-' || substr(${expenses.id}::text, 1, 8)`,
            party: expenses.category,
            method: sql<string>`'Cash'`,
            amount: expenses.amount,
          })
          .from(expenses)
          .where(expCond.length ? and(...expCond) : undefined),

        db
          .select({
            id: workerExpenses.id,
            date: workerExpenses.expenseDate,
            ref: sql<string>`'WEXP-' || substr(${workerExpenses.id}::text, 1, 8)`,
            party: workers.name,
            method: workerExpenses.method,
            amount: workerExpenses.amount,
          })
          .from(workerExpenses)
          .innerJoin(workers, eq(workerExpenses.workerId, workers.id))
          .where(wExpCond.length ? and(...wExpCond) : undefined),

        db
          .select({
            id: loanPayments.id,
            date: loanPayments.paymentDate,
            ref: sql<string>`'LPAY-' || substr(${loanPayments.id}::text, 1, 8)`,
            party: loans.lender,
            method: loanPayments.method,
            amount: loanPayments.amount,
          })
          .from(loanPayments)
          .innerJoin(loans, eq(loanPayments.loanId, loans.id))
          .where(lPayCond.length ? and(...lPayCond) : undefined),
      ]);

      let transactions: Array<{
        id: string;
        date: string;
        type: 'Inflow' | 'Outflow';
        source: string;
        reference: string;
        party: string;
        method: string;
        amount: number;
      }> = [];

      cSalesRows.forEach((r) => {
        const amt = asNum(r.amount);
        if (amt > 0) {
          transactions.push({
            id: r.id,
            date: r.date,
            type: 'Inflow',
            source: 'Customer Direct Sale',
            reference: r.ref,
            party: r.party,
            method: r.method || 'Cash',
            amount: amt,
          });
        }
      });

      cPayRows.forEach((r) => {
        const amt = asNum(r.amount);
        if (amt > 0) {
          transactions.push({
            id: r.id,
            date: r.date,
            type: 'Inflow',
            source: 'Customer Payment',
            reference: r.ref,
            party: r.party,
            method: r.method || 'Cash',
            amount: amt,
          });
        }
      });

      purRows.forEach((r) => {
        const amt = asNum(r.amount);
        if (amt > 0) {
          transactions.push({
            id: r.id,
            date: r.date,
            type: 'Outflow',
            source: 'Purchase Direct Payment',
            reference: r.ref,
            party: r.party,
            method: r.method || 'Cash',
            amount: amt,
          });
        }
      });

      sPayRows.forEach((r) => {
        const amt = asNum(r.amount);
        if (amt > 0) {
          transactions.push({
            id: r.id,
            date: r.date,
            type: 'Outflow',
            source: 'Supplier Payment',
            reference: r.ref,
            party: r.party,
            method: r.method || 'Cash',
            amount: amt,
          });
        }
      });

      expRows.forEach((r) => {
        const amt = asNum(r.amount);
        if (amt > 0) {
          transactions.push({
            id: r.id,
            date: r.date,
            type: 'Outflow',
            source: 'General Expense',
            reference: r.ref,
            party: r.party,
            method: r.method || 'Cash',
            amount: amt,
          });
        }
      });

      wExpRows.forEach((r) => {
        const amt = asNum(r.amount);
        if (amt > 0) {
          transactions.push({
            id: r.id,
            date: r.date,
            type: 'Outflow',
            source: 'Worker Expense',
            reference: r.ref,
            party: r.party,
            method: r.method || 'Cash',
            amount: amt,
          });
        }
      });

      lPayRows.forEach((r) => {
        const amt = asNum(r.amount);
        if (amt > 0) {
          transactions.push({
            id: r.id,
            date: r.date,
            type: 'Outflow',
            source: 'Loan EMI Payment',
            reference: r.ref,
            party: r.party,
            method: r.method || 'Cash',
            amount: amt,
          });
        }
      });

      // Sort by date descending
      transactions.sort((a, b) => String(b.date).localeCompare(String(a.date)));

      if (paymentMethod && paymentMethod !== 'All') {
        transactions = transactions.filter((t) => t.method.toLowerCase() === paymentMethod.toLowerCase());
      }

      if (search) {
        transactions = transactions.filter(
          (t) =>
            t.reference.toLowerCase().includes(search) ||
            t.party.toLowerCase().includes(search) ||
            t.source.toLowerCase().includes(search) ||
            t.method.toLowerCase().includes(search)
        );
      }

      const totalInflow = transactions.filter((t) => t.type === 'Inflow').reduce((acc, t) => acc + t.amount, 0);
      const totalOutflow = transactions.filter((t) => t.type === 'Outflow').reduce((acc, t) => acc + t.amount, 0);
      const netCashFlow = totalInflow - totalOutflow;

      // Method breakdown
      const methodMap = new Map<string, { inflow: number; outflow: number }>();
      transactions.forEach((t) => {
        const existing = methodMap.get(t.method) || { inflow: 0, outflow: 0 };
        if (t.type === 'Inflow') existing.inflow += t.amount;
        else existing.outflow += t.amount;
        methodMap.set(t.method, existing);
      });

      const methodBreakdown = Array.from(methodMap.entries()).map(([mName, data]) => ({
        method: mName,
        inflow: data.inflow,
        outflow: data.outflow,
        net: data.inflow - data.outflow,
      }));

      return NextResponse.json({
        type: 'payment_methods',
        startDate,
        endDate,
        metrics: {
          totalInflow,
          totalOutflow,
          netCashFlow,
          count: transactions.length,
        },
        methodBreakdown,
        rows: transactions,
      });
    }

    return NextResponse.json({ error: 'Invalid report type requested.' }, { status: 400 });
  } catch (error) {
    console.error('Reports API GET Error:', error);
    return NextResponse.json({ error: 'Failed to generate requested report data.' }, { status: 500 });
  }
}
