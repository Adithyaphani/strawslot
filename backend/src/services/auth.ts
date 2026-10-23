// Officer authentication: scrypt passwords, lockout, short-lived JWT access tokens, rotating refresh tokens.
import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env.js';
import { loginResults } from '../core/metrics.js';
import { AppError, unauthorized } from '../core/errors.js';
import * as users from '../repositories/users.js';
import * as tokens from '../repositories/tokens.js';
import { audit } from '../repositories/ops.js';
import { pool } from '../db/pool.js';

const key = new TextEncoder().encode(env.JWT_SECRET);
export type Role = users.User['role'];
export interface Claims { sub: string; username: string; role: Role; districtId: string }

async function signAccess(u: users.User): Promise<string> {
  return new SignJWT({ username: u.username, role: u.role, districtId: u.districtId })
    .setProtectedHeader({ alg: 'HS256' }).setSubject(u.id).setIssuer(env.JWT_ISSUER)
    .setIssuedAt().setExpirationTime(`${env.ACCESS_TOKEN_TTL_MIN}m`).sign(key);
}
export async function verifyAccess(token: string): Promise<Claims> {
  try {
    const { payload } = await jwtVerify(token, key, { issuer: env.JWT_ISSUER, algorithms: ['HS256'] });
    return { sub: String(payload.sub), username: String(payload.username), role: payload.role as Role, districtId: String(payload.districtId) };
  } catch { throw unauthorized('Session expired or invalid. Please sign in again.'); }
}

const DUMMY_HASH = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$' + 'A'.repeat(43);

export async function login(username: string, password: string, meta: { ip?: string; ua?: string }) {
  const u = await users.findByUsername(username || '');
  if (!u || !u.active) {
    // spend the same time as a real check so response timing does not reveal whether a username exists
    if (!u) await users.verifyPassword(password || '', DUMMY_HASH).catch(() => false);
    loginResults.inc({ result: 'unknown_or_disabled' });
    throw unauthorized('Invalid username or password');
  }
  if (u.lockedUntil && u.lockedUntil > new Date()) {
    loginResults.inc({ result: 'locked' });
    const mins = Math.ceil((u.lockedUntil.getTime() - Date.now()) / 60000);
    throw new AppError(423 as any, 'unauthorized', `Account locked after repeated failures. Try again in ${mins} minute(s).`, undefined, { 'retry-after': String(mins * 60) });
  }
  if (!(await users.verifyPassword(password || '', u.passwordHash))) {
    const f = await users.recordFailure(u.id, env.LOGIN_MAX_FAILURES, env.LOGIN_LOCK_MINUTES);
    loginResults.inc({ result: 'bad_password' });
    if (f?.locked_until) await audit(pool, u.districtId, u.username, 'login_locked', `account locked after ${f.failed_attempts} failed attempts`);
    throw unauthorized('Invalid username or password');
  }
  await users.recordSuccess(u.id);
  loginResults.inc({ result: 'ok' });
  await audit(pool, u.districtId, u.username, 'login', meta.ip ?? '');
  const refresh = await tokens.issueRefresh(u.id, env.REFRESH_TOKEN_TTL_DAYS, meta);
  const accessToken = await signAccess(u);
  return { user: u, accessToken, refreshToken: refresh.token };
}

export async function refresh(refreshToken: string, meta: { ip?: string; ua?: string }) {
  const r = await tokens.consumeRefresh(refreshToken);
  if (!r.ok) {
    loginResults.inc({ result: `refresh_${r.reason}` });
    throw unauthorized(r.reason === 'reused' ? 'This session was signed out because its token was used twice. Please sign in again.' : 'Session expired. Please sign in again.');
  }
  const u = await users.findById(r.userId);
  if (!u || !u.active) throw unauthorized('Account disabled');
  const next = await tokens.issueRefresh(u.id, env.REFRESH_TOKEN_TTL_DAYS, meta, r.familyId);
  await tokens.linkReplacement(r.oldId, next.id);
  return { user: u, accessToken: await signAccess(u), refreshToken: next.token };
}
export const logout = (refreshToken: string) => tokens.revokeFamilyByToken(refreshToken);
export const accessTtlSeconds = () => env.ACCESS_TOKEN_TTL_MIN * 60;
