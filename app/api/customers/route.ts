import {NextResponse} from 'next/server';import {asc} from 'drizzle-orm';import {z} from 'zod';import {db} from '@/lib/db';import {customerPayments,customers,customerSales} from '@/lib/schema';
export const dynamic = 'force-dynamic';
const schema=z.object({name:z.string().trim().min(1).max(150),mobile:z.string().trim().min(5).max(30),address:z.string().trim().max(500).optional(),openingBalance:z.coerce.number().min(0)});
export async function GET(){try{
  // This mirrors the customer ledger: a sale's `paid` field already includes
  // payments linked to that sale, while opening-balance receipts have no
  // saleId and must be added separately.
  const [rows,sales,payments]=await Promise.all([
    db.select().from(customers).orderBy(asc(customers.name)),
    db.select({customerId:customerSales.customerId,total:customerSales.total,paid:customerSales.paid}).from(customerSales),
    db.select({customerId:customerPayments.customerId,saleId:customerPayments.saleId,amount:customerPayments.amount}).from(customerPayments),
  ]);
  const totals=new Map<string,{totalSales:number;totalPaid:number}>();
  for(const sale of sales){const total=totals.get(sale.customerId)||{totalSales:0,totalPaid:0};total.totalSales+=Number(sale.total);total.totalPaid+=Number(sale.paid);totals.set(sale.customerId,total)}
  for(const payment of payments){if(payment.saleId)continue;const total=totals.get(payment.customerId)||{totalSales:0,totalPaid:0};total.totalPaid+=Number(payment.amount);totals.set(payment.customerId,total)}
  return NextResponse.json(rows.map(customer=>{const total=totals.get(customer.id)||{totalSales:0,totalPaid:0};return {...customer,...total,outstanding:Number(customer.openingBalance)+total.totalSales-total.totalPaid}}))
}catch{return NextResponse.json({error:'Unable to load customers.'},{status:503})}}
export async function POST(request:Request){const data=schema.safeParse(await request.json());if(!data.success)return NextResponse.json({error:'Enter valid customer details.'},{status:400});try{const [row]=await db.insert(customers).values({...data.data,address:data.data.address||null,openingBalance:String(data.data.openingBalance)}).returning();return NextResponse.json(row,{status:201})}catch{return NextResponse.json({error:'Unable to save customer.'},{status:500})}}
