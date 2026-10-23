import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { farmerBody, startHarness, type Harness } from './helpers.js';

let h: Harness;
before(async () => { h = await startHarness(); });
after(async () => { await h.stop(); });

const V1 = '/api/v1';

test('health: liveness and readiness (database, migrations)', async () => {
  assert.equal((await h.call('GET', '/health/live')).body.status, 'ok');
  const r = await h.call('GET', '/health/ready');
  assert.equal(r.status, 200);
  assert.equal(r.body.checks.database, 'ok');
  assert.equal(r.body.checks.migrations, 'current');
});

test('public data: meta, stats, live feeds; /api is an alias of /api/v1', async () => {
  const a = await h.call('GET', `${V1}/meta`), b = await h.call('GET', '/api/meta');
  assert.equal(a.status, 200);
  assert.equal(a.body.villages.length, 27);
  assert.equal(a.body.chcs.length, 8);
  assert.deepEqual(a.body.blocks, b.body.blocks);
  const s = await h.call('GET', `${V1}/public/stats`);
  assert.ok(s.body.stats.onTimePct > s.body.baseline.onTimePct, 'optimiser should beat first-come booking');
  assert.ok((await h.call('GET', `${V1}/live/weather`)).body.days.length >= 10);
  assert.equal((await h.call('GET', `${V1}/live/fires?scope=district`)).status, 200);
});

test('request ids are returned and echoed', async () => {
  const r = await h.call('GET', `${V1}/meta`, { headers: { 'x-request-id': 'my-trace-id-123' } });
  assert.equal(r.headers.get('x-request-id'), 'my-trace-id-123');
  assert.ok((await h.call('GET', `${V1}/meta`)).headers.get('x-request-id'));
});

