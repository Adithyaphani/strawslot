// The heart of the read path. A "plan" is the full schedule for one district. Computing it is the only
// CPU-heavy thing the API does, so plans are cached under a key that includes the district's data version:
//   key = plan:<district>:<data_version>:<live-data stamp>:<today>
// Any write bumps data_version (database trigger), so a cached plan can never be stale, and nothing ever
// needs to be "invalidated". Three layers: in-process LRU -> Redis (shared by all instances) -> compute.
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import { env } from '../config/env.js';
import { cacheEvents, scheduleCompute } from '../core/metrics.js';
import { logger } from '../core/logger.js';
import { kvGet, kvLock, kvSet, kvUnlock } from '../cache/kv.js';
import { getVersion } from '../repositories/districts.js';
import { loadState } from '../repositories/snapshot.js';
import { pool } from '../db/pool.js';
import { buildAlerts, buildStats, runSchedule } from '../domain/engine.js';
import { todayIST } from '../domain/dates.js';
import type { Alert, Schedule, ScheduleOptions, State } from '../domain/types.js';
import { getLive, rainMap } from './liveService.js';
import { notFound } from '../core/errors.js';

const gzip = promisify(zlib.gzip), gunzip = promisify(zlib.gunzip);

export interface Plan {
  districtId: string; version: number; stamp: string; today: string;
  state: State; sched: Schedule;
  stats: ReturnType<typeof buildStats>;
  baseline: { onTimePct: number; atRisk: number; protectedAcres: number };
  alerts: Alert[];
  opts: ScheduleOptions;
  live: { weatherSource: string; weatherLive: boolean; firesSource: string; firesLive: boolean; districtFires: number; punjabFires: number };
  computedAt: string; computeMs: number;
}

// ---- L1: small LRU
const L1_MAX = 6;
const l1 = new Map<string, Plan>();
const l1Get = (k: string) => { const v = l1.get(k); if (v) { l1.delete(k); l1.set(k, v); } return v; };
const l1Set = (k: string, v: Plan) => { l1.set(k, v); while (l1.size > L1_MAX) l1.delete(l1.keys().next().value); };
export const clearPlanCache = () => l1.clear();

// ---- data version, cached for a few hundred ms so a burst of requests costs one tiny query
const versionCache = new Map<string, { at: number; v: number }>();
export async function currentVersion(districtId: string): Promise<number> {
  const hit = versionCache.get(districtId);
  if (hit && Date.now() - hit.at < env.VERSION_CACHE_MS) return hit.v;
  const v = await getVersion(districtId);
  if (v == null) throw notFound(`Unknown district "${districtId}"`);
  versionCache.set(districtId, { at: Date.now(), v });
  return v;
}
/** Called after this instance commits a write so the next read on this instance sees it immediately. */
export const noteWrite = (districtId: string) => versionCache.delete(districtId);

// ---- single flight: concurrent misses for one key share one computation
const inflight = new Map<string, Promise<Plan>>();

/** Reads version + all tables in ONE repeatable-read snapshot so the plan is internally consistent. */
async function readSnapshot(districtId: string): Promise<{ version: number; state: State }> {
  const c = await pool.connect();
  try {
    await c.query('begin isolation level repeatable read read only');
    const version = await getVersion(districtId, c);
    if (version == null) throw notFound(`Unknown district "${districtId}"`);
    const state = await loadState(districtId, c);
    await c.query('commit');
    return { version, state };
  } catch (e) { await c.query('rollback').catch(() => {}); throw e; } finally { c.release(); }
}

