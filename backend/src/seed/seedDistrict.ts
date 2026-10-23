// Creates the demo district (Sangrur, simulated) and keeps the season "live" around today's date.
import type { PoolClient } from 'pg';
import { bulkInsert } from '../db/bulk.js';
import { one, tx } from '../db/pool.js';
import { DISTRICT } from '../domain/constants.js';
import { diffDays, todayIST } from '../domain/dates.js';
import { buildSeed } from './generator.js';
import { insertField, audit } from '../repositories/ops.js';
import { logger } from '../core/logger.js';
import type { State } from '../domain/types.js';

const DISTRICT_ID = 'sangrur';

async function insertFields(c: PoolClient, s: State) { for (const f of s.fields) await insertField(c, DISTRICT_ID, f); }

export async function seedDistrict(today = todayIST()): Promise<void> {
  const s = buildSeed(today);
  await tx(async (c) => {
    const [w, so, e, n] = DISTRICT.bbox;
    await c.query(`insert into districts (id, name, state, centre_lat, centre_lon, bbox_w, bbox_s, bbox_e, bbox_n, anchor_date, simulated)
                   values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true) on conflict (id) do nothing`,
      [DISTRICT_ID, DISTRICT.name, DISTRICT.state, DISTRICT.centre.lat, DISTRICT.centre.lon, w, so, e, n, today]);
    await bulkInsert(c, 'blocks', ['district_id', 'id', 'name', 'lat', 'lon'], s.blocks.map((b) => [DISTRICT_ID, b.id, b.name, b.lat, b.lon]));
    await bulkInsert(c, 'villages', ['district_id', 'id', 'block_id', 'name', 'lat', 'lon'], s.villages.map((v) => [DISTRICT_ID, v.id, v.blockId, v.name, v.lat, v.lon]));
    await bulkInsert(c, 'chcs', ['district_id', 'id', 'block_id', 'name', 'phone', 'operator', 'lat', 'lon'], s.chcs.map((h) => [DISTRICT_ID, h.id, h.blockId, h.name, h.phone, h.operator, h.lat, h.lon]));
    await bulkInsert(c, 'tractors', ['district_id', 'id', 'chc_id', 'hp'], s.chcs.flatMap((h) => h.tractors.map((t) => [DISTRICT_ID, t.id, h.id, t.hp])));
    await bulkInsert(c, 'machines', ['district_id', 'id', 'chc_id', 'type', 'label', 'acres_per_day', 'status'], s.machines.map((m) => [DISTRICT_ID, m.id, m.chcId, m.type, m.label, m.acresPerDay, m.status]));
    await bulkInsert(c, 'vendors', ['district_id', 'id', 'name', 'phone', 'destination', 'capacity_tpd'], s.vendors.map((v) => [DISTRICT_ID, v.id, v.name, v.phone, v.destination, v.capacityTonnesPerDay]));
    await insertFields(c, s);
    await c.query('update districts set next_field_no = $2 where id = $1', [DISTRICT_ID, 1001 + s.fields.length]);
    await audit(c, DISTRICT_ID, 'system', 'seed', `Demo season generated around ${today}`);
  });
  logger.info({ fields: s.fields.length }, 'demo district seeded');
}

/** Regenerates the simulated fields around today; keeps everything real users added. */
export async function reseedFields(today = todayIST(), actor = 'system'): Promise<number> {
  const s = buildSeed(today);
  await tx(async (c) => {
    await c.query('select pg_advisory_xact_lock(hashtext($1))', [`district:${DISTRICT_ID}`]);
    await c.query("delete from fields where district_id = $1 and source = 'seed'", [DISTRICT_ID]); // cascades pins and issues
    await c.query('delete from pins where district_id = $1', [DISTRICT_ID]);
    await c.query('update machines m set status = x.status from (select unnest($2::text[]) as id, unnest($3::text[]) as status) x where m.district_id = $1 and m.id = x.id',
      [DISTRICT_ID, s.machines.map((m) => m.id), s.machines.map((m) => m.status)]);
    const keepers = await one<{ max: number }>("select coalesce(max(substring(id from 3)::int), 1000) as max from fields where district_id = $1", [DISTRICT_ID], c);
    // re-use the original ids F-1001.. for seeded rows, and move the counter past both sets
    await insertFields(c, s);
    await c.query('update districts set anchor_date = $2, next_field_no = greatest($3, $4) where id = $1', [DISTRICT_ID, today, 1001 + s.fields.length, (keepers?.max ?? 1000) + 1]);
    await audit(c, DISTRICT_ID, actor, 'reseed', `Demo season refreshed around ${today}`);
  });
  return s.fields.length;
}

export async function districtIsStale(today = todayIST(), maxAgeDays = 10): Promise<boolean> {
  const r = await one<{ anchor_date: string }>('select anchor_date from districts where id = $1', [DISTRICT_ID]);
  return Boolean(r?.anchor_date) && diffDays(today, r.anchor_date) > maxAgeDays;
}
export const districtExists = async () => Boolean(await one('select 1 from districts where id = $1', [DISTRICT_ID]));
