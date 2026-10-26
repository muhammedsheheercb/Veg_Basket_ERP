import { eq, sql } from 'drizzle-orm';
import { supplierPayments, suppliers, purchases } from '@/lib/schema';
import { db } from '@/lib/db';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export const supplierMilli = (value:string|number) => Math.round(Number(value||0)*1000);

export async function supplierBalance(tx:Transaction,id:string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${id}))`);
  const [supplier]=await tx.select().from(suppliers).where(eq(suppliers.id,id));
  if(!supplier)throw Error('Supplier was not found.');
  const [bills,payments]=await Promise.all([
    tx.select({total:purchases.total,paid:purchases.paid}).from(purchases).where(eq(purchases.supplierId,id)),
    tx.select({amount:supplierPayments.amount}).from(supplierPayments).where(sql`${supplierPayments.supplierId} = ${id} and ${supplierPayments.purchaseId} is null`),
  ]);
  return supplierMilli(supplier.openingBalance)+bills.reduce((sum,bill)=>sum+supplierMilli(bill.total)-supplierMilli(bill.paid),0)-payments.reduce((sum,payment)=>sum+supplierMilli(payment.amount),0);
}

export async function splitPurchasePayment(tx:Transaction,data:{supplierId:string;paid:number;total:number;date:string;method?:string;notes?:string},previous?:{supplierId:string;total:string;paid:string;existingBalance?:string|null;accountPaid?:string|null;accountPaymentId?:string|null}) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${data.supplierId}))`);
  if(previous?.accountPaymentId)await tx.delete(supplierPayments).where(eq(supplierPayments.id,previous.accountPaymentId));
  const balance=await supplierBalance(tx,data.supplierId);
  const sameSupplier=previous?.supplierId===data.supplierId;
  const availableExisting=balance-(sameSupplier?supplierMilli(previous.total)-supplierMilli(previous.paid):0);
  const existing=sameSupplier&&previous.existingBalance!=null?supplierMilli(previous.existingBalance):Math.max(0,availableExisting);
  const grandTotal=data.total+existing;
  if(data.paid>grandTotal||data.paid>data.total+Math.max(0,availableExisting))throw Error('Payment amount cannot exceed the outstanding balance.');
  const accountAmount=Math.max(0,data.paid-data.total);
  let accountPaymentId:string|null=null;
  if(accountAmount>0){
    const [receipt]=await tx.insert(supplierPayments).values({supplierId:data.supplierId,purchaseId:null,paymentDate:data.date,amount:(accountAmount/1000).toFixed(3),method:data.method||'Cash',notes:data.notes||'Payment toward existing balance with purchase bill',idempotencyKey:crypto.randomUUID()}).returning({id:supplierPayments.id});
    accountPaymentId=receipt.id;
  }
  return {invoicePaid:data.paid-accountAmount,existingBalance:Math.max(0,existing),accountPaid:accountAmount,accountPaymentId};
}
