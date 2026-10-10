import { Router } from 'express';
import { loadState, saveState, logEvent, freshState } from '../lib/store.js';
import { buildAlerts, buildStats, runSchedule } from '../lib/engine.js';
import { getAir } from '../lib/live.js';
import { requireAdmin } from '../lib/auth.js';
import { MACHINE_TYPES } from '../lib/constants.js';
import { todayIST } from '../lib/dates.js';
import { validateBody } from '../middleware/validate.js';
import { ah, badRequest, notFound } from '../middleware/errors.js';
import { AutofixSchema, FieldStatusSchema, MachineStatusSchema, ReassignSchema, ResolveSchema, WhatIfSchema } from '../schemas.js';
import { atRiskCount, compute, farmerSlot, fieldView, index, tryFix } from '../services/schedule.js';
import { makeBriefing } from '../services/briefing.js';
import type { Pin, State } from '../types.js';
import type { z } from 'zod';

export const adminRoutes = Router();
adminRoutes.use(requireAdmin);

const actor = (req: { admin?: { sub: string } }) => req.admin?.sub || 'officer';

adminRoutes.get('/overview', ah(async (_req, res) => {
  const state = await loadState();
  const [{ sched, weather, fires, opts }, air] = await Promise.all([compute(state), getAir()]);
  const stats = buildStats(state, sched);
  const base = buildStats(state, runSchedule(state, { ...opts, mode: 'baseline' }));
  const byId = index(sched.results);
  const villages = index(state.villages);
  const { storeKind } = await import('../lib/store.js');
  res.json({
    stats,
    baseline: { onTimePct: base.onTimePct, atRisk: base.fields.atRisk, protectedAcres: base.acres.protected },
    fields: state.fields.map((f) => {
      const r = byId[f.id];
      return { id: f.id, lat: f.lat, lon: f.lon, acres: f.acres, status: r.status, risk: r.risk.score, level: r.risk.level, deadline: r.deadline, village: villages[f.villageId]?.name, farmerName: f.farmerName, source: f.source };
    }),
    chcs: state.chcs.map((c) => ({ ...c, machines: state.machines.filter((m) => m.chcId === c.id).length })),
    fires: { source: fires.source, live: fires.live, error: fires.error, districtCount: fires.districtCount, punjabCount: fires.punjabCount, points: fires.points, byDate: fires.byDate },
    weather,
    air,
    openIssues: (state.issues || []).filter((i) => i.status === 'open').length,
    store: await storeKind(),
  });
}));

adminRoutes.get('/fields', ah(async (req, res) => {
  const state = await loadState();
  const { sched } = await compute(state);
  const byId = index(sched.results);
  let list = state.fields.map((f) => fieldView(state, f, byId[f.id]));
  const q = String(req.query.q || '').toLowerCase();
  if (q) list = list.filter((f) => [f.id, f.farmerName, f.village].some((s) => s?.toLowerCase().includes(q)));
  if (req.query.status) list = list.filter((f) => f.status === req.query.status);
  if (req.query.block) list = list.filter((f) => f.blockId === req.query.block);
  res.json({ fields: list });
}));

adminRoutes.get('/fields/:id', ah(async (req, res) => {
  const state = await loadState();
  const f = state.fields.find((x) => x.id === req.params.id);
  if (!f) throw notFound('Field not found');
  const { sched } = await compute(state);
  const r = sched.results.find((x) => x.id === f.id)!;
  res.json({ field: farmerSlot(state, f, r), issues: (state.issues || []).filter((i) => i.fieldId === f.id) });
}));

adminRoutes.post('/fields/:id/status', validateBody(FieldStatusSchema), ah(async (req, res) => {
  const { status } = req.body as z.infer<typeof FieldStatusSchema>;
  const state = await loadState();
  const f = state.fields.find((x) => x.id === req.params.id);
  if (!f) throw notFound('Field not found');
  f.status = status;
  if (status === 'cleared') { f.clearedOn = todayIST(); f.clearedBy = 'machine'; } else { delete f.clearedOn; }
  state.pins = (state.pins || []).filter((p) => p.fieldId !== f.id || status === 'pending');
  logEvent(state, actor(req), 'status', `${f.id} → ${status}`);
  await saveState(state);
  res.json({ ok: true });
}));

