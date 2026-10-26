import { NextResponse } from 'next/server';
import { desc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { purchaseItems, purchases, supplierPayments, suppliers } from '@/lib/schema';
import { splitPurchasePayment } from '@/lib/supplier-balance';

const cents = (value: unknown) => {
  const text = String(value ?? '');
  if (!/^\d+(\.\d{1,3})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  const amount = Number(whole) * 1000 + Number((fraction + '000').slice(0, 3));
  return Number.isSafeInteger(amount) && amount < 100_000_000_000_000 ? amount : null;
};
const validUuid = (value: string) => /^[0-9a-f-]{36}$/i.test(value);
const schema = z.object({ supplierId:z.string().uuid(), date:z.string().date().refine(date=>date<=new Date().toISOString().slice(0,10),{message:'Purchase date cannot be in the future.'}), paid:z.unknown(), method:z.enum(['Cash','Card','Bank Transfer']).optional(), notes:z.string().trim().max(1000).optional(), items:z.array(z.object({itemId:z.string().optional(),itemName:z.string(),quantity:z.string(),unit:z.string().optional(),unitPrice:z.string()})).min(1) });

function parseLine(line: z.infer<typeof schema>['items'][number]) {
  const name = line.itemName.trim().toUpperCase();
  const quantityMatch = line.quantity.trim().match(/^(\d+(?:\.\d{1,3})?)\s*([^\d.].*)?$/);
  const quantity = quantityMatch ? Number(quantityMatch[1]) : 0;
  const unitPrice = cents(line.unitPrice);
  if (!name || name.length > 250 || !Number.isFinite(quantity) || quantity < 1 || quantity >= 100_000_000_000 || unitPrice === null || (line.itemId && !validUuid(line.itemId))) return null;
  const lineTotal = Math.round(quantity * unitPrice);
  if (!Number.isSafeInteger(lineTotal) || lineTotal >= 100_000_000_000_000) return null;
  return { itemId:line.itemId || null, itemName:name, quantity:Math.round(quantity*1000), unit:(quantityMatch?.[2]?.trim() || line.unit?.trim() || null), unitPrice, lineTotal };
}

export async function GET(){
  try{
    const [allBills,accountPayments]=await Promise.all([
      db.select({id:purchases.id,invoice:purchases.invoiceNumber,supplierId:purchases.supplierId,date:purchases.purchaseDate,createdAt:purchases.createdAt,description:purchases.description,total:purchases.total,paid:purchases.paid,supplier:suppliers.name,supplierOpeningBalance:suppliers.openingBalance}).from(purchases).innerJoin(suppliers,eq(purchases.supplierId,suppliers.id)).orderBy(desc(purchases.purchaseDate)),
      db.select({supplierId:supplierPayments.supplierId,amount:supplierPayments.amount}).from(supplierPayments).where(isNull(supplierPayments.purchaseId)),
    ]);
    const balanceByBill=new Map<string,number>();
    const suppliersToBills=new Map<string,typeof allBills>();
    for(const bill of allBills){const list=suppliersToBills.get(bill.supplierId)||[];list.push(bill);suppliersToBills.set(bill.supplierId,list);}
    for(const [supplierId,bills] of suppliersToBills){
      const opening=Math.max(0,Number(bills[0]?.supplierOpeningBalance||0));
      const accountPaid=accountPayments.filter(payment=>payment.supplierId===supplierId).reduce((sum,payment)=>sum+Number(payment.amount),0);
      let remaining=Math.max(0,accountPaid-opening);
      const oldestFirst=[...bills].sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt.getTime()-b.createdAt.getTime());
      for(const bill of oldestFirst){const due=Math.max(0,Number(bill.total)-Number(bill.paid));const applied=Math.min(due,remaining);balanceByBill.set(bill.id,Math.max(0,Math.round((due-applied)*1000)/1000));remaining-=applied;}
    }
    return NextResponse.json(allBills.slice(0,50).map(({supplierId,supplierOpeningBalance,createdAt,...bill})=>({...bill,balancePayable:balanceByBill.get(bill.id)??Math.max(0,Number(bill.total)-Number(bill.paid))})),{headers:{'Cache-Control':'no-store'}});
  }
  catch{return NextResponse.json({error:'Unable to load purchases.'},{status:503});}
}

export async function POST(request:Request) {
  const raw = await request.json();
  const parsed = schema.safeParse(raw);
  const key = raw.idempotencyKey || crypto.randomUUID();
  if (!parsed.success) return NextResponse.json({error:parsed.error.issues[0]?.message||'Invalid purchase.'},{status:400});
  if (!z.string().uuid().safeParse(key).success) return NextResponse.json({error:'Missing request key. Please try again.'},{status:400});
  const lines = parsed.data.items.map(parseLine);
  if (lines.some(line=>!line)) return NextResponse.json({error:'Enter valid item names, quantities and rates.'},{status:400});
  const validLines = lines as NonNullable<(typeof lines)[number]>[];
  const total = validLines.reduce((sum,line)=>sum+line.lineTotal,0);
  const paid = cents(parsed.data.paid);
  if (total < 1 || !Number.isSafeInteger(total) || total >= 100_000_000_000_000 || paid === null) return NextResponse.json({error:'Enter a valid paid amount.'},{status:400});
  try {
    const result = await db.transaction(async tx=>{
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
      const claimed=await tx.execute(sql`insert into mutation_requests (idempotency_key) values (${key}) on conflict do nothing returning idempotency_key`);
      if(!claimed.rows.length)return {duplicate:true as const};
      const prefix=`PUR-${new Date().toISOString().slice(0,10).replaceAll('-','')}`;
      const existing=await tx.select({invoiceNumber:purchases.invoiceNumber}).from(purchases);
      const existingSet=new Set(existing.map(row=>row.invoiceNumber));
      const highest=existing.reduce((max,{invoiceNumber})=>{const match=/-([0-9]+)$/.exec(invoiceNumber);return match?Math.max(max,Number(match[1])):max;},0);
      let seq=highest+1,invoiceNumber=`${prefix}-${String(seq).padStart(3,'0')}`;
      while(existingSet.has(invoiceNumber)){seq++;invoiceNumber=`${prefix}-${String(seq).padStart(3,'0')}`;}
      const payment=await splitPurchasePayment(tx,{supplierId:parsed.data.supplierId,paid,total,date:parsed.data.date,method:parsed.data.method,notes:parsed.data.notes});
      const [purchase]=await tx.insert(purchases).values({invoiceNumber,supplierId:parsed.data.supplierId,purchaseDate:parsed.data.date,description:validLines.map(line=>line.itemName).join(', ').slice(0,500),total:(total/1000).toFixed(3),paid:(payment.invoicePaid/1000).toFixed(3),existingBalance:(payment.existingBalance/1000).toFixed(3),accountPaid:(payment.accountPaid/1000).toFixed(3),accountPaymentId:payment.accountPaymentId,paymentMethod:parsed.data.method||null,notes:parsed.data.notes||null}).returning();
      await tx.insert(purchaseItems).values(validLines.map((line,position)=>({purchaseId:purchase.id,...line,position,quantity:(line.quantity/1000).toFixed(3),unitPrice:(line.unitPrice/1000).toFixed(3),lineTotal:(line.lineTotal/1000).toFixed(3)})));
      return {purchase};
    });
    return result.duplicate?NextResponse.json({duplicate:true}):NextResponse.json(result.purchase,{status:201});
  } catch(error){console.error('POST /api/purchases error:',error);const message=error instanceof Error?error.message:'';const clientError=message==='Payment amount cannot exceed the outstanding balance.'||message==='Enter a payment with at most two decimal places.'||message==='Supplier was not found.';return NextResponse.json({error:clientError?message:'Unable to create purchase.'},{status:clientError?400:500});}
}
