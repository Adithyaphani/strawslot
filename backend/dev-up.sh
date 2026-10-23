#!/bin/sh
# Local dev helper: API plus the in-process worker, against local Postgres and Redis.
cd "$(dirname "$0")"
export DATABASE_URL="${DATABASE_URL:-postgres://strawslot:strawslot@127.0.0.1:5432/strawslot}"
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
export RUN_WORKER_IN_API=true
export PORT="${PORT:-8080}"
export LOG_LEVEL="${LOG_LEVEL:-warn}"
exec npx tsx src/server.ts
