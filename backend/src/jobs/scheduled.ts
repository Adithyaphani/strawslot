// Periodic jobs. Only the elected leader worker runs these, so there is one refresh per interval no matter how many workers exist.
import { env } from '../config/env.js';
import { logger } from '../core/logger.js';
import { jobRuns } from '../core/metrics.js';
import { one, query } from '../db/pool.js';
import { todayIST } from '../domain/dates.js';
import { listDistricts } from '../repositories/districts.js';
import { districtIsStale, reseedFields } from '../seed/seedDistrict.js';
import { freshPlan } from '../services/planService.js';
import { refreshLive } from '../services/liveService.js';

export interface Job { name: string; everyMs: number; run: () => Promise<string | void> }

export const jobs: Job[] = [
  { name: 'live-refresh', everyMs: env.LIVE_REFRESH_MINUTES * 60_000, run: async () => {
    const out: string[] = [];
    for (const d of await listDistricts()) out.push(`${d.id}: ${JSON.stringify(await refreshLive(d.id))}`);
    return out.join('; ');
  } },
  { name: 'kpi-snapshot', everyMs: 15 * 60_000, run: async () => {
    let n = 0;
    for (const d of await listDistricts()) {
      const plan = await freshPlan(d.id);
      const s = plan.stats;
      await query(`insert into kpi_history (district_id, day, on_time_pct, baseline_pct, pending, at_risk, high_risk, utilisation_pct, protected_acres)
                   values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                   on conflict (district_id, day) do update set on_time_pct = excluded.on_time_pct, baseline_pct = excluded.baseline_pct, pending = excluded.pending,
                     at_risk = excluded.at_risk, high_risk = excluded.high_risk, utilisation_pct = excluded.utilisation_pct, protected_acres = excluded.protected_acres`,
        [d.id, todayIST(), s.onTimePct, plan.baseline.onTimePct, s.fields.pending, s.fields.atRisk, s.fields.highRisk, s.utilisationPct, s.acres.protected]);
      n++;
    }
    return `${n} district(s)`;
  } },
  { name: 'cleanup', everyMs: 60 * 60_000, run: async () => {
    const a = await query("delete from idempotency_keys where created_at < now() - interval '48 hours' returning 1");
    const b = await query("delete from refresh_tokens where expires_at < now() - interval '30 days' or revoked_at < now() - interval '30 days' returning 1");
    const c = await query("delete from notifications where status in ('sent','dead') and created_at < now() - interval '90 days' returning 1");
    const d = await query("delete from job_runs where started_at < now() - interval '14 days' returning 1");
    return `idempotency ${a.length}, tokens ${b.length}, notifications ${c.length}, job_runs ${d.length}`;
  } },
  { name: 'demo-reseed', everyMs: 60 * 60_000, run: async () => {
    if (!env.DEMO_AUTO_RESEED) return 'disabled';
    if (!(await districtIsStale())) return 'fresh';
    const n = await reseedFields(todayIST(), 'system');
    return `reseeded ${n} simulated fields`;
  } },
];

/** Runs one job with bookkeeping in job_runs and metrics. Errors never escape: a failing job must not stop the worker. */
export async function runJob(j: Job): Promise<void> {
  const row = await one<{ id: number }>('insert into job_runs (job) values ($1) returning id', [j.name]).catch(() => null);
  try {
    const detail = (await j.run()) ?? '';
    jobRuns.inc({ job: j.name, result: 'ok' });
    if (row) await query("update job_runs set finished_at = now(), status = 'ok', detail = $2 where id = $1", [row.id, String(detail).slice(0, 500)]);
    logger.info({ job: j.name, detail }, 'job ok');
  } catch (e) {
    jobRuns.inc({ job: j.name, result: 'error' });
    if (row) await query("update job_runs set finished_at = now(), status = 'error', detail = $2 where id = $1", [row.id, String(e.message).slice(0, 500)]).catch(() => {});
    logger.error({ job: j.name, err: e.message }, 'job failed');
  }
}
