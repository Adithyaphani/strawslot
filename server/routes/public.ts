import { Router } from 'express';
import { loadState, storeKind } from '../lib/store.js';
import { buildStats, runSchedule } from '../lib/engine.js';
import { getAir, getFires, getWeather } from '../lib/live.js';
import { credentials } from '../lib/auth.js';
import { DISTRICT, FACTORS, MACHINE_TYPES, SCHED } from '../lib/constants.js';
import { todayIST } from '../lib/dates.js';
import { config } from '../config.js';
import { ah } from '../middleware/errors.js';
import { compute } from '../services/schedule.js';

export const publicRoutes = Router();

publicRoutes.get('/health', ah(async (_req, res) => {
  res.json({ ok: true, store: await storeKind(), today: todayIST(), uptimeS: Math.round(process.uptime()), warnings: config.insecureSecret ? ['AUTH_SECRET is not set; using the development signing secret'] : [] });
}));

publicRoutes.get('/meta', ah(async (_req, res) => {
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

publicRoutes.get('/public/stats', ah(async (_req, res) => {
  const state = await loadState();
  const { sched, fires, weather, opts } = await compute(state);
  const stats = buildStats(state, sched);
  const base = buildStats(state, runSchedule(state, { ...opts, mode: 'baseline' }));
  res.json({
    stats,
    baseline: { onTimePct: base.onTimePct, atRisk: base.fields.atRisk },
    fires: { source: fires.source, live: fires.live, districtCount: fires.districtCount, punjabCount: fires.punjabCount },
    weather: { source: weather.source, live: weather.live },
  });
}));

publicRoutes.get('/live/weather', ah(async (_req, res) => { res.json(await getWeather()); }));
publicRoutes.get('/live/air', ah(async (_req, res) => { res.json(await getAir()); }));
publicRoutes.get('/live/fires', ah(async (req, res) => {
  const f = await getFires();
  res.json(req.query.scope === 'district' ? { ...f, points: f.district } : f);
}));
