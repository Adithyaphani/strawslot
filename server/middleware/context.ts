import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';

/** Adds a request id and writes one structured access-log line per request. */
export function requestContext(req: Request, res: Response, next: NextFunction) {
  const incoming = req.headers['x-request-id'];
  req.id = (typeof incoming === 'string' && /^[\w-]{6,64}$/.test(incoming) ? incoming : crypto.randomUUID()).slice(0, 64);
  res.setHeader('x-request-id', req.id);
  const t0 = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    if (req.path === '/health') return;
    const line = { t: new Date().toISOString(), id: req.id, method: req.method, path: req.originalUrl.split('?')[0], status: res.statusCode, ms: Math.round(ms) };
    if (config.logJson) console.log(JSON.stringify(line));
    else console.log(`${line.method} ${line.path} ${line.status} ${line.ms}ms [${line.id?.slice(0, 8)}]`);
  });
  next();
}
