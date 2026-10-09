import { SignJWT } from 'jose';
import { detail } from '@/lib/sale-detail';
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sale = await detail((await params).id);
    if (!sale) return Response.json({ error: 'Sale not found.' }, { status: 404 });
    if (!process.env.AUTH_SECRET) throw new Error('Missing signing secret');
    const token = await new SignJWT({ saleId: sale.id }).setProtectedHeader({ alg: 'HS256' })
      .setAudience('invoice-share').setIssuedAt().setExpirationTime('7d')
      .sign(new TextEncoder().encode(process.env.AUTH_SECRET));
    return Response.json({ path: '/api/shared-invoices/' + token }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Unable to prepare invoice link.' }, { status: 503 }); }
}
