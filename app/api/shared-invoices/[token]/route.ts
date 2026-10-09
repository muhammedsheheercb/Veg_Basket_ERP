import { jwtVerify } from 'jose';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { businessSettings } from '@/lib/schema';
import { detail } from '@/lib/sale-detail';
import { createPdfBlob } from '@/components/pdf-download';
import { salesPdfData } from '@/lib/sales-pdf';
export const runtime = 'nodejs';
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  let saleId: string;
  try {
    if (!process.env.AUTH_SECRET) throw new Error('Missing signing secret');
    const { payload } = await jwtVerify((await params).token, new TextEncoder().encode(process.env.AUTH_SECRET), { audience: 'invoice-share', algorithms: ['HS256'] });
    if (typeof payload.saleId !== 'string') throw new Error('Invalid invoice');
    saleId = payload.saleId;
  } catch { return Response.json({ error: 'This invoice link is invalid or has expired.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } }); }
  try {
    const sale = await detail(saleId);
    if (!sale) return Response.json({ error: 'Invoice no longer available.' }, { status: 404 });
    const [business] = await db.select().from(businessSettings).where(eq(businessSettings.id, 1));
    const blob = await createPdfBlob(salesPdfData(sale, business));
    return new Response(await blob.arrayBuffer(), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${sale.invoiceNumber.replace(/[^a-z0-9_-]/gi, '-')}.pdf"`, 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow' } });
  } catch { return Response.json({ error: 'Unable to generate invoice PDF.' }, { status: 503 }); }
}
