import cors from 'cors';
import helmet from 'helmet';
import rateLimit, { type Options } from 'express-rate-limit';
import type { Request, RequestHandler } from 'express';
import { config } from '../config.js';

/** Client IP: Netlify header first, then X-Forwarded-For, then the socket. */
export const clientKey = (req: Request): string =>
  String(req.headers['x-nf-client-connection-ip'] || '') ||
  String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
  req.ip ||
  'anon';

export const limiter = (opts: Partial<Options>): RequestHandler =>
  rateLimit({ standardHeaders: true, legacyHeaders: false, keyGenerator: clientKey, validate: false, ...opts });

export const securityHeaders = helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } });

export const corsPolicy = cors({
  origin: config.corsOrigins.length ? config.corsOrigins : true,
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['content-type', 'authorization', 'x-request-id'],
  exposedHeaders: ['x-request-id', 'ratelimit-remaining'],
  maxAge: 600,
});
