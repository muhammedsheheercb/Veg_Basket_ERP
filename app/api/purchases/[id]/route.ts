import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { purchaseItems, purchases, supplierPayments, suppliers } from '@/lib/schema';
import { splitPurchasePayment } from '@/lib/supplier-balance';
const schema=z.object({supplierId:z.string().uuid(),date:z.string().date().refine(date=>date<=new Date().toISOString().slice(0,10),{message:'Purchase date cannot be in the future.'}),paid:z.unknown(),method:z.enum(['Cash','Card','Bank Transfer']).optional(),notes:z.string().trim().max(1000).optional(),items:z.array(z.object({itemId:z.string().optional(),itemName:z.string(),quantity:z.string(),unit:z.string().optional(),unitPrice:z.string()})).min(1)});
const cents=(value:unknown)=>{const text=String(value??'');if(!/^\d+(\.\d{1,3})?$/.test(text))return null;const[whole,fraction='']=text.split('.');const amount=Number(whole)*1000+Number((fraction+'000').slice(0,3));return Number.isSafeInteger(amount)&&amount<100_000_000_000_000?amount:null;};
const validUuid=(value:string)=>/^[0-9a-f-]{36}$/i.test(value);
function parseLine(line:z.infer<typeof schema>['items'][number]){const name=line.itemName.trim().toUpperCase(),match=line.quantity.trim().match(/^(\d+(?:\.\d{1,3})?)\s*([^\d.].*)?$/),quantity=match?Number(match[1]):0,unitPrice=cents(line.unitPrice);if(!name||name.length>250||!Number.isFinite(quantity)||quantity<1||quantity>=100_000_000_000||unitPrice===null||(line.itemId&&!validUuid(line.itemId)))return null;const lineTotal=Math.round(quantity*unitPrice);if(!Number.isSafeInteger(lineTotal)||lineTotal>=100_000_000_000_000)return null;return{itemId:line.itemId||null,itemName:name,quantity:Math.round(quantity*1000),unit:match?.[2]?.trim()||line.unit?.trim()||null,unitPrice,lineTotal};}
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;const [purchase]=await db.select({id:purchases.id,invoiceNumber:purchases.invoiceNumber,supplierId:purchases.supplierId,purchaseDate:purchases.purchaseDate,description:purchases.description,total:purchases.total,paid:purchases.paid,existingBalance:purchases.existingBalance,accountPaid:purchases.accountPaid,accountPaymentId:purchases.accountPaymentId,paymentMethod:purchases.paymentMethod,notes:purchases.notes,createdAt:purchases.createdAt,supplierName:suppliers.name,supplierMobile:suppliers.mobile,supplierAddress:suppliers.address,supplierOpeningBalance:suppliers.openingBalance}).from(purchases).innerJoin(suppliers,eq(purchases.supplierId,suppliers.id)).where(eq(purchases.id,id));if(!purchase)return NextResponse.json({error:'Purchase not found.'},{status:404});const [itemRows,bills,openingPayments]=await Promise.all([db.select().from(purchaseItems).where(eq(purchaseItems.purchaseId,id)).orderBy(purchaseItems.position),db.select({total:purchases.total,paid:purchases.paid}).from(purchases).where(eq(purchases.supplierId,purchase.supplierId)),db.select({amount:supplierPayments.amount}).from(supplierPayments).where(and(eq(supplierPayments.supplierId,purchase.supplierId),isNull(supplierPayments.purchaseId)))]);const payable=Number(purchase.supplierOpeningBalance)+bills.reduce((sum,bill)=>sum+Number(bill.total)-Number(bill.paid),0)-openingPayments.reduce((sum,payment)=>sum+Number(payment.amount),0);const existingBalance=purchase.existingBalance==null?Math.max(0,payable-(Number(purchase.total)-Number(purchase.paid))):Number(purchase.existingBalance);return NextResponse.json({...purchase,existingBalance,items:itemRows});}
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){
  const parsed=schema.safeParse(await request.json());
  if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message},{status:400});
  const lines=parsed.data.items.map(parseLine);
  if(lines.some(line=>!line))return NextResponse.json({error:'Enter valid item names, quantities and rates.'},{status:400});
  const validLines=lines as NonNullable<(typeof lines)[number]>[];
  const total=validLines.reduce((sum,line)=>sum+line.lineTotal,0),paid=cents(parsed.data.paid);
  if(total<1||!Number.isSafeInteger(total)||total>=100_000_000_000_000||paid===null)return NextResponse.json({error:'Enter a valid paid amount.'},{status:400});
  try{
    const {id}=await params;
    const result=await db.transaction(async tx=>{
      const [previous]=await tx.select().from(purchases).where(eq(purchases.id,id));
      if(!previous)throw Error('Purchase not found.');
      const payment=await splitPurchasePayment(tx,{supplierId:parsed.data.supplierId,paid,total,date:parsed.data.date,method:parsed.data.method,notes:parsed.data.notes},previous);
      const billPayments=await tx.select({amount:supplierPayments.amount}).from(supplierPayments).where(eq(supplierPayments.purchaseId,id));
      if(payment.invoicePaid/1000<billPayments.reduce((sum,row)=>sum+Number(row.amount),0))throw Error('Paid amount cannot be lower than recorded purchase payments.');
      const [purchase]=await tx.update(purchases).set({supplierId:parsed.data.supplierId,purchaseDate:parsed.data.date,description:validLines.map(line=>line.itemName).join(', ').slice(0,500),total:(total/1000).toFixed(3),paid:(payment.invoicePaid/1000).toFixed(3),existingBalance:(payment.existingBalance/1000).toFixed(3),accountPaid:(payment.accountPaid/1000).toFixed(3),accountPaymentId:payment.accountPaymentId,paymentMethod:parsed.data.method||null,notes:parsed.data.notes||null}).where(eq(purchases.id,id)).returning();
      await tx.delete(purchaseItems).where(eq(purchaseItems.purchaseId,id));
      await tx.insert(purchaseItems).values(validLines.map((line,position)=>({purchaseId:id,...line,position,quantity:(line.quantity/1000).toFixed(3),unitPrice:(line.unitPrice/1000).toFixed(3),lineTotal:(line.lineTotal/1000).toFixed(3)})));
      return purchase;
    });
    return NextResponse.json(result);
  }catch(error){
    const message=error instanceof Error?error.message:'';
    const clientError=message==='Purchase not found.'||message==='Payment amount cannot exceed the outstanding balance.'||message==='Enter a payment with at most two decimal places.'||message==='Supplier was not found.'||message==='Paid amount cannot be lower than recorded purchase payments.';
    return NextResponse.json({error:clientError?message:'Unable to update purchase.'},{status:clientError?400:500});
  }
}
export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;const payments=await db.select({id:supplierPayments.id}).from(supplierPayments).where(eq(supplierPayments.purchaseId,id));if(payments.length)return NextResponse.json({error:'Purchase with recorded payments cannot be deleted.'},{status:409});await db.delete(purchases).where(eq(purchases.id,id));return NextResponse.json({ok:true});}catch{return NextResponse.json({error:'Unable to delete purchase.'},{status:500})}}
