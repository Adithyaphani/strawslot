import type { PoolClient } from 'pg';
import { one, query, pool, type Db } from '../db/pool.js';

export interface District {
  id: string; name: string; state: string; centre: { lat: number; lon: number };
  bbox: [number, number, number, number]; anchorDate: string | null; simulated: boolean; dataVersion: number;
}
const map = (r: any): District => ({
  id: r.id, name: r.name, state: r.state, centre: { lat: r.centre_lat, lon: r.centre_lon },
  bbox: [r.bbox_w, r.bbox_s, r.bbox_e, r.bbox_n], anchorDate: r.anchor_date, simulated: r.simulated, dataVersion: r.data_version,
});

export async function getDistrict(id: string, db: Db = pool): Promise<District | null> {
  const r = await one('select * from districts where id = $1', [id], db);
  return r ? map(r) : null;
}
export async function listDistricts(): Promise<District[]> { return (await query('select * from districts order by id')).map(map); }
export async function getVersion(id: string, db: Db = pool): Promise<number | null> {
  const r = await one<{ data_version: number }>('select data_version from districts where id = $1', [id], db);
  return r ? r.data_version : null;
}
/** Allocates the next field id under a row lock so two simultaneous bookings can never get the same number. */
export async function allocateFieldId(c: PoolClient, districtId: string): Promise<string> {
  const r = await one<{ next_field_no: number }>('update districts set next_field_no = next_field_no + 1 where id = $1 returning next_field_no - 1 as next_field_no', [districtId], c);
  if (!r) throw new Error(`Unknown district ${districtId}`);
  return `F-${r.next_field_no}`;
}
