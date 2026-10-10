// Runtime configuration in one place. Everything is optional and has a safe default.

const env = process.env;

export const config = {
  isProd: env.NODE_ENV === 'production' || Boolean(env.NETLIFY),
  port: Number(env.PORT) || 8787,
  /** Comma separated list of allowed browser origins. Empty = same-origin only plus any origin for GET. */
  corsOrigins: (env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  firmsKey: env.FIRMS_MAP_KEY || '',
  anthropicKey: env.ANTHROPIC_API_KEY || '',
  anthropicModel: env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
  logJson: env.LOG_FORMAT === 'json' || Boolean(env.NETLIFY),
  /** True when the default signing secret is still in use. Shown on /health so it is not forgotten. */
  insecureSecret: !env.AUTH_SECRET,
};
