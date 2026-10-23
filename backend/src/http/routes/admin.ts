import crypto from 'node:crypto';
import { z } from 'zod';
import * as officer from '../../services/officerService.js';
import { getPlan } from '../../services/planService.js';
import { define } from '../route.js';
import { AuditQuery, AutofixSchema, FieldStatusSchema, FieldsQuery, MachineStatusSchema, ReassignSchema, ResolveSchema, WhatIfSchema } from '../schemas.js';

const A = 'admin';
const O = 'officer';
const V = 'viewer';
const short = (s: string) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);
const guard = async (c: any, variant: string) => (await getPlan(c.user.districtId).then((p) => c.notModified(p, short(variant))));

define({ method: 'get', path: '/admin/overview', tag: 'Officer', summary: 'Control-room overview: KPIs, map data, weather, air, fires', auth: V,
  handler: async (c) => { if (await guard(c, 'overview')) return; return officer.overview(c.districtId); } });
define({ method: 'get', path: '/admin/fields', tag: 'Officer', summary: 'Fields with plan and risk (search, filter, optional pagination)', auth: V, query: FieldsQuery,
  handler: async (c) => { if (await guard(c, `fields.${c.req.originalUrl}`)) return; const r = await officer.fieldsList(c.districtId, c.query); c.res.setHeader('x-total-count', String(r.total)); return { fields: r.fields, total: r.total }; } });
define({ method: 'get', path: '/admin/fields/:id', tag: 'Officer', summary: 'One field: plan, SMS text, reports, version', auth: V, handler: async (c) => officer.fieldDetail(c.districtId, c.params.id) });
define({ method: 'post', path: '/admin/fields/:id/status', tag: 'Officer', summary: 'Mark a field cleared, burned or pending (optional expectedVersion for optimistic locking)', auth: O, body: FieldStatusSchema,
  responses: { 409: 'Field changed by someone else' }, handler: async (c) => officer.setStatus(c.districtId, c.user!.username, c.params.id, c.body.status, c.body.expectedVersion) });
define({ method: 'get', path: '/admin/dispatch', tag: 'Officer', summary: 'Machine-by-day dispatch board for four weeks', auth: V,
  handler: async (c) => { if (await guard(c, 'dispatch')) return; return officer.dispatch(c.districtId); } });
define({ method: 'get', path: '/admin/alerts', tag: 'Officer', summary: 'At-risk fields with ranked fixes, and farmer reports', auth: V,
  handler: async (c) => { if (await guard(c, 'alerts')) return; return officer.alerts(c.districtId); } });
define({ method: 'post', path: '/admin/reassign', tag: 'Officer', summary: 'Pin a field to a machine from a date (officer override)', auth: O, body: ReassignSchema, handler: async (c) => officer.reassign(c.districtId, c.user!.username, c.body) });
define({ method: 'post', path: '/admin/autofix', tag: 'Officer', summary: 'Apply the first suggested fix that helps the field without hurting the district', auth: O, body: AutofixSchema, handler: async (c) => officer.autofix(c.districtId, c.user!.username, c.body.fieldId) });
define({ method: 'post', path: '/admin/autofix-all', tag: 'Officer', summary: 'Sweep the most urgent alerts and apply every net-positive fix', auth: O, rate: { bucket: 'autofix-all', limit: 20, windowMs: 60_000 }, handler: async (c) => officer.autofixAll(c.districtId, c.user!.username) });
define({ method: 'delete', path: '/admin/pins/:fieldId', tag: 'Officer', summary: 'Remove an officer override', auth: O, handler: async (c) => officer.unpin(c.districtId, c.user!.username, c.params.fieldId) });
define({ method: 'post', path: '/admin/issues/:id/resolve', tag: 'Officer', summary: 'Resolve a farmer report with a note', auth: O, body: ResolveSchema, handler: async (c) => officer.resolve(c.districtId, c.user!.username, c.params.id, c.body.note) });
define({ method: 'post', path: '/admin/machines/:id', tag: 'Officer', summary: 'Put a machine into or out of maintenance', auth: O, body: MachineStatusSchema, handler: async (c) => officer.machineStatus(c.districtId, c.user!.username, c.params.id, c.body.status) });
define({ method: 'get', path: '/admin/registry', tag: 'Officer', summary: 'Hiring centres, machines with utilisation, straw buyers', auth: V,
  handler: async (c) => { if (await guard(c, 'registry')) return; return officer.registry(c.districtId); } });
define({ method: 'post', path: '/admin/whatif', tag: 'Officer', summary: 'Simulate adding machines or tractors. Nothing is saved.', auth: V, body: WhatIfSchema, rate: { bucket: 'whatif', limit: 30, windowMs: 60_000 }, handler: async (c) => officer.whatIf(c.districtId, c.body) });
define({ method: 'get', path: '/admin/briefing', tag: 'Officer', summary: "Today's briefing", auth: V, handler: async (c) => officer.briefing(c.districtId) });
define({ method: 'get', path: '/admin/log', tag: 'Officer', summary: 'Audit trail, newest first (cursor: ?before=<id>)', auth: V, query: AuditQuery, handler: async (c) => officer.auditLog(c.districtId, c.query.limit, c.query.before) });
define({ method: 'get', path: '/admin/trends', tag: 'Officer', summary: 'Daily KPI history', auth: V, query: z.object({ days: z.coerce.number().int().min(1).max(120).default(30) }), handler: async (c) => officer.trends(c.districtId, c.query.days) });
define({ method: 'get', path: '/admin/notifications', tag: 'Officer', summary: 'Outbox: queued, sent and failed messages to farmers', auth: V, handler: async (c) => officer.notificationsList(c.districtId) });
define({ method: 'get', path: '/admin/export/schedule.csv', tag: 'Officer', summary: 'Download the schedule as CSV', auth: V, raw: true,
  handler: async (c) => { const { csv, filename } = await officer.exportCsv(c.districtId); c.res.setHeader('content-type', 'text/csv'); c.res.setHeader('content-disposition', `attachment; filename="${filename}"`); c.res.send(csv); } });
define({ method: 'post', path: '/admin/reset', tag: 'Admin', summary: 'Rebuild the simulated demo season (demo district only)', auth: A, handler: async (c) => officer.resetDemo(c.districtId, c.user!.username) });
