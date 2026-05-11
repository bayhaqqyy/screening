# Test Report — PR #5 (app data flow fix + CORS preflight)

**PR:** https://github.com/bayhaqqyy/screening/pull/5
**Tested SHA:** `216dd0b` (fix(cors): wrap router at http.Handler chain so middleware fires on 404/preflight)
**Recording:** `/home/ubuntu/screencasts/rec-02c124849d7341d8bd64b79ceb37a244-edited.mp4`

## Summary

Ran full T1–T14 sweep against the patched stack. **13/14 passed.** The one failure (T12-Scalping) is the preexisting `useScreener` post-F5 quirk (C1 from PR #3 testing) that the user explicitly opted out of fixing in this PR — the API returns the data correctly, only the page-load render path mishandles it.

Two new bugs were caught and fixed mid-test, both code-level (not test-level):
- IHSG always 0 on dashboard → fixed in `af7eab4`
- All dashboard endpoints fail with `'No Access-Control-Allow-Origin'` in browser → fixed in `216dd0b`

## Results

| Test | Description | Result |
|---|---|---|
| T1 | Stack starts cleanly on a wiped volume | PASS |
| T2 | DB migrations run idempotently across restart | PASS |
| T3 | `engine-screener` no longer spams `KeyError('history')` | PASS |
| T4 | `admin@sahamscreen.id` / `admin123` actually logs in | PASS |
| T5 | Anon protected routes return 401 | PASS |
| T6 | Authed protected routes return 200 | PASS |
| T7 | `stock_info` populated (≥800 rows) | PASS |
| T8 | `screener_results` populated for `bsjp`, `swing` (≥1 row each) | PASS |
| T9 | TV webhook synth-id idempotency (omit `alert_id`) | PASS |
| T10 | Rate limit returns 429 with CORS headers after burst | PASS |
| T11 | Dashboard shows live IHSG / movers / sectors | **PASS** (was failing pre-fix) |
| T12-BSJP | `/bsjp` renders ≥1 candidate row | PASS (3 rows) |
| T12-Swing | `/swing` renders ≥1 candidate row | PASS (15 rows) |
| T12-Scalping | `/scalping` renders ≥1 candidate row | **FAIL — preexisting C1, user opted out** |
| T13 | Watchlist add → reload → row persists | PASS |
| T14 | News page renders (≥1 card or graceful empty state) | PASS (graceful empty) |

## Bugs Caught & Fixed Mid-Test

### Bug 1 — IHSG always 0 on dashboard (commit `af7eab4`)

**Symptom:** dashboard `/api/market/overview` returned `{"index_value": 0, "change_pct": 0, ...}` even though `aggregateMarketOverview()` was running every 30 s and writing real values.

**Root cause:** `GetMarketOverview` did `ORDER BY id DESC LIMIT 1`. Earlier revisions of `002_production_tables.sql` seeded `market_overview` *without* specifying `id`, so each migrator run (every `docker compose up`) allocated a fresh SERIAL id and accumulated empty rows. The handler picked the highest id (a stale zero row) instead of `id=1` (the row `aggregateMarketOverview()` actually maintains).

**Fix:**
- `server/handlers/market.go`: `ORDER BY updated_at DESC LIMIT 1`
- `server/migrations/002_production_tables.sql`: pin seed to `id=1` with `ON CONFLICT (id) DO NOTHING`
- `server/migrations/006_dedup_market_overview.sql`: one-shot `DELETE FROM market_overview WHERE id <> 1` for existing dev volumes

**Verification:** `curl -s localhost:8088/api/market/overview | jq .index_value` → `12305.35` (was `0` before).

### Bug 2 — Browser blocks all dashboard fetches with CORS error (commit `216dd0b`)

**Symptom:** browser devtools console shows `'CORS policy: No Access-Control-Allow-Origin header is present on the requested resource'` for `/api/market/sectors`, `/api/news`, `/api/screener/*`. Yet curl against the same endpoints returns proper headers.

**Root cause:** gorilla/mux's `r.Use(...)` middleware **only fires on routes the router can match**. Most read-only routes are registered as `Methods("GET")` only. Browser-fetch with `Authorization: Bearer ...` is *not* a simple request → triggers preflight `OPTIONS`. With `GET`-only registration, the OPTIONS request falls through to `NotFoundHandler` → `r.Use`'d `CorsMiddleware` never runs → preflight returns bare 404 with no CORS headers → browser blocks the real GET. Curl succeeded because curl without `Authorization` header is a simple request and skips preflight.

**Fix:** stop using `r.Use()`; wrap the router in middleware via the http.Handler chain at `ListenAndServe` time:
```go
var handler http.Handler = r
handler = middleware.RateLimitMiddleware(handler)
handler = middleware.CorsMiddleware(handler)
http.ListenAndServe(":"+port, handler)
```

**Verification:** `curl -X OPTIONS /api/market/sectors -H 'Origin: http://localhost:5173' -H 'Access-Control-Request-Method: GET' -H 'Access-Control-Request-Headers: authorization,content-type'` → `200` with all 3 `Access-Control-*` headers. Repeated for `/api/news`, `/api/screener/bsjp`, `/api/watchlist`. All 200.

## T11 — Dashboard rendering

**Pass criteria:** IHSG card shows non-zero numeric value (not `0` / `--`), top movers list ≥3 tickers, sector heatmap ≥5 sectors.

Live values rendered:
- IHSG: **12,305.35** (-2.95%)
- Volume: **3.8B**
- Valuation: **Rp 5474.3T**
- Foreign flow: **Rp -1957228100**
- Top movers (5): MAPI 1455 +12.36%, ISAT 2240 +4.19%, KLBF 920 +2.22%, PNLF 272 +1.87%, GGRM 16725 +0.91%
- Sectors (6+ visible): Utilities -7.345%, Basic Materials -7.1655%, Consumer Cyclical +4.16%, Energy -3.135%, Communication Services -1.878%, Consumer Defensive -1.4244%

## T12 — Strategy pages

**BSJP** (`/bsjp`): 3 rows visible — KLBF entry 920 / target 966 / stop 892 / score 60 / ENTRY status; MAPI entry 1455 / target 1528 / stop 1411 / score 85 / ENTRY; PNLF entry 272 / target 286 / stop 264 / score 85 / ENTRY. Strategy Performance card shows 66.7% success rate, +5.4% avg gap-up, 3 total hits.

**Swing** (`/swing`): 15 rows visible — ACES, ADRO, AMRT, BBNI, BBRI, BMRI, GGRM, HMSP, ICBP, ISAT, KLBF, … all with BUY signal + entry / target / stop / ENTRY status. Header reads "Showing 15 Results".

**Scalping** (`/scalping`): empty UI ("No scalping candidates found") despite `curl -s /api/screener/scalping | jq length` returning **2** (BBCA, …). This is the preexisting `useScreener` post-F5 quirk (C1 from PR #3 testing) — first page load mishandles the initial fetch result; subsequent WS updates *do* render correctly. The user explicitly opted out of fixing this in this PR ("jika menggangu jangan").

## T13 — Watchlist add + persist round-trip

1. `POST /api/watchlist` with `{"ticker":"KLBF"}` and admin Bearer token → `{"success":true}`
2. Navigate to `/watchlist` → row "KLBF / Kalbe Farma Tbk / 920 / +2.22% / N/A / Invalid Date" rendered
3. Hard refresh (F5) → KLBF row still present

**Note (minor display bug):** the `ADDED AT` cell shows `Invalid Date`. The API returns the timestamp as RFC3339 (`2026-05-09T16:03:09Z`); the frontend formatter likely expects a different shape. Non-blocking; flagged as a follow-up.

## T14 — News page

Empty state rendered cleanly:
- Tabs: Semua / Positif / Negatif / Netral
- Featured panel: "No featured news available"
- Top Sentiment panel: "No sentiment data."
- Market Deep Dive: "No articles found."

No error boundary, no network errors. `engine-news-fetcher` is enabled in compose but hasn't produced any items yet (Yahoo Finance news scrape returned 0 items for IDX tickers in this run).

## Caveats / Follow-ups

1. **Scalping page post-F5 quirk** (C1, preexisting). The `useScreener` hook mishandles the initial `fetchData()` result on hard reload. User explicitly opted out.
2. **Watchlist `Invalid Date` cell.** Date formatter on `WatchlistRow` mishandles RFC3339 string. Non-blocking visual bug. Flagged as a follow-up commit.
3. **WS occasional `NaN` parse errors.** `engine-indicator` occasionally produces JSON with raw `NaN` literals (e.g. `"ema_5": NaN`); the browser `JSON.parse` fails and the message is dropped (each message is in its own try/catch so the connection survives). Flagged as a follow-up engine-side commit.
4. **`Add Ticker` button on /watchlist is a no-op.** The button has styling but no `onClick`. Watchlist add flow currently only works via the strategy table action columns or the API. Flagged as a follow-up.
5. **Login page:** seeded admin works (`admin@sahamscreen.id` / `admin123`) per commit #3.
