import client from 'prom-client';

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

export const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds', help: 'HTTP request latency', labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5], registers: [registry],
});
export const scheduleCompute = new client.Histogram({
  name: 'schedule_compute_seconds', help: 'Time to compute a district plan', buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2], registers: [registry],
});
export const cacheEvents = new client.Counter({
  name: 'plan_cache_events_total', help: 'Plan cache lookups', labelNames: ['layer', 'result'], registers: [registry],
});
export const jobRuns = new client.Counter({
  name: 'job_runs_total', help: 'Background job runs', labelNames: ['job', 'result'], registers: [registry],
});
export const notificationsSent = new client.Counter({
  name: 'notifications_total', help: 'Outbox deliveries', labelNames: ['result'], registers: [registry],
});
export const outboxDepth = new client.Gauge({ name: 'outbox_pending', help: 'Notifications waiting to be sent', registers: [registry] });
export const rateLimited = new client.Counter({ name: 'rate_limited_total', help: 'Requests rejected by the limiter', labelNames: ['bucket'], registers: [registry] });
export const loginResults = new client.Counter({ name: 'login_attempts_total', help: 'Officer login attempts', labelNames: ['result'], registers: [registry] });
