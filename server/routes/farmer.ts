import { Router } from 'express';
import { loadState, logEvent, saveState } from '../lib/store.js';
import { haversineKm } from '../lib/engine.js';
import { addDays, todayIST } from '../lib/dates.js';
import { limiter } from '../middleware/security.js';
import { validateBody } from '../middleware/validate.js';
import { ah, badRequest, notFound } from '../middleware/errors.js';
import { IssueSchema, phone, RegisterSchema, type RegisterInput } from '../schemas.js';
import { compute, farmerSlot, index } from '../services/schedule.js';
import type { Field, Issue, Lang } from '../types.js';

export const farmerRoutes = Router();
const writeLimit = limiter({ windowMs: 60 * 60e3, limit: 40, message: { error: 'Too many submissions, please try again later' } });

farmerRoutes.post('/fields', writeLimit, validateBody(RegisterSchema), ah(async (req, res) => {
  const body = req.body as RegisterInput;
  const state = await loadState();
  const village = state.villages.find((v) => v.id === body.villageId);
  if (!village) throw badRequest('Unknown village');
  const today = todayIST();
  if (body.harvestDate < addDays(today, -20) || body.harvestDate > addDays(today, 60)) throw badRequest('Harvest date should be within the current season');

  // Use the farmer's pin only if it is plausibly inside their village's area; otherwise jitter the village centre.
  let { lat, lon } = village;
  if (body.location && haversineKm({ lat: body.location.lat, lon: body.location.lon }, village) <= 15) ({ lat, lon } = body.location);
  else if (!body.location) { lat += (Math.random() - 0.5) * 0.02; lon += (Math.random() - 0.5) * 0.02; }

  const nextNum = 1 + state.fields.reduce((m, x) => Math.max(m, parseInt(x.id.slice(2), 10) || 0), 1000);
  const field: Field = {
    id: `F-${nextNum}`,
    source: 'farmer',
    farmerName: body.farmerName,
    phone: body.phone,
    language: body.language,
    villageId: body.villageId,
    lat: Math.round(lat * 1e5) / 1e5,
    lon: Math.round(lon * 1e5) / 1e5,
    acres: Math.round(body.acres * 100) / 100,
    harvestDate: body.harvestDate,
    windowDays: body.windowDays,
    nextCrop: 'wheat',
    preference: body.preference,
    tractor: body.tractor.owns ? { owns: true, hp: body.tractor.hp } : { owns: false, hp: 0 },
    status: 'pending',
    createdAt: today,
  };
  state.fields.push(field);
  logEvent(state, 'farmer', 'register', `${field.id} · ${field.acres} ac · ${village.name}`);
  await saveState(state);
  const { sched } = await compute(state);
  const result = sched.results.find((x) => x.id === field.id)!;
  res.status(201).json({ slot: farmerSlot(state, field, result, body.language) });
}));

farmerRoutes.get('/lookup', ah(async (req, res) => {
  const p = phone.parse(String(req.query.phone || ''));
  const lang = (['en', 'hi', 'pa'] as const).find((l) => l === req.query.lang) as Lang | undefined;
  const state = await loadState();
  const mine = state.fields.filter((f) => f.phone === p);
  if (!mine.length) throw notFound('No field registered with this number yet');
  const { sched } = await compute(state);
  const byId = index(sched.results);
  res.json({ slots: mine.map((f) => farmerSlot(state, f, byId[f.id], lang)) });
}));

farmerRoutes.post('/issues', writeLimit, validateBody(IssueSchema), ah(async (req, res) => {
  const body = req.body as { fieldId: string; phone: string; type: string; note: string };
  const state = await loadState();
  const f = state.fields.find((x) => x.id === body.fieldId && x.phone === body.phone);
  if (!f) throw notFound('Field not found for this number');
  const issue: Issue = { id: `I-${Date.now().toString(36)}`, ...body, status: 'open', createdAt: new Date().toISOString() };
  state.issues = [...(state.issues || []), issue];
  logEvent(state, 'farmer', 'issue', `${f.id} · ${body.type}`);
  await saveState(state);
  res.status(201).json({ issue });
}));
