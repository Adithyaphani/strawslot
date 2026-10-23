import pino from 'pino';
import { env, isProd } from '../config/env.js';
import { ctx } from './context.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { svc: 'strawslot-api' },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: { paths: ['req.headers.authorization', '*.password', '*.refreshToken', '*.token'], censor: '[redacted]' },
  // every line emitted while handling a request carries its id
  mixin: () => { const c = ctx(); return c ? { requestId: c.requestId, actor: c.actor } : {}; },
  transport: env.LOG_PRETTY && !isProd ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
});
