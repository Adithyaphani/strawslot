import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { als } from '../../core/context.js';
import { logger } from '../../core/logger.js';
import { httpDuration } from '../../core/metrics.js';

/** Request id (accepts a caller-supplied one), per-request async context, one structured access-log line, latency metric. */
export function requestContext(req: Request, res: Response, next: NextFunction) {
  const incoming = req.headers['x-request-id'];
  const requestId = (typeof incoming === 'string' && /^[\w-]{6,64}$/.test(incoming) ? incoming : crypto.randomUUID()).slice(0, 64);
  res.setHeader('x-request-id', requestId);
  const t0 = process.hrtime.bigint();
  res.on('finish', () => {
    const s = Number(process.hrtime.bigint() - t0) / 1e9;
    const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : 'unmatched';
    httpDuration.observe({ method: req.method, route, status: String(res.statusCode) }, s);
    if (req.path.startsWith('/health') || req.path === '/metrics') return;
    logger.info({ method: req.method, path: req.originalUrl.split('?')[0], status: res.statusCode, ms: Math.round(s * 1000), ip: req.ip }, 'request');
  });
  als.run({ requestId }, next);
}
