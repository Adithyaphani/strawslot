import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { farmerBody, startHarness, type Harness } from './helpers.js';

let h: Harness;
before(async () => { h = await startHarness(); });
after(async () => { await h.stop(); });

const sent: { to: string; body: string; ref: string }[] = [];
const mode = { fail: false };

test('setup: stub SMS provider', async () => {
  const { setSmsProviderForTests } = await import('../src/jobs/sms.js');
  setSmsProviderForTests({ name: 'stub', async send(to, body, ref) { if (mode.fail) throw new Error('gateway down'); sent.push({ to, body, ref }); return `stub-${ref}`; } });
});

test('a booking writes its SMS to the outbox in the same commit; the worker delivers it with the rendered text', async () => {
  const reg = await h.call('POST', '/api/v1/farmer/fields', { body: farmerBody({ phone: '9700000001', farmerName: 'Outbox Kaur', language: 'pa' }) });
  assert.equal(reg.status, 201);
  const { query } = await import('../src/db/pool.js');
  const pending = await query("select status, body from notifications where field_id = $1", [reg.body.slot.id]);
  assert.equal(pending[0].status, 'pending');
  assert.equal(pending[0].body, null, 'text is rendered at send time from the latest plan');

  const { dispatchBatch } = await import('../src/jobs/outbox.js');
  const r = await dispatchBatch(50);
  assert.ok(r.sent >= 1);
  const row = (await query('select status, provider_ref, body, sent_at from notifications where field_id = $1', [reg.body.slot.id]))[0];
  assert.equal(row.status, 'sent');
  assert.ok(row.provider_ref.startsWith('stub-'));
  assert.ok(row.body.includes('Outbox') && /[਀-੿]/.test(row.body), 'Punjabi (Gurmukhi) message');
  assert.ok(sent.some((s) => s.to === '9700000001'));
});

test('duplicate enqueue with the same dedupe key creates one row', async () => {
  const { enqueueNotification } = await import('../src/repositories/ops.js');
  const { pool, query } = await import('../src/db/pool.js');
  const n = { districtId: 'sangrur', kind: 'plan_update', toPhone: '9700000002', lang: 'en', body: 'hello', dedupeKey: 'dedupe-test-1' };
  await enqueueNotification(pool, n); await enqueueNotification(pool, n);
  assert.equal((await query("select 1 from notifications where dedupe_key = 'dedupe-test-1'")).length, 1);
});

test('failures retry with backoff and end up dead after 6 attempts', async () => {
  const { enqueueNotification } = await import('../src/repositories/ops.js');
  const { pool, query } = await import('../src/db/pool.js');
  const { dispatchBatch } = await import('../src/jobs/outbox.js');
  await enqueueNotification(pool, { districtId: 'sangrur', kind: 'plan_update', toPhone: '9700000003', lang: 'en', body: 'will fail', dedupeKey: 'fail-test-1' });
  mode.fail = true;
  const get = async () => (await query("select status, attempts, last_error, next_attempt_at > now() as future from notifications where dedupe_key = 'fail-test-1'"))[0];
  await dispatchBatch(50);
  let row = await get();
  assert.equal(row.status, 'pending'); assert.equal(row.attempts, 1); assert.equal(row.future, true, 'backoff pushes the next attempt into the future'); assert.match(row.last_error, /gateway down/);
  for (let i = 2; i <= 6; i++) { await query("update notifications set next_attempt_at = now() where dedupe_key = 'fail-test-1'"); await dispatchBatch(50); }
  row = await get();
  assert.equal(row.status, 'dead'); assert.equal(row.attempts, 6);
  mode.fail = false;
});

test('many dispatchers at once deliver every message exactly once (SKIP LOCKED)', async () => {
  const { pool, query } = await import('../src/db/pool.js');
  const { dispatchBatch } = await import('../src/jobs/outbox.js');
  await query("delete from notifications");
  sent.length = 0;
  for (let i = 0; i < 60; i++) await query("insert into notifications (district_id, kind, to_phone, body) values ('sangrur','plan_update',$1,$2)", [`98000${String(i).padStart(5, '0')}`, `msg ${i}`]);
  await Promise.all([1, 2, 3, 4, 5, 6].map(() => dispatchBatch(15)));
  let guard = 0; while ((await query("select 1 from notifications where status = 'pending'")).length && guard++ < 10) await dispatchBatch(50);
  assert.equal(sent.length, 60);
  assert.equal(new Set(sent.map((s) => s.ref)).size, 60, 'no message sent twice');
  void pool;
});

test('rows stuck in "sending" after a worker crash are recovered', async () => {
  const { query } = await import('../src/db/pool.js');
  const { recoverStuck } = await import('../src/jobs/outbox.js');
  await query("insert into notifications (district_id, kind, to_phone, body, status, next_attempt_at) values ('sangrur','plan_update','9700000009','x','sending', now() - interval '1 minute')");
  assert.ok((await recoverStuck()) >= 1);
});
