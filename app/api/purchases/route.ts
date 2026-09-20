import { NextResponse } from 'next/server';
import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { purchases, suppliers } from '@/lib/schema';
const bodySchema=z.object({supplierId:z.string().uuid(),date:z.string().date().refine(date=>date<=new Date().toISOString().slice(0,10),{message:'Purchase date cannot be in the future.'}),description:z.string().trim().max(500).optional(),total:z.coerce.number().min(.01),paid:z.coerce.number().min(0),method:z.enum(['Cash','Card','Bank Transfer']).optional(),notes:z.string().trim().max(1000).optional()}).refine(v=>v.paid<=v.total,{message:'Paid amount cannot exceed purchase total.',path:['paid']});
export async function GET(){try{return NextResponse.json(await db.select({id:purchases.id,invoice:purchases.invoiceNumber,date:purchases.purchaseDate,description:purchases.description,total:purchases.total,paid:purchases.paid,supplier:suppliers.name}).from(purchases).innerJoin(suppliers,eq(purchases.supplierId,suppliers.id)).orderBy(desc(purchases.purchaseDate)).limit(50));}catch{return NextResponse.json({error:'Unable to load purchases.'},{status:503})}}
export async function POST(request: Request) {
  const raw = await request.json();
  const parsed = bodySchema.safeParse(raw);
  const key = raw.idempotencyKey || crypto.randomUUID();

  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid purchase.' }, { status: 400 });
  if (!z.string().uuid().safeParse(key).success) return NextResponse.json({ error: 'Missing request key. Please try again.' }, { status: 400 });

  try {
    const result = await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
      const claimed = await tx.execute(sql`insert into mutation_requests (idempotency_key) values (${key}) on conflict do nothing returning idempotency_key`);
      if (!claimed.rows.length) return { duplicate: true };

      const prefix = `PUR-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`;
      const existing = await tx.select({ invoiceNumber: purchases.invoiceNumber }).from(purchases);
      const existingSet = new Set(existing.map(e => e.invoiceNumber));

      let highestSeq = 0;
      for (const { invoiceNumber } of existing) {
        const match = /-([0-9]+)$/.exec(invoiceNumber);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > highestSeq) highestSeq = num;
        }
      }

      let nextNum = highestSeq + 1;
      let invoiceNumber = `${prefix}-${String(nextNum).padStart(3, '0')}`;
      while (existingSet.has(invoiceNumber)) {
        nextNum++;
        invoiceNumber = `${prefix}-${String(nextNum).padStart(3, '0')}`;
      }

      const [purchase] = await tx.insert(purchases).values({
        invoiceNumber,
        supplierId: parsed.data.supplierId,
        purchaseDate: parsed.data.date,
        description: parsed.data.description || null,
        total: String(parsed.data.total),
        paid: String(parsed.data.paid),
        paymentMethod: parsed.data.method || null,
        notes: parsed.data.notes || null
      }).returning();
      return { purchase };
    });

    return result.duplicate ? NextResponse.json({ duplicate: true }) : NextResponse.json(result.purchase, { status: 201 });
  } catch (err) {
    console.error('POST /api/purchases error:', err);
    return NextResponse.json({ error: 'Unable to create purchase.' }, { status: 500 });
  }
}

