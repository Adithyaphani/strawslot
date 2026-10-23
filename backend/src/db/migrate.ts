// Forward-only SQL migrations. Safe to run from many instances at once (advisory lock).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';
import { logger } from '../core/logger.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

export async function migrate(): Promise<string[]> {
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const c = await pool.connect();
  const applied: string[] = [];
  try {
    await c.query('select pg_advisory_lock(727001)');
    await c.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())');
    const done = new Set((await c.query('select name from schema_migrations')).rows.map((r) => r.name));
    for (const f of files) {
      if (done.has(f)) continue;
      const sql = await fs.readFile(path.join(dir, f), 'utf8');
      try {
        await c.query('begin');
        await c.query(sql);
        await c.query('insert into schema_migrations(name) values ($1)', [f]);
        await c.query('commit');
        applied.push(f);
        logger.info({ migration: f }, 'migration applied');
      } catch (e) {
        await c.query('rollback');
        throw new Error(`Migration ${f} failed: ${e.message}`);
      }
    }
  } finally {
    await c.query('select pg_advisory_unlock(727001)').catch(() => {});
    c.release();
  }
  return applied;
}

export async function latestMigration(): Promise<{ expected: string; current: string | null }> {
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const r = await pool.query('select name from schema_migrations order by name desc limit 1').catch(() => ({ rows: [] as any[] }));
  return { expected: files[files.length - 1], current: r.rows[0]?.name ?? null };
}
