import type { RequestHandler } from 'express';
import type { ZodTypeAny, z } from 'zod';

/** Parses req.body with a Zod schema and replaces it with the typed result. Errors go to the central handler. */
export const validateBody = <S extends ZodTypeAny>(schema: S): RequestHandler =>
  (req, _res, next) => {
    try { req.body = schema.parse(req.body) as z.infer<S>; next(); } catch (e) { next(e); }
  };