adminRoutes.get('/dispatch', ah(async (_req, res) => {
  const state = await loadState();
  const { sched } = await compute(state);
  const fields = index(state.fields);
  const byId = index(sched.results);
  const villages = index(state.villages);
  type Job = { date: string; fieldId: string; acres: number; travelKm: number; tractor: string; level: string; onTime: boolean; village?: string; farmerName: string; deadline: string };
  const jobs: Record<string, Job[]> = {};
  sched.results.forEach((r) => r.assignments.forEach((a) => {
    (jobs[a.machineId] = jobs[a.machineId] || []).push({ date: a.date, fieldId: r.id, acres: a.acres, travelKm: a.travelKm, tractor: a.tractor, level: byId[r.id].risk.level, onTime: r.onTime, village: villages[fields[r.id].villageId]?.name, farmerName: fields[r.id].farmerName, deadline: r.deadline });
  }));
  res.json({
    today: sched.today,
    days: sched.days.slice(0, 28),
    chcs: state.chcs.map((c) => ({ id: c.id, name: c.name, blockId: c.blockId, tractors: c.tractors })),
    machines: state.machines.map((m) => ({ ...m, typeLabel: MACHINE_TYPES[m.type].label, minHp: MACHINE_TYPES[m.type].minHp, jobs: (jobs[m.id] || []).sort((x, y) => x.date.localeCompare(y.date)), usage: sched.usage[m.id] || {} })),
    pins: state.pins || [],
  });
}));

adminRoutes.get('/alerts', ah(async (_req, res) => {
  const state = await loadState();
  const { sched } = await compute(state);
  const fieldsById = index(state.fields);
  res.json({
    alerts: buildAlerts(state, sched),
    issues: (state.issues || []).slice().reverse().map((i) => ({ ...i, farmerName: fieldsById[i.fieldId]?.farmerName })),
    machines: state.machines.filter((m) => m.status !== 'maintenance').map((m) => ({ id: m.id, label: m.label, chcId: m.chcId, type: m.type })),
    chcs: state.chcs.map((c) => ({ id: c.id, name: c.name })),
  });
}));

adminRoutes.post('/reassign', validateBody(ReassignSchema), ah(async (req, res) => {
  const body = req.body as z.infer<typeof ReassignSchema>;
  const state = await loadState();
  const f = state.fields.find((x) => x.id === body.fieldId);
  const m = state.machines.find((x) => x.id === body.machineId);
  if (!f || !m) throw notFound('Field or machine not found');
  if (m.status === 'maintenance') throw badRequest('Machine is under maintenance');
  const fromDate = body.fromDate < todayIST() ? todayIST() : body.fromDate;
  const pin: Pin = { fieldId: f.id, machineId: m.id, fromDate, by: actor(req), at: new Date().toISOString() };
  state.pins = [...(state.pins || []).filter((p) => p.fieldId !== f.id), pin];
  logEvent(state, actor(req), 'reassign', `${f.id} → ${m.label} from ${fromDate}`);
  await saveState(state);
  const { sched } = await compute(state);
  const r = sched.results.find((x) => x.id === f.id)!;
  res.json({ ok: true, result: fieldView(state, f, r), atRiskAfter: atRiskCount(sched.results) });
}));

adminRoutes.post('/autofix', validateBody(AutofixSchema), ah(async (req, res) => {
  const { fieldId } = req.body as z.infer<typeof AutofixSchema>;
  const state = await loadState();
  const base = await compute(state);
  const alert = buildAlerts(state, base.sched).find((x) => x.fieldId === fieldId);
  if (!alert) { res.json({ ok: true, fixed: true, already: true }); return; }
  const out = tryFix(state, base.opts, alert, actor(req));
  if (out.fixed) await saveState(state);
  res.json({ ok: true, ...out });
}));

// Sweep the most urgent alerts and apply every net-positive fix (time-boxed for serverless limits).
adminRoutes.post('/autofix-all', ah(async (req, res) => {
  const state = await loadState();
  const base = await compute(state);
  const startedAt = Date.now();
  const atRiskBefore = atRiskCount(base.sched.results);
  const queue = buildAlerts(state, base.sched).slice(0, 25);
  let fixed = 0, tried = 0;
  for (const alert of queue) {
    if (Date.now() - startedAt > 6500) break;
    tried++;
    if (tryFix(state, base.opts, alert, actor(req), 2).fixed) fixed++;
  }
  if (fixed) await saveState(state);
  res.json({ ok: true, fixed, tried, atRiskBefore, atRiskAfter: atRiskCount(runSchedule(state, base.opts).results) });
}));

adminRoutes.delete('/pins/:fieldId', ah(async (req, res) => {
  const state = await loadState();
  state.pins = (state.pins || []).filter((p) => p.fieldId !== req.params.fieldId);
  logEvent(state, actor(req), 'unpin', String(req.params.fieldId));
  await saveState(state);
  res.json({ ok: true });
}));

adminRoutes.post('/issues/:id/resolve', validateBody(ResolveSchema), ah(async (req, res) => {
  const state = await loadState();
  const i = (state.issues || []).find((x) => x.id === req.params.id);
  if (!i) throw notFound('Issue not found');
  i.status = 'resolved';
  i.resolvedAt = new Date().toISOString();
  i.resolution = (req.body as z.infer<typeof ResolveSchema>).note;
  logEvent(state, actor(req), 'resolve', `${i.id} (${i.fieldId})`);
  await saveState(state);
  res.json({ ok: true });
}));

