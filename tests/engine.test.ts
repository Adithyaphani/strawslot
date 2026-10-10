import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../server/data/seed.js';
import { runSchedule, buildStats, buildAlerts, deadlineOf, eligibleTypes, haversineKm, riskLevel } from '../server/lib/engine.js';
import { addDays, diffDays } from '../server/lib/dates.js';
import { MACHINE_TYPES } from '../server/lib/constants.js';

const TODAY = '2026-10-10';
const seed = () => buildSeed(TODAY);

test('date helpers', () => {
  assert.equal(addDays('2026-10-30', 3), '2026-11-02');
  assert.equal(diffDays('2026-11-02', '2026-10-30'), 3);
});

test('deadline = harvest + window', () => {
  assert.equal(deadlineOf({ harvestDate: '2026-10-10', windowDays: 16 }), '2026-10-26');
});

test('eligible machine types follow farmer preference', () => {
  assert.deepEqual(eligibleTypes('ex_situ'), ['baler']);
  assert.ok(!eligibleTypes('in_situ').includes('baler'));
  assert.equal(eligibleTypes('any').length, 4);
});

test('haversine is sane (Sangrur to Dhuri ~14 km)', () => {
  const km = haversineKm({ lat: 30.2458, lon: 75.8421 }, { lat: 30.3687, lon: 75.868 });
  assert.ok(km > 12 && km < 16, `got ${km}`);
});

test('risk levels', () => {
  assert.equal(riskLevel(80), 'high');
  assert.equal(riskLevel(40), 'medium');
  assert.equal(riskLevel(5), 'low');
});

test('seed is deterministic', () => {
  assert.deepEqual(seed().fields.slice(0, 5), seed().fields.slice(0, 5));
});

test('schedule respects capacity, harvest dates and machine HP', () => {
  const s = seed();
  const sched = runSchedule(s, { today: TODAY });
  const machines = Object.fromEntries(s.machines.map((m) => [m.id, m]));
  const fields = Object.fromEntries(s.fields.map((f) => [f.id, f]));
  for (const [mid, byDate] of Object.entries(sched.usage)) {
    for (const acres of Object.values(byDate)) assert.ok(acres <= machines[mid].acresPerDay + 0.3, `${mid} over capacity`);
  }
  for (const r of sched.results) {
    for (const a of r.assignments) {
      const f = fields[r.id];
      assert.ok(a.date > f.harvestDate, 'worked before harvest');
      assert.ok(a.date >= TODAY, 'worked in the past');
      assert.ok(eligibleTypes(f.preference).includes(a.type), 'wrong machine type');
      if (a.tractor === 'farmer') assert.ok(f.tractor.hp >= MACHINE_TYPES[a.type].minHp, 'farmer tractor too small');
      assert.notEqual(machines[a.machineId].status, 'maintenance');
    }
    if (r.status === 'scheduled' || r.status === 'awaiting_harvest') assert.ok(r.completion <= r.deadline);
  }
});

test('rain days block field work', () => {
  const s = seed();
  const sched = runSchedule(s, { today: TODAY, rain: { [addDays(TODAY, 1)]: 12 } });
  const worked = sched.results.flatMap((r) => r.assignments).filter((a) => a.date === addDays(TODAY, 1));
  assert.equal(worked.length, 0);
});

test('optimiser beats first-come-first-served baseline', () => {
  const s = seed();
  const opt = buildStats(s, runSchedule(s, { today: TODAY }));
  const base = buildStats(s, runSchedule(s, { today: TODAY, mode: 'baseline' }));
  assert.ok(opt.onTimePct > base.onTimePct, `${opt.onTimePct} vs ${base.onTimePct}`);
});

test('officer pin forces the chosen machine', () => {
  const s = seed();
  const f = s.fields.find((x) => x.status === 'pending' && x.harvestDate < TODAY && x.preference === 'any');
  const m = s.machines.find((x) => x.status === 'active' && x.type === 'baler');
  s.pins = [{ fieldId: f.id, machineId: m.id, fromDate: TODAY, by: 'test', at: new Date().toISOString() }];
  const r = runSchedule(s, { today: TODAY }).results.find((x) => x.id === f.id);
  assert.ok(r.assignments.length > 0);
  assert.ok(r.assignments.every((a) => a.machineId === m.id));
});

test('alerts are only for at-risk fields and carry suggestions', () => {
  const s = seed();
  const sched = runSchedule(s, { today: TODAY });
  const alerts = buildAlerts(s, sched);
  const atRisk = sched.results.filter((r) => r.status === 'at_risk').length;
  assert.equal(alerts.length, atRisk);
  alerts.forEach((a) => assert.ok(a.suggestions.length > 0));
});
