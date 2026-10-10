// StrawSlot core engine: deadlines, slot optimiser, burn-risk scoring,
// early warnings, KPIs and impact estimates. Pure functions, no I/O.

import { addDays, diffDays, maxDate, minDate } from './dates.js';
import { MACHINE_TYPES, SCHED, FACTORS, RISK_LEVELS } from './constants.js';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const niceDate = (d) => `${+d.slice(8, 10)} ${MON[+d.slice(5, 7) - 1]}`;

export function haversineKm(a, b) {
  const R = 6371, toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const round1 = (x) => Math.round(x * 10) / 10;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export function deadlineOf(field) {
  return addDays(field.harvestDate, field.windowDays ?? SCHED.defaultWindowDays);
}

export function eligibleTypes(preference) {
  if (preference === 'in_situ') return Object.keys(MACHINE_TYPES).filter((t) => MACHINE_TYPES[t].method === 'in_situ');
  if (preference === 'ex_situ') return ['baler'];
  return Object.keys(MACHINE_TYPES);
}

export function riskLevel(score) {
  return RISK_LEVELS.find((r) => score >= r.min).level;
}

/**
 * Run the full schedule.
 * @param {object} state  store state (fields, machines, chcs, vendors, pins, villages, blocks)
 * @param {object} opts   { today, rain: {date: mm}, fires: [{lat,lon,date}], horizonDays }
 */
export function runSchedule(state, opts) {
  const today = opts.today;
  const rain = opts.rain || {};
  const fires = opts.fires || [];
  const horizonCap = opts.horizonDays ?? 60;
  // 'optimised' = StrawSlot. 'baseline' = today's first-come-first-served booking:
  // requests served in booking order, only by the nearest CHC, no cross-block borrowing.
  const baseline = opts.mode === 'baseline';

  const chcById = Object.fromEntries(state.chcs.map((c) => [c.id, c]));
  const villageById = Object.fromEntries(state.villages.map((v) => [v.id, v]));
  const pins = Object.fromEntries((state.pins || []).map((p) => [p.fieldId, p]));

  const machines = state.machines
    .filter((m) => m.status !== 'maintenance')
    .map((m) => {
      const c = chcById[m.chcId];
      return { ...m, minHp: MACHINE_TYPES[m.type].minHp, method: MACHINE_TYPES[m.type].method, home: { lat: c.lat, lon: c.lon }, pos: { lat: c.lat, lon: c.lon } };
    });

  // Per-field working state
  const work = state.fields.map((f) => {
    const nearest = state.chcs
      .map((c) => ({ c, km: haversineKm(f, c) }))
      .sort((a, b) => a.km - b.km)[0];
    return {
      f,
      deadline: deadlineOf(f),
      remaining: f.status === 'pending' ? f.acres : 0,
      types: eligibleTypes(f.preference),
      assignments: [],
      lastMachine: null,
      nearestChc: nearest ? { id: nearest.c.id, km: round1(nearest.km) } : null,
    };
  });

  const pendingWork = work.filter((w) => w.remaining > 0);
  const lastDeadline = pendingWork.reduce((m, w) => maxDate(m, w.deadline), today);
  const horizonEnd = minDate(addDays(lastDeadline, 10), addDays(today, horizonCap));

  const usage = {}; // machineId -> date -> acres
  const days = [];
  const tractorHp = (chc) => (chc.tractors || []).map((t) => t.hp);

  for (let d = today; d <= horizonEnd; d = addDays(d, 1)) {
    const rainMm = rain[d] ?? null;
    const working = !(rainMm != null && rainMm >= SCHED.rainStopMm);
    const day = { date: d, working, rainMm, scheduledAcres: 0, capacityAcres: 0 };
    days.push(day);
    if (!working) continue;

    const cap = {}; // machineId -> acres left today
    const hasTractor = {}; // machineId -> bool
    const tractorsLeft = {}; // chcId -> [hp...]
    machines.forEach((m) => { cap[m.id] = m.acresPerDay; m.pos = { ...m.home }; day.capacityAcres += m.acresPerDay; });
    state.chcs.forEach((c) => { tractorsLeft[c.id] = tractorHp(c).sort((a, b) => a - b); });

    const ready = pendingWork
      .filter((w) => w.remaining > 0.01 && addDays(w.f.harvestDate, 1) <= d)
      .filter((w) => !pins[w.f.id] || pins[w.f.id].fromDate <= d)
      .map((w) => {
        if (baseline) return { w, slack: Date.parse(w.f.createdAt || w.f.harvestDate) / 864e5 - (w.assignments.length ? 1e6 : 0) };
        const daysLeft = diffDays(w.deadline, d);
        let slack = daysLeft - w.remaining / 7;
        if (w.assignments.length) slack -= 0.5; // finish what we started
        if (pins[w.f.id]) slack -= 1.5; // officer overrides get a nudge, without starving other fields
        return { w, slack };
      })
      .sort((a, b) => a.slack - b.slack);

    for (const { w, slack } of ready) {
      const pin = pins[w.f.id];
      const radius = slack <= 1 ? SCHED.serviceRadiusKm * 1.6 : SCHED.serviceRadiusKm;
      let best = null;
      for (const m of machines) {
        if (cap[m.id] < 0.5) continue;
        if (pin && pin.machineId !== m.id) continue;
        if (!pin && !w.types.includes(m.type)) continue;
        if (baseline && m.chcId !== w.nearestChc?.id) continue;
        const kmHome = haversineKm(m.home, w.f);
        if (!pin && kmHome > radius) continue;
        const ownTractorOk = w.f.tractor?.owns && w.f.tractor.hp >= m.minHp;
        const needsChcTractor = !ownTractorOk && !hasTractor[m.id];
        if (needsChcTractor && !(tractorsLeft[m.chcId] || []).some((hp) => hp >= m.minHp)) continue;
        const km = haversineKm(m.pos, w.f);
        const travelLoss = (km / SCHED.travelKmPerHourOfWork / SCHED.workHoursPerDay) * m.acresPerDay;
        const usable = cap[m.id] - travelLoss;
        if (usable < 0.5) continue;
        const cost = baseline ? kmHome : km - (w.lastMachine === m.id ? 5 : 0) - usable * 0.2;
        if (!best || cost < best.cost) best = { m, km, usable, cost, needsChcTractor, ownTractorOk };
      }
      if (!best) continue;
      const { m } = best;
      if (best.needsChcTractor) {
        const list = tractorsLeft[m.chcId];
        const idx = list.findIndex((hp) => hp >= m.minHp);
        list.splice(idx, 1);
        hasTractor[m.id] = true;
      }
      const acres = w.remaining <= best.usable + 0.25 ? w.remaining : best.usable; // finish small leftovers in the same visit
      cap[m.id] = Math.max(0, best.usable - acres); // usable already excludes travel time
      m.pos = { lat: w.f.lat, lon: w.f.lon };
      w.remaining = Math.max(0, w.remaining - acres);
      w.lastMachine = m.id;
      w.assignments.push({ date: d, machineId: m.id, chcId: m.chcId, type: m.type, acres: round1(acres), travelKm: round1(best.km), tractor: best.ownTractorOk ? 'farmer' : 'chc' });
      usage[m.id] = usage[m.id] || {};
      usage[m.id][d] = round1((usage[m.id][d] || 0) + acres);
      day.scheduledAcres += acres;
    }
    day.scheduledAcres = round1(day.scheduledAcres);
  }

  // Straw pickups for baled fields
  const vendorCap = {};
  const pickupFor = (date, tonnes) => {
    const out = [];
    let left = tonnes;
    for (let d = date; left > 0.05 && d <= addDays(horizonEnd, 10); d = addDays(d, 1)) {
      if (rain[d] != null && rain[d] >= SCHED.rainStopMm) continue;
      for (const v of state.vendors) {
        const key = `${v.id}|${d}`;
        const free = v.capacityTonnesPerDay - (vendorCap[key] || 0);
        if (free <= 0.05) continue;
        const take = Math.min(free, left);
        vendorCap[key] = (vendorCap[key] || 0) + take;
        out.push({ date: d, vendorId: v.id, tonnes: round1(take) });
        left -= take;
        if (left <= 0.05) break;
      }
    }
    return out;
  };

  // Results per field
  const firesRecent = fires.filter((p) => !p.date || diffDays(today, p.date) <= 7);
  const results = work.map((w) => {
    const f = w.f;
    const base = {
      id: f.id,
      deadline: w.deadline,
      daysLeft: diffDays(w.deadline, today),
      nearestChc: w.nearestChc,
      village: villageById[f.villageId]?.name,
      blockId: villageById[f.villageId]?.blockId,
    };
    if (f.status !== 'pending') {
      return { ...base, status: f.status, onTime: f.status === 'cleared', risk: { score: 0, level: 'low', reasons: [], codes: [] }, assignments: [], pickups: [] };
    }
    const done = w.remaining <= 0.01;
    const completion = done ? w.assignments[w.assignments.length - 1].date : null;
    const start = w.assignments[0]?.date || null;
    const onTime = done && completion <= w.deadline;
    const balerAcres = w.assignments.filter((a) => a.type === 'baler').reduce((s, a) => s + a.acres, 0);
    const pickups = done && balerAcres > 0 ? pickupFor(addDays(completion, 1), balerAcres * FACTORS.strawTonnesPerAcre) : [];

    // Burn-risk score
    const slackDays = done ? diffDays(w.deadline, completion) : -3;
    // reasons: English text for logs/CSV, codes for the bilingual UI
    const reasons = [];
    const codes = [];
    const why = (text, code) => { reasons.push(text); codes.push(code); };
    const sSlack = clamp(45 - slackDays * 7.5, 0, 60);
    if (!done) why('No machine available before the deadline', { k: 'no_machine' });
    else if (slackDays < 0) why(`Projected ${-slackDays} day(s) after sowing deadline`, { k: 'late', n: -slackDays });
    else if (slackDays <= 2) why(`Only ${slackDays} day(s) of buffer`, { k: 'buffer', n: slackDays });
    const sTractor = !f.tractor?.owns ? 10 : f.tractor.hp < 45 ? 5 : 0;
    if (sTractor === 10) why('Farmer has no tractor, needs a CHC tractor', { k: 'no_tractor' });
    else if (sTractor === 5) why(`Own tractor (${f.tractor.hp} HP) too small for seeders`, { k: 'small_tractor', n: f.tractor.hp });
    const km = w.nearestChc?.km ?? 0;
    const sDist = clamp(km * 0.5, 0, 10);
    if (km > 12) why(`Nearest CHC is ${km} km away`, { k: 'far', n: km });
    const nearFires = firesRecent.filter((p) => haversineKm(p, f) <= 5).length;
    const sFire = clamp(nearFires * 5, 0, 15);
    if (nearFires) why(`${nearFires} fire hotspot(s) within 5 km this week`, { k: 'fires', n: nearFires });
    const score = Math.round(clamp(sSlack + sTractor + sDist + sFire, 0, 100));

    let status = 'scheduled';
    if (!onTime) status = 'at_risk';
    else if (start && start > today && diffDays(f.harvestDate, today) > 0) status = 'awaiting_harvest';

    return {
      ...base,
      status,
      onTime,
      start,
      completion,
      slackDays: done ? slackDays : null,
      unscheduledAcres: round1(w.remaining),
      assignments: w.assignments,
      pickups,
      method: w.assignments.length ? MACHINE_TYPES[w.assignments[0].type].method : null,
      risk: { score, level: riskLevel(score), reasons, codes, parts: { slack: Math.round(sSlack), tractor: sTractor, distance: Math.round(sDist), fires: sFire } },
    };
  });

  return { today, horizonEnd, days, usage, results };
}

/** Early warnings + concrete fixes the officer can apply. */
export function buildAlerts(state, sched) {
  const machineById = Object.fromEntries(state.machines.map((m) => [m.id, m]));
  const chcById = Object.fromEntries(state.chcs.map((c) => [c.id, c]));
  const fieldById = Object.fromEntries(state.fields.map((f) => [f.id, f]));
  const workingDays = sched.days.filter((d) => d.working).map((d) => d.date);

  return sched.results
    .filter((r) => r.status === 'at_risk')
    .map((r) => {
      const f = fieldById[r.id];
      const suggestions = [];
      const types = eligibleTypes(f.preference);
      // Machines that still have idle days between harvest and deadline.
      const windowDays = workingDays.filter((d) => d >= maxDate(sched.today, addDays(f.harvestDate, 1)) && d <= r.deadline);
      const candidates = state.machines
        .filter((m) => m.status !== 'maintenance' && types.includes(m.type))
        .map((m) => {
          const free = windowDays.filter((d) => (sched.usage[m.id]?.[d] || 0) < m.acresPerDay * 0.5);
          const c = chcById[m.chcId];
          return { m, c, free, km: round1(haversineKm(c, f)) };
        })
        .filter((x) => x.free.length > 0 && x.km <= SCHED.serviceRadiusKm * 1.5)
        .sort((a, b) => a.km - b.km)
        .slice(0, 3);
      candidates.forEach((x) => suggestions.push({
        kind: 'reassign',
        machineId: x.m.id,
        machineType: x.m.type,
        machineNo: x.m.label.split('#')[1] || '',
        chcId: x.c.id,
        km: x.km,
        fromDate: x.free[0],
        text: `Assign ${x.m.label} from ${x.c.name} (${x.km} km), free from ${niceDate(x.free[0])}`,
      }));
      if (f.preference === 'in_situ') suggestions.push({ kind: 'switch_method', text: 'Offer baling (ex-situ) so straw is sold instead of burnt' });
      if (!f.tractor?.owns) suggestions.push({ kind: 'tractor', text: 'Pair with a CHC tractor of 55 HP or more' });
      return {
        fieldId: r.id,
        farmerName: f.farmerName,
        village: r.village,
        blockId: r.blockId,
        acres: f.acres,
        deadline: r.deadline,
        leadDays: r.daysLeft,
        risk: r.risk,
        completion: r.completion,
        unscheduledAcres: r.unscheduledAcres,
        assignedMachine: r.assignments[0] ? machineById[r.assignments[0].machineId]?.label : null,
        suggestions,
      };
    })
    .sort((a, b) => b.risk.score - a.risk.score || a.leadDays - b.leadDays);
}

/** Headline KPIs, charts and impact estimates. */
export function buildStats(state, sched) {
  const fieldById = Object.fromEntries(state.fields.map((f) => [f.id, f]));
  const res = sched.results;
  const pending = res.filter((r) => fieldById[r.id].status === 'pending');
  const cleared = res.filter((r) => r.status === 'cleared');
  const onTime = pending.filter((r) => r.onTime);
  const atRisk = pending.filter((r) => !r.onTime);
  const acres = (list) => list.reduce((s, r) => s + fieldById[r.id].acres, 0);

  const protectedAcres = acres(onTime) + acres(cleared);
  const tonnes = protectedAcres * FACTORS.strawTonnesPerAcre;

  // Utilisation over the next 14 working days
  const active = state.machines.filter((m) => m.status !== 'maintenance');
  const next = sched.days.filter((d) => d.working).slice(0, 14);
  let used = 0, capacity = 0;
  next.forEach((d) => active.forEach((m) => { capacity += m.acresPerDay; used += sched.usage[m.id]?.[d.date] || 0; }));

  const byBlock = state.blocks.map((b) => {
    const inBlock = res.filter((r) => r.blockId === b.id);
    return {
      blockId: b.id,
      name: b.name,
      onTime: inBlock.filter((r) => r.onTime && r.status !== 'cleared').length,
      atRisk: inBlock.filter((r) => r.status === 'at_risk').length,
      cleared: inBlock.filter((r) => r.status === 'cleared').length,
    };
  });

  const load = sched.days.slice(0, 21).map((d) => ({ date: d.date, scheduled: d.scheduledAcres, capacity: d.working ? round1(d.capacityAcres) : 0, rainMm: d.rainMm, working: d.working }));

  return {
    today: sched.today,
    fields: { total: res.length, pending: pending.length, cleared: cleared.length, onTime: onTime.length, atRisk: atRisk.length, highRisk: atRisk.filter((r) => r.risk.level === 'high').length },
    onTimePct: pending.length ? Math.round((onTime.length / pending.length) * 1000) / 10 : 100,
    acres: { total: round1(acres(res)), protected: round1(protectedAcres), atRisk: round1(acres(atRisk)) },
    machines: { total: state.machines.length, active: active.length, chcs: state.chcs.length },
    utilisationPct: capacity ? Math.round((used / capacity) * 1000) / 10 : 0,
    impact: {
      strawTonnes: Math.round(tonnes),
      co2Tonnes: Math.round((tonnes * FACTORS.perTonne.co2Kg) / 1000),
      pmKg: Math.round(tonnes * FACTORS.perTonne.pmKg),
      coTonnes: round1((tonnes * FACTORS.perTonne.coKg) / 1000),
      nitrogenKg: Math.round(tonnes * FACTORS.nutrientsPerTonne.nKg),
      potassiumKg: Math.round(tonnes * FACTORS.nutrientsPerTonne.k2oKg),
      hectares: round1(protectedAcres * 0.4047),
    },
    byBlock,
    load,
  };
}
