// Officer use cases. Reads come from the cached plan; writes run in a transaction under a per-district lock
// (so two officers pressing Auto-fix at once cannot overwrite each other) and are audited.
import { badRequest, conflict, notFound } from '../core/errors.js';
import { query, tx, lockDistrict, one } from '../db/pool.js';
import { MACHINE_TYPES } from '../domain/constants.js';
import { buildStats, runSchedule } from '../domain/engine.js';
import { todayIST } from '../domain/dates.js';
import type { Pin, State } from '../domain/types.js';
import { audit, listIssues, openIssueCount, deletePin, deletePinsForMachine, enqueueNotification, fieldExists, listAudit, resolveIssue, setFieldStatus, setMachineStatus, upsertPin } from '../repositories/ops.js';
import { loadState } from '../repositories/snapshot.js';
import { reseedFields } from '../seed/seedDistrict.js';
import { freshPlan, getPlan, noteWrite, type Plan } from './planService.js';
import { getLive } from './liveService.js';
import { atRiskCount, buildAlerts, fieldView, farmerSlot, index, tryFix } from './views.js';
import { makeBriefing } from './briefing.js';

const flat = (s: { payload: any; source: string; live: boolean; fetchedAt: string; error?: string }) => ({ source: s.source, live: s.live, fetchedAt: s.fetchedAt, error: s.error, ...s.payload });

// Views derived from an immutable plan are built once per plan object, not once per request.
const viewMemo = new WeakMap<object, Map<string, any>>();
function memo<T>(plan: object, key: string, build: () => T): T {
  let m = viewMemo.get(plan); if (!m) viewMemo.set(plan, m = new Map());
  if (!m.has(key)) m.set(key, build());
  return m.get(key);
}

export async function overview(d: string) {
  const [plan, live] = await Promise.all([getPlan(d), getLive(d)]);
  const openIssues = await openIssueCount(d);
  const base = memo(plan, 'overview:' + live.fires.fetchedAt + live.weather.fetchedAt + live.air.fetchedAt, () => buildOverview(plan, live));
  return { ...base, openIssues };
}

function buildOverview(plan: Plan, live: Awaited<ReturnType<typeof getLive>>) {
  const { state, sched, stats } = plan;
  const byId = index(sched.results), villages = index(state.villages);
  const fires = flat(live.fires);
  return {
    stats, baseline: plan.baseline,
    fields: state.fields.map((f) => {
      const r = byId[f.id];
      return { id: f.id, lat: f.lat, lon: f.lon, acres: f.acres, status: r.status, risk: r.risk.score, level: r.risk.level, deadline: r.deadline, village: villages[f.villageId]?.name, farmerName: f.farmerName, source: f.source };
    }),
    chcs: state.chcs.map((c) => ({ ...c, machines: state.machines.filter((m) => m.chcId === c.id).length })),
    // the map only needs fires inside the district; the Punjab-wide total is still reported
    fires: { source: fires.source, live: fires.live, error: fires.error, districtCount: fires.districtCount, punjabCount: fires.punjabCount, points: fires.district, byDate: fires.byDate },
    weather: flat(live.weather), air: flat(live.air),
    store: 'postgres', plan: { version: plan.version, computedAt: plan.computedAt, computeMs: plan.computeMs },
  };
}

export async function fieldsList(d: string, q: { q?: string; status?: string; block?: string; limit?: number; offset?: number }) {
  const plan = await getPlan(d);
  const byId = index(plan.sched.results);
  let list: ReturnType<typeof fieldView>[] = memo(plan, 'fieldViews', () => plan.state.fields.map((f) => fieldView(plan.state, f, byId[f.id])));
  const needle = (q.q || '').toLowerCase();
  if (needle) list = list.filter((f) => [f.id, f.farmerName, f.village].some((s) => s?.toLowerCase().includes(needle)));
  if (q.status) list = list.filter((f) => f.status === q.status);
  if (q.block) list = list.filter((f) => f.blockId === q.block);
  const total = list.length;
  if (q.limit != null) list = list.slice(q.offset ?? 0, (q.offset ?? 0) + q.limit);
  return { fields: list, total };
}

export async function fieldDetail(d: string, id: string) {
  const plan = await getPlan(d);
  const f = plan.state.fields.find((x) => x.id === id);
  if (!f) throw notFound('Field not found');
  const r = plan.sched.results.find((x) => x.id === id)!;
  const version = (await one<{ version: number }>('select version from fields where district_id = $1 and id = $2', [d, id]))?.version;
  return { field: { ...farmerSlot(plan.state, f, r), version }, issues: await listIssues(d, id) };
}

