// All configuration comes from environment variables, validated once at start-up.
// A bad value stops the process immediately with a readable message instead of failing later at runtime.
import { z } from 'zod';

const bool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const Schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(8080),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  LOG_PRETTY: bool.default('false'),

  DATABASE_URL: z.string().default('postgres://strawslot:strawslot@127.0.0.1:5432/strawslot'),
  DB_POOL_MAX: z.coerce.number().int().min(1).default(10),
  DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().default(10_000),
  MIGRATE_ON_BOOT: bool.default('true'),

  REDIS_URL: z.string().optional(), // optional: without it the app uses in-process cache and limits

  JWT_SECRET: z.string().default('dev-only-secret-change-me-dev-only-secret'),
  JWT_ISSUER: z.string().default('strawslot'),
  ACCESS_TOKEN_TTL_MIN: z.coerce.number().int().min(1).default(720), // 15 is better in production; the demo web app has no refresh flow yet
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).default(14),
  LOGIN_MAX_FAILURES: z.coerce.number().int().default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().default(15),

  CORS_ORIGINS: z.string().default(''),
  TRUST_PROXY: z.coerce.number().int().default(1),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().default(25_000),
  BODY_LIMIT: z.string().default('100kb'),

  RATE_LIMIT_ENABLED: bool.default('true'),
  RATE_LIMIT_GLOBAL_PER_MIN: z.coerce.number().int().default(600),
  RATE_LIMIT_LOGIN_PER_15MIN: z.coerce.number().int().default(20),
  RATE_LIMIT_WRITE_PER_HOUR: z.coerce.number().int().default(40),

  METRICS_TOKEN: z.string().optional(), // when set, /metrics needs "Authorization: Bearer <token>"
  DEFAULT_DISTRICT: z.string().default('sangrur'),
  VERSION_CACHE_MS: z.coerce.number().int().default(250),
  PLAN_CACHE_TTL_S: z.coerce.number().int().default(3600),

  RUN_WORKER_IN_API: bool.default('false'),
  BOOTSTRAP_SEED: bool.default('true'), // create the demo district and users on first boot
  BOOTSTRAP_OFFICER_USER: z.string().optional(),
  BOOTSTRAP_OFFICER_PASSWORD: z.string().optional(),
  BOOTSTRAP_ADMIN_USER: z.string().optional(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().optional(),
  DEMO_AUTO_RESEED: bool.default('true'),

  FIRMS_MAP_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-haiku-5-5'),
  LIVE_REFRESH_MINUTES: z.coerce.number().int().default(30),

  SMS_PROVIDER: z.enum(['console', 'webhook', 'twilio']).default('console'),
  SMS_WEBHOOK_URL: z.string().optional(),
  SMS_WEBHOOK_SECRET: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM: z.string().optional(),
});

export type Env = z.infer<typeof Schema>;

function load(): Env {
  const parsed = Schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${lines}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production') {
    const problems: string[] = [];
    if (env.JWT_SECRET.startsWith('dev-only') || env.JWT_SECRET.length < 32) problems.push('JWT_SECRET must be set to a random string of at least 32 characters');
    if (env.BOOTSTRAP_SEED && (!env.BOOTSTRAP_OFFICER_PASSWORD || !env.BOOTSTRAP_ADMIN_PASSWORD)) problems.push('BOOTSTRAP_OFFICER_PASSWORD and BOOTSTRAP_ADMIN_PASSWORD are required when BOOTSTRAP_SEED=true in production');
    if (env.SMS_PROVIDER === 'webhook' && !env.SMS_WEBHOOK_URL) problems.push('SMS_WEBHOOK_URL is required for the webhook SMS provider');
    if (env.SMS_PROVIDER === 'twilio' && !(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM)) problems.push('TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM are required for the twilio SMS provider');
    if (problems.length) throw new Error(`Unsafe production configuration:\n  ${problems.join('\n  ')}`);
  }
  return env;
}

export const env = load();
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export const corsOrigins = env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
