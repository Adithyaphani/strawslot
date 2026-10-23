import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
process.env.REDIS_URL = 'redis://127.0.0.1:6399'; // nothing listens here
const { farmerBody, startHarness } = await import('./helpers.js');
let h: Awaited<ReturnType<typeof startHarness>>;
before(async () => { h = await startHarness(); });
after(async () => { await h.stop(); });

test('Redis outage degrades to in-process behaviour: every endpoint still answers', async () => {
  const t = await h.officerToken();
  assert.equal((await h.call('GET', '/api/v1/admin/overview', { token: t })).status, 200);
  assert.equal((await h.call('POST', '/api/v1/farmer/fields', { body: farmerBody({ phone: '9400000001' }) })).status, 201);
  const ready = await h.call('GET', '/health/ready');
  assert.equal(ready.status, 200, 'readiness must not fail just because the cache is down');
  assert.equal(ready.body.checks.redis, 'degraded');
});
