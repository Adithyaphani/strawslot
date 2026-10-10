// StrawSlot API (Express). Runs as a Netlify Function in production and as a
// plain Node server locally (server/index.js).

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import { loadState, saveState, logEvent, storeKind, freshState } from './lib/store.js';
import { runSchedule, buildAlerts, buildStats, haversineKm } from './lib/engine.js';
import { getWeather, getAir, getFires, rainMap } from './lib/live.js';
import { farmerMessage, fmtDate } from './lib/messages.js';
import { checkPassword, sign, requireAdmin, credentials } from './lib/auth.js';
import { MACHINE_TYPES, SCHED, FACTORS, DISTRICT } from './lib/constants.js';
import { todayIST, addDays } from './lib/dates.js';

// ---------- helpers ----------
// Client IP on Netlify comes from a header; fall back gracefully elsewhere.
const clientKey = (req) => req.headers['x-nf-client-connection-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'anon';
const limiter = (opts) => rateLimit({ standardHeaders: true, legacyHeaders: false, keyGenerator: clientKey, validate: false, ...opts });

const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

async function compute(state, extra = {}) {
  const [weather, fires] = await Promise.all([getWeather(), getFires()]);
  const opts = { today: todayIST(), rain: rainMap(weather), fires: fires.district };
  const sched = runSchedule(state, { ...opts, ...extra });
  return { sched, weather, fires, opts };
}

const maskPhone = (p) => (p ? `${p.slice(0, 2)}xxxxxx${p.slice(-2)}` : '');
const index = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));

function fieldView(state, f, r, { full = false } = {}) {
  const villages = index(state.villages);
  const v = villages[f.villageId];
  return {
    id: f.id,
    farmerName: f.farmerName,
    phone: full ? f.phone : maskPhone(f.phone),
    language: f.language,
    village: v?.name,
    blockId: v?.blockId,
    lat: f.lat,
    lon: f.lon,
    acres: f.acres,
    harvestDate: f.harvestDate,
    windowDays: f.windowDays,
    preference: f.preference,
    tractor: f.tractor,
    source: f.source,
    status: r.status,
    deadline: r.deadline,
    daysLeft: r.daysLeft,
    start: r.start || null,
    completion: r.completion || null,
    slackDays: r.slackDays ?? null,
    risk: r.risk,
    assignments: r.assignments,
    pickups: r.pickups,
    nearestChc: r.nearestChc,
    pinned: (state.pins || []).some((p) => p.fieldId === f.id),
    clearedOn: f.clearedOn || null,
  };
}

function farmerSlot(state, f, r, lang) {
  const machines = index(state.machines);
  const chcs = index(state.chcs);
  const vendors = index(state.vendors);
  const a0 = r.assignments?.[0];
  const machine = a0 ? machines[a0.machineId] : null;
  const chc = machine ? chcs[machine.chcId] : null;
  const vendor = r.pickups?.[0] ? vendors[r.pickups[0].vendorId] : null;
  return {
    ...fieldView(state, f, r, { full: true }),
    machine: machine ? { id: machine.id, label: machine.label, type: machine.type, typeLabel: MACHINE_TYPES[machine.type].label } : null,
    chc: chc ? { id: chc.id, name: chc.name, phone: chc.phone, operator: chc.operator, lat: chc.lat, lon: chc.lon } : null,
    vendor: vendor ? { id: vendor.id, name: vendor.name, phone: vendor.phone, destination: vendor.destination } : null,
    message: farmerMessage({ field: f, result: r, machine, chc, vendor, lang: lang || f.language }),
  };
}

