// Transactional-outbox dispatcher. Many workers can run at once: rows are claimed with FOR UPDATE SKIP LOCKED.
import { logger } from '../core/logger.js';
import { notificationsSent } from '../core/metrics.js';
import { query } from '../db/pool.js';
import { getPlan } from '../services/planService.js';
import { farmerSlot, index } from '../services/views.js';
import { smsProvider } from './sms.js';

const MAX_ATTEMPTS = 6;
const backoffS = (attempt: number) => Math.min(30 * 2 ** (attempt - 1), 3600); // 30s, 1m, 2m, 4m, 8m ...

async function claim(limit: number) {
  // visibility timeout: a claimed row comes back by itself after 5 minutes if the worker dies mid-send
  return query(`update notifications set status = 'sending', attempts = attempts + 1, next_attempt_at = now() + interval '5 minutes'
                where id in (select id from notifications where status = 'pending' and next_attempt_at <= now() order by next_attempt_at limit $1 for update skip locked)
                returning id, district_id, field_id, kind, to_phone, lang, body, attempts`, [limit]);
}

async function render(n: any): Promise<string> {
  if (n.body) return n.body;
  const plan = await getPlan(n.district_id);
  const f = index(plan.state.fields)[n.field_id];
  if (!f) throw new Error('field no longer exists');
  const r = index(plan.sched.results)[n.field_id];
  return farmerSlot(plan.state, f, r, n.lang).message;
}

export async function dispatchBatch(limit = 20): Promise<{ sent: number; failed: number; dead: number }> {
  const rows = await claim(limit);
  const out = { sent: 0, failed: 0, dead: 0 };
  const provider = smsProvider();
  await Promise.all(rows.map(async (n) => {
    try {
      const body = await render(n);
      const ref = await provider.send(n.to_phone, body, n.id);
      await query("update notifications set status = 'sent', sent_at = now(), provider_ref = $2, body = $3, last_error = null where id = $1", [n.id, ref ?? null, body]);
      out.sent++; notificationsSent.inc({ result: 'sent' });
    } catch (e) {
      const dead = n.attempts >= MAX_ATTEMPTS;
      await query(`update notifications set status = $2, last_error = $3, next_attempt_at = now() + make_interval(secs => $4) where id = $1`,
        [n.id, dead ? 'dead' : 'pending', String(e.message).slice(0, 300), backoffS(n.attempts)]);
      if (dead) { out.dead++; notificationsSent.inc({ result: 'dead' }); logger.error({ id: n.id, err: e.message }, 'notification gave up'); }
      else { out.failed++; notificationsSent.inc({ result: 'retry' }); }
    }
  }));
  return out;
}

/** Rows stuck in "sending" past their visibility timeout go back to the queue. */
export const recoverStuck = () => query("update notifications set status = 'pending' where status = 'sending' and next_attempt_at < now() returning id").then((r) => r.length);
