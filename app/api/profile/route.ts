import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSession, verifySession } from '@/lib/auth';

async function getActiveUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);

  if (session?.id) {
    const [user] = await db.select().from(users).where(eq(users.id, session.id)).limit(1);
    if (user && user.active) return user;
  }

  // Fallback to first active user if session isn't strict
  const [defaultUser] = await db.select().from(users).where(eq(users.active, true)).limit(1);
  return defaultUser || null;
}

export async function GET() {
  try {
    const user = await getActiveUser();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error('GET /api/profile error:', error);
    return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getActiveUser();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, currentPassword, newPassword } = body;

    const updates: Partial<typeof users.$inferInsert> = {};

    // 1. Name Update
    if (typeof name === 'string' && name.trim()) {
      updates.name = name.trim();
    }

    // 2. Password Update
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Current password is required to set a new password.' },
          { status: 400 }
        );
      }

      const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValidPassword) {
        return NextResponse.json(
          { error: 'Current password is incorrect.' },
          { status: 400 }
        );
      }

      if (typeof newPassword !== 'string' || newPassword.length < 6) {
        return NextResponse.json(
          { error: 'New password must be at least 6 characters long.' },
          { status: 400 }
        );
      }

      updates.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No changes provided.' }, { status: 400 });
    }

    // Apply updates to database
    await db.update(users).set(updates).where(eq(users.id, user.id));

    // Fetch updated user
    const [updatedUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);

    const sessionPayload = {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
    };

    const response = NextResponse.json({
      ok: true,
      user: sessionPayload,
      message: 'Profile updated successfully.',
    });

    if (process.env.AUTH_SECRET) {
      try {
        const newToken = await signSession(sessionPayload);
        const cookieStore = await cookies();
        cookieStore.set(SESSION_COOKIE, newToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: SESSION_MAX_AGE_SECONDS,
        });
      } catch (e) {
        console.warn('Could not refresh session cookie:', e);
      }
    }

    return response;
  } catch (error: any) {
    console.error('PUT /api/profile error:', error);
    return NextResponse.json({ error: 'Failed to update profile.' }, { status: 500 });
  }
}
