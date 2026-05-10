---
name: testing-app
description: How to bring up the SahamScreen stack and end-to-end test the dashboard / screener / watchlist / news flows. Captures the specific gotchas that have bitten Devin sessions on this repo (CORS preflight, market_overview ORDER BY, scalping post-F5 quirk, broken Add Ticker button, NaN in WS).
---

# Testing the SahamScreen app

## Stack bring-up

```bash
# From repo root. Required env vars are in server/.env (gitignored).
export TV_WEBHOOK_PATH_TOKEN="$TV_WEBHOOK_PATH_TOKEN"
export TV_WEBHOOK_SECRET="$TV_WEBHOOK_SECRET"
docker compose up -d
# Wait ~3 minutes for engine-fetcher first batch + engine-indicator warm-up.
# Web:    http://localhost:5173
# Server: http://localhost:8088
# Webhook: POST /api/webhooks/tradingview/$TV_WEBHOOK_PATH_TOKEN
```

No `cloudflared` by default — it's gated behind `--profile tunnel`.

## Login

Seeded admin works after PR #5 commit 801c160: `admin@sahamscreen.id` / `admin123`. If a session reports it doesn't, check `005_fix_admin_password.sql` actually ran (`docker logs sahamscreen-db-migrator 2>&1 | grep 005`).

Alternative: register a fresh user with `POST /api/auth/register`.

## Smoke checks before any UI testing

These five curls catch most regressions that have ever broken the dashboard:

```bash
curl -s localhost:8088/api/market/overview | jq '.index_value'    # >0, not 0
curl -s localhost:8088/api/market/sectors | jq 'length'           # ~10
curl -s localhost:8088/api/screener/bsjp | jq 'length'            # >=1
curl -s localhost:8088/api/screener/swing | jq 'length'           # >=1
curl -s -o /dev/null -w '%{http_code}\n' \
  -X OPTIONS localhost:8088/api/market/sectors \
  -H 'Origin: http://localhost:5173' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: authorization,content-type'  # 200, NOT 404
```

If the OPTIONS preflight returns 404, the dashboard will be blank in the browser even though all the GET endpoints work in curl. Root cause: gorilla/mux's `r.Use(...)` only fires on routes the router can match. Fix: middleware must be wrapped at `http.Handler` chain time (`http.ListenAndServe(addr, mw1(mw2(r)))`) — see `server/main.go` post commit `216dd0b`.

## Known UI gotchas (preexisting, not from PR #5)

1. **Scalping page post-F5 quirk.** `/scalping` shows "No scalping candidates found" on hard reload even when `/api/screener/scalping` returns rows. The `useScreener` hook mishandles its initial fetch result; subsequent WS updates *do* render correctly. The user has explicitly opted out of fixing this ("jika menggangu jangan"). To demonstrate scalping rows in a recording, fire a TV webhook with `strategy=scalping` while the page is already mounted — the WS-driven render path works.
2. **Watchlist `Add Ticker` button is a no-op.** No `onClick` handler. Watchlist add only works via the strategy table action columns or `POST /api/watchlist`. To test the round trip via API:
   ```bash
   TOKEN=$(curl -s -X POST localhost:8088/api/auth/login -H 'Content-Type: application/json' \
     -d '{"email":"admin@sahamscreen.id","password":"admin123"}' | jq -r '.token')
   curl -s -X POST localhost:8088/api/watchlist -H "Authorization: Bearer $TOKEN" \
     -H 'Content-Type: application/json' -d '{"ticker":"KLBF"}'
   # Then navigate to /watchlist in the UI and F5 to verify persistence.
   ```
3. **Watchlist `Invalid Date` cell** in the `ADDED AT` column. API returns RFC3339; frontend formatter mishandles it. Cosmetic only.
4. **WS `JSON.parse` errors with `NaN` in payload.** `engine-indicator` occasionally emits `"ema_5": NaN`. The browser drops that single message (each is in its own try/catch); the connection survives. Real fix is engine-side: coerce `NaN`/`±Inf` to `null` before `json.dumps`.

## TV webhook end-to-end

```bash
# Idempotency: PR #5 commit d234aee synthesizes alert_id when TV omits it.
curl -s -X POST "http://localhost:8088/api/webhooks/tradingview/$TV_WEBHOOK_PATH_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"ticker":"BBCA","strategy":"scalping","signal":"BUY",
       "price":9500,"stop_loss":9400,"target":9700,
       "secret":"'"$TV_WEBHOOK_SECRET"'"}'
# First call  -> {"status":"accepted"}
# Second identical call within the same minute -> {"status":"duplicate"}
# Note: body field is `price` (not `entry`) and `stop_loss` (not `stop`).
```

## Recording browser tests

- Always maximize Chrome before recording: `wmctrl -i -r $(wmctrl -l | grep -i sahamscreen | awk '{print $1}') -b add,maximized_vert,maximized_horz`. Half-screen Chrome looks bad and clips key UI.
- Don't use `xdotool key super+Up` to maximize on Plasma; it tiles to half-screen.
- Hard refresh after server rebuilds (`Ctrl+Shift+R`) — the dashboard caches the initial fetch result.
- Keep a single recording for the whole T11–T14 sweep. Use `annotate_recording` with `setup`/`test_start`/`assertion` per test so the player auto-slows at key moments.
- If the browser_console tool says "Chrome is not in the foreground", click any non-input area inside the Chrome viewport first (clicking the URL bar moves focus to the address bar but doesn't always restore the foreground state).
