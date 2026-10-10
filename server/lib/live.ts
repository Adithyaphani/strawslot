// Live data adapters with caching and graceful fallback, so the demo never breaks.
//  - Open-Meteo forecast (rain, wind, temperature) - no key
//  - Open-Meteo air quality (PM2.5 now, Sangrur + Delhi) - no key
//  - NASA FIRMS VIIRS active fires - free MAP_KEY via FIRMS_MAP_KEY

import { DISTRICT } from './constants.js';
import { addDays, todayIST } from './dates.js';

const cache = new Map();
async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function fetchJson(url, ms = 7000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'StrawSlot/1.0' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const type = r.headers.get('content-type') || '';
    return type.includes('json') ? r.json() : r.text();
  } finally {
    clearTimeout(t);
  }
}

export async function getWeather() {
  return cached('weather', 30 * 60e3, async () => {
    const { lat, lon } = DISTRICT.centre;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      '&daily=precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant' +
      '&timezone=Asia%2FKolkata&past_days=2&forecast_days=16';
    try {
      const j = await fetchJson(url);
      const d = j.daily;
      const days = d.time.map((date, i) => ({
        date,
        rainMm: d.precipitation_sum[i] ?? 0,
        rainProb: d.precipitation_probability_max?.[i] ?? null,
        tMax: d.temperature_2m_max[i],
        tMin: d.temperature_2m_min[i],
        windKmh: d.wind_speed_10m_max[i],
        windDir: d.wind_direction_10m_dominant[i],
      }));
      return { source: 'open-meteo', live: true, fetchedAt: new Date().toISOString(), days };
    } catch (e) {
      const today = todayIST();
      const days = Array.from({ length: 16 }, (_, i) => ({ date: addDays(today, i), rainMm: 0, rainProb: null, tMax: 30, tMin: 17, windKmh: 8, windDir: 300 }));
      return { source: 'fallback', live: false, error: String(e.message || e), days };
    }
  });
}

export async function getAir() {
  return cached('air', 30 * 60e3, async () => {
    const spots = [
      { id: 'sangrur', name: 'Sangrur', lat: DISTRICT.centre.lat, lon: DISTRICT.centre.lon },
      { id: 'delhi', name: 'New Delhi', lat: 28.6139, lon: 77.209 },
    ];
    try {
      const out = await Promise.all(spots.map(async (s) => {
        const j = await fetchJson(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${s.lat}&longitude=${s.lon}&current=pm2_5,us_aqi&timezone=Asia%2FKolkata`);
        return { ...s, pm25: j.current?.pm2_5 ?? null, usAqi: j.current?.us_aqi ?? null, time: j.current?.time };
      }));
      return { source: 'open-meteo-air-quality', live: true, spots: out };
    } catch (e) {
      return { source: 'unavailable', live: false, error: String(e.message || e), spots: spots.map((s) => ({ ...s, pm25: null, usAqi: null })) };
    }
  });
}

function parseFirmsCsv(csv) {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2 || !lines[0].includes('latitude')) throw new Error('Unexpected FIRMS response');
  const head = lines[0].split(',');
  const idx = (k) => head.indexOf(k);
  return lines.slice(1).map((l) => {
    const c = l.split(',');
    return {
      lat: +c[idx('latitude')],
      lon: +c[idx('longitude')],
      date: c[idx('acq_date')],
      time: c[idx('acq_time')],
      frp: +c[idx('frp')] || null,
      confidence: c[idx('confidence')],
      daynight: c[idx('daynight')],
    };
  });
}

// Deterministic sample used only when no FIRMS key is configured or FIRMS is down.
function sampleFires() {
  const today = todayIST();
  let a = 7;
  const rand = () => ((a = (a * 16807) % 2147483647) / 2147483647);
  const [w, s, e, n] = DISTRICT.punjabBbox;
  return Array.from({ length: 140 }, (_, i) => {
    // cluster towards the Malwa belt (south-central Punjab) where burning concentrates
    const inDistrict = i < 34;
    const [x0, y0, x1, y1] = inDistrict ? DISTRICT.bbox : [74.4, 29.9, 76.4, 31.2];
    return {
      lat: Math.round((y0 + rand() * (y1 - y0)) * 1e4) / 1e4,
      lon: Math.round((x0 + rand() * (x1 - x0)) * 1e4) / 1e4,
      date: addDays(today, -Math.floor(rand() * 7)),
      time: String(1500 + Math.floor(rand() * 300)),
      frp: Math.round((2 + rand() * 18) * 10) / 10,
      confidence: 'n',
      daynight: 'D',
    };
  }).filter((p) => p.lon >= w && p.lon <= e && p.lat >= s && p.lat <= n);
}

export async function getFires() {
  return cached('fires', 30 * 60e3, async () => {
    const key = process.env.FIRMS_MAP_KEY;
    const [w, s, e, n] = DISTRICT.punjabBbox;
    if (key) {
      try {
        const sources = ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT'];
        const sets = await Promise.all(sources.map((src) =>
          fetchJson(`https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${src}/${w},${s},${e},${n}/7`, 12000).then(parseFirmsCsv)));
        const points = sets.flat();
        return withDistrict({ source: 'nasa-firms', live: true, fetchedAt: new Date().toISOString(), points });
      } catch (err) {
        return withDistrict({ source: 'sample', live: false, error: `FIRMS: ${err.message}`, points: sampleFires() });
      }
    }
    return withDistrict({ source: 'sample', live: false, error: 'FIRMS_MAP_KEY not set', points: sampleFires() });
  });
}

function withDistrict(r) {
  const [w, s, e, n] = DISTRICT.bbox;
  const inD = r.points.filter((p) => p.lon >= w && p.lon <= e && p.lat >= s && p.lat <= n);
  const byDate = {};
  r.points.forEach((p) => { byDate[p.date] = (byDate[p.date] || 0) + 1; });
  return { ...r, punjabCount: r.points.length, districtCount: inD.length, district: inD, byDate };
}

export function rainMap(weather) {
  return Object.fromEntries(weather.days.map((d) => [d.date, d.rainMm]));
}

export function clearLiveCache() { cache.clear(); }
