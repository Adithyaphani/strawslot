// Idempotency keys for farmer registration: the same key + same body returns the original answer instead of creating a second field.
import crypto from 'node:crypto';
import type { PoolClient } from 'pg';
import { one, query } from '../db/pool.js';
import { AppError, conflict } from '../core/errors.js';

export const hashBody = (b: unknown) => crypto.createHash('sha256').update(JSON.stringify(b)).digest('hex');

export interface Replay { statusCode: number; response: unknown }

/** Pre-check outside the transaction: returns the stored answer, or null when the key is new. */
export async function lookup(scope: string, key: string, hash: string): Promise<Replay | null> {
  const r = await one<{ request_hash: string; status_code: number | null; response: unknown }>('select request_hash, status_code, response from idempotency_keys where scope = $1 and key = $2', [scope, key]);
  if (!r) return null;
  if (r.request_hash !== hash) throw new AppError(422, 'conflict', 'This Idempotency-Key was already used with a different request body');
  if (r.response == null) throw conflict('A request with this Idempotency-Key is still being processed. Retry in a moment.');
  return { statusCode: r.status_code ?? 200, response: r.response };
}
/** Inside the transaction: claims the key. Returns false when a concurrent request already claimed it. */
export async function claim(c: PoolClient, scope: string, key: string, hash: string): Promise<boolean> {
  const r = await query('insert into idempotency_keys (scope, key, request_hash) values ($1,$2,$3) on conflict do nothing returning key', [scope, key, hash], c);
  return r.length > 0;
}
export const complete = (scope: string, key: string, statusCode: number, response: unknown) =>
  query('update idempotency_keys set status_code = $3, response = $4 where scope = $1 and key = $2', [scope, key, statusCode, JSON.stringify(response)]);
