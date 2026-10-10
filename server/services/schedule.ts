// Application services shared by the route modules: compute the live schedule and
// shape domain objects into API views.
import { buildAlerts, runSchedule } from '../lib/engine.js';
import { getFires, getWeather, rainMap } from '../lib/live.js';
import { farmerMessage } from '../lib/messages.js';
import { logEvent } from '../lib/store.js';
import { MACHINE_TYPES } from '../lib/constants.js';
import { todayIST } from '../lib/dates.js';
import type { Alert, Field, FieldResult, Lang, Pin, ScheduleOptions, State } from '../types.js';

export const index = <T extends { id: string }>(arr: T[]): Record<string, T> => Object.fromEntries(arr.map((x) => [x.id, x]));
const maskPhone = (p: string) => (p ? `${p.slice(0, 2)}xxxxxx${p.slice(-2)}` : '');

/** Runs the scheduler against live rain and fire data. */
export async function compute(state: State, extra: Partial<ScheduleOptions> = {}) {
  const [weather, fires] = await Promise.all([getWeather(), getFires()]);
  const opts: ScheduleOptions = { today: todayIST(), rain: rainMap(weather), fires: fires.district };
  const sched = runSchedule(state, { ...opts, ...extra });
  return { sched, weather, fires, opts };
}

export function fieldView(state: State, f: Field, r: FieldResult, { full = false } = {}) {
  const v = index(state.villages)[f.villageId];
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

/** What a farmer (or the officer opening a field) sees: the view plus machine, hiring centre and an SMS text. */
export function farmerSlot(state: State, f: Field, r: FieldResult, lang?: Lang) {
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

const atRiskCount = (results: FieldResult[]) => results.filter((x) => x.status === 'at_risk').length;

/**
 * Try the suggested machines for one alert and keep the first that gets the field in on time
 * AND lowers the district's at-risk count, so a fix never just pushes other fields late.
 */
export function tryFix(state: State, opts: ScheduleOptions, alert: Alert, actor: string, maxTries = 3) {
  const others = (state.pins || []).filter((p) => p.fieldId !== alert.fieldId);
  const before = atRiskCount(runSchedule(state, opts).results);
  for (const s of alert.suggestions.filter((x) => x.kind === 'reassign').slice(0, maxTries)) {
    const pin: Pin = { fieldId: alert.fieldId, machineId: s.machineId!, fromDate: s.fromDate!, by: actor, at: new Date().toISOString() };
    const all = runSchedule({ ...state, pins: [...others, pin] }, opts).results;
    const trial = all.find((x) => x.id === alert.fieldId)!;
    const after = atRiskCount(all);
    if (trial.status !== 'at_risk' && after < before) {
      state.pins = [...others, pin];
      const m = state.machines.find((x) => x.id === s.machineId);
      logEvent(state, actor, 'reassign', `${alert.fieldId} → ${m?.label} (${m?.chcId}) from ${s.fromDate}, auto-fix`);
      return { fixed: true as const, result: { start: trial.start, completion: trial.completion, status: trial.status }, atRiskAfter: after };
    }
  }
  return { fixed: false as const };
}

export { atRiskCount, buildAlerts };
