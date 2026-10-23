import pg from 'pg';
import { env } from '../config/env.js';
import { logger } from '../core/logger.js';

// numeric -> number, int8 -> number, date -> 'YYYY-MM-DD' string (no time-zone surprises for deadlines)
pg.types.setTypeParser(1700, (v) => parseFloat(v));
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1082, (v) => v);

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: env.DB_STATEMENT_TIMEOUT_MS,
  application_name: 'strawslot',
});
pool.on('error', (e) => logger.error({ err: e.message }, 'idle postgres client error'));

export type Db = pg.Pool | pg.PoolClient;
export const query = <T = any>(text: string, params: unknown[] = [], db: Db = pool) => db.query(text, params as any[]).then((r) => r.rows as T[]);
export const one = async <T = any>(text: string, params: unknown[] = [], db: Db = pool): Promise<T | null> => (await query<T>(text, params, db))[0] ?? null;

/** Run fn inside a transaction. Rolls back on any error; the connection always goes back to the pool. */
export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('begin');
    const out = await fn(c);
    await c.query('commit');
    return out;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/** Serialise read-modify-write work for one district (e.g. auto-fix) across every API instance. */
export const lockDistrict = (c: pg.PoolClient, districtId: string) =>
  c.query('select pg_advisory_xact_lock(hashtext($1))', [`district:${districtId}`]);

export const poolStats = () => ({ total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount });
export async function closePool() { await pool.end(); }
