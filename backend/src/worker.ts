// Stand-alone worker process: outbox delivery and scheduled jobs. Run as many as you like.
import { env } from './config/env.js';
import { logger } from './core/logger.js';
import { migrate } from './db/migrate.js';
import { closePool } from './db/pool.js';
import { closeRedis, redis } from './cache/redis.js';
import { startWorker } from './jobs/runner.js';
import { createServer } from 'node:http';
import { registry } from './core/metrics.js';

async function main() {
  if (env.MIGRATE_ON_BOOT) await migrate();
  redis();
  const stop = await startWorker();
  // tiny ops port: liveness for the orchestrator and Prometheus metrics for the worker
  const port = Number(process.env.WORKER_PORT || 9100);
  const ops = createServer(async (req, res) => {
    if (req.url === '/metrics') { res.setHeader('content-type', registry.contentType); res.end(await registry.metrics()); return; }
    res.statusCode = 200; res.end('ok');
  }).listen(port);
  const shutdown = async () => { ops.close(); await stop(); await closeRedis(); await closePool(); process.exit(0); };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}
main().catch((e) => { logger.fatal({ err: e.message }, 'worker failed to start'); process.exit(1); });
