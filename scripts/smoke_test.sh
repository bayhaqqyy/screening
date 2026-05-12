#!/usr/bin/env bash
# scripts/smoke_test.sh — Sprint 7 post-deploy smoke test.
#
# Runs a short sequence of read-only HTTP checks against the live server to
# confirm the Sprint 4–7 changes are healthy after a rollout. Safe to run in
# any environment (production included) because it never writes data and
# requires only a base URL, optional JWT, and standard POSIX tools (curl +
# jq).
#
# Usage:
#   BASE_URL=http://localhost:8088 ./scripts/smoke_test.sh
#   BASE_URL=https://api.example.com TOKEN=<jwt> ./scripts/smoke_test.sh
#
# Exit codes:
#   0 — all required checks passed
#   1 — at least one required check failed
#   2 — missing dependency (curl/jq)
#
# The watchlist + AI sections are skipped automatically when TOKEN is not
# provided so the script is still useful for anonymous health probes.

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8088}"
TOKEN="${TOKEN:-}"
FAIL=0
PASS=0

for bin in curl jq; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "ERROR: required binary '$bin' not found on PATH" >&2
    exit 2
  fi
done

note()  { printf '• %s\n' "$*"; }
pass()  { printf '  \033[32mPASS\033[0m %s\n' "$*"; PASS=$((PASS + 1)); }
fail()  { printf '  \033[31mFAIL\033[0m %s\n' "$*"; FAIL=$((FAIL + 1)); }

# http_get <path> [auth?]
# Prints the response body; exit status reflects HTTP >= 400.
http_get() {
  local path="$1"; local auth="${2:-}"
  local url="${BASE_URL%/}${path}"
  local hdr=(-s -S -w '\n%{http_code}')
  if [[ -n "$auth" ]]; then
    hdr+=(-H "Authorization: Bearer ${auth}")
  fi
  curl "${hdr[@]}" "$url"
}

# check_status <label> <path> <want_status> [auth?]
check_status() {
  local label="$1"; local path="$2"; local want="$3"; local auth="${4:-}"
  note "$label  ($path)"
  local resp code body
  resp="$(http_get "$path" "$auth" || true)"
  code="${resp##*$'\n'}"
  body="${resp%$'\n'*}"
  if [[ "$code" == "$want" ]]; then
    pass "HTTP $code"
    echo "$body"
  else
    fail "HTTP $code (want $want)"
    printf '       body: %s\n' "$body" | head -c 400
    printf '\n'
  fi
}

echo "=== SahamScreen smoke test @ ${BASE_URL} ==="

# ---- Public -----------------------------------------------------------------
health_body="$(check_status 'health'          '/api/health'          200)"
if jq -e '.kafka.ohlcv != null' <<<"$health_body" >/dev/null 2>&1; then
  pass 'health payload exposes Kafka counters (Sprint 7 wiring)'
else
  fail 'health payload missing kafka counters — /api/health upgrade did not ship'
fi
if jq -e '.watchlist.get != null' <<<"$health_body" >/dev/null 2>&1; then
  pass 'health payload exposes watchlist counters'
else
  fail 'health payload missing watchlist counters'
fi

check_status 'market status'   '/api/market/status'   200 >/dev/null || true
check_status 'market overview' '/api/market/overview' 200 >/dev/null || true
check_status 'market sectors'  '/api/market/sectors'  200 >/dev/null || true

check_status 'screener bsjp'     '/api/screener/bsjp'     200 >/dev/null || true
check_status 'screener swing'    '/api/screener/swing'    200 >/dev/null || true
check_status 'screener scalping' '/api/screener/scalping' 200 >/dev/null || true

check_status 'news'           '/api/news?limit=3'            200 >/dev/null || true
check_status 'news by ticker' '/api/news?limit=3&ticker=BBCA' 200 >/dev/null || true
check_status 'bandar batch'   '/api/bandar/batch?tickers=BBCA,BBRI' 200 >/dev/null || true

# ---- Authenticated checks (only if TOKEN provided) --------------------------
if [[ -n "$TOKEN" ]]; then
  check_status 'watchlist GET'   '/api/watchlist' 200 "$TOKEN" >/dev/null || true
  ai_status="$(check_status 'ai status' '/api/ai/status' 200 "$TOKEN")"
  if jq -e '.enabled != null' <<<"$ai_status" >/dev/null 2>&1; then
    pass 'ai status shape OK'
  else
    fail 'ai status missing enabled field'
  fi
else
  note 'TOKEN unset — skipping watchlist & AI checks'
fi

echo "----"
echo "Passed: $PASS   Failed: $FAIL"
if (( FAIL > 0 )); then
  exit 1
fi
exit 0
