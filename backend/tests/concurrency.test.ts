import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { farmerBody, startHarness, type Harness } from './helpers.js';

let h: Harness;
before(async () => { h = await startHarness(); });
after(async () => { await h.stop(); });
const V1 = '/api/v1';

async function computeCount(): Promise<number> {
  const { registry } = await import('../src/core/metrics.js');
  const text = await registry.getSingleMetricAsString('schedule_compute_seconds');
  return Number(/schedule_compute_seconds_count (\d+)/.exec(text)![1]);
}

test('40 farmers booking at the same instant: unique ids, no errors, and far fewer than 40 plan computations', async () => {
  await h.call('GET', `${V1}/public/stats`); // warm
  const before = await computeCount();
  const results = await Promise.all(Array.from({ length: 40 }, (_, i) =>
    h.call('POST', `${V1}/farmer/fields`, { body: farmerBody({ phone: `97${String(10000000 + i)}`, farmerName: `Burst ${i}`, acres: 2 + (i % 5) }) })));
  assert.ok(results.every((r) => r.status === 201), JSON.stringify(results.filter((r) => r.status !== 201).map((r) => r.body)));
  const ids = results.map((r) => r.body.slot.id);
  assert.equal(new Set(ids).size, 40, 'field ids must be unique');
  const computes = (await computeCount()) - before;
  console.log(`      40 concurrent bookings used ${computes} plan computations`);
  assert.ok(computes <= 10, `group commit should coalesce computations (got ${computes})`);
  // every response must already contain the farmer's own field with a real plan
  assert.ok(results.every((r) => r.body.slot.deadline && r.body.slot.status));
  const t = await h.officerToken();
  const overview = (await h.call('GET', `${V1}/admin/overview`, { token: t })).body;
  assert.equal(overview.stats.fields.total, 640 + 40);
});

test('simultaneous auto-fix-all calls serialise cleanly (no 500s, no lost pins)', async () => {
  const t = await h.officerToken();
  const start = (await h.call('GET', `${V1}/admin/overview`, { token: t })).body.stats.fields.atRisk;
  const rs = await Promise.all([1, 2, 3].map(() => h.call('POST', `${V1}/admin/autofix-all`, { token: t })));
  assert.ok(rs.every((r) => r.status === 200), JSON.stringify(rs.map((r) => r.status)));
  const end = (await h.call('GET', `${V1}/admin/overview`, { token: t })).body.stats.fields.atRisk;
  assert.ok(end <= start);
  const { query } = await import('../src/db/pool.js');
  const dupes = await query('select field_id, count(*) from pins group by field_id having count(*) > 1');
  assert.equal(dupes.length, 0);
});

test('optimistic locking: of several simultaneous edits using the same version, exactly one wins', async () => {
  const t = await h.officerToken();
  const id = (await h.call('GET', `${V1}/admin/fields?status=scheduled&limit=1`, { token: t })).body.fields[0].id;
  const v = (await h.call('GET', `${V1}/admin/fields/${id}`, { token: t })).body.field.version;
  const rs = await Promise.all(Array.from({ length: 6 }, () => h.call('POST', `${V1}/admin/fields/${id}/status`, { token: t, body: { status: 'cleared', expectedVersion: v } })));
  assert.equal(rs.filter((r) => r.status === 200).length, 1);
  assert.equal(rs.filter((r) => r.status === 409).length, 5);
});

test('a burst of reads is served from the cache with at most one compute', async () => {
  const t = await h.officerToken();
  await h.call('GET', `${V1}/admin/overview`, { token: t });
  const before = await computeCount();
  const rs = await Promise.all(Array.from({ length: 200 }, () => h.call('GET', `${V1}/admin/alerts`, { token: t })));
  assert.ok(rs.every((r) => r.status === 200));
  assert.equal((await computeCount()) - before, 0, '200 reads, zero recomputation');
});
