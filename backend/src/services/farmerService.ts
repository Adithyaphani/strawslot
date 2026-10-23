// Farmer-facing use cases. No login: the phone number is the only identity, so writes are rate limited
// and registration is idempotent.
import { env } from '../config/env.js';
import { badRequest, notFound, conflict } from '../core/errors.js';
import { tx, query } from '../db/pool.js';
import { addDays, todayIST } from '../domain/dates.js';
import { haversineKm } from '../domain/engine.js';
import type { Field, Lang } from '../domain/types.js';
import { allocateFieldId } from '../repositories/districts.js';
import { audit, enqueueNotification, fieldIdsByPhone, insertField, insertIssue } from '../repositories/ops.js';
import type { RegisterInput } from '../http/schemas.js';
import { freshPlan, getPlan } from './planService.js';
import { farmerSlot, index } from './views.js';
import * as idem from './idempotency.js';

export async function register(districtId: string, body: RegisterInput, idemKey?: string) {
  const scope = `register:${districtId}`;
  const hash = idem.hashBody(body);
  if (idemKey) { const replay = await idem.lookup(scope, idemKey, hash); if (replay) return { ...replay, replayed: true }; }

  const village = (await query('select id, block_id, lat, lon from villages where district_id = $1 and id = $2', [districtId, body.villageId]))[0];
  if (!village) throw badRequest('Unknown village');
  const today = todayIST();
  if (body.harvestDate < addDays(today, -20) || body.harvestDate > addDays(today, 60)) throw badRequest('Harvest date should be within the current season');

  // Use the farmer's pin only when it is plausibly inside the village area; otherwise jitter the village centre.
  let { lat, lon } = village;
  if (body.location && haversineKm({ lat: body.location.lat, lon: body.location.lon }, village) <= 15) ({ lat, lon } = body.location);
  else if (!body.location) { lat += (Math.random() - 0.5) * 0.02; lon += (Math.random() - 0.5) * 0.02; }

  let field: Field | null = null;
  await tx(async (c) => {
    if (idemKey && !(await idem.claim(c, scope, idemKey, hash))) throw conflict('A request with this Idempotency-Key is still being processed. Retry in a moment.');
    const id = await allocateFieldId(c, districtId);
    field = {
      id, source: 'farmer', farmerName: body.farmerName, phone: body.phone, language: body.language, villageId: body.villageId,
      lat: Math.round(lat * 1e5) / 1e5, lon: Math.round(lon * 1e5) / 1e5, acres: Math.round(body.acres * 100) / 100,
      harvestDate: body.harvestDate, windowDays: body.windowDays, nextCrop: 'wheat', preference: body.preference,
      tractor: body.tractor.owns ? { owns: true, hp: body.tractor.hp } : { owns: false, hp: 0 }, status: 'pending', createdAt: today,
    };
    await insertField(c, districtId, field);
    await audit(c, districtId, 'farmer', 'register', `${id} · ${field.acres} ac · ${village.id}`);
    // Outbox: committed together with the field, delivered later by the worker. The text is rendered at send time from the latest plan.
    await enqueueNotification(c, { districtId, fieldId: id, kind: 'booking_confirmation', toPhone: body.phone, lang: body.language, dedupeKey: `booking:${districtId}:${id}` });
  });

  const plan = await freshPlan(districtId);
  const result = plan.sched.results.find((x) => x.id === field!.id)!;
  const response = { slot: farmerSlot(plan.state, field!, result, body.language) };
  if (idemKey) await idem.complete(scope, idemKey, 201, response);
  return { statusCode: 201, response, replayed: false };
}

export async function lookup(districtId: string, phoneNo: string, lang?: Lang) {
  if (!/^[6-9]\d{9}$/.test(phoneNo)) throw badRequest('Enter a 10-digit mobile number');
  const ids = await fieldIdsByPhone(districtId, phoneNo);
  if (!ids.length) throw notFound('No field registered with this number yet');
  const plan = await getPlan(districtId);
  const byId = index(plan.sched.results), fields = index(plan.state.fields);
  return { slots: ids.filter((id) => fields[id]).map((id) => farmerSlot(plan.state, fields[id], byId[id], lang)) };
}

export async function reportIssue(districtId: string, body: { fieldId: string; phone: string; type: string; note: string }) {
  const f = (await query('select id from fields where district_id = $1 and id = $2 and phone = $3', [districtId, body.fieldId, body.phone]))[0];
  if (!f) throw notFound('Field not found for this number');
  const id = `I-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  await tx(async (c) => {
    await insertIssue(c, districtId, { id, ...body });
    await audit(c, districtId, 'farmer', 'issue', `${body.fieldId} · ${body.type}`);
  });
  return { issue: { id, ...body, status: 'open', createdAt: new Date().toISOString() } };
}
void env;
