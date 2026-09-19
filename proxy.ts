import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, hasValidSession } from './lib/session';

type Window = { count: number; resetAt: number };
const limits = new Map<string, Window>();

function limited(request: NextRequest, max: number, windowMs: number) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  const key = `${request.nextUrl.pathname}:${ip}`;
  const now = Date.now();
  const current = limits.get(key);
  if (!current || current.resetAt <= now) { limits.set(key, { count: 1, resetAt: now + windowMs }); return false; }
  current.count += 1;
  return current.count > max;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const write = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  const isLogin = pathname === '/api/auth/login';
  if (isLogin && limited(request, 5, 15 * 60_000)) return NextResponse.json({ error: 'Too many sign-in attempts. Please try again in 15 minutes.' }, { status: 429, headers: { 'Retry-After': '900' } });
  if (pathname.startsWith('/api/') && write && !pathname.startsWith('/api/auth/') && limited(request, 120, 60_000)) return NextResponse.json({ error: 'Too many requests. Please wait a moment and try again.' }, { status: 429, headers: { 'Retry-After': '60' } });
  if (pathname.startsWith('/api/auth/')) return NextResponse.next();
  const session = await hasValidSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = { matcher: ['/((?!login|unauthorized|_next|images|favicon.ico).*)'] };
