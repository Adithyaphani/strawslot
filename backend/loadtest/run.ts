// Load test: node loadtest/run.ts [baseUrl]. Results depend on the machine; always report the hardware with them.
import autocannon from 'autocannon';
const base = process.argv[2] || 'http://127.0.0.1:8080';
const login = await fetch(`${base}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'officer', password: process.env.OFFICER_PASSWORD || 'sangrur2026' }) });
const { accessToken } = await login.json() as any;
const auth = { authorization: `Bearer ${accessToken}` };
const scenarios: { name: string; req: any }[] = [
  { name: 'public stats (cached plan, anonymous)', req: { path: '/api/v1/public/stats' } },
  { name: 'officer overview (cached plan, authenticated)', req: { path: '/api/v1/admin/overview', headers: auth } },
  { name: 'officer fields list (paginated)', req: { path: '/api/v1/admin/fields?limit=50', headers: auth } },
  { name: 'health/live', req: { path: '/health/live' } },
];
const rows: any[] = [];
for (const s of scenarios) {
  const { path, ...rest } = s.req;
  const r = await autocannon({ url: base + path, connections: 64, duration: 10, ...rest });
  rows.push({ scenario: s.name, rps: Math.round(r.requests.average), p50: r.latency.p50, p97_5: r.latency.p97_5, p99: r.latency.p99, errors: r.errors + r.non2xx });
}
// mixed: farmers booking while officers read
const mixed = await autocannon({ url: base, connections: 48, duration: 10, requests: [
  { method: 'GET', path: '/api/v1/admin/overview', headers: auth },
  { method: 'GET', path: '/api/v1/public/stats' },
]});
rows.push({ scenario: 'mixed reads', rps: Math.round(mixed.requests.average), p50: mixed.latency.p50, p97_5: mixed.latency.p97_5, p99: mixed.latency.p99, errors: mixed.errors + mixed.non2xx });
console.table(rows);
console.log(JSON.stringify(rows));
