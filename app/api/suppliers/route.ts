import { NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { purchases, supplierPayments, suppliers } from '@/lib/schema';
export const dynamic = 'force-dynamic';
const schema = z.object({ name:z.string().trim().min(1).max(150), mobile:z.string().trim().min(5).max(30), address:z.string().trim().max(500).optional(), openingBalance:z.coerce.number().min(0) });
export async function GET(){try{
  // Keep the list totals aligned with the supplier ledger/statement.  A bill's
  // `paid` value already includes bill-linked supplier payment records, so
  // adding those records again here would count the same payment twice.
  const [rows, bills, payments] = await Promise.all([
    db.select().from(suppliers).orderBy(asc(suppliers.name)),
    db.select({ supplierId: purchases.supplierId, total: purchases.total, paid: purchases.paid }).from(purchases),
    db.select({ supplierId: supplierPayments.supplierId, purchaseId: supplierPayments.purchaseId, amount: supplierPayments.amount }).from(supplierPayments),
  ]);
  const totals = new Map<string, { totalPurchases: number; totalPaid: number }>();
  for (const bill of bills) {
    const total = totals.get(bill.supplierId) || { totalPurchases: 0, totalPaid: 0 };
    total.totalPurchases += Number(bill.total);
    total.totalPaid += Number(bill.paid);
    totals.set(bill.supplierId, total);
  }
  for (const payment of payments) {
    // Only opening-balance payments are not represented by purchases.paid.
    if (payment.purchaseId) continue;
    const total = totals.get(payment.supplierId) || { totalPurchases: 0, totalPaid: 0 };
    total.totalPaid += Number(payment.amount);
    totals.set(payment.supplierId, total);
  }
  return NextResponse.json(rows.map(supplier => {
    const total = totals.get(supplier.id) || { totalPurchases: 0, totalPaid: 0 };
    return { ...supplier, ...total, payable: Number(supplier.openingBalance) + total.totalPurchases - total.totalPaid };
  }));
}catch{return NextResponse.json({error:'Unable to load suppliers.'},{status:503})}}
export async function POST(request:Request){const parsed=schema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:'Enter a supplier name, valid mobile number, and non-negative opening balance.'},{status:400});try{const [supplier]=await db.insert(suppliers).values({name:parsed.data.name,mobile:parsed.data.mobile,address:parsed.data.address||null,openingBalance:String(parsed.data.openingBalance)}).returning();return NextResponse.json(supplier,{status:201});}catch{return NextResponse.json({error:'Unable to save supplier.'},{status:500})}}
