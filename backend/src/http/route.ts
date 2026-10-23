// A tiny route registry. Each endpoint is declared once, with its auth rule, rate limit and Zod schemas;
// the same declaration wires Express, validates input and produces the OpenAPI document.
import type { NextFunction, Request, Response, Router } from 'express';
import type { ZodTypeAny } from 'zod';
import { env } from '../config/env.js';
import { als, ctx as getCtx } from '../core/context.js';
import { forbidden, unauthorized } from '../core/errors.js';
import { verifyAccess, type Claims, type Role } from '../services/auth.js';
import { rateLimit } from './middleware/rateLimit.js';
import type { Plan } from '../services/planService.js';

export interface Ctx<B = any, Q = any> {
  req: Request; res: Response; body: B; query: Q; params: Record<string, string>;
  user?: Claims; districtId: string; ip: string;
  /** Sends 304 and returns true when the client already holds this exact plan. */
  notModified: (plan: Plan, variant?: string) => boolean;
}
export interface RouteDef<B = any, Q = any> {
  method: 'get' | 'post' | 'delete' | 'patch';
  path: string; summary: string; tag: string;
  auth?: 'public' | Role;
  body?: ZodTypeAny; query?: ZodTypeAny;
  rate?: { bucket: string; limit: number; windowMs: number };
  cache?: 'public-30s' | 'no-store';
  /** Declared for the OpenAPI document only. */
  responses?: Record<number, string>;
  handler: (c: Ctx<B, Q>) => Promise<unknown> | unknown;
  /** Handler writes the response itself (e.g. CSV download). */
  raw?: boolean;
}
export const registry: RouteDef[] = [];
export const define = <B = any, Q = any>(r: RouteDef<B, Q>) => { registry.push(r); return r; };

const RANK: Record<Role, number> = { viewer: 1, officer: 2, admin: 3 };

export function mount(router: Router) {
  for (const r of registry) {
    const stack: ((q: Request, s: Response, n: NextFunction) => unknown)[] = [];
    if (r.rate && env.RATE_LIMIT_ENABLED) stack.push(rateLimit(r.rate));
    stack.push(async (req, res, next) => {
      try {
        let user: Claims | undefined;
        if (r.auth && r.auth !== 'public') {
          const h = req.headers.authorization || '';
          if (!h.startsWith('Bearer ')) throw unauthorized('Officer login required');
          user = await verifyAccess(h.slice(7));
          if (RANK[user.role] < RANK[r.auth]) throw forbidden(`This action needs the ${r.auth} role`);
          const store = getCtx(); if (store) { store.actor = user.username; store.districtId = user.districtId; }
        }
        const query = r.query ? r.query.parse(req.query) : req.query;
        const body = r.body ? r.body.parse(req.body ?? {}) : req.body;
        const districtId = user?.districtId ?? (query as any)?.district ?? env.DEFAULT_DISTRICT;
        res.setHeader('cache-control', r.cache === 'public-30s' ? 'public, max-age=30, stale-while-revalidate=60' : 'no-store');
        const c: Ctx = {
          req, res, body, query, params: req.params as any, user, districtId, ip: req.ip || '',
          notModified: (plan, variant = '') => {
            const tag = `W/"${plan.districtId}.${plan.version}.${plan.stamp}.${plan.today}${variant ? '.' + variant : ''}"`;
            res.setHeader('etag', tag);
            if (req.headers['if-none-match'] === tag) { res.status(304).end(); return true; }
            return false;
          },
        };
        const out = await r.handler(c);
        if (r.raw || res.headersSent) return;
        res.json(out);
      } catch (e) { next(e); }
    });
    (router as any)[r.method](r.path, ...stack);
  }
}
void als;