export async function computePlan(districtId: string, version: number, state: State): Promise<Plan> {
  const t0 = process.hrtime.bigint();
  const live = await getLive(districtId);
  const opts: ScheduleOptions = { today: todayIST(), rain: rainMap(live.weather), fires: live.fires.payload.district };
  const sched = runSchedule(state, opts);
  const stats = buildStats(state, sched);
  const base = buildStats(state, runSchedule(state, { ...opts, mode: 'baseline' }));
  const alerts = buildAlerts(state, sched);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  scheduleCompute.observe(ms / 1000);
  return {
    districtId, version, stamp: live.stamp, today: opts.today, state, sched, stats,
    baseline: { onTimePct: base.onTimePct, atRisk: base.fields.atRisk, protectedAcres: base.acres.protected },
    alerts, opts,
    live: { weatherSource: live.weather.source, weatherLive: live.weather.live, firesSource: live.fires.source, firesLive: live.fires.live, districtFires: live.fires.payload.districtCount, punjabFires: live.fires.payload.punjabCount },
    computedAt: new Date().toISOString(), computeMs: Math.round(ms),
  };
}

const keyOf = (p: { districtId: string; version: number; stamp: string; today: string }) => `plan:${p.districtId}:${p.version}:${p.stamp}:${p.today}`;

async function computeAndStore(districtId: string): Promise<Plan> {
  const { version, state } = await readSnapshot(districtId);
  const plan = await computePlan(districtId, version, state);
  const key = keyOf(plan);
  l1Set(key, plan);
  gzip(JSON.stringify(plan), { level: 1 }).then((z) => kvSet(key, z, env.PLAN_CACHE_TTL_S)).catch((e) => logger.warn({ err: e.message }, 'plan cache write failed'));
  return plan;
}

async function fromRedis(key: string): Promise<Plan | null> {
  const buf = await kvGet(key);
  if (!buf) return null;
  try { return JSON.parse((await gunzip(buf)).toString()); } catch { return null; }
}

/** Read path. Cheap when the plan is cached, which is almost always. */
export async function getPlan(districtId: string): Promise<Plan> {
  const version = await currentVersion(districtId);
  const live = await getLive(districtId);
  const key = `plan:${districtId}:${version}:${live.stamp}:${todayIST()}`;

  const hit = l1Get(key);
  if (hit) { cacheEvents.inc({ layer: 'l1', result: 'hit' }); return hit; }
  const pending = inflight.get(key);
  if (pending) { cacheEvents.inc({ layer: 'l1', result: 'coalesced' }); return pending; }

  const p = (async () => {
    const r = await fromRedis(key);
    if (r) { cacheEvents.inc({ layer: 'l2', result: 'hit' }); l1Set(key, r); return r; }
    cacheEvents.inc({ layer: 'l2', result: 'miss' });
    // Another instance may be computing this exact key right now; wait briefly rather than duplicate the work.
    const lockKey = `lock:${key}`;
    const got = await kvLock(lockKey, 15_000);
    if (!got) {
      for (let i = 0; i < 20; i++) {
        await new Promise((res) => setTimeout(res, 50));
        const again = await fromRedis(key);
        if (again) { cacheEvents.inc({ layer: 'l2', result: 'waited' }); l1Set(key, again); return again; }
      }
    }
    try { return await computeAndStore(districtId); } finally { if (got) await kvUnlock(lockKey); }
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// ---- group commit for write responses -------------------------------------------------------------
// After a write commits, its response needs a plan that includes that write. If 50 farmers book at once we
// must not compute 50 plans. A run that STARTED before a caller's commit cannot be used by that caller, so
// callers wait for the running one and then share exactly one follow-up run.
const groups = new Map<string, { running: Promise<Plan>; next?: Promise<Plan> }>();

/** Call only after the write has committed. Returns a plan that includes it. */
export function freshPlan(districtId: string): Promise<Plan> {
  noteWrite(districtId);
  const g = groups.get(districtId);
  const start = () => {
    const run: Promise<Plan> = computeAndStore(districtId);
    const entry = { running: run } as { running: Promise<Plan>; next?: Promise<Plan> };
    groups.set(districtId, entry);
    run.finally(() => { if (groups.get(districtId) === entry) groups.delete(districtId); }).catch(() => {});
    return run;
  };
  if (!g) return start();
  if (!g.next) {
    g.next = g.running.catch(() => undefined).then(() => start());
    // next becomes the running entry when it starts; later arrivals queue behind it
  }
  return g.next;
}
