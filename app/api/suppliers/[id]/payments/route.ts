import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { purchases, supplierPayments } from '@/lib/schema';

const schema=z.object({purchaseId:z.string().uuid(),date:z.string().date().refine(date=>date<=new Date().toISOString().slice(0,10),{message:'Payment date cannot be in the future.'}),amount:z.coerce.number().finite().positive(),method:z.enum(['Cash','Card','Bank Transfer']),notes:z.string().trim().max(1000).optional(),idempotencyKey:z.string().uuid()});
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){const parsed=schema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:'Enter a valid payment request.'},{status:400});try{const {id}=await params;const result=await db.transaction(async tx=>{
  // This lock serializes all writes for a bill, so the value below is always current.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${parsed.data.purchaseId}))`);
  const [existing]=await tx.select({id:supplierPayments.id}).from(supplierPayments).where(eq(supplierPayments.idempotencyKey,parsed.data.idempotencyKey));
  if(existing)return {duplicate:true};
  const [bill]=await tx.select().from(purchases).where(eq(purchases.id,parsed.data.purchaseId));
  if(!bill||bill.supplierId!==id)throw new Error('Purchase bill was not found.');
  const remaining=Number(bill.total)-Number(bill.paid);
  if(parsed.data.amount>remaining+0.00001)throw new Error(`Payment cannot exceed the outstanding balance of AED ${remaining.toFixed(2)}.`);
  await tx.insert(supplierPayments).values({supplierId:id,purchaseId:bill.id,paymentDate:parsed.data.date,amount:String(parsed.data.amount),method:parsed.data.method,notes:parsed.data.notes||null,idempotencyKey:parsed.data.idempotencyKey});
  await tx.update(purchases).set({paid:String(Number(bill.paid)+parsed.data.amount)}).where(eq(purchases.id,bill.id));
  return {remaining:remaining-parsed.data.amount};
 });return NextResponse.json(result,{status:result.duplicate?200:201});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to record payment.'},{status:400})}}
