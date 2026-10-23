// API process: migrate, bootstrap, listen, and shut down cleanly on SIGTERM.
import http from 'node:http';
import { env } from './config/env.js';
import { logger } from './core/logger.js';
import { migrate } from './db/migrate.js';
import { closePool } from './db/pool.js';
import { closeRedis, redis } from './cache/redis.js';
import { bootstrap } from './seed/bootstrap.js';
import { createApp, state } from './http/app.js';
import { startWorker } from './jobs/runner.js';

async function main() {
  if (env.MIGRATE_ON_BOOT) await migrate();
  if (env.BOOTSTRAP_SEED) await bootstrap();
  redis();
  const app = createApp();
  const server = http.createServer(app);
  server.keepAliveTimeout = 65_000; // longer than common load-balancer idle timeouts, avoids sporadic 502s
  server.headersTimeout = 66_000;
  const stopWorker = env.RUN_WORKER_IN_API ? await startWorker() : async () => {};

  await new Promise<void>((resolve) => server.listen(env.PORT, resolve));
  logger.info({ port: env.PORT, env: env.NODE_ENV, redis: Boolean(env.REDIS_URL), workerInProcess: env.RUN_WORKER_IN_API }, 'api listening');

  let closing = false;
  const shutdown = async (sig: string) => {
    if (closing) return; closing = true;
    logger.info({ sig }, 'shutting down');
    state.shuttingDown = true;                 // readiness turns red so the load balancer stops sending traffic
    await new Promise((r) => setTimeout(r, Number(process.env.SHUTDOWN_GRACE_MS ?? 3000)));
    server.close();                            // finish in-flight requests
    const force = setTimeout(() => process.exit(1), 15_000).unref();
    await new Promise<void>((r) => server.once('close', () => r()));
    await stopWorker(); await closeRedis(); await closePool();
    clearTimeout(force);
    logger.info('bye'); process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (e) => logger.error({ err: String(e) }, 'unhandled rejection'));
}
main().catch((e) => { logger.fatal({ err: e.message, stack: e.stack }, 'failed to start'); process.exit(1); });
