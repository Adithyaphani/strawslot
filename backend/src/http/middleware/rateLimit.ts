import type { Request, RequestHandler } from 'express';
import { env } from '../../config/env.js';
import { kvIncr } from '../../cache/kv.js';
import { tooMany } from '../../core/errors.js';
import { rateLimited } from '../../core/metrics.js';

export interface LimitOpts { bucket: string; limit: number; windowMs: number }

/** Fixed-window limiter keyed by client IP. Shared across instances through Redis; fails open if Redis is down. */
export const rateLimit = ({ bucket, limit, windowMs }: LimitOpts): RequestHandler => async (req: Request, res, next) => {
  if (!env.RATE_LIMIT_ENABLED) return next();
  try {
    const window = Math.floor(Date.now() / windowMs);
    const { count, resetMs } = await kvIncr(`rl:${bucket}:${req.ip}:${window}`, windowMs);
    res.setHeader('ratelimit-limit', String(limit));
    res.setHeader('ratelimit-remaining', String(Math.max(0, limit - count)));
    res.setHeader('ratelimit-reset', String(Math.ceil(resetMs / 1000)));
    if (count > limit) { rateLimited.inc({ bucket }); throw tooMany('Too many requests. Please slow down and try again shortly.', Math.max(1, Math.ceil(resetMs / 1000))); }
    next();
  } catch (e) { next(e); }
};
