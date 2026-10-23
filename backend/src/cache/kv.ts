// Tiny key-value facade: Redis when configured, otherwise in-process. Used by the plan cache and rate limiter.
import { redis } from './redis.js';

interface Entry { v: Buffer | string; exp: number }
const mem = new Map<string, Entry>();
setInterval(() => { const now = Date.now(); for (const [k, e] of mem) if (e.exp < now) mem.delete(k); }, 30_000).unref();

export async function kvGet(key: string): Promise<Buffer | null> {
  const r = redis();
  if (r) { try { return await r.getBuffer(key); } catch { return null; } }
  const e = mem.get(key);
  return e && e.exp > Date.now() ? Buffer.from(e.v as any) : null;
}
export async function kvSet(key: string, value: Buffer | string, ttlS: number): Promise<void> {
  const r = redis();
  if (r) { try { await r.set(key, value, 'EX', ttlS); } catch { /* fail open */ } return; }
  mem.set(key, { v: value, exp: Date.now() + ttlS * 1000 });
}
/** SET NX with expiry: true when this caller got the lock. */
export async function kvLock(key: string, ttlMs: number): Promise<boolean> {
  const r = redis();
  if (r) { try { return (await r.set(key, '1', 'PX', ttlMs, 'NX')) === 'OK'; } catch { return true; } }
  const e = mem.get(key);
  if (e && e.exp > Date.now()) return false;
  mem.set(key, { v: '1', exp: Date.now() + ttlMs });
  return true;
}
export async function kvUnlock(key: string): Promise<void> {
  const r = redis();
  if (r) { try { await r.del(key); } catch { /* ignore */ } return; }
  mem.delete(key);
}
/** Fixed-window counter; returns the new count and ms until the window resets. */
export async function kvIncr(key: string, windowMs: number): Promise<{ count: number; resetMs: number }> {
  const r = redis();
  if (r) {
    try {
      const res = await r.multi().incr(key).pexpire(key, windowMs, 'NX').pttl(key).exec();
      return { count: Number(res![0][1]), resetMs: Math.max(0, Number(res![2][1])) };
    } catch { return { count: 0, resetMs: windowMs }; }
  }
  const now = Date.now();
  const e = mem.get(key);
  if (!e || e.exp <= now) { mem.set(key, { v: '1', exp: now + windowMs }); return { count: 1, resetMs: windowMs }; }
  const count = Number(e.v) + 1; e.v = String(count);
  return { count, resetMs: e.exp - now };
}
export const kvClearMemory = () => mem.clear();
