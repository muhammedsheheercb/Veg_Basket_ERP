import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { businessSettings } from '@/lib/schema';

const defaults = {
  address: 'Al Quoz, Dubai, United Arab Emirates',
  contactNumber: '+971 50 123 4567',
  email: 'info@vegbasket.ae',
};

async function getSettings() {
  const [settings] = await db.select().from(businessSettings).where(eq(businessSettings.id, 1));
  if (settings) return settings;
  const [created] = await db.insert(businessSettings).values({ id: 1, ...defaults }).onConflictDoNothing().returning();
  if (created) return created;
  const [saved] = await db.select().from(businessSettings).where(eq(businessSettings.id, 1));
  return saved;
}

export async function GET() {
  try {
    return NextResponse.json(await getSettings());
  } catch {
    return NextResponse.json({ error: 'Unable to load business settings.' }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const address = typeof body.address === 'string' ? body.address.trim() : '';
    const contactNumber = typeof body.contactNumber === 'string' ? body.contactNumber.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    if (!address || !contactNumber || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'Enter a business address, contact number, and valid email address.' }, { status: 400 });
    }
    await db.insert(businessSettings).values({ id: 1, address, contactNumber, email, updatedAt: new Date() })
      .onConflictDoUpdate({ target: businessSettings.id, set: { address, contactNumber, email, updatedAt: new Date() } });
    return NextResponse.json(await getSettings());
  } catch {
    return NextResponse.json({ error: 'Unable to save business settings.' }, { status: 500 });
  }
}
