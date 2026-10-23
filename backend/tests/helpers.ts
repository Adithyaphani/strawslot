// Shared test harness: a clean database, the real Express app on an ephemeral port, and a small HTTP client.
// Tests run against real PostgreSQL (and optionally Redis), not mocks.
import type { AddressInfo } from 'node:net';
import type http from 'node:http';

export const TEST_DB = process.env.TEST_DATABASE_URL || 'postgres://strawslot:strawslot@127.0.0.1:5432/strawslot_test';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = TEST_DB;
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';
process.env.RATE_LIMIT_GLOBAL_PER_MIN ||= '100000';
process.env.VERSION_CACHE_MS ||= '0';
process.env.BOOTSTRAP_SEED = 'false';

export interface Harness {
  base: string; server: http.Server;
  call: (method: string, path: string, opts?: { token?: string; body?: unknown; headers?: Record<string, string> }) => Promise<{ status: number; body: any; headers: Headers; text: string }>;
  login: (user?: string, password?: string) => Promise<any>;
  officerToken: () => Promise<string>;
  stop: () => Promise<void>;
}

export async function startHarness(): Promise<Harness> {
  const pg = await import('pg');
  const admin = new pg.default.Client({ connectionString: TEST_DB });
  await admin.connect();
  await admin.query('drop schema public cascade; create schema public;');
  await admin.end();

  const { migrate } = await import('../src/db/migrate.js');
  const { bootstrap } = await import('../src/seed/bootstrap.js');
  const { createApp } = await import('../src/http/app.js');
  const { closePool } = await import('../src/db/pool.js');
  await migrate();
  await bootstrap();
  const server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const call: Harness['call'] = async (method, path, opts = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { ...(opts.body ? { 'content-type': 'application/json' } : {}), ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}), ...(opts.headers || {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    let body: any = text; try { body = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, body, headers: res.headers, text };
  };
  const login = async (user = 'officer', password = 'sangrur2026') => (await call('POST', '/api/v1/auth/login', { body: { user, password } }));
  let cached: string | null = null;
  return {
    base, server, call, login,
    officerToken: async () => (cached ||= (await login()).body.accessToken),
    stop: async () => { await new Promise((r) => server.close(r)); await closePool(); const { closeRedis } = await import('../src/cache/redis.js'); await closeRedis(); },
  };
}

export const farmerBody = (over: Record<string, unknown> = {}) => ({
  farmerName: 'Test Farmer', phone: '9876543210', language: 'en', villageId: 'v-sangrur-1', acres: 3.5,
  harvestDate: new Date(Date.now() + 5.5 * 3600e3 + 3 * 86400e3).toISOString().slice(0, 10), windowDays: 16, preference: 'any', tractor: { owns: false, hp: 0 }, ...over,
});
