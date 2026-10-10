import type { AdminClaims } from './types.js';

declare global {
  namespace Express {
    interface Request {
      /** Correlation id, also returned as the x-request-id header. */
      id?: string;
      /** Set by requireAdmin once the bearer token has been verified. */
      admin?: AdminClaims;
    }
  }
}
export {};