adminRoutes.post('/machines/:id', validateBody(MachineStatusSchema), ah(async (req, res) => {
  const { status } = req.body as z.infer<typeof MachineStatusSchema>;
  const state = await loadState();
  const m = state.machines.find((x) => x.id === req.params.id);
  if (!m) throw notFound('Machine not found');
  m.status = status;
  if (status === 'maintenance') state.pins = (state.pins || []).filter((p) => p.machineId !== m.id);
  logEvent(state, actor(req), 'machine', `${m.label} (${m.chcId}) → ${status}`);
  await saveState(state);
  res.json({ ok: true });
}));

adminRoutes.get('/registry', ah(async (_req, res) => {
  const state = await loadState();
  const { sched } = await compute(state);
  const next14 = sched.days.filter((d) => d.working).slice(0, 14).map((d) => d.date);
  res.json({
    chcs: state.chcs.map((c) => ({ ...c, machineCount: state.machines.filter((m) => m.chcId === c.id).length })),
    machines: state.machines.map((m) => {
      const used = next14.reduce((s, d) => s + (sched.usage[m.id]?.[d] || 0), 0);
      return { ...m, typeLabel: MACHINE_TYPES[m.type].label, minHp: MACHINE_TYPES[m.type].minHp, utilisationPct: m.status === 'maintenance' ? 0 : Math.round((used / (m.acresPerDay * Math.max(1, next14.length))) * 100) };
    }),
    vendors: state.vendors,
    blocks: state.blocks,
  });
}));

adminRoutes.post('/whatif', validateBody(WhatIfSchema), ah(async (req, res) => {
  const body = req.body as z.infer<typeof WhatIfSchema>;
  const state = await loadState();
  const base = await compute(state);
  const sim: State = structuredClone(state);
  body.add.forEach((x, i) => {
    for (let k = 0; k < x.count; k++) {
      sim.machines.push({ id: `sim-${i}-${k}`, chcId: x.chcId, type: x.type, label: `+ ${MACHINE_TYPES[x.type].label}`, acresPerDay: MACHINE_TYPES[x.type].acresPerDay, status: 'active' });
    }
  });
  if (body.fixMaintenance) sim.machines.forEach((m) => { m.status = 'active'; });
  for (let t = 0; t < body.extraTractors; t++) sim.chcs[t % sim.chcs.length].tractors.push({ id: `sim-tr-${t}`, hp: 60 });
  const sb = buildStats(state, base.sched);
  const sa = buildStats(sim, runSchedule(sim, { ...base.opts }));
  const pick = (s: ReturnType<typeof buildStats>) => ({ onTimePct: s.onTimePct, atRisk: s.fields.atRisk, highRisk: s.fields.highRisk, protectedAcres: s.acres.protected, utilisationPct: s.utilisationPct, co2Tonnes: s.impact.co2Tonnes, pmKg: s.impact.pmKg, machines: s.machines.active });
  res.json({ before: pick(sb), after: pick(sa) });
}));

adminRoutes.get('/briefing', ah(async (_req, res) => {
  const state = await loadState();
  const [{ sched, weather, fires }, air] = await Promise.all([compute(state), getAir()]);
  res.json(await makeBriefing({ state, sched, weather, fires, air }));
}));

adminRoutes.get('/log', ah(async (_req, res) => {
  const state = await loadState();
  res.json({ log: (state.log || []).slice().reverse().slice(0, 150) });
}));

adminRoutes.get('/export/schedule.csv', ah(async (_req, res) => {
  const state = await loadState();
  const { sched } = await compute(state);
  const fields = index(state.fields), machines = index(state.machines), chcs = index(state.chcs);
  const rows: (string | number | boolean | undefined)[][] = [['date', 'field_id', 'farmer', 'acres_worked', 'machine', 'chc', 'tractor', 'deadline', 'on_time', 'risk_score']];
  sched.results.forEach((r) => r.assignments.forEach((a) => rows.push([a.date, r.id, fields[r.id].farmerName, a.acres, machines[a.machineId]?.label, chcs[a.chcId]?.name, a.tractor, r.deadline, r.onTime, r.risk.score])));
  rows.sort((x, y) => String(x[0]).localeCompare(String(y[0])));
  // Neutralise spreadsheet formulas in text cells (CSV injection).
  const cell = (c: unknown) => { const s = String(c ?? ''); return `"${(/^[=+@-]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`; };
  res.setHeader('content-type', 'text/csv');
  res.setHeader('content-disposition', `attachment; filename="strawslot-schedule-${sched.today}.csv"`);
  res.send(rows.map((row) => row.map(cell).join(',')).join('\n'));
}));

adminRoutes.post('/reset', ah(async (req, res) => {
  const state = freshState();
  logEvent(state, actor(req), 'reset', 'Demo data reset');
  await saveState(state);
  res.json({ ok: true });
}));
