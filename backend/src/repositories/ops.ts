// Small write/read helpers for audit, pins, issues, machines, fields and notifications.
import type { PoolClient } from 'pg';
import { ctx } from '../core/context.js';
import { one, query, pool, type Db } from '../db/pool.js';
import type { Field, Pin } from '../domain/types.js';

export const audit = (db: Db, districtId: string, actor: string, action: string, detail: string) =>
  query('insert into audit_log (district_id, actor, action, detail, request_id) values ($1,$2,$3,$4,$5)', [districtId, actor, action, detail, ctx()?.requestId ?? null], db);

export async function listAudit(districtId: string, limit = 150, before?: number) {
  const rows = await query('select id, at, actor, action, detail from audit_log where district_id = $1 and ($3::bigint is null or id < $3) order by id desc limit $2', [districtId, limit, before ?? null]);
  return rows.map((r) => ({ id: r.id, at: r.at.toISOString(), actor: r.actor, action: r.action, detail: r.detail }));
}

export const upsertPin = (c: PoolClient, districtId: string, p: Pick<Pin, 'fieldId' | 'machineId' | 'fromDate' | 'by'>) =>
  query(`insert into pins (district_id, field_id, machine_id, from_date, by) values ($1,$2,$3,$4,$5)
         on conflict (district_id, field_id) do update set machine_id = excluded.machine_id, from_date = excluded.from_date, by = excluded.by, at = now()`,
    [districtId, p.fieldId, p.machineId, p.fromDate, p.by], c);
export const deletePin = (c: PoolClient, districtId: string, fieldId: string) => query('delete from pins where district_id = $1 and field_id = $2', [districtId, fieldId], c);
export const deletePinsForMachine = (c: PoolClient, districtId: string, machineId: string) => query('delete from pins where district_id = $1 and machine_id = $2', [districtId, machineId], c);

export const insertIssue = (c: PoolClient, districtId: string, i: { id: string; fieldId: string; phone: string; type: string; note: string }) =>
  query('insert into issues (district_id, id, field_id, phone, type, note) values ($1,$2,$3,$4,$5,$6)', [districtId, i.id, i.fieldId, i.phone, i.type, i.note], c);
export const resolveIssue = (c: PoolClient, districtId: string, id: string, note: string) =>
  one('update issues set status = \'resolved\', resolved_at = now(), resolution = $3 where district_id = $1 and id = $2 returning id, field_id', [districtId, id, note], c);

export async function insertField(c: PoolClient, districtId: string, f: Field) {
  await query(`insert into fields (district_id, id, source, farmer_name, phone, language, village_id, lat, lon, acres, harvest_date, window_days, next_crop,
                 preference, tractor_owns, tractor_hp, status, created_on, cleared_on, cleared_by)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
    [districtId, f.id, f.source, f.farmerName, f.phone, f.language, f.villageId, f.lat, f.lon, f.acres, f.harvestDate, f.windowDays, f.nextCrop ?? 'wheat',
      f.preference, f.tractor.owns, f.tractor.hp, f.status, f.createdAt, f.clearedOn ?? null, f.clearedBy ?? null], c);
}

export async function setFieldStatus(c: PoolClient, districtId: string, id: string, status: string, today: string, expectedVersion?: number) {
  return one<{ version: number }>(
    `update fields set status = $3, cleared_on = case when $3 = 'cleared' then $4::date else null end,
            cleared_by = case when $3 = 'cleared' then 'machine' else null end, version = version + 1, updated_at = now()
     where district_id = $1 and id = $2 and ($5::int is null or version = $5) returning version`, [districtId, id, status, today, expectedVersion ?? null], c);
}
export const fieldExists = async (districtId: string, id: string) => Boolean(await one('select 1 from fields where district_id = $1 and id = $2', [districtId, id]));
export const fieldIdsByPhone = async (districtId: string, phone: string) => (await query<{ id: string }>('select id from fields where district_id = $1 and phone = $2 order by id', [districtId, phone])).map((r) => r.id);

export const setMachineStatus = (c: PoolClient, districtId: string, id: string, status: string) =>
  one('update machines set status = $3 where district_id = $1 and id = $2 returning id, label, chc_id', [districtId, id, status], c);

export interface NotificationInput { districtId: string; fieldId?: string; kind: string; toPhone: string; lang: string; body?: string; dedupeKey?: string }
export const enqueueNotification = (db: Db, n: NotificationInput) =>
  query(`insert into notifications (district_id, field_id, kind, to_phone, lang, body, dedupe_key) values ($1,$2,$3,$4,$5,$6,$7) on conflict (dedupe_key) do nothing`,
    [n.districtId, n.fieldId ?? null, n.kind, n.toPhone, n.lang, n.body ?? null, n.dedupeKey ?? null], db);

export async function pendingNotificationCount(): Promise<number> {
  return Number((await one<{ n: number }>('select count(*)::int as n from notifications where status = \'pending\''))?.n ?? 0);
}

const mapIssue = (i: any) => ({ id: i.id, fieldId: i.field_id, phone: i.phone, type: i.type, note: i.note, status: i.status, createdAt: i.created_at.toISOString(), resolvedAt: i.resolved_at ? i.resolved_at.toISOString() : undefined, resolution: i.resolution || undefined });
export const listIssues = async (districtId: string, fieldId?: string) =>
  (await query('select * from issues where district_id = $1 and ($2::text is null or field_id = $2) order by created_at', [districtId, fieldId ?? null])).map(mapIssue);
export const openIssueCount = async (districtId: string) => Number((await one<{ n: number }>("select count(*)::int as n from issues where district_id = $1 and status = 'open'", [districtId]))!.n);
