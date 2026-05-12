# Deployment Guide

This document covers the rollout sequence for the Sprint 4–7 changes. It
complements `PLAN_V2.md` (the what/why) with the operational steps (the
how/when). Every command here assumes you are at the repository root on a
machine with Docker + docker-compose + bash.

## 1. Pre-flight

```bash
# Confirm clean working tree and latest main.
git status
git pull --ff-only origin main

# Pull the feature branch under test (example).
git fetch origin sprint-7
git checkout sprint-7

# Verify dependencies are resolved (go.mod + package.json).
( cd server && go mod download )
( cd web && npm ci )
```

Copy the environment templates:

```bash
cp server/.env.example server/.env
cp web/.env.example web/.env
```

Edit both files. At a minimum set:

- `POSTGRES_PASSWORD`, `JWT_SECRET`
- `TV_WEBHOOK_PATH_TOKEN`, `TV_WEBHOOK_SECRET` (if TradingView is wired up)
- Feature flags, all default to "off":
  - `server/.env`: `AI_ENABLED`, `SCHEDULE_TIMES_OVERRIDE`
  - `web/.env`:   `VITE_USE_TABLE_V2`, `VITE_USE_WATCHLIST_V2`, `VITE_ENABLE_AI`

## 2. Run the automated test suites

Go (unit):

```bash
cd server
go test ./...
```

Frontend build check (Vite will also lint the JSX imports):

```bash
cd web
npm run build
```

Expected green: markethours trading-day helpers, watchlist handler, schedule
worker, AI client skeleton, per-user rate limiter.

## 3. Apply migrations

`docker-compose up` wires the `db-migrator` container to replay every file in
`server/migrations/` in sort order. Migration `009_watchlist_v2.sql` adds the
Sprint 4 Watchlist V2 columns + `watchlist_daily_prices` table; it is
idempotent so replaying is safe.

```bash
docker compose up -d postgres db-migrator
docker compose logs -f db-migrator   # expect: "Migrations complete!"
```

## 4. Rollout sequence

Staged rollout keeps each Sprint's surface area independent so a regression
can be reverted with a flag flip instead of a redeploy.

### Stage A — Infra + backend only (flags off)

```bash
docker compose up -d --build server kafka zookeeper kafka-ui
curl -fsS http://localhost:8088/api/health | jq
```

The `/api/health` JSON now exposes Kafka and Watchlist counters (added in
Sprint 7). Watch them tick while TradingView webhooks and engine producers
come online:

```bash
watch -n 5 'curl -s http://localhost:8088/api/health | jq .kafka'
```

### Stage B — Schedule worker verification

With no override, the cron entries fire at WIB wall-clock times only. To
smoke the publish path out-of-hours, set the override and restart:

```bash
# .env  (server/.env)
SCHEDULE_TIMES_OVERRIDE=12:00:swing,13:30:bsjp
```

```bash
docker compose restart server
docker compose logs server | grep schedule_worker
# expect: "published swing refresh trigger" and "published bsjp refresh trigger"
```

Clear the override once confirmed:

```bash
sed -i '' 's/^SCHEDULE_TIMES_OVERRIDE=.*/SCHEDULE_TIMES_OVERRIDE=/' server/.env
docker compose restart server
```

### Stage C — Frontend with V2 flags off

```bash
docker compose up -d --build web
open http://localhost:5173
```

Sanity-check all pages still render the legacy layouts (they should; flags
default to false).

### Stage D — Enable V2 tables (Sprint 5)

```bash
# web/.env
VITE_USE_TABLE_V2=true
```

```bash
docker compose restart web
```

Visit `/swing`, `/scalping`, `/bsjp` and confirm the V2 columns load. The
"V2" pill in the table header indicates the flag is active. If something
breaks, flip back to `false` and restart `web` — no backend change required.

### Stage E — Enable Watchlist V2 (Sprint 4)

```bash
# web/.env
VITE_USE_WATCHLIST_V2=true
```

```bash
docker compose restart web
```

Check the H+1..H+7 columns render and the inline sell-price editor PATCHes
successfully. The server-side `workers.StartWatchlistTracker()` is always
on (it has no flag) — it will start writing snapshots at 15:30 WIB regardless
of the UI flag, so the column data exists before the flag is flipped.

### Stage F — AI dark launch (Sprint 7)

The server handlers and per-user rate limiter ship with the deploy but stay
disabled until the model decision is confirmed. When ready:

```bash
# server/.env
AI_ENABLED=true
GROK_API_KEY=sk-...             # production key
GROK_MODEL=grok-4-0709          # pin the exact verified model id

# web/.env
VITE_ENABLE_AI=true
```

```bash
docker compose restart server web
curl -fsS http://localhost:8088/api/ai/status -H "Authorization: Bearer $TOKEN" | jq
```

## 5. Smoke test

After every stage run the smoke script:

```bash
BASE_URL=http://localhost:8088 ./scripts/smoke_test.sh
# With an authenticated token for watchlist + AI checks:
BASE_URL=http://localhost:8088 TOKEN=$(cat ~/.sahamscreen_token) ./scripts/smoke_test.sh
```

Exit code 0 means every required check passed. Non-zero is a rollout stop.

## 6. Monitoring checkpoint

The Sprint 7 observability pieces you should eyeball for the first hour of
any rollout:

- `docker compose logs server | grep kafka_counters` — one line per minute
  with per-topic ingest rates. Flatlines mean an engine producer stalled.
- `curl -s http://localhost:8088/api/health | jq .watchlist` — add, remove,
  sell_patch, and errors counters. Errors should stay at 0; a sudden jump
  is usually a schema drift or a user input edge case.
- `docker compose logs server | grep schedule_worker` — scheduler activity.
  You should see `published … refresh trigger` lines at the configured WIB
  times; a missed trigger log means the cron process died.
- `/api/ai/status` (once Stage F is active) — reports the circuit-breaker
  state and whether the API key is populated. A run of `enabled:false` in
  the JSON response means the server still thinks AI is off even though
  the flag flipped, typically because `GROK_API_KEY` was left empty.

## 7. Rollback

Every Sprint 4–7 change is feature-flagged or flag-adjacent. Rollback by
toggling the flag and restarting the affected service; avoid code reverts
unless the flag path itself is broken.

| Sprint | Flag                          | Location           |
|--------|-------------------------------|--------------------|
| 4      | `VITE_USE_WATCHLIST_V2=false` | `web/.env`         |
| 5      | `VITE_USE_TABLE_V2=false`     | `web/.env`         |
| 6      | `SCHEDULE_TIMES_OVERRIDE=`    | `server/.env`      |
| 7      | `AI_ENABLED=false` + `VITE_ENABLE_AI=false` | both `.env`s |

Database-schema changes (migration 009) are additive only — no rollback
script is required because the old handlers ignore the new columns.

**Market data sources.** If OHLCV or screener tables are empty and someone
suggests "just turn the tick generator back on": there is no tick generator.
`engine/streaming/market_producer.py` and the commented `engine-market`
service block were deleted in the Sprint-7 hygiene pass because a fake-tick
producer parked behind a comment is one accidental uncomment away from
emitting synthetic prices into production Kafka. The canonical sources are:

1. **engine-fetcher** (`engine/data/fetcher.py`) — yfinance poll into
   `idx.ohlcv.enriched` + `idx.ohlcv.raw`. This is the default.
2. **TradingView webhook** (`server/handlers/webhook.go`) — receives Pine
   alert payloads and upserts them into `screener_results`.

Both paths write `source='…'` so they're auditable after the fact. No other
Kafka producer for market ticks exists or should be added without a design
review.
