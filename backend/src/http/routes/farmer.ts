import { env } from '../../config/env.js';
import { badRequest } from '../../core/errors.js';
import * as farmer from '../../services/farmerService.js';
import { define } from '../route.js';
import { DistrictQuery, IssueSchema, LookupQuery, RegisterSchema } from '../schemas.js';

const writeLimit = { bucket: 'farmer-write', limit: env.RATE_LIMIT_WRITE_PER_HOUR, windowMs: 60 * 60_000 };

define({ method: 'post', path: '/farmer/fields', tag: 'Farmer', summary: 'Register a field and get the booked slot back. Send an Idempotency-Key header to make retries safe.', auth: 'public',
  body: RegisterSchema, rate: writeLimit, responses: { 201: 'Slot created', 409: 'Same Idempotency-Key still processing', 422: 'Idempotency-Key reused with a different body' },
  handler: async (c) => {
    const key = c.req.header('idempotency-key');
    if (key && !/^[\w.:-]{8,100}$/.test(key)) throw badRequest('Idempotency-Key must be 8-100 characters (letters, digits, . : _ -)');
    const r = await farmer.register(c.districtId, c.body, key);
    if (r.replayed) c.res.setHeader('idempotent-replay', 'true');
    c.res.status(r.statusCode);
    return r.response;
  } });

define({ method: 'get', path: '/farmer/lookup', tag: 'Farmer', summary: 'All slots registered under a mobile number', auth: 'public', query: LookupQuery.merge(DistrictQuery),
  rate: { bucket: 'farmer-lookup', limit: 60, windowMs: 15 * 60_000 },
  handler: async (c) => farmer.lookup(c.districtId, c.query.phone, c.query.lang) });

define({ method: 'post', path: '/farmer/issues', tag: 'Farmer', summary: 'Report a problem with a booking', auth: 'public', body: IssueSchema, rate: writeLimit,
  handler: async (c) => { c.res.status(201); return farmer.reportIssue(c.districtId, c.body); } });
