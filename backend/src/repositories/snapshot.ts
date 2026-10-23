// Reads every table the scheduler needs and assembles the same State object the engine has always used.
import { query, pool, type Db } from '../db/pool.js';
import type { State } from '../domain/types.js';
import { getDistrict } from './districts.js';

const iso = (v: any) => (v instanceof Date ? v.toISOString() : v);

export async function loadState(districtId: string, db: Db = pool): Promise<State> {
  const d = await getDistrict(districtId, db);
  if (!d) throw new Error(`Unknown district ${districtId}`);
  const q = <T = any>(sql: string) => () => query<T>(sql, [districtId], db);
  const jobs = [
    q('select id, name, lat, lon from blocks where district_id = $1 order by id'),
    q('select id, name, block_id, lat, lon from villages where district_id = $1 order by id'),
    q('select id, name, block_id, phone, operator, lat, lon from chcs where district_id = $1 order by id'),
    q('select id, chc_id, hp from tractors where district_id = $1 order by id'),
    q('select id, chc_id, type, label, acres_per_day, status from machines where district_id = $1 order by id'),
    q('select id, name, phone, destination, capacity_tpd from vendors where district_id = $1 order by id'),
    q('select * from fields where district_id = $1 order by id'),
    q('select field_id, machine_id, from_date, by, at from pins where district_id = $1'),
  ];
  // a single connection runs one query at a time; only a pool gets the parallel path
  const rows: any[][] = 'totalCount' in db ? await Promise.all(jobs.map((j) => j())) : await jobs.reduce<Promise<any[][]>>(async (acc, j) => [...(await acc), await j()], Promise.resolve([]));
  const [blocks, villages, chcs, tractors, machines, vendors, fields, pins] = rows;
  const trByChc = new Map<string, { id: string; hp: number }[]>();
  tractors.forEach((t) => { const a = trByChc.get(t.chc_id) || []; a.push({ id: t.id, hp: t.hp }); trByChc.set(t.chc_id, a); });
  return {
    meta: { anchor: d.anchorDate, district: d.name, simulated: d.simulated },
    blocks,
    villages: villages.map((v) => ({ id: v.id, name: v.name, blockId: v.block_id, lat: v.lat, lon: v.lon })),
    chcs: chcs.map((c) => ({ id: c.id, name: c.name, blockId: c.block_id, phone: c.phone, operator: c.operator, lat: c.lat, lon: c.lon, tractors: trByChc.get(c.id) || [] })),
    machines: machines.map((m) => ({ id: m.id, chcId: m.chc_id, type: m.type, label: m.label, acresPerDay: m.acres_per_day, status: m.status })),
    vendors: vendors.map((v) => ({ id: v.id, name: v.name, phone: v.phone, destination: v.destination, capacityTonnesPerDay: v.capacity_tpd })),
    fields: fields.map((f) => ({
      id: f.id, source: f.source, farmerName: f.farmer_name, phone: f.phone, language: f.language, villageId: f.village_id,
      lat: f.lat, lon: f.lon, acres: f.acres, harvestDate: f.harvest_date, windowDays: f.window_days, nextCrop: f.next_crop,
      preference: f.preference, tractor: { owns: f.tractor_owns, hp: f.tractor_hp }, status: f.status,
      createdAt: f.created_on, clearedOn: f.cleared_on || undefined, clearedBy: f.cleared_by || undefined,
    })),
    pins: pins.map((p) => ({ fieldId: p.field_id, machineId: p.machine_id, fromDate: p.from_date, by: p.by, at: iso(p.at) })),
    issues: [], // issues change often and do not affect the schedule, so they are read live and kept out of the cached plan
    log: [],
  };
}

export const fieldVersions = async (districtId: string): Promise<Record<string, number>> =>
  Object.fromEntries((await query('select id, version from fields where district_id = $1', [districtId])).map((r) => [r.id, r.version]));
