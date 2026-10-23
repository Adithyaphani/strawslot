Measured 22 Oct 2026 on a 2-vCPU sandbox (load generator, API, Postgres, Redis all on the same machine).
autocannon, 64 connections, 10 s per scenario, rate limiting disabled.

| Scenario | req/s | p50 ms | p99 ms |
|---|---|---|---|
| health/live | 5555 | 10 | 25 |
| public stats | 2564 | 19 | 96 |
| officer overview (139 KB) | 673 | 93 | 154 |
| officer fields (50 rows) | 901 | 60 | 234 |
| mixed reads | 1133 | 42 | 90 |

Scheduler time vs district size: 640 fields 53 ms · 1280 → 205 ms · 2560 → 1351 ms · 5120 → 5271 ms.
