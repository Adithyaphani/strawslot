// StrawSlot API. Composition root: middleware order, routers, error handling.
// Runs as a Netlify Function in production and as a plain Node server locally (server/index.ts).

import express from 'express';
import { checkPassword, sign } from './lib/auth.js';
import { DISTRICT } from './lib/constants.js';
import { requestContext } from './middleware/context.js';
import { corsPolicy, limiter, securityHeaders } from './middleware/security.js';
import { validateBody } from './middleware/validate.js';
import { ah, apiNotFound, errorHandler } from './middleware/errors.js';
import { LoginSchema } from './schemas.js';
import { publicRoutes } from './routes/public.js';
import { farmerRoutes } from './routes/farmer.js';
import { adminRoutes } from './routes/admin.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(requestContext);
  app.use(securityHeaders);
  app.use(corsPolicy);
  app.use(express.json({ limit: '100kb' }));

  const api = express.Router();
  api.use(limiter({ windowMs: 15 * 60e3, limit: 600 }));
  api.use(publicRoutes);
  api.use('/farmer', farmerRoutes);

  api.post('/auth/login',
    limiter({ windowMs: 15 * 60e3, limit: 20, message: { error: 'Too many login attempts, try again in 15 minutes' } }),
    validateBody(LoginSchema),
    ah(async (req, res) => {
      const { user, password } = req.body as { user: string; password: string };
      if (!checkPassword(user, password)) { res.status(401).json({ error: 'Invalid username or password' }); return; }
      res.json({ token: sign({ sub: user, role: 'officer' }), user: { name: 'District Nodal Officer', username: user, district: DISTRICT.name } });
    }));

  api.use('/admin', adminRoutes);
  api.use(apiNotFound);

  app.use('/api', api);
  app.use('/.netlify/functions/api', api);
  app.use(errorHandler);
  return app;
}