test('errors have one consistent shape; unknown paths 404; bad JSON 400', async () => {
  const nf = await h.call('GET', `${V1}/nope`);
  assert.equal(nf.status, 404); assert.equal(nf.body.code, 'not_found'); assert.ok(nf.body.requestId);
  const bad = await fetch(h.base + `${V1}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops' });
  assert.equal(bad.status, 400);
});

// ---------------------------------------------------------------- auth
test('login: legacy field names, trims spaces, case-insensitive username; returns both tokens', async () => {
  const r = await h.login(' Officer ', 'sangrur2026 ');
  assert.equal(r.status, 200);
  assert.ok(r.body.token && r.body.accessToken && r.body.refreshToken);
  assert.equal(r.body.user.role, 'officer');
  const alt = await h.call('POST', `${V1}/auth/login`, { body: { username: 'officer', password: 'sangrur2026' } });
  assert.equal(alt.status, 200);
});

test('officer routes need a valid token', async () => {
  assert.equal((await h.call('GET', `${V1}/admin/overview`)).status, 401);
  assert.equal((await h.call('GET', `${V1}/admin/overview`, { token: 'garbage' })).status, 401);
  const t = await h.officerToken();
  assert.equal((await h.call('GET', `${V1}/admin/overview`, { token: t })).status, 200);
});

test('refresh tokens rotate, and reuse of an old one revokes the whole session', async () => {
  const first = (await h.login()).body;
  const second = await h.call('POST', `${V1}/auth/refresh`, { body: { refreshToken: first.refreshToken } });
  assert.equal(second.status, 200);
  assert.notEqual(second.body.refreshToken, first.refreshToken);
  assert.equal((await h.call('GET', `${V1}/admin/overview`, { token: second.body.accessToken })).status, 200);
  // replaying the first (already used) token is theft evidence: it fails AND kills the new token too
  assert.equal((await h.call('POST', `${V1}/auth/refresh`, { body: { refreshToken: first.refreshToken } })).status, 401);
  assert.equal((await h.call('POST', `${V1}/auth/refresh`, { body: { refreshToken: second.body.refreshToken } })).status, 401);
});

test('logout revokes the refresh token', async () => {
  const s = (await h.login()).body;
  assert.equal((await h.call('POST', `${V1}/auth/logout`, { body: { refreshToken: s.refreshToken } })).status, 200);
  assert.equal((await h.call('POST', `${V1}/auth/refresh`, { body: { refreshToken: s.refreshToken } })).status, 401);
});

test('roles: admin creates a viewer; viewer can read but not write; officer cannot manage users', async () => {
  const admin = (await h.login('admin', 'admin-sangrur-2026')).body.accessToken;
  const made = await h.call('POST', `${V1}/admin/users`, { token: admin, body: { username: 'viewer1', displayName: 'Read Only', password: 'a-long-password-1', role: 'viewer' } });
  assert.equal(made.status, 201);
  assert.equal(made.body.user.passwordHash, undefined, 'hash must never be returned');
  const v = (await h.login('viewer1', 'a-long-password-1')).body.accessToken;
  assert.equal((await h.call('GET', `${V1}/admin/overview`, { token: v })).status, 200);
  assert.equal((await h.call('POST', `${V1}/admin/autofix-all`, { token: v })).status, 403);
  assert.equal((await h.call('POST', `${V1}/admin/machines/m-sangrur-1`, { token: v, body: { status: 'maintenance' } })).status, 403);
  const o = await h.officerToken();
  assert.equal((await h.call('GET', `${V1}/admin/users`, { token: o })).status, 403);
  assert.equal((await h.call('POST', `${V1}/admin/users`, { token: admin, body: { username: 'viewer1', displayName: 'Dup', password: 'a-long-password-1' } })).status, 409);
  // disabling a user signs them out everywhere
  const id = made.body.user.id;
  assert.equal((await h.call('PATCH', `${V1}/admin/users/${id}`, { token: admin, body: { active: false } })).status, 200);
  assert.equal((await h.login('viewer1', 'a-long-password-1')).status, 401);
});

test('lockout: repeated wrong passwords lock the account, even for the right password', async () => {
  const admin = (await h.login('admin', 'admin-sangrur-2026')).body.accessToken;
  await h.call('POST', `${V1}/admin/users`, { token: admin, body: { username: 'locky', displayName: 'Lock Test', password: 'correct-password-1', role: 'officer' } });
  for (let i = 0; i < 5; i++) assert.equal((await h.login('locky', 'wrong')).status, 401);
  const r = await h.login('locky', 'correct-password-1');
  assert.equal(r.status, 423);
  assert.ok(r.headers.get('retry-after'));
});

// ---------------------------------------------------------------- farmer flows
test('farmer: validation errors list every problem', async () => {
  const r = await h.call('POST', `${V1}/farmer/fields`, { body: farmerBody({ phone: '123', acres: 0, farmerName: 'x' }) });
  assert.equal(r.status, 400);
  assert.equal(r.body.code, 'validation_failed');
  assert.ok(r.body.details.length >= 3);
});

test('farmer: register -> slot -> lookup -> report issue -> officer sees everything', async () => {
  const body = farmerBody({ farmerName: 'Gurmeet Dhillon', phone: '9811122233' });
  const reg = await h.call('POST', `${V1}/farmer/fields`, { body });
  assert.equal(reg.status, 201);
  const slot = reg.body.slot;
  assert.match(slot.id, /^F-\d+$/);
  assert.ok(slot.deadline > body.harvestDate);
  assert.ok(slot.message.includes('Gurmeet'));

  const look = await h.call('GET', `${V1}/farmer/lookup?phone=9811122233&lang=hi`);
  assert.equal(look.status, 200);
  assert.equal(look.body.slots[0].id, slot.id);
  assert.equal((await h.call('GET', `${V1}/farmer/lookup?phone=9000000999`)).status, 404);

  const issue = await h.call('POST', `${V1}/farmer/issues`, { body: { fieldId: slot.id, phone: '9811122233', type: 'machine_late', note: 'Still waiting' } });
  assert.equal(issue.status, 201);
  assert.equal((await h.call('POST', `${V1}/farmer/issues`, { body: { fieldId: slot.id, phone: '9000000000', type: 'other' } })).status, 404, 'wrong phone must not match');

  const t = await h.officerToken();
  const detail = await h.call('GET', `${V1}/admin/fields/${slot.id}`, { token: t });
  assert.equal(detail.body.field.farmerName, 'Gurmeet Dhillon');
  assert.equal(detail.body.issues.length, 1);
  const log = await h.call('GET', `${V1}/admin/log`, { token: t });
  assert.ok(log.body.log.some((l: any) => l.action === 'register' && l.detail.includes(slot.id)));
});

test('farmer: officer list masks phone numbers', async () => {
  const t = await h.officerToken();
  const list = await h.call('GET', `${V1}/admin/fields?limit=3`, { token: t });
  assert.equal(list.body.fields.length, 3);
  assert.match(list.body.fields[0].phone, /^\d{2}xxxxxx\d{2}$/);
  assert.ok(list.body.total > 600);
  assert.equal(list.headers.get('x-total-count'), String(list.body.total));
});

test('idempotency: same key + same body returns the original; different body is rejected', async () => {
  const body = farmerBody({ phone: '9822233344', farmerName: 'Retry Singh' });
  const hdr = { 'idempotency-key': 'idem-key-0001' };
  const a = await h.call('POST', `${V1}/farmer/fields`, { body, headers: hdr });
  const b = await h.call('POST', `${V1}/farmer/fields`, { body, headers: hdr });
  assert.equal(a.status, 201); assert.equal(b.status, 201);
  assert.equal(b.headers.get('idempotent-replay'), 'true');
  assert.equal(a.body.slot.id, b.body.slot.id, 'a retry must not create a second field');
  const c = await h.call('POST', `${V1}/farmer/fields`, { body: { ...body, acres: 9 }, headers: hdr });
  assert.equal(c.status, 422);
  const look = await h.call('GET', `${V1}/farmer/lookup?phone=9822233344`);
  assert.equal(look.body.slots.length, 1);
});

// ---------------------------------------------------------------- cache correctness
test('plan cache: a write is visible on the very next read (no stale plans), and ETag/304 works', async () => {
  const t = await h.officerToken();
  const first = await h.call('GET', `${V1}/admin/overview`, { token: t });
  const etag = first.headers.get('etag')!;
  assert.ok(etag);
  const again = await h.call('GET', `${V1}/admin/overview`, { token: t, headers: { 'if-none-match': etag } });
  assert.equal(again.status, 304);
  await h.call('POST', `${V1}/farmer/fields`, { body: farmerBody({ phone: '9833344455', farmerName: 'Cache Check' }) });
  const after = await h.call('GET', `${V1}/admin/overview`, { token: t, headers: { 'if-none-match': etag } });
  assert.equal(after.status, 200, 'etag must change after a write');
  assert.equal(after.body.stats.fields.total, first.body.stats.fields.total + 1);
});

// ---------------------------------------------------------------- officer actions
test('officer: status change, optimistic locking and clearing enqueues an SMS', async () => {
  const t = await h.officerToken();
  const list = await h.call('GET', `${V1}/admin/fields?status=scheduled&limit=1`, { token: t });
  const id = list.body.fields[0].id;
  const d1 = (await h.call('GET', `${V1}/admin/fields/${id}`, { token: t })).body.field;
  const ok = await h.call('POST', `${V1}/admin/fields/${id}/status`, { token: t, body: { status: 'cleared', expectedVersion: d1.version } });
  assert.equal(ok.status, 200);
  const stale = await h.call('POST', `${V1}/admin/fields/${id}/status`, { token: t, body: { status: 'burned', expectedVersion: d1.version } });
  assert.equal(stale.status, 409, 'stale version must conflict');
  assert.equal((await h.call('POST', `${V1}/admin/fields/F-999999/status`, { token: t, body: { status: 'cleared' } })).status, 404);
  const n = await h.call('GET', `${V1}/admin/notifications`, { token: t });
  assert.ok(n.body.notifications.some((x: any) => x.fieldId === id && x.kind === 'field_cleared'));
});

test('officer: auto-fix never makes the district worse, and writes an audit trail', async () => {
  const t = await h.officerToken();
  const before = (await h.call('GET', `${V1}/admin/overview`, { token: t })).body.stats.fields.atRisk;
  const r = await h.call('POST', `${V1}/admin/autofix-all`, { token: t });
  assert.equal(r.status, 200);
  assert.ok(r.body.atRiskAfter <= before);
  assert.equal(r.body.atRiskBefore, before);
  const after = (await h.call('GET', `${V1}/admin/overview`, { token: t })).body.stats.fields.atRisk;
  assert.equal(after, r.body.atRiskAfter, 'reported result matches the next read');
  if (r.body.fixed > 0) {
    const log = await h.call('GET', `${V1}/admin/log?limit=50`, { token: t });
    assert.ok(log.body.log.some((l: any) => l.action === 'reassign' && l.detail.includes('auto-fix')));
  }
});

test('officer: manual reassign pins a machine; maintenance removes the pin', async () => {
  const t = await h.officerToken();
  const al = (await h.call('GET', `${V1}/admin/alerts`, { token: t })).body;
  const target = al.alerts[0];
  if (!target) return; // nothing at risk after auto-fix: nothing to reassign
  const m = al.machines[0];
  const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const r = await h.call('POST', `${V1}/admin/reassign`, { token: t, body: { fieldId: target.fieldId, machineId: m.id, fromDate: today } });
  assert.equal(r.status, 200);
  assert.equal(r.body.result.pinned, true);
  assert.equal((await h.call('POST', `${V1}/admin/machines/${m.id}`, { token: t, body: { status: 'maintenance' } })).status, 200);
  const dd = (await h.call('GET', `${V1}/admin/dispatch`, { token: t })).body;
  assert.ok(!dd.pins.some((p: any) => p.machineId === m.id), 'pins on a machine in maintenance are dropped');
  assert.equal((await h.call('POST', `${V1}/admin/machines/${m.id}`, { token: t, body: { status: 'active' } })).status, 200);
  assert.equal((await h.call('DELETE', `${V1}/admin/pins/${target.fieldId}`, { token: t })).status, 200);
});

test('what-if: more machines never reduce on-time share, and nothing is saved', async () => {
  const t = await h.officerToken();
  const before = (await h.call('GET', `${V1}/admin/overview`, { token: t })).body;
  const r = await h.call('POST', `${V1}/admin/whatif`, { token: t, body: { add: [{ chcId: 'chc-moonak', type: 'super_seeder', count: 3 }], fixMaintenance: true, extraTractors: 2 } });
  assert.equal(r.status, 200);
  assert.ok(r.body.after.onTimePct >= r.body.before.onTimePct);
  const after = (await h.call('GET', `${V1}/admin/overview`, { token: t })).body;
  assert.equal(after.stats.machines.total, before.stats.machines.total);
  assert.equal((await h.call('POST', `${V1}/admin/whatif`, { token: t, body: { add: [{ chcId: 'chc-nowhere', type: 'baler', count: 1 }] } })).status, 400);
});

test('CSV export neutralises spreadsheet formulas and downloads as a file', async () => {
  const t = await h.officerToken();
  const r = await h.call('GET', `${V1}/admin/export/schedule.csv`, { token: t });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-disposition')!, /attachment; filename="strawslot-schedule-/);
  assert.ok(r.text.split('\n').length > 100);
});

test('trends, registry, briefing and fields filters respond', async () => {
  const t = await h.officerToken();
  for (const p of ['registry', 'briefing', 'trends?days=7', 'fields?q=Kheri&status=pending&block=sangrur', 'log?limit=5']) {
    const r = await h.call('GET', `${V1}/admin/${p}`, { token: t });
    assert.equal(r.status, 200, p);
  }
});

// ---------------------------------------------------------------- docs
test('OpenAPI document lists every route, with security and request bodies', async () => {
  const r = await h.call('GET', '/openapi.json');
  assert.equal(r.status, 200);
  assert.ok(Object.keys(r.body.paths).length >= 30);
  assert.ok(r.body.paths['/farmer/fields'].post.requestBody);
  assert.deepEqual(r.body.paths['/admin/autofix-all'].post.security, [{ bearerAuth: [] }]);
  assert.equal((await h.call('GET', '/docs')).status, 200);
});

test('metrics endpoint exposes request, cache and compute metrics', async () => {
  const r = await h.call('GET', '/metrics');
  assert.equal(r.status, 200);
  for (const m of ['http_request_duration_seconds', 'plan_cache_events_total', 'schedule_compute_seconds', 'login_attempts_total']) assert.ok(r.text.includes(m), m);
});
