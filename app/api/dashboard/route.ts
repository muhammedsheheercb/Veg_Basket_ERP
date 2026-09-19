import { NextResponse } from 'next/server';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customerSales, customers, expenses, items, loans, purchases, sales, suppliers, workers } from '@/lib/schema';

const asNumber = (value: unknown) => Number(value ?? 0);
const sum = (field: any) => sql<string>`coalesce(sum(${field}), 0)`;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const range = url.searchParams.get('range') || 'this_month';

    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().slice(0, 10);

    let startDateStr = `${today.slice(0, 7)}-01`;
    let endDateStr = today;

    if (range === 'last_month') {
      const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      startDateStr = prevMonthDate.toISOString().slice(0, 10);
      endDateStr = lastDayPrevMonth.toISOString().slice(0, 10);
    } else if (range === '30_days') {
      const d30 = new Date(now);
      d30.setDate(d30.getDate() - 30);
      startDateStr = d30.toISOString().slice(0, 10);
      endDateStr = today;
    }

    const [
      tCustSales,
      tSales,
      yCustSales,
      ySales,
      tPurchases,
      yPurchases,
      tExpenses,
      yExpenses,
      custRec,
      salesRec,
      custBal,
      purPay,
      suppBal,
      loanBal,
      mCustSales,
      mSales,
      mPurchases,
      mExpenses,
      recentCustSales,
      recentLegacySales,
      countsCust,
      countsSupp,
      countsItems,
      countsWorkers,
      dailySalesRows,
      dailyPurchasesRows,
    ] = await Promise.all([
      db.select({ value: sum(customerSales.total) }).from(customerSales).where(eq(customerSales.saleDate, today)),
      db.select({ value: sum(sales.total) }).from(sales).where(eq(sales.saleDate, today)),
      db.select({ value: sum(customerSales.total) }).from(customerSales).where(eq(customerSales.saleDate, yesterday)),
      db.select({ value: sum(sales.total) }).from(sales).where(eq(sales.saleDate, yesterday)),

      db.select({ value: sum(purchases.total) }).from(purchases).where(eq(purchases.purchaseDate, today)),
      db.select({ value: sum(purchases.total) }).from(purchases).where(eq(purchases.purchaseDate, yesterday)),

      db.select({ value: sum(expenses.amount) }).from(expenses).where(eq(expenses.expenseDate, today)),
      db.select({ value: sum(expenses.amount) }).from(expenses).where(eq(expenses.expenseDate, yesterday)),

      db.select({ value: sql<string>`coalesce(sum(${customerSales.total} - ${customerSales.paid}), 0)` }).from(customerSales),
      db.select({ value: sql<string>`coalesce(sum(${sales.total} - ${sales.paid}), 0)` }).from(sales),
      db.select({ value: sum(customers.openingBalance) }).from(customers),

      db.select({ value: sql<string>`coalesce(sum(${purchases.total} - ${purchases.paid}), 0)` }).from(purchases),
      db.select({ value: sum(suppliers.openingBalance) }).from(suppliers),

      db.select({ value: sum(loans.outstanding) }).from(loans),

      db.select({ value: sum(customerSales.total) }).from(customerSales).where(and(gte(customerSales.saleDate, startDateStr), lte(customerSales.saleDate, endDateStr))),
      db.select({ value: sum(sales.total) }).from(sales).where(and(gte(sales.saleDate, startDateStr), lte(sales.saleDate, endDateStr))),
      db.select({ value: sum(purchases.total) }).from(purchases).where(and(gte(purchases.purchaseDate, startDateStr), lte(purchases.purchaseDate, endDateStr))),
      db.select({ value: sum(expenses.amount) }).from(expenses).where(and(gte(expenses.expenseDate, startDateStr), lte(expenses.expenseDate, endDateStr))),

      db
        .select({
          id: customerSales.id,
          invoice: customerSales.invoiceNumber,
          customer: customers.name,
          date: customerSales.saleDate,
          total: customerSales.total,
          paid: customerSales.paid,
        })
        .from(customerSales)
        .innerJoin(customers, eq(customerSales.customerId, customers.id))
        .orderBy(desc(customerSales.saleDate), desc(customerSales.createdAt))
        .limit(6),

      db
        .select({
          id: sales.id,
          invoice: sales.invoiceNumber,
          customer: sales.customerName,
          date: sales.saleDate,
          total: sales.total,
          paid: sales.paid,
        })
        .from(sales)
        .orderBy(desc(sales.saleDate))
        .limit(6),

      db.select({ count: sql<number>`count(*)` }).from(customers),
      db.select({ count: sql<number>`count(*)` }).from(suppliers),
      db.select({ count: sql<number>`count(*)` }).from(items),
      db.select({ count: sql<number>`count(*)` }).from(workers),

      db
        .select({
          date: customerSales.saleDate,
          total: sum(customerSales.total),
        })
        .from(customerSales)
        .where(and(gte(customerSales.saleDate, startDateStr), lte(customerSales.saleDate, endDateStr)))
        .groupBy(customerSales.saleDate),

      db
        .select({
          date: purchases.purchaseDate,
          total: sum(purchases.total),
        })
        .from(purchases)
        .where(and(gte(purchases.purchaseDate, startDateStr), lte(purchases.purchaseDate, endDateStr)))
        .groupBy(purchases.purchaseDate),
    ]);

    const todaySalesVal = asNumber(tCustSales[0]?.value) + asNumber(tSales[0]?.value);
    const yesterdaySalesVal = asNumber(yCustSales[0]?.value) + asNumber(ySales[0]?.value);

    const todayPurchasesVal = asNumber(tPurchases[0]?.value);
    const yesterdayPurchasesVal = asNumber(yPurchases[0]?.value);

    const todayExpensesVal = asNumber(tExpenses[0]?.value);
    const yesterdayExpensesVal = asNumber(yExpenses[0]?.value);

    const receivablesVal = asNumber(custRec[0]?.value) + asNumber(salesRec[0]?.value) + asNumber(custBal[0]?.value);
    const payablesVal = asNumber(purPay[0]?.value) + asNumber(suppBal[0]?.value);
    const loanBalanceVal = asNumber(loanBal[0]?.value);

    const monthSalesVal = asNumber(mCustSales[0]?.value) + asNumber(mSales[0]?.value);
    const monthPurchasesVal = asNumber(mPurchases[0]?.value);
    const monthExpensesVal = asNumber(mExpenses[0]?.value);

    const calcPct = (curr: number, prev: number) => {
      if (!prev && !curr) return 0;
      if (!prev) return 100;
      return Math.round(((curr - prev) / prev) * 1000) / 10;
    };

    const combinedRecentSales = [...recentCustSales, ...recentLegacySales]
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 6)
      .map((s) => {
        const totalNum = asNumber(s.total);
        const paidNum = asNumber(s.paid);
        const statusStr = paidNum >= totalNum ? 'Paid' : paidNum > 0 ? 'Partial' : 'Unpaid';
        return {
          id: s.id,
          invoice: s.invoice,
          customer: s.customer,
          date: s.date,
          total: totalNum,
          paid: paidNum,
          balance: Math.max(0, totalNum - paidNum),
          status: statusStr,
        };
      });

    // Build Chart Timeline
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    const dateList: string[] = [];

    const dt = new Date(startDate);
    while (dt <= endDate) {
      dateList.push(dt.toISOString().slice(0, 10));
      dt.setDate(dt.getDate() + 1);
    }

    const salesMap = new Map<string, number>();
    dailySalesRows.forEach((r) => salesMap.set(String(r.date), asNumber(r.total)));

    const purchasesMap = new Map<string, number>();
    dailyPurchasesRows.forEach((r) => purchasesMap.set(String(r.date), asNumber(r.total)));

    const chartSales = dateList.map((d) => salesMap.get(d) || 0);
    const chartPurchases = dateList.map((d) => purchasesMap.get(d) || 0);

    const maxChartVal = Math.max(10, ...chartSales, ...chartPurchases);

    // Format axis labels (5 spaced ticks)
    const tickIndices = [
      0,
      Math.floor(dateList.length * 0.25),
      Math.floor(dateList.length * 0.5),
      Math.floor(dateList.length * 0.75),
      dateList.length - 1,
    ];
    const chartLabels = Array.from(new Set(tickIndices.filter((i) => i >= 0 && i < dateList.length))).map((i) => {
      const parts = dateList[i].split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const mIdx = parseInt(parts[1], 10) - 1;
      return `${parts[2]} ${monthNames[mIdx] || ''}`;
    });

    return NextResponse.json({
      metrics: {
        todaySales: todaySalesVal,
        todaySalesChangePct: calcPct(todaySalesVal, yesterdaySalesVal),
        todayPurchases: todayPurchasesVal,
        todayPurchasesChangePct: calcPct(todayPurchasesVal, yesterdayPurchasesVal),
        todayExpenses: todayExpensesVal,
        todayExpensesChangePct: calcPct(todayExpensesVal, yesterdayExpensesVal),
        receivables: receivablesVal,
        payables: payablesVal,
        loanBalance: loanBalanceVal,
        monthSales: monthSalesVal,
        monthPurchases: monthPurchasesVal,
        monthExpenses: monthExpensesVal,
        netMovement: monthSalesVal - monthPurchasesVal - monthExpensesVal,
      },
      chart: {
        sales: chartSales,
        purchases: chartPurchases,
        labels: chartLabels,
        maxVal: maxChartVal,
      },
      recentSales: combinedRecentSales,
      counts: {
        customers: Number(countsCust[0]?.count || 0),
        suppliers: Number(countsSupp[0]?.count || 0),
        items: Number(countsItems[0]?.count || 0),
        workers: Number(countsWorkers[0]?.count || 0),
      },
      range,
    });
  } catch (error) {
    console.error('Dashboard GET Error:', error);
    return NextResponse.json({ error: 'Unable to load live dashboard statistics.' }, { status: 500 });
  }
}
