import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';

/** An error whose message is safe to show to the caller. */
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const notFound = (what = 'Not found') => new HttpError(404, what);
export const badRequest = (what: string) => new HttpError(400, what);

/** Express 4 does not catch rejected promises, so every async route is wrapped. */
export const ah = (fn: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler =>
  (req, res, next) => { Promise.resolve(fn(req, res, next)).catch(next); };

export const apiNotFound: RequestHandler = (_req, res) => { res.status(404).json({ error: 'Not found' }); };

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof z.ZodError) {
    res.status(400).json({
      error: err.issues[0]?.message || 'Invalid input',
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      requestId: req.id,
    });
    return;
  }
  if (err instanceof HttpError) { res.status(err.status).json({ error: err.message, requestId: req.id }); return; }
  if (err?.type === 'entity.parse.failed') { res.status(400).json({ error: 'Request body is not valid JSON', requestId: req.id }); return; }
  if (err?.type === 'entity.too.large') { res.status(413).json({ error: 'Request body too large', requestId: req.id }); return; }
  console.error(JSON.stringify({ level: 'error', id: req.id, method: req.method, path: req.path, message: err?.message, stack: err?.stack }));
  res.status(500).json({ error: 'Something went wrong. Please try again.', requestId: req.id });
};
