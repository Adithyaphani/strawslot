// Worker runtime: the outbox loop on every worker, plus leader-elected periodic jobs.
import pg from 'pg';
import { env } from '../config/env.js';
import { logger } from '../core/logger.js';
import { dispatchBatch, recoverStuck } from './outbox.js';
import { jobs, runJob } from './scheduled.js';

const LEADER_LOCK = 727002;

export async function startWorker(): Promise<() => Promise<void>> {
  let stopping = false;
  const timers: NodeJS.Timeout[] = [];
  let leaderClient: pg.Client | null = null;
  let isLeader = false;
  const lastRun = new Map<string, number>();

  // ---- outbox: every worker, polling; SKIP LOCKED keeps them from fighting
  const outbox = (async () => {
    while (!stopping) {
      try {
        const r = await dispatchBatch(20);
        if (r.sent + r.failed + r.dead > 0) { logger.info(r, 'outbox batch'); continue; } // more may be waiting
      } catch (e) { logger.error({ err: e.message }, 'outbox error'); }
      await new Promise((res) => setTimeout(res, 1500));
    }
  })();
  timers.push(setInterval(() => { recoverStuck().then((n) => n && logger.warn({ n }, 'recovered stuck notifications')).catch(() => {}); }, 60_000));

  // ---- leader election with a session-level advisory lock on a dedicated connection
  async function tryLead() {
    if (stopping || isLeader) return;
    try {
      if (!leaderClient) { leaderClient = new pg.Client({ connectionString: env.DATABASE_URL, application_name: 'strawslot-leader' }); leaderClient.on('error', () => { isLeader = false; leaderClient = null; }); await leaderClient.connect(); }
      const r = await leaderClient.query('select pg_try_advisory_lock($1) as ok', [LEADER_LOCK]);
      if (r.rows[0].ok) { isLeader = true; logger.info('this worker is now the leader'); }
    } catch (e) { isLeader = false; leaderClient = null; logger.warn({ err: e.message }, 'leader election failed'); }
  }
  async function tick() {
    await tryLead();
    if (!isLeader) return;
    for (const j of jobs) {
      if (Date.now() - (lastRun.get(j.name) ?? 0) >= j.everyMs) { lastRun.set(j.name, Date.now()); await runJob(j); }
    }
  }
  const t0 = setTimeout(() => void tick(), 500); // first run shortly after boot so data exists immediately
  timers.push(setInterval(() => void tick(), 10_000), t0 as any);

  logger.info('worker started');
  return async () => {
    stopping = true; timers.forEach((t) => { clearInterval(t); clearTimeout(t); });
    await outbox;
    if (leaderClient) await leaderClient.end().catch(() => {});  // releasing the connection releases the lock
    logger.info('worker stopped');
  };
}
