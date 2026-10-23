// One error type for everything the caller may see. Anything else becomes a generic 500.
export type ErrorCode =
  | 'bad_request' | 'validation_failed' | 'unauthorized' | 'forbidden' | 'not_found'
  | 'conflict' | 'rate_limited' | 'unavailable' | 'timeout' | 'internal';

export class AppError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
    public details?: unknown,
    public headers?: Record<string, string>,
  ) { super(message); this.name = 'AppError'; }
}

export const badRequest = (m: string, details?: unknown) => new AppError(400, 'bad_request', m, details);
export const unauthorized = (m = 'Login required') => new AppError(401, 'unauthorized', m);
export const forbidden = (m = 'You do not have permission to do this') => new AppError(403, 'forbidden', m);
export const notFound = (m = 'Not found') => new AppError(404, 'not_found', m);
export const conflict = (m: string, details?: unknown) => new AppError(409, 'conflict', m, details);
export const tooMany = (m: string, retryAfterS: number) => new AppError(429, 'rate_limited', m, undefined, { 'retry-after': String(retryAfterS) });
export const unavailable = (m = 'Service temporarily unavailable') => new AppError(503, 'unavailable', m);
