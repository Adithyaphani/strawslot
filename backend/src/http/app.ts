// Express composition root. Order matters: context -> security -> parsing -> limits -> routes -> 404 -> errors.
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { corsOrigins, env } from '../config/env.js';
import { registry as metrics } from '../core/metrics.js';
import { apiNotFound, errorHandler } from './middleware/errors.js';
import { requestContext } from './middleware/context.js';
import { rateLimit } from './middleware/rateLimit.js';
import { latestMigration } from '../db/migrate.js';
import { pool, poolStats } from '../db/pool.js';
import { redisConfigured, redisPing } from '../cache/redis.js';
import { pendingNotificationCount } from '../repositories/ops.js';
import { buildOpenApi, docsHtml } from './openapi.js';
import { mount } from './route.js';
import './routes/public.js';
import './routes/farmer.js';
import './routes/auth.js';
import './routes/admin.js';
import './routes/users.js';

export const state = { shuttingDown: false };

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
  app.set('etag', false); // plan-aware ETags are set per route; hashing large JSON bodies is wasted CPU

  app.use(requestContext);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression({ threshold: 1024 }));
  app.use(cors({
    origin: corsOrigins.length ? corsOrigins : true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['content-type', 'authorization', 'x-request-id', 'idempotency-key', 'if-none-match'],
    exposedHeaders: ['x-request-id', 'etag', 'x-total-count', 'ratelimit-limit', 'ratelimit-remaining', 'ratelimit-reset', 'retry-after', 'idempotent-replay'],
    maxAge: 600,
  }));
  app.use(express.json({ limit: env.BODY_LIMIT }));
  app.use((req, res, next) => {
    const t = setTimeout(() => { if (!res.headersSent) res.status(503).json({ error: 'The request took too long. Please try again.', code: 'timeout' }); }, env.REQUEST_TIMEOUT_MS);
    res.on('close', () => clearTimeout(t));
    next();
  });

  // ---- infrastructure endpoints (not under /api so load balancers and Prometheus can reach them without auth rules)
  app.get('/health/live', (_req, res) => { res.json({ status: 'ok' }); });
  app.get('/health/ready', async (_req, res) => {
    if (state.shuttingDown) { res.status(503).json({ status: 'draining' }); return; }
    const checks: Record<string, unknown> = {};
    let ok = true;
    try { await pool.query('select 1'); const m = await latestMigration(); checks.database = 'ok'; checks.migrations = m.current === m.expected ? 'current' : `behind (${m.current} < ${m.expected})`; if (m.current !== m.expected) ok = false; }
    catch (e) { checks.database = 'down'; ok = false; }
    // Redis is an optimisation: when it is down we still serve, so it reports "degraded" without failing readiness
    checks.redis = redisConfigured() ? ((await redisPing()) ? 'ok' : 'degraded') : 'not configured';
    checks.pool = poolStats();
    res.status(ok ? 200 : 503).json({ status: ok ? 'ready' : 'not ready', checks });
  });
  app.get('/metrics', async (req, res) => {
    if (env.METRICS_TOKEN && req.headers.authorization !== `Bearer ${env.METRICS_TOKEN}`) { res.status(401).end(); return; }
    const { outboxDepth } = await import('../core/metrics.js');
    outboxDepth.set(await pendingNotificationCount().catch(() => 0));
    res.setHeader('content-type', metrics.contentType);
    res.send(await metrics.metrics());
  });
  app.get('/openapi.json', (_req, res) => { res.json(buildOpenApi()); });
  app.get('/docs', (_req, res) => { res.type('html').send(docsHtml); });

  // ---- API: /api/v1 is canonical; /api is an alias so the existing web app keeps working
  const api = express.Router();
  if (env.RATE_LIMIT_ENABLED) api.use(rateLimit({ bucket: 'global', limit: env.RATE_LIMIT_GLOBAL_PER_MIN, windowMs: 60_000 }));
  mount(api);
  app.use('/api/v1', api);
  app.use('/api', api);
  app.use('/api', apiNotFound);
  app.use(errorHandler);
  return app;
}
