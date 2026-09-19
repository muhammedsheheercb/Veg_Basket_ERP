import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { purseAdditions } from '@/lib/schema';

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Invalid transaction ID.' }, { status: 400 });
    }

    const deleted = await db.delete(purseAdditions).where(eq(purseAdditions.id, id)).returning();
    if (!deleted.length) {
      return NextResponse.json({ error: 'Manual money record not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Purse DELETE Error:', error);
    return NextResponse.json({ error: 'Unable to remove manual money addition.' }, { status: 500 });
  }
}
