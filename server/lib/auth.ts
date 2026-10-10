// Minimal signed-token auth for the officer (admin) side. Farmers never need to log in.
import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { AdminClaims } from '../types.js';

const secret = () => process.env.AUTH_SECRET || 'strawslot-dev-secret-change-me';
const b64 = (s: string) => Buffer.from(s).toString('base64url');

export function credentials() {
  return { user: process.env.ADMIN_USER || 'officer', password: process.env.ADMIN_PASSWORD || 'sangrur2026' };
}

export function sign(payload: { sub: string; role: 'officer' }, ttlHours = 12): string {
  const body = b64(JSON.stringify({ ...payload, exp: Date.now() + ttlHours * 3600e3 }));
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verify(token: string | null): AdminClaims | null {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expect = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}

export function checkPassword(user: unknown, password: unknown): boolean {
  const c = credentials();
  const eq = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  return eq(String(user).trim().toLowerCase(), c.user.toLowerCase()) && eq(String(password), c.password);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization || '';
  const p = verify(h.startsWith('Bearer ') ? h.slice(7) : null);
  if (!p) return res.status(401).json({ error: 'Officer login required' });
  (req as Request & { admin: AdminClaims }).admin = p;
  next();
}
