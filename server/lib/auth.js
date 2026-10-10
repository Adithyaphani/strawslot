// Minimal signed-token auth for the officer (admin) side. Farmers never need to log in.
import crypto from 'node:crypto';

const secret = () => process.env.AUTH_SECRET || 'strawslot-dev-secret-change-me';
const b64 = (s) => Buffer.from(s).toString('base64url');

export function credentials() {
  return { user: process.env.ADMIN_USER || 'officer', password: process.env.ADMIN_PASSWORD || 'sangrur2026' };
}

export function sign(payload, ttlHours = 12) {
  const body = b64(JSON.stringify({ ...payload, exp: Date.now() + ttlHours * 3600e3 }));
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expect = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}

export function checkPassword(user, password) {
  const c = credentials();
  const eq = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  return eq(String(user), c.user) && eq(String(password), c.password);
}

export function requireAdmin(req, res, next) {
  const h = req.headers.authorization || '';
  const p = verify(h.startsWith('Bearer ') ? h.slice(7) : null);
  if (!p) return res.status(401).json({ error: 'Officer login required' });
  req.admin = p;
  next();
}