export async function setStatus(d: string, actor: string, id: string, status: string, expectedVersion?: number) {
  await tx(async (c) => {
    await lockDistrict(c, d);
    const r = await setFieldStatus(c, d, id, status, todayIST(), expectedVersion);
    if (!r) {
      if (!(await fieldExists(d, id))) throw notFound('Field not found');
      throw conflict('This field was changed by someone else. Reload and try again.');
    }
    if (status !== 'pending') await deletePin(c, d, id);
    await audit(c, d, actor, 'status', `${id} → ${status}`);
    if (status === 'cleared') {
      const f = (await query('select phone, language from fields where district_id = $1 and id = $2', [d, id], c))[0];
      await enqueueNotification(c, { districtId: d, fieldId: id, kind: 'field_cleared', toPhone: f.phone, lang: f.language, dedupeKey: `cleared:${d}:${id}` });
    }
  });
  noteWrite(d);
  return { ok: true };
}

export async function dispatch(d: string) {
  const { state, sched } = await getPlan(d);
  const fields = index(state.fields), byId = index(sched.results), villages = index(state.villages);
  const jobs: Record<string, any[]> = {};
  sched.results.forEach((r) => r.assignments.forEach((a) => {
    (jobs[a.machineId] = jobs[a.machineId] || []).push({ date: a.date, fieldId: r.id, acres: a.acres, travelKm: a.travelKm, tractor: a.tractor, level: byId[r.id].risk.level, onTime: r.onTime, village: villages[fields[r.id].villageId]?.name, farmerName: fields[r.id].farmerName, deadline: r.deadline });
  }));
  return {
    today: sched.today, days: sched.days.slice(0, 28),
    chcs: state.chcs.map((c) => ({ id: c.id, name: c.name, blockId: c.blockId, tractors: c.tractors })),
    machines: state.machines.map((m) => ({ ...m, typeLabel: MACHINE_TYPES[m.type].label, minHp: MACHINE_TYPES[m.type].minHp, jobs: (jobs[m.id] || []).sort((x, y) => x.date.localeCompare(y.date)), usage: sched.usage[m.id] || {} })),
    pins: state.pins || [],
  };
}

export async function alerts(d: string) {
  const plan = await getPlan(d);
  const fieldsById = index(plan.state.fields);
  return {
    alerts: plan.alerts,
    issues: (await listIssues(d)).reverse().map((i) => ({ ...i, farmerName: fieldsById[i.fieldId]?.farmerName })),
    machines: plan.state.machines.filter((m) => m.status !== 'maintenance').map((m) => ({ id: m.id, label: m.label, chcId: m.chcId, type: m.type })),
    chcs: plan.state.chcs.map((c) => ({ id: c.id, name: c.name })),
  };
}

/** Notify the farmer when their machine or date changed because of an officer action. */
async function queuePlanUpdate(c: any, d: string, fieldIds: string[], version: number) {
  if (!fieldIds.length) return;
  const rows = await query('select id, phone, language from fields where district_id = $1 and id = any($2::text[])', [d, fieldIds], c);
  for (const f of rows) await enqueueNotification(c, { districtId: d, fieldId: f.id, kind: 'plan_update', toPhone: f.phone, lang: f.language, dedupeKey: `plan:${d}:${f.id}:${version}` });
}

export async function reassign(d: string, actor: string, body: { fieldId: string; machineId: string; fromDate: string }) {
  await tx(async (c) => {
    await lockDistrict(c, d);
    const f = await one('select id from fields where district_id = $1 and id = $2', [d, body.fieldId], c);
    const m = await one<{ label: string; status: string }>('select label, status from machines where district_id = $1 and id = $2', [d, body.machineId], c);
    if (!f || !m) throw notFound('Field or machine not found');
    if (m.status === 'maintenance') throw badRequest('Machine is under maintenance');
    const fromDate = body.fromDate < todayIST() ? todayIST() : body.fromDate;
    await upsertPin(c, d, { fieldId: body.fieldId, machineId: body.machineId, fromDate, by: actor });
    await audit(c, d, actor, 'reassign', `${body.fieldId} → ${m.label} from ${fromDate}`);
    await queuePlanUpdate(c, d, [body.fieldId], Date.now());
  });
  const plan = await freshPlan(d);
  const f = plan.state.fields.find((x) => x.id === body.fieldId)!;
  return { ok: true, result: fieldView(plan.state, f, plan.sched.results.find((x) => x.id === f.id)!), atRiskAfter: atRiskCount(plan.sched.results) };
}

