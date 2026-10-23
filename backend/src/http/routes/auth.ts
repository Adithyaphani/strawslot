import { loginResults } from '../../core/metrics.js';
import * as auth from '../../services/auth.js';
import * as users from '../../repositories/users.js';
import { env } from '../../config/env.js';
import { unauthorized } from '../../core/errors.js';
import { define } from '../route.js';
import { LoginSchema, RefreshSchema } from '../schemas.js';

const meta = (c: { ip: string; req: any }) => ({ ip: c.ip, ua: String(c.req.headers['user-agent'] || '') });
const session = (r: { user: users.User; accessToken: string; refreshToken: string }) => ({
  token: r.accessToken, // legacy field name used by the web app
  accessToken: r.accessToken, refreshToken: r.refreshToken, tokenType: 'Bearer', expiresIn: auth.accessTtlSeconds(),
  user: { name: r.user.displayName, username: r.user.username, role: r.user.role, district: r.user.districtId },
});

define({ method: 'post', path: '/auth/login', tag: 'Auth', summary: 'Sign in. Returns a short-lived access token and a rotating refresh token.', auth: 'public', body: LoginSchema,
  rate: { bucket: 'login', limit: env.RATE_LIMIT_LOGIN_PER_15MIN, windowMs: 15 * 60_000 }, responses: { 200: 'Signed in', 401: 'Invalid credentials', 423: 'Account locked' },
  handler: async (c) => session(await auth.login(c.body.username, c.body.password, meta(c))) });

define({ method: 'post', path: '/auth/refresh', tag: 'Auth', summary: 'Exchange a refresh token for a new access token and a new refresh token (the old one stops working)', auth: 'public', body: RefreshSchema,
  rate: { bucket: 'refresh', limit: 60, windowMs: 15 * 60_000 }, handler: async (c) => session(await auth.refresh(c.body.refreshToken, meta(c))) });

define({ method: 'post', path: '/auth/logout', tag: 'Auth', summary: 'Revoke a refresh token family', auth: 'public', body: RefreshSchema,
  handler: async (c) => { await auth.logout(c.body.refreshToken); return { ok: true }; } });

define({ method: 'get', path: '/auth/me', tag: 'Auth', summary: 'Who am I', auth: 'viewer',
  handler: async (c) => { const u = await users.findById(c.user!.sub); if (!u || !u.active) throw unauthorized('Account disabled'); return { user: users.publicUser(u) }; } });
void loginResults;
