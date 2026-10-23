// Outbound calls to Open-Meteo and NASA FIRMS. Only the worker calls these; API requests read stored snapshots.
import { env } from '../config/env.js';
import { DISTRICT } from '../domain/constants.js';
import { addDays, todayIST } from '../domain/dates.js';

async function fetchJson(url: string, ms = 7000): Promise<any> {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'StrawSlot/2.0' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const type = r.headers.get('content-type') || '';
    return type.includes('json') ? await r.json() : await r.text();
  } finally { clearTimeout(t); }
}

export interface Snapshot<T = any> { source: string; live: boolean; fetchedAt: string; error?: string; payload: T }

export function fallbackWeather(): Snapshot {
  const today = todayIST();
  const days = Array.from({ length: 16 }, (_, i) => ({ date: addDays(today, i), rainMm: 0, rainProb: null, tMax: 30, tMin: 17, windKmh: 8, windDir: 300 }));
  return { source: 'fallback', live: false, fetchedAt: new Date().toISOString(), payload: { days } };
}
export function fallbackAir(): Snapshot {
  return { source: 'unavailable', live: false, fetchedAt: new Date().toISOString(), payload: { spots: [{ id: 'sangrur', name: 'Sangrur', pm25: null, usAqi: null }, { id: 'delhi', name: 'New Delhi', pm25: null, usAqi: null }] } };
}

export async function fetchWeather(centre = DISTRICT.centre): Promise<Snapshot> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${centre.lat}&longitude=${centre.lon}` +
    '&daily=precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant&timezone=Asia%2FKolkata&past_days=2&forecast_days=16';
  try {
    const d = (await fetchJson(url)).daily;
    const days = d.time.map((date: string, i: number) => ({ date, rainMm: d.precipitation_sum[i] ?? 0, rainProb: d.precipitation_probability_max?.[i] ?? null, tMax: d.temperature_2m_max[i], tMin: d.temperature_2m_min[i], windKmh: d.wind_speed_10m_max[i], windDir: d.wind_direction_10m_dominant[i] }));
    return { source: 'open-meteo', live: true, fetchedAt: new Date().toISOString(), payload: { days } };
  } catch (e) { return { ...fallbackWeather(), error: String(e.message || e) }; }
}

export async function fetchAir(centre = DISTRICT.centre): Promise<Snapshot> {
  const spots = [{ id: 'sangrur', name: 'Sangrur', lat: centre.lat, lon: centre.lon }, { id: 'delhi', name: 'New Delhi', lat: 28.6139, lon: 77.209 }];
  try {
    const out = await Promise.all(spots.map(async (s) => {
      const j = await fetchJson(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${s.lat}&longitude=${s.lon}&current=pm2_5,us_aqi&timezone=Asia%2FKolkata`);
      return { ...s, pm25: j.current?.pm2_5 ?? null, usAqi: j.current?.us_aqi ?? null, time: j.current?.time };
    }));
    return { source: 'open-meteo-air-quality', live: true, fetchedAt: new Date().toISOString(), payload: { spots: out } };
  } catch (e) { return { ...fallbackAir(), error: String(e.message || e) }; }
}

function parseFirms(csv: string) {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2 || !lines[0].includes('latitude')) throw new Error('Unexpected FIRMS response');
  const head = lines[0].split(','); const idx = (k: string) => head.indexOf(k);
  return lines.slice(1).map((l) => { const c = l.split(','); return { lat: +c[idx('latitude')], lon: +c[idx('longitude')], date: c[idx('acq_date')], time: c[idx('acq_time')], frp: +c[idx('frp')] || null, confidence: c[idx('confidence')], daynight: c[idx('daynight')] }; });
}
function sampleFires() {
  const today = todayIST(); let a = 7; const rand = () => ((a = (a * 16807) % 2147483647) / 2147483647);
  const [w, s, e, n] = DISTRICT.punjabBbox;
  return Array.from({ length: 140 }, (_, i) => {
    const inD = i < 34; const [x0, y0, x1, y1] = inD ? DISTRICT.bbox : [74.4, 29.9, 76.4, 31.2];
    return { lat: Math.round((y0 + rand() * (y1 - y0)) * 1e4) / 1e4, lon: Math.round((x0 + rand() * (x1 - x0)) * 1e4) / 1e4, date: addDays(today, -Math.floor(rand() * 7)), time: String(1500 + Math.floor(rand() * 300)), frp: Math.round((2 + rand() * 18) * 10) / 10, confidence: 'n', daynight: 'D' };
  }).filter((p) => p.lon >= w && p.lon <= e && p.lat >= s && p.lat <= n);
}
const withDistrict = (points: any[], bbox = DISTRICT.bbox) => {
  const [w, s, e, n] = bbox;
  const district = points.filter((p) => p.lon >= w && p.lon <= e && p.lat >= s && p.lat <= n);
  const byDate: Record<string, number> = {}; points.forEach((p) => { byDate[p.date] = (byDate[p.date] || 0) + 1; });
  return { points, district, punjabCount: points.length, districtCount: district.length, byDate };
};
export async function fetchFires(bbox = DISTRICT.bbox): Promise<Snapshot> {
  const key = env.FIRMS_MAP_KEY; const [w, s, e, n] = DISTRICT.punjabBbox;
  if (key) {
    try {
      const sets = await Promise.all(['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT'].map((src) => fetchJson(`https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${src}/${w},${s},${e},${n}/7`, 12000).then(parseFirms)));
      return { source: 'nasa-firms', live: true, fetchedAt: new Date().toISOString(), payload: withDistrict(sets.flat(), bbox) };
    } catch (err) { return { source: 'sample', live: false, fetchedAt: new Date().toISOString(), error: `FIRMS: ${err.message}`, payload: withDistrict(sampleFires(), bbox) }; }
  }
  return { source: 'sample', live: false, fetchedAt: new Date().toISOString(), error: 'FIRMS_MAP_KEY not set', payload: withDistrict(sampleFires(), bbox) };
}
export const fallbackFires = (bbox = DISTRICT.bbox): Snapshot => ({ source: 'sample', live: false, fetchedAt: new Date().toISOString(), error: 'not fetched yet', payload: withDistrict(sampleFires(), bbox) });
