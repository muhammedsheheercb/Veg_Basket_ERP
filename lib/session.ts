import { jwtVerify } from 'jose';
const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
export const SESSION_COOKIE = 'veg_basket_session';
export async function hasValidSession(token?: string) { if (!token || !process.env.AUTH_SECRET) return false; try { await jwtVerify(token, secret); return true; } catch { return false; } }
