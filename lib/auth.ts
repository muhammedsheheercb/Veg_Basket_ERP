import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { users } from './schema';

const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
export const SESSION_COOKIE = 'veg_basket_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export type Session = { id: string; email: string; name: string; role: string };
export async function authenticate(email: string, password: string): Promise<Session | null> { const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1); if (!user?.active || !(await bcrypt.compare(password, user.passwordHash))) return null; return { id: user.id, email: user.email, name: user.name, role: user.role }; }
export async function signSession(session: Session) { if (!process.env.AUTH_SECRET) throw new Error('AUTH_SECRET must be configured.'); return new SignJWT(session).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('30d').sign(secret); }
export async function verifySession(token?: string): Promise<Session | null> { if (!token || !process.env.AUTH_SECRET) return null; try { return (await jwtVerify(token, secret)).payload as unknown as Session; } catch { return null; } }
