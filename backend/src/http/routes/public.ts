import { env, isProd } from '../../config/env.js';
import { DISTRICT, FACTORS, MACHINE_TYPES, SCHED } from '../../domain/constants.js';
import { todayIST } from '../../domain/dates.js';
import { getDistrict } from '../../repositories/districts.js';
import { getLive } from '../../services/liveService.js';
import { getPlan } from '../../services/planService.js';
import { notFound } from '../../core/errors.js';
import { define } from '../route.js';
import { DistrictQuery } from '../schemas.js';

const flat = (s: any) => ({ source: s.source, live: s.live, fetchedAt: s.fetchedAt, error: s.error, ...s.payload });

define({ method: 'get', path: '/health', tag: 'System', summary: 'Liveness with a few facts (kept for the web app)', auth: 'public',
  handler: async () => ({ ok: true, store: 'postgres', today: todayIST(), uptimeS: Math.round(process.uptime()), warnings: env.JWT_SECRET.startsWith('dev-only') ? ['JWT_SECRET is not set; using the development signing secret'] : [] }) });

define({ method: 'get', path: '/meta', tag: 'Public', summary: 'District, blocks, villages, hiring centres, machine types and scheduling assumptions', auth: 'public', query: DistrictQuery, cache: 'public-30s',
  handler: async (c) => {
    const d = await getDistrict(c.districtId);
    if (!d) throw notFound('Unknown district');
    const plan = await getPlan(c.districtId);
    if (c.notModified(plan, 'meta')) return;
    const s = plan.state;
    const demoField = s.fields.find((f) => f.source === 'seed' && f.status === 'pending');
    return {
      district: { name: d.name, state: d.state, centre: d.centre, bbox: d.bbox, punjabBbox: DISTRICT.punjabBbox },
      blocks: s.blocks, villages: s.villages,
      chcs: s.chcs.map((h) => ({ id: h.id, name: h.name, blockId: h.blockId, lat: h.lat, lon: h.lon, phone: h.phone })),
      machineTypes: MACHINE_TYPES, sched: SCHED, factors: FACTORS,
      season: { anchor: d.anchorDate, simulated: d.simulated },
      demo: d.simulated ? { farmerPhone: demoField?.phone, officer: isProd ? undefined : 'officer' } : undefined,
    };
  } });

define({ method: 'get', path: '/public/stats', tag: 'Public', summary: 'Headline numbers for the landing page', auth: 'public', query: DistrictQuery, cache: 'public-30s',
  handler: async (c) => {
    const plan = await getPlan(c.districtId);
    if (c.notModified(plan, 'stats')) return;
    return { stats: plan.stats, baseline: { onTimePct: plan.baseline.onTimePct, atRisk: plan.baseline.atRisk },
      fires: { source: plan.live.firesSource, live: plan.live.firesLive, districtCount: plan.live.districtFires, punjabCount: plan.live.punjabFires },
      weather: { source: plan.live.weatherSource, live: plan.live.weatherLive } };
  } });

define({ method: 'get', path: '/live/weather', tag: 'Public', summary: 'Latest stored weather snapshot', auth: 'public', query: DistrictQuery, cache: 'public-30s', handler: async (c) => flat((await getLive(c.districtId)).weather) });
define({ method: 'get', path: '/live/air', tag: 'Public', summary: 'Latest stored air-quality snapshot', auth: 'public', query: DistrictQuery, cache: 'public-30s', handler: async (c) => flat((await getLive(c.districtId)).air) });
define({ method: 'get', path: '/live/fires', tag: 'Public', summary: 'Latest stored fire-hotspot snapshot (add ?scope=district for district points only)', auth: 'public', query: DistrictQuery, cache: 'public-30s',
  handler: async (c) => { const f = flat((await getLive(c.districtId)).fires); return c.req.query.scope === 'district' ? { ...f, points: f.district, district: undefined } : { ...f, district: undefined }; } });