export async function autofix(d: string, actor: string, fieldId: string) {
  let out: any = { ok: true, fixed: false };
  await tx(async (c) => {
    await lockDistrict(c, d);
    // read inside the lock so the decision is made on the latest pins
    const state = await loadState(d, c);
    const base = await freshOpts(d);
    const alert = buildAlerts(state, runSchedule(state, base)).find((x) => x.fieldId === fieldId);
    if (!alert) { out = { ok: true, fixed: true, already: true }; return; }
    const r = tryFix(state, base, alert, actor);
    if (!r.fixed) return;
    await upsertPin(c, d, r.pin!);
    await audit(c, d, actor, 'reassign', `${fieldId} → ${r.machineLabel} from ${r.pin!.fromDate}, auto-fix`);
    await queuePlanUpdate(c, d, [fieldId], Date.now());
    out = { ok: true, fixed: true, result: r.result, atRiskAfter: r.atRiskAfter };
  });
  if (out.fixed && !out.already) await freshPlan(d);
  return out;
}

export async function autofixAll(d: string, actor: string) {
  let out: any;
  await tx(async (c) => {
    // A sweep is CPU-heavy. A second one started while the first runs would only queue behind it
    // and likely hit the request timeout, so say so immediately instead.
    const free = (await c.query("select pg_try_advisory_xact_lock(hashtext($1)) as ok", ['autofix:' + d])).rows[0].ok;
    if (!free) throw conflict('An auto-fix sweep is already running for this district. Try again in a few seconds.');
    await lockDistrict(c, d);
    const state = await loadState(d, c);
    const opts = await freshOpts(d);
    const before = atRiskCount(runSchedule(state, opts).results);
    const queue = buildAlerts(state, runSchedule(state, opts)).slice(0, 25);
    const started = Date.now();
    let fixed = 0, tried = 0; const changed: string[] = [];
    for (const alert of queue) {
      if (Date.now() - started > 6500) break; // time box so one request cannot hog the CPU
      tried++;
      const r = tryFix(state, opts, alert, actor, 2);
      if (r.fixed) {
        fixed++; changed.push(alert.fieldId);
        state.pins = [...(state.pins || []).filter((p) => p.fieldId !== alert.fieldId), r.pin!]; // later trials see earlier fixes
        await upsertPin(c, d, r.pin!);
        await audit(c, d, actor, 'reassign', `${alert.fieldId} → ${r.machineLabel} from ${r.pin!.fromDate}, auto-fix`);
      }
    }
    await queuePlanUpdate(c, d, changed, Date.now());
    out = { ok: true, fixed, tried, atRiskBefore: before, atRiskAfter: atRiskCount(runSchedule(state, opts).results) };
  });
  if (out.fixed) await freshPlan(d);
  return out;
}

async function freshOpts(d: string) {
  const live = await getLive(d);
  const rain = Object.fromEntries((live.weather.payload.days as any[]).map((x) => [x.date, x.rainMm]));
  return { today: todayIST(), rain, fires: live.fires.payload.district };
}

export async function unpin(d: string, actor: string, fieldId: string) {
  await tx(async (c) => { await lockDistrict(c, d); await deletePin(c, d, fieldId); await audit(c, d, actor, 'unpin', fieldId); });
  noteWrite(d);
  return { ok: true };
}

export async function resolve(d: string, actor: string, id: string, note: string) {
  await tx(async (c) => {
    const r = await resolveIssue(c, d, id, note);
    if (!r) throw notFound('Issue not found');
    await audit(c, d, actor, 'resolve', `${id} (${r.field_id})`);
  });
  return { ok: true };
}

export async function machineStatus(d: string, actor: string, id: string, status: string) {
  await tx(async (c) => {
    await lockDistrict(c, d);
    const m = await setMachineStatus(c, d, id, status);
    if (!m) throw notFound('Machine not found');
    if (status === 'maintenance') await deletePinsForMachine(c, d, id);
    await audit(c, d, actor, 'machine', `${m.label} (${m.chc_id}) → ${status}`);
  });
  noteWrite(d);
  return { ok: true };
}

export async function registry(d: string) {
  const { state, sched } = await getPlan(d);
  const next14 = sched.days.filter((x) => x.working).slice(0, 14).map((x) => x.date);
  return {
    chcs: state.chcs.map((c) => ({ ...c, machineCount: state.machines.filter((m) => m.chcId === c.id).length })),
    machines: state.machines.map((m) => {
      const used = next14.reduce((s, day) => s + (sched.usage[m.id]?.[day] || 0), 0);
      return { ...m, typeLabel: MACHINE_TYPES[m.type].label, minHp: MACHINE_TYPES[m.type].minHp, utilisationPct: m.status === 'maintenance' ? 0 : Math.round((used / (m.acresPerDay * Math.max(1, next14.length))) * 100) };
    }),
    vendors: state.vendors, blocks: state.blocks,
  };
}

