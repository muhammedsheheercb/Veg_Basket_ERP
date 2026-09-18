import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, hasValidSession } from './lib/session';

export async function middleware(request: NextRequest) { const session = await hasValidSession(request.cookies.get(SESSION_COOKIE)?.value); if (!session) return NextResponse.redirect(new URL('/login', request.url)); return NextResponse.next(); }
export const config = { matcher: ['/((?!login|api/auth|_next|images|favicon.ico).*)'] };
