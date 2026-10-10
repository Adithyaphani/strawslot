#!/usr/bin/env bash
# Post-deploy smoke test: ./scripts/smoke-test.sh https://your-site.netlify.app
set -u
BASE="${1:-http://localhost:8787}"
fail=0

check() { # name expected_status method path [json_body] [auth_token]
  local name="$1" want="$2" method="$3" path="$4" body="${5:-}" token="${6:-}"
  local args=(-s -o /dev/null -w '%{http_code}' -X "$method" "$BASE$path" -H 'content-type: application/json')
  [ -n "$body" ] && args+=(-d "$body")
  [ -n "$token" ] && args+=(-H "authorization: Bearer $token")
  local got; got=$(curl "${args[@]}")
  if [ "$got" = "$want" ]; then printf '  ok   %-34s %s\n' "$name" "$got"; else printf '  FAIL %-34s got %s, want %s\n' "$name" "$got" "$want"; fail=1; fi
}

echo "StrawSlot smoke test -> $BASE"
check "health"                    200 GET  /api/health
check "meta (villages dropdown)"  200 GET  /api/meta
check "public stats"              200 GET  /api/public/stats
check "weather (live or fallback)" 200 GET /api/live/weather
check "validation rejects {}"     400 POST /api/farmer/fields '{}'
check "admin needs login"         401 GET  /api/admin/overview
TOKEN=$(curl -s -X POST "$BASE/api/auth/login" -H 'content-type: application/json' \
  -d '{"user":"officer","password":"sangrur2026"}' | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
check "officer login works"       200 GET  /api/admin/overview "" "$TOKEN"
check "dispatch board"            200 GET  /api/admin/dispatch "" "$TOKEN"
[ "$fail" = 0 ] && echo "All checks passed." || { echo "Some checks failed."; exit 1; }
