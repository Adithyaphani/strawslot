import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { one, query, pool, type Db } from '../db/pool.js';

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number, opts: crypto.ScryptOptions) => Promise<Buffer>;
const N = 16384, R = 8, P = 1, KEYLEN = 32;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const dk = await scrypt(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${dk.toString('base64url')}`;
}
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split('$');
  if (alg !== 'scrypt') return false;
  const expect = Buffer.from(hash, 'base64url');
  const dk = await scrypt(password, Buffer.from(salt, 'base64url'), expect.length, { N: +n, r: +r, p: +p });
  return dk.length === expect.length && crypto.timingSafeEqual(dk, expect);
}

export interface User { id: string; username: string; displayName: string; role: 'viewer' | 'officer' | 'admin'; districtId: string; active: boolean; failedAttempts: number; lockedUntil: Date | null; passwordHash: string; lastLoginAt: Date | null; createdAt: Date }
const map = (r: any): User => ({ id: r.id, username: r.username, displayName: r.display_name, role: r.role, districtId: r.district_id, active: r.active, failedAttempts: r.failed_attempts, lockedUntil: r.locked_until, passwordHash: r.password_hash, lastLoginAt: r.last_login_at, createdAt: r.created_at });
export const publicUser = (u: User) => ({ id: u.id, username: u.username, name: u.displayName, role: u.role, districtId: u.districtId, active: u.active, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt });

export const findByUsername = async (username: string, db: Db = pool) => { const r = await one('select * from users where lower(username) = lower($1)', [username.trim()], db); return r ? map(r) : null; };
export const findById = async (id: string, db: Db = pool) => { const r = await one('select * from users where id = $1', [id], db); return r ? map(r) : null; };
export const listUsers = async (districtId: string) => (await query('select * from users where district_id = $1 order by created_at', [districtId])).map(map);
export const countUsers = async () => Number((await one<{ n: number }>('select count(*)::int as n from users'))!.n);

export async function createUser(u: { username: string; displayName: string; password: string; role: User['role']; districtId: string }) {
  const hash = await hashPassword(u.password);
  const r = await one('insert into users (username, display_name, password_hash, role, district_id) values ($1,$2,$3,$4,$5) returning *', [u.username.trim(), u.displayName, hash, u.role, u.districtId]);
  return map(r);
}
export const recordFailure = (id: string, max: number, lockMinutes: number) =>
  one<{ failed_attempts: number; locked_until: Date | null }>(
    `update users set failed_attempts = failed_attempts + 1,
            locked_until = case when failed_attempts + 1 >= $2 then now() + make_interval(mins => $3) else locked_until end
     where id = $1 returning failed_attempts, locked_until`, [id, max, lockMinutes]);
export const recordSuccess = (id: string) => query('update users set failed_attempts = 0, locked_until = null, last_login_at = now() where id = $1', [id]);
export const updateUser = async (id: string, patch: { active?: boolean; role?: User['role']; password?: string; displayName?: string }) => {
  const hash = patch.password ? await hashPassword(patch.password) : null;
  const r = await one(`update users set active = coalesce($2, active), role = coalesce($3, role), password_hash = coalesce($4, password_hash),
      display_name = coalesce($5, display_name), failed_attempts = case when $4 is not null then 0 else failed_attempts end,
      locked_until = case when $4 is not null then null else locked_until end where id = $1 returning *`,
    [id, patch.active ?? null, patch.role ?? null, hash, patch.displayName ?? null]);
  return r ? map(r) : null;
};
