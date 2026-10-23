import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://127.0.0.1:6379/15';
process.env.RATE_LIMIT_WRITE_PER_HOUR = '3';
const { farmerBody, startHarness } = await import('./helpers.js');
let h: Awaited<ReturnType<typeof startHarness>>;
before(async () => {
  const { redis } = await import('../src/cache/redis.js');
  const r = redis()!; await new Promise((res) => setTimeout(res, 300)); await r.flushdb();
  h = await startHarness();
});
after(async () => { await h.stop(); });

const l2 = async () => {
  const { registry } = await import('../src/core/metrics.js');
  const text = await registry.getSingleMetricAsString('plan_cache_events_total');
  const hit = /plan_cache_events_total\{layer="l2",result="hit"\} (\d+)/.exec(text);
  return hit ? Number(hit[1]) : 0;
};

test('plans are shared through Redis: a second instance (empty in-process cache) does not recompute', async () => {
  const t = await h.officerToken();
  await h.call('GET', '/api/v1/admin/overview', { token: t });
  await new Promise((r) => setTimeout(r, 300)); // gzip + SET happen in the background
  const { redis } = await import('../src/cache/redis.js');
  assert.ok((await redis()!.keys('plan:*')).length >= 1, 'plan stored in Redis');
  const { clearPlanCache } = await import('../src/services/planService.js');
  clearPlanCache(); // what a freshly started instance looks like
  const before = await l2();
  const r = await h.call('GET', '/api/v1/admin/overview', { token: t });
  assert.equal(r.status, 200);
  assert.equal((await l2()) - before, 1, 'served from Redis (L2)');
});

test('rate limits are shared through Redis', async () => {
  const codes: number[] = [];
  for (let i = 0; i < 4; i++) codes.push((await h.call('POST', '/api/v1/farmer/fields', { body: farmerBody({ phone: `9500000${100 + i}` }) })).status);
  assert.deepEqual(codes, [201, 201, 201, 429]);
  const { redis } = await import('../src/cache/redis.js');
  assert.ok((await redis()!.keys('rl:farmer-write:*')).length >= 1);
});

test('readiness reports Redis', async () => {
  assert.equal((await h.call('GET', '/health/ready')).body.checks.redis, 'ok');
});