// ---------- validation ----------
const phone = z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit mobile number');
const RegisterSchema = z.object({
  farmerName: z.string().trim().min(2).max(60),
  phone,
  language: z.enum(['en', 'hi', 'pa']).default('pa'),
  villageId: z.string().min(1),
  acres: z.coerce.number().min(0.25).max(100),
  harvestDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  windowDays: z.coerce.number().int().min(7).max(30).default(SCHED.defaultWindowDays),
  preference: z.enum(['in_situ', 'ex_situ', 'any']).default('any'),
  tractor: z.object({ owns: z.boolean(), hp: z.coerce.number().min(0).max(150).default(0) }),
  location: z.object({ lat: z.number(), lon: z.number() }).optional(),
});
const IssueSchema = z.object({
  fieldId: z.string().min(1),
  phone,
  type: z.enum(['machine_late', 'machine_not_needed', 'harvest_changed', 'other']),
  note: z.string().trim().max(300).optional().default(''),
});
const ReassignSchema = z.object({ fieldId: z.string(), machineId: z.string(), fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
const WhatIfSchema = z.object({
  add: z.array(z.object({ chcId: z.string(), type: z.enum(Object.keys(MACHINE_TYPES)), count: z.coerce.number().int().min(1).max(20) })).max(20).default([]),
  fixMaintenance: z.boolean().default(false),
  extraTractors: z.coerce.number().int().min(0).max(30).default(0),
});

// ---------- app ----------
export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));
  app.use((req, _res, next) => { req.t0 = Date.now(); next(); });

  const r = express.Router();
  r.use(limiter({ windowMs: 15 * 60e3, limit: 600 }));
  const writeLimit = limiter({ windowMs: 60 * 60e3, limit: 40, message: { error: 'Too many submissions, please try again later' } });

  // --- public ---
  r.get('/health', ah(async (_req, res) => res.json({ ok: true, store: await storeKind(), today: todayIST() })));

  r.get('/meta', ah(async (_req, res) => {
    const state = await loadState();
    res.json({
      district: DISTRICT,
      blocks: state.blocks,
      villages: state.villages,
      chcs: state.chcs.map((c) => ({ id: c.id, name: c.name, blockId: c.blockId, lat: c.lat, lon: c.lon, phone: c.phone })),
      machineTypes: MACHINE_TYPES,
      sched: SCHED,
      factors: FACTORS,
      season: { anchor: state.meta.anchor, simulated: true },
      demo: { farmerPhone: state.fields.find((f) => f.source === 'seed' && f.status === 'pending')?.phone, officer: credentials().user },
    });
  }));

  r.get('/public/stats', ah(async (_req, res) => {
    const state = await loadState();
    const { sched, fires, weather, opts } = await compute(state);
    const stats = buildStats(state, sched);
    const base = buildStats(state, runSchedule(state, { ...opts, mode: 'baseline' }));
    res.json({ stats, baseline: { onTimePct: base.onTimePct, atRisk: base.fields.atRisk }, fires: { source: fires.source, live: fires.live, districtCount: fires.districtCount, punjabCount: fires.punjabCount }, weather: { source: weather.source, live: weather.live } });
  }));

  r.get('/live/weather', ah(async (_req, res) => res.json(await getWeather())));
  r.get('/live/air', ah(async (_req, res) => res.json(await getAir())));
  r.get('/live/fires', ah(async (req, res) => {
    const f = await getFires();
    res.json(req.query.scope === 'district' ? { ...f, points: f.district } : f);
  }));

  // --- farmer ---
  r.post('/farmer/fields', writeLimit, ah(async (req, res) => {
    const body = RegisterSchema.parse(req.body);
    const state = await loadState();
    const village = state.villages.find((v) => v.id === body.villageId);
    if (!village) return res.status(400).json({ error: 'Unknown village' });
    const today = todayIST();
    if (body.harvestDate < addDays(today, -20) || body.harvestDate > addDays(today, 60)) {
      return res.status(400).json({ error: 'Harvest date should be within the current season' });
    }
    let { lat, lon } = village;
    if (body.location) {
      const near = haversineKm(body.location, village) <= 15;
      if (near) ({ lat, lon } = body.location);
    } else {
      lat += (Math.random() - 0.5) * 0.02; lon += (Math.random() - 0.5) * 0.02;
    }
    const nextNum = 1 + state.fields.reduce((m, x) => Math.max(m, parseInt(x.id.slice(2), 10) || 0), 1000);
    const field = {
      id: `F-${nextNum}`,
      source: 'farmer',
      farmerName: body.farmerName,
      phone: body.phone,
      language: body.language,
      villageId: body.villageId,
      lat: Math.round(lat * 1e5) / 1e5,
      lon: Math.round(lon * 1e5) / 1e5,
      acres: Math.round(body.acres * 100) / 100,
      harvestDate: body.harvestDate,
      windowDays: body.windowDays,
      nextCrop: 'wheat',
      preference: body.preference,
      tractor: body.tractor.owns ? body.tractor : { owns: false, hp: 0 },
      status: 'pending',
      createdAt: today,
    };
    state.fields.push(field);
    logEvent(state, 'farmer', 'register', `${field.id} · ${field.acres} ac · ${village.name}`);
    await saveState(state);
    const { sched } = await compute(state);
    const result = sched.results.find((x) => x.id === field.id);
    res.status(201).json({ slot: farmerSlot(state, field, result, body.language) });
  }));

  r.get('/farmer/lookup', ah(async (req, res) => {
    const p = phone.parse(String(req.query.phone || ''));
    const lang = ['en', 'hi', 'pa'].includes(req.query.lang) ? req.query.lang : undefined;
    const state = await loadState();
    const mine = state.fields.filter((f) => f.phone === p);
    if (!mine.length) return res.status(404).json({ error: 'No field registered with this number yet' });
    const { sched } = await compute(state);
    const byId = index(sched.results);
    res.json({ slots: mine.map((f) => farmerSlot(state, f, byId[f.id], lang)) });
  }));

  r.post('/farmer/issues', writeLimit, ah(async (req, res) => {
    const body = IssueSchema.parse(req.body);
    const state = await loadState();
    const f = state.fields.find((x) => x.id === body.fieldId && x.phone === body.phone);
    if (!f) return res.status(404).json({ error: 'Field not found for this number' });
    const issue = { id: `I-${Date.now().toString(36)}`, ...body, status: 'open', createdAt: new Date().toISOString() };
    state.issues = [...(state.issues || []), issue];
    logEvent(state, 'farmer', 'issue', `${f.id} · ${body.type}`);
    await saveState(state);
    res.status(201).json({ issue });
  }));

  // --- auth ---
  r.post('/auth/login', limiter({ windowMs: 15 * 60e3, limit: 20, message: { error: 'Too many login attempts, try again in 15 minutes' } }), ah(async (req, res) => {
    const { user = '', password = '' } = req.body || {};
    if (!checkPassword(user, password)) return res.status(401).json({ error: 'Invalid username or password' });
    res.json({ token: sign({ sub: user, role: 'officer' }), user: { name: 'District Nodal Officer', username: user, district: DISTRICT.name } });
  }));

  // --- admin ---
  const a = express.Router();
  a.use(requireAdmin);

  a.get('/overview', ah(async (_req, res) => {
    const state = await loadState();
    const [{ sched, weather, fires, opts }, air] = await Promise.all([compute(state), getAir()]);
    const stats = buildStats(state, sched);
    const base = buildStats(state, runSchedule(state, { ...opts, mode: 'baseline' }));
    const byId = index(sched.results);
    const villages = index(state.villages);
    res.json({
      stats,
      baseline: { onTimePct: base.onTimePct, atRisk: base.fields.atRisk, protectedAcres: base.acres.protected },
      fields: state.fields.map((f) => {
        const r0 = byId[f.id];
        return { id: f.id, lat: f.lat, lon: f.lon, acres: f.acres, status: r0.status, risk: r0.risk.score, level: r0.risk.level, deadline: r0.deadline, village: villages[f.villageId]?.name, farmerName: f.farmerName, source: f.source };
      }),
      chcs: state.chcs.map((c) => ({ ...c, machines: state.machines.filter((m) => m.chcId === c.id).length })),
      fires: { source: fires.source, live: fires.live, error: fires.error, districtCount: fires.districtCount, punjabCount: fires.punjabCount, points: fires.points, byDate: fires.byDate },
      weather,
      air,
      openIssues: (state.issues || []).filter((i) => i.status === 'open').length,
      store: await storeKind(),
    });
  }));

  a.get('/fields', ah(async (req, res) => {
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

  a.get('/fields/:id', ah(async (req, res) => {
    const state = await loadState();
    const f = state.fields.find((x) => x.id === req.params.id);
    if (!f) return res.status(404).json({ error: 'Field not found' });
    const { sched } = await compute(state);
    const r0 = sched.results.find((x) => x.id === f.id);
    res.json({ field: farmerSlot(state, f, r0), issues: (state.issues || []).filter((i) => i.fieldId === f.id) });
  }));

  a.post('/fields/:id/status', ah(async (req, res) => {
    const { status } = z.object({ status: z.enum(['cleared', 'pending', 'burned']) }).parse(req.body);
    const state = await loadState();
    const f = state.fields.find((x) => x.id === req.params.id);
    if (!f) return res.status(404).json({ error: 'Field not found' });
    f.status = status;
    if (status === 'cleared') { f.clearedOn = todayIST(); f.clearedBy = 'machine'; } else delete f.clearedOn;
    state.pins = (state.pins || []).filter((p) => p.fieldId !== f.id || status === 'pending');
    logEvent(state, req.admin.sub, 'status', `${f.id} → ${status}`);
    await saveState(state);
    res.json({ ok: true });
  }));

  a.get('/dispatch', ah(async (_req, res) => {
    const state = await loadState();
    const { sched } = await compute(state);
    const fields = index(state.fields);
    const byId = index(sched.results);
    const villages = index(state.villages);
    const jobs = {};
    sched.results.forEach((r0) => r0.assignments.forEach((a0) => {
      (jobs[a0.machineId] = jobs[a0.machineId] || []).push({ date: a0.date, fieldId: r0.id, acres: a0.acres, travelKm: a0.travelKm, tractor: a0.tractor, level: byId[r0.id].risk.level, onTime: r0.onTime, village: villages[fields[r0.id].villageId]?.name, farmerName: fields[r0.id].farmerName, deadline: r0.deadline });
    }));
    res.json({
      today: sched.today,
      days: sched.days.slice(0, 28),
      chcs: state.chcs.map((c) => ({ id: c.id, name: c.name, blockId: c.blockId, tractors: c.tractors })),
      machines: state.machines.map((m) => ({ ...m, typeLabel: MACHINE_TYPES[m.type].label, minHp: MACHINE_TYPES[m.type].minHp, jobs: (jobs[m.id] || []).sort((x, y) => x.date.localeCompare(y.date)), usage: sched.usage[m.id] || {} })),
      pins: state.pins || [],
    });
  }));

  a.get('/alerts', ah(async (_req, res) => {
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

  a.post('/reassign', ah(async (req, res) => {
    const body = ReassignSchema.parse(req.body);
    const state = await loadState();
    const f = state.fields.find((x) => x.id === body.fieldId);
    const m = state.machines.find((x) => x.id === body.machineId);
    if (!f || !m) return res.status(404).json({ error: 'Field or machine not found' });
    if (m.status === 'maintenance') return res.status(400).json({ error: 'Machine is under maintenance' });
    const fromDate = body.fromDate < todayIST() ? todayIST() : body.fromDate;
    state.pins = [...(state.pins || []).filter((p) => p.fieldId !== f.id), { fieldId: f.id, machineId: m.id, fromDate, by: req.admin.sub, at: new Date().toISOString() }];
    logEvent(state, req.admin.sub, 'reassign', `${f.id} → ${m.label} from ${fromDate}`);
    await saveState(state);
    const { sched } = await compute(state);
    const r0 = sched.results.find((x) => x.id === f.id);
    const atRiskAfter = sched.results.filter((x) => x.status === 'at_risk').length;
    res.json({ ok: true, result: fieldView(state, f, r0), atRiskAfter });
  }));

  // Try suggested machines for a field; keep the first that gets it in on time AND
  // lowers the district's at-risk count (so a fix never just pushes other fields late).
  function tryFix(state, opts, alert, actor, maxTries = 3) {
    const others = (state.pins || []).filter((p) => p.fieldId !== alert.fieldId);
    const before = runSchedule(state, opts).results.filter((x) => x.status === 'at_risk').length;
    for (const s of alert.suggestions.filter((x) => x.kind === 'reassign').slice(0, maxTries)) {
      const pin = { fieldId: alert.fieldId, machineId: s.machineId, fromDate: s.fromDate, by: actor, at: new Date().toISOString() };
      const all = runSchedule({ ...state, pins: [...others, pin] }, opts).results;
      const trial = all.find((x) => x.id === alert.fieldId);
      const after = all.filter((x) => x.status === 'at_risk').length;
      if (trial.status !== 'at_risk' && after < before) {
        state.pins = [...others, pin];
        const m = state.machines.find((x) => x.id === s.machineId);
        logEvent(state, actor, 'reassign', `${alert.fieldId} → ${m?.label} (${m?.chcId}) from ${s.fromDate}, auto-fix`);
        return { fixed: true, result: { start: trial.start, completion: trial.completion, status: trial.status }, atRiskAfter: after };
      }
    }
    return { fixed: false };
  }

  a.post('/autofix', ah(async (req, res) => {
    const { fieldId } = z.object({ fieldId: z.string() }).parse(req.body);
    const state = await loadState();
    const base = await compute(state);
    const alert = buildAlerts(state, base.sched).find((x) => x.fieldId === fieldId);
    if (!alert) return res.json({ ok: true, fixed: true, already: true });
    const r0 = tryFix(state, base.opts, alert, req.admin.sub);
    if (r0.fixed) await saveState(state);
    res.json({ ok: true, ...r0 });
  }));

  // Sweep the most urgent alerts and apply every net-positive fix (bounded for serverless time limits).
  a.post('/autofix-all', ah(async (req, res) => {
    const state = await loadState();
    const base = await compute(state);
    const startedAt = Date.now();
    const atRiskBefore = base.sched.results.filter((x) => x.status === 'at_risk').length;
    const queue = buildAlerts(state, base.sched).slice(0, 25);
    let fixed = 0, tried = 0;
    for (const alert of queue) {
      if (Date.now() - startedAt > 6500) break;
      tried++;
      if (tryFix(state, base.opts, alert, req.admin.sub, 2).fixed) fixed++;
    }
    if (fixed) await saveState(state);
    const atRiskAfter = runSchedule(state, base.opts).results.filter((x) => x.status === 'at_risk').length;
    res.json({ ok: true, fixed, tried, atRiskBefore, atRiskAfter });
  }));

  a.delete('/pins/:fieldId', ah(async (req, res) => {
    const state = await loadState();
    state.pins = (state.pins || []).filter((p) => p.fieldId !== req.params.fieldId);
    logEvent(state, req.admin.sub, 'unpin', req.params.fieldId);
    await saveState(state);
    res.json({ ok: true });
  }));

  a.post('/issues/:id/resolve', ah(async (req, res) => {
    const state = await loadState();
    const i = (state.issues || []).find((x) => x.id === req.params.id);
    if (!i) return res.status(404).json({ error: 'Issue not found' });
    i.status = 'resolved'; i.resolvedAt = new Date().toISOString(); i.resolution = String(req.body?.note || '').slice(0, 300);
    logEvent(state, req.admin.sub, 'resolve', `${i.id} (${i.fieldId})`);
    await saveState(state);
    res.json({ ok: true });
  }));

  a.post('/machines/:id', ah(async (req, res) => {
    const { status } = z.object({ status: z.enum(['active', 'maintenance']) }).parse(req.body);
    const state = await loadState();
    const m = state.machines.find((x) => x.id === req.params.id);
    if (!m) return res.status(404).json({ error: 'Machine not found' });
    m.status = status;
    if (status === 'maintenance') state.pins = (state.pins || []).filter((p) => p.machineId !== m.id);
    logEvent(state, req.admin.sub, 'machine', `${m.label} (${m.chcId}) → ${status}`);
    await saveState(state);
    res.json({ ok: true });
  }));

  a.get('/registry', ah(async (_req, res) => {
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

  a.post('/whatif', ah(async (req, res) => {
    const body = WhatIfSchema.parse(req.body);
    const state = await loadState();
    const base = await compute(state);
    const sim = structuredClone(state);
    body.add.forEach((x, i) => {
      for (let k = 0; k < x.count; k++) {
        sim.machines.push({ id: `sim-${i}-${k}`, chcId: x.chcId, type: x.type, label: `+ ${MACHINE_TYPES[x.type].label}`, acresPerDay: MACHINE_TYPES[x.type].acresPerDay, status: 'active' });
      }
    });
    if (body.fixMaintenance) sim.machines.forEach((m) => { m.status = 'active'; });
    for (let t = 0; t < body.extraTractors; t++) {
      const c = sim.chcs[t % sim.chcs.length];
      c.tractors.push({ id: `sim-tr-${t}`, hp: 60 });
    }
    const after = runSchedule(sim, { ...base.opts });
    const sb = buildStats(state, base.sched);
    const sa = buildStats(sim, after);
    const pick = (s) => ({ onTimePct: s.onTimePct, atRisk: s.fields.atRisk, highRisk: s.fields.highRisk, protectedAcres: s.acres.protected, utilisationPct: s.utilisationPct, co2Tonnes: s.impact.co2Tonnes, pmKg: s.impact.pmKg, machines: s.machines.active });
    res.json({ before: pick(sb), after: pick(sa) });
  }));

  a.get('/briefing', ah(async (_req, res) => {
    const state = await loadState();
    const [{ sched, weather, fires }, air] = await Promise.all([compute(state), getAir()]);
    const stats = buildStats(state, sched);
    const alerts = buildAlerts(state, sched);
    const rainDays = weather.days.filter((d) => d.date >= sched.today && d.rainMm >= SCHED.rainStopMm).slice(0, 3).map((d) => d.date);
    const worstBlock = [...stats.byBlock].sort((x, y) => y.atRisk - x.atRisk)[0];
    const facts = {
      date: sched.today, onTimePct: stats.onTimePct, pending: stats.fields.pending, atRisk: stats.fields.atRisk, highRisk: stats.fields.highRisk,
      utilisationPct: stats.utilisationPct, rainDays, firesDistrict7d: fires.districtCount, firesSource: fires.source,
      worstBlock: worstBlock?.atRisk ? { id: worstBlock.blockId, name: worstBlock.name, atRisk: worstBlock.atRisk } : null,
      topAlert: alerts[0] ? { fieldId: alerts[0].fieldId, village: alerts[0].village, acres: alerts[0].acres, deadline: alerts[0].deadline, code: alerts[0].risk.codes[0] || null, reason: alerts[0].risk.reasons[0] || null } : null,
      pm25Sangrur: air.spots?.[0]?.pm25 ?? null,
      openIssues: (state.issues || []).filter((i) => i.status === 'open').length,
    };
    const ruleBased = [
      `${facts.onTimePct}% of ${facts.pending} pending fields are scheduled before their sowing deadline; ${facts.atRisk} are at risk (${facts.highRisk} high).`,
      facts.worstBlock ? `Most pressure is in ${facts.worstBlock.name} (${facts.worstBlock.atRisk} at risk). Consider moving a machine there.` : 'No block currently has fields at risk.',
      `Machine utilisation over the next 14 working days is ${facts.utilisationPct}%.`,
      facts.rainDays.length ? `Rain is forecast on ${facts.rainDays.map((d) => fmtDate(d)).join(', ')}; those days are blocked for field work.` : 'No rain stoppages in the forecast.',
      `${facts.firesDistrict7d} fire hotspots in the district over the last 7 days${facts.firesSource === 'sample' ? ' (sample data, add a FIRMS key for live)' : ''}.`,
      facts.openIssues ? `${facts.openIssues} farmer report(s) are waiting for a response.` : null,
      facts.topAlert ? `Top priority: ${facts.topAlert.fieldId} in ${facts.topAlert.village}, ${facts.topAlert.acres} ac, deadline ${fmtDate(facts.topAlert.deadline)}${facts.topAlert.reason ? ` (${facts.topAlert.reason.toLowerCase()})` : ''}.` : null,
    ].filter(Boolean);

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const r0 = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
            max_tokens: 400,
            messages: [{ role: 'user', content: `You are the morning briefing assistant for a district crop-residue nodal officer in Punjab, India. Using ONLY these facts (JSON), write 4-6 short bullet points: what needs action today, in plain English, most urgent first. Do not invent numbers.\n\n${JSON.stringify(facts)}` }],
          }),
        });
        const j = await r0.json();
        const text = j.content?.[0]?.text;
        if (text) return res.json({ source: 'claude', bullets: text.split('\n').map((s) => s.replace(/^[-*•\s]+/, '').trim()).filter(Boolean), facts });
      } catch (e) { /* fall back to rule-based */ }
    }
    res.json({ source: 'rules', bullets: ruleBased, facts });
  }));

  a.get('/log', ah(async (_req, res) => {
    const state = await loadState();
    res.json({ log: (state.log || []).slice().reverse().slice(0, 150) });
  }));

  a.get('/export/schedule.csv', ah(async (_req, res) => {
    const state = await loadState();
    const { sched } = await compute(state);
    const fields = index(state.fields);
    const machines = index(state.machines);
    const chcs = index(state.chcs);
    const rows = [['date', 'field_id', 'farmer', 'acres_worked', 'machine', 'chc', 'tractor', 'deadline', 'on_time', 'risk_score']];
    sched.results.forEach((r0) => r0.assignments.forEach((a0) => rows.push([a0.date, r0.id, fields[r0.id].farmerName, a0.acres, machines[a0.machineId]?.label, chcs[a0.chcId]?.name, a0.tractor, r0.deadline, r0.onTime, r0.risk.score])));
    rows.sort((x, y) => String(x[0]).localeCompare(String(y[0])));
    const csv = rows.map((row) => row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    res.setHeader('content-type', 'text/csv');
    res.setHeader('content-disposition', `attachment; filename="strawslot-schedule-${sched.today}.csv"`);
    res.send(csv);
  }));

  a.post('/reset', ah(async (req, res) => {
    const state = freshState();
    logEvent(state, req.admin.sub, 'reset', 'Demo data reset');
    await saveState(state);
    res.json({ ok: true });
  }));

  r.use('/admin', a);
  r.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  app.use('/api', r);
  app.use('/.netlify/functions/api', r);

  // Central error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.issues[0]?.message || 'Invalid input', details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
    }
    console.error('[api]', req.method, req.path, err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

  return app;
}
