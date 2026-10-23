import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
process.env.RATE_LIMIT_WRITE_PER_HOUR = '3';
process.env.RATE_LIMIT_LOGIN_PER_15MIN = '4';
const { farmerBody, startHarness } = await import('./helpers.js');
let h: Awaited<ReturnType<typeof startHarness>>;
before(async () => { h = await startHarness(); });
after(async () => { await h.stop(); });

test('farmer writes are limited per client, with standard headers and Retry-After', async () => {
  const codes: number[] = [];
  let last: any;
  for (let i = 0; i < 5; i++) { last = await h.call('POST', '/api/v1/farmer/fields', { body: farmerBody({ phone: `9600000${100 + i}` }) }); codes.push(last.status); }
  assert.deepEqual(codes, [201, 201, 201, 429, 429]);
  assert.equal(last.body.code, 'rate_limited');
  assert.ok(Number(last.headers.get('retry-after')) > 0);
  assert.equal(last.headers.get('ratelimit-remaining'), '0');
});

test('login attempts are limited separately from everything else', async () => {
  const codes: number[] = [];
  for (let i = 0; i < 6; i++) codes.push((await h.login('nobody', 'x')).status);
  assert.deepEqual(codes.slice(0, 4), [401, 401, 401, 401]);
  assert.equal(codes[4], 429);
  assert.equal((await h.call('GET', '/api/v1/meta')).status, 200, 'other routes are unaffected');
});
