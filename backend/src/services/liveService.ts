// API-side view of live data: reads the snapshots the worker stores. Never calls a third party on the request path.
import { one, query } from '../db/pool.js';
import { fallbackAir, fallbackFires, fallbackWeather, fetchAir, fetchFires, fetchWeather, type Snapshot } from './liveFeeds.js';
import { getDistrict } from '../repositories/districts.js';

export type Kind = 'weather' | 'air' | 'fires';
export interface LiveBundle { weather: Snapshot; air: Snapshot; fires: Snapshot; stamp: string }

const TTL_MS = 20_000;
const mem = new Map<string, { at: number; v: LiveBundle }>();

async function loadFromDb(districtId: string): Promise<LiveBundle> {
  const rows = await query('select kind, payload, source, live, fetched_at from live_snapshots where district_id = $1', [districtId]);
  const by: Record<string, Snapshot> = {};
  rows.forEach((r) => { by[r.kind] = { source: r.source, live: r.live, fetchedAt: r.fetched_at.toISOString(), payload: r.payload }; });
  const d = await getDistrict(districtId);
  const weather = by.weather || fallbackWeather();
  const air = by.air || fallbackAir();
  const fires = by.fires || fallbackFires(d?.bbox);
  // The stamp changes only when stored data changes, so cached plans stay valid between refreshes.
  const stamp = `${by.weather ? Date.parse(weather.fetchedAt) : 0}-${by.fires ? Date.parse(fires.fetchedAt) : 0}`;
  return { weather, air, fires, stamp };
}

export async function getLive(districtId: string, fresh = false): Promise<LiveBundle> {
  const hit = mem.get(districtId);
  if (!fresh && hit && Date.now() - hit.at < TTL_MS) return hit.v;
  const v = await loadFromDb(districtId);
  mem.set(districtId, { at: Date.now(), v });
  return v;
}
export const invalidateLive = (districtId?: string) => (districtId ? mem.delete(districtId) : mem.clear());

export const rainMap = (weather: Snapshot) => Object.fromEntries((weather.payload.days as any[]).map((d) => [d.date, d.rainMm]));

/** Worker entry point: fetch from the providers and store. Returns what changed. */
export async function refreshLive(districtId: string): Promise<Record<Kind, string>> {
  const d = await getDistrict(districtId);
  if (!d) throw new Error(`Unknown district ${districtId}`);
  const [weather, air, fires] = await Promise.all([fetchWeather(d.centre), fetchAir(d.centre), fetchFires(d.bbox)]);
  const out = {} as Record<Kind, string>;
  for (const [kind, snap] of [['weather', weather], ['air', air], ['fires', fires]] as const) {
    // never replace good live data with a fallback: keep the last real snapshot when a provider is down
    const existing = await one<{ live: boolean }>('select live from live_snapshots where district_id = $1 and kind = $2', [districtId, kind]);
    if (!snap.live && existing?.live) { out[kind] = 'kept-previous'; continue; }
    await query(`insert into live_snapshots (district_id, kind, payload, source, live, fetched_at) values ($1,$2,$3,$4,$5,now())
                 on conflict (district_id, kind) do update set payload = excluded.payload, source = excluded.source, live = excluded.live, fetched_at = now()`,
      [districtId, kind, JSON.stringify(snap.payload), snap.source, snap.live]);
    out[kind] = snap.source;
  }
  invalidateLive(districtId);
  return out;
}
