import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../../core/errors.js';
import { ctx } from '../../core/context.js';
import { logger } from '../../core/logger.js';

export const apiNotFound: RequestHandler = (req, res) => { res.status(404).json({ error: 'Not found', code: 'not_found', requestId: ctx()?.requestId }); };

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = ctx()?.requestId;
  if (res.headersSent) return;
  if (err instanceof ZodError) {
    res.status(400).json({ error: err.issues[0]?.message || 'Invalid input', code: 'validation_failed', details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })), requestId });
    return;
  }
  if (err instanceof AppError) {
    for (const [k, v] of Object.entries(err.headers || {})) res.setHeader(k, v);
    res.status(err.status).json({ error: err.message, code: err.code, details: err.details, requestId });
    return;
  }
  if (err?.type === 'entity.parse.failed') { res.status(400).json({ error: 'Request body is not valid JSON', code: 'bad_request', requestId }); return; }
  if (err?.type === 'entity.too.large') { res.status(413).json({ error: 'Request body too large', code: 'bad_request', requestId }); return; }
  // Postgres conditions worth a clear status instead of a generic 500
  if (err?.code === '57014') { res.status(503).json({ error: 'The request took too long. Please try again.', code: 'timeout', requestId }); return; }
  if (err?.code === '23505') { res.status(409).json({ error: 'That record already exists', code: 'conflict', requestId }); return; }
  if (err?.code === '23503' || err?.code === '23514') { res.status(400).json({ error: 'The request refers to something that does not exist or is out of range', code: 'bad_request', requestId }); return; }
  if (['ECONNREFUSED', '57P01', '53300', '08006', '08001'].includes(err?.code)) { res.setHeader('retry-after', '5'); res.status(503).json({ error: 'Service temporarily unavailable', code: 'unavailable', requestId }); return; }
  logger.error({ err: { message: err?.message, stack: err?.stack, code: err?.code }, path: req.path }, 'unhandled error');
  res.status(500).json({ error: 'Something went wrong. Please try again.', code: 'internal', requestId });
};