export async function whatIf(d: string, body: { add: { chcId: string; type: keyof typeof MACHINE_TYPES; count: number }[]; fixMaintenance: boolean; extraTractors: number }) {
  const plan = await getPlan(d);
  const sim: State = structuredClone(plan.state);
  for (const [i, x] of body.add.entries()) {
    if (!sim.chcs.some((c) => c.id === x.chcId)) throw badRequest(`Unknown centre ${x.chcId}`);
    for (let k = 0; k < x.count; k++) sim.machines.push({ id: `sim-${i}-${k}`, chcId: x.chcId, type: x.type, label: `+ ${MACHINE_TYPES[x.type].label}`, acresPerDay: MACHINE_TYPES[x.type].acresPerDay, status: 'active' });
  }
  if (body.fixMaintenance) sim.machines.forEach((m) => { m.status = 'active'; });
  for (let t = 0; t < body.extraTractors; t++) sim.chcs[t % sim.chcs.length].tractors.push({ id: `sim-tr-${t}`, hp: 60 });
  const sb = plan.stats;
  const sa = buildStats(sim, runSchedule(sim, { ...plan.opts }));
  const pick = (s: typeof sb) => ({ onTimePct: s.onTimePct, atRisk: s.fields.atRisk, highRisk: s.fields.highRisk, protectedAcres: s.acres.protected, utilisationPct: s.utilisationPct, co2Tonnes: s.impact.co2Tonnes, pmKg: s.impact.pmKg, machines: s.machines.active });
  return { before: pick(sb), after: pick(sa) };
}

export async function briefing(d: string) {
  const [plan, live] = await Promise.all([getPlan(d), getLive(d)]);
  const issues = await listIssues(d);
  return makeBriefing({ state: { ...plan.state, issues }, sched: plan.sched, weather: live.weather.payload, fires: { districtCount: live.fires.payload.districtCount, source: live.fires.source }, air: live.air.payload });
}

export const auditLog = async (d: string, limit: number, before?: number) => ({ log: (await listAudit(d, limit, before)).map((r) => ({ ...r, at: r.at })) });

export async function exportCsv(d: string) {
  const { state, sched } = await getPlan(d);
  const fields = index(state.fields), machines = index(state.machines), chcs = index(state.chcs);
  const rows: (string | number | boolean | undefined)[][] = [['date', 'field_id', 'farmer', 'acres_worked', 'machine', 'chc', 'tractor', 'deadline', 'on_time', 'risk_score']];
  sched.results.forEach((r) => r.assignments.forEach((a) => rows.push([a.date, r.id, fields[r.id].farmerName, a.acres, machines[a.machineId]?.label, chcs[a.chcId]?.name, a.tractor, r.deadline, r.onTime, r.risk.score])));
  rows.sort((x, y) => String(x[0]).localeCompare(String(y[0])));
  const cell = (c: unknown) => { const s = String(c ?? ''); return `"${(/^[=+@-]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`; }; // neutralise spreadsheet formulas
  return { csv: rows.map((r) => r.map(cell).join(',')).join('\n'), filename: `strawslot-schedule-${sched.today}.csv` };
}

export async function trends(d: string, days = 30) {
  const rows = await query('select day, on_time_pct, baseline_pct, pending, at_risk, high_risk, utilisation_pct, protected_acres from kpi_history where district_id = $1 order by day desc limit $2', [d, days]);
  return { days: rows.reverse().map((r) => ({ day: r.day, onTimePct: r.on_time_pct, baselinePct: r.baseline_pct, pending: r.pending, atRisk: r.at_risk, highRisk: r.high_risk, utilisationPct: r.utilisation_pct, protectedAcres: r.protected_acres })) };
}

export async function notificationsList(d: string, limit = 100) {
  const rows = await query('select id, field_id, kind, to_phone, status, attempts, last_error, created_at, sent_at, next_attempt_at from notifications where district_id = $1 order by created_at desc limit $2', [d, limit]);
  const summary = await query("select status, count(*)::int as n from notifications where district_id = $1 group by status", [d]);
  return { summary: Object.fromEntries(summary.map((r) => [r.status, r.n])), notifications: rows.map((r) => ({ id: r.id, fieldId: r.field_id, kind: r.kind, to: `${r.to_phone.slice(0, 2)}xxxxxx${r.to_phone.slice(-2)}`, status: r.status, attempts: r.attempts, lastError: r.last_error, createdAt: r.created_at, sentAt: r.sent_at, nextAttemptAt: r.next_attempt_at })) };
}

export async function resetDemo(d: string, actor: string) {
  if (d !== 'sangrur') throw badRequest('Only the demo district can be reset');
  await reseedFields(todayIST(), actor);
  noteWrite(d);
  return { ok: true };
}
export type { Plan, Pin };
