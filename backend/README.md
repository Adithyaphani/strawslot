# StrawSlot backend

Production-shaped API for StrawSlot (Team TrailBlazers). Node 22 · TypeScript · Express · PostgreSQL · Redis (optional).

Full explanation: `docs/StrawSlot-Backend-Architecture-and-Operations-Guide.pdf`

## Run locally
```
npm install
./dev-up.sh            # API + in-process worker on :8080 (needs local Postgres + Redis; see DATABASE_URL in the script)
```
Docs UI: http://localhost:8080/docs · Health: `/health/ready` · Metrics: `/metrics`
Dev logins: `officer / sangrur2026`, `admin / admin-sangrur-2026`

## Run the production-shaped stack
```
cd deploy && cp ../.env.example .env   # set secrets
docker compose up --build              # 2 API replicas, worker, Postgres, Redis, nginx, Prometheus
```
Kubernetes manifests (HPA, PDB, probes, migrate job) are in `deploy/k8s/`.

## Scripts
`npm test` (50 tests, needs Postgres `strawslot_test`) · `npm run typecheck` · `npm run build` · `npm run loadtest` · `npx tsx loadtest/engine-scale.ts`

## Layout
`src/http` routes + OpenAPI · `src/services` business logic and plan cache · `src/repositories` SQL · `src/domain` scheduler engine · `src/jobs` outbox and scheduled jobs · `deploy/` infra.
