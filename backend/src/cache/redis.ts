// Optional Redis. Every call fails open: if Redis is down the app slows down but keeps answering.
import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../core/logger.js';

let client: Redis | null = null;
let healthy = false;

export function redis(): Redis | null {
  if (!env.REDIS_URL) return null;
  if (client) return client;
  client = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1, enableOfflineQueue: false, connectTimeout: 2000, lazyConnect: false, retryStrategy: (n) => Math.min(n * 200, 5000) });
  client.on('ready', () => { healthy = true; logger.info('redis connected'); });
  client.on('end', () => { healthy = false; });
  client.on('error', (e) => { if (healthy) logger.warn({ err: e.message }, 'redis error'); healthy = false; });
  return client;
}
export const redisConfigured = () => Boolean(env.REDIS_URL);
export const redisHealthy = () => healthy;
export async function redisPing(): Promise<boolean> {
  const r = redis(); if (!r) return false;
  try { return (await r.ping()) === 'PONG'; } catch { return false; }
}
export async function closeRedis() { if (client) { await client.quit().catch(() => client?.disconnect()); client = null; } }
