# SahamScreen V2 — Major Update Plan

> **Scope**: Dashboard fixes, Live P&L Engine, Screener/Watchlist UI redesign, News pipeline, AI Integration (Groq), Market-hours-aware scheduling.

---

## Current Architecture Summary

```
Engine (Python)                    Server (Go)                    Web (React/Vite)
┌─────────────────────┐     ┌──────────────────────────┐     ┌───────────────────┐
│ engine-fetcher      │     │ REST API (gorilla/mux)   │     │ Dashboard         │
│ yfinance → Kafka    │────▶│ Kafka Consumer           │────▶│ Scalping Page     │
│                     │     │ persist + WS broadcast   │     │ Swing Page        │
│ engine-news-fetcher │     │                          │     │ BSJP Page         │
│ RSS → Kafka         │────▶│ TradingView Webhook      │     │ Watchlist Page    │
│                     │     │                          │     │ News Page         │
│ engine-indicator    │     │ WebSocket Hub            │────▶│                   │
│ TA enrichment       │────▶│                          │     │                   │
│                     │     └──────────────────────────┘     └───────────────────┘
│ engine-screener     │
│ BSJP/Swing/Scalp    │
└─────────────────────┘
```

---

## Phase 1 — Dashboard Fixes (Priority: Urgent)

### 1A. Sector Heatmap — Fix `change_pct` Formatting

**Problem**: Sector heatmap shows raw decimal values (e.g. `+2.3188%` instead of `+2.32%`). The data is correct, but the formatting is wrong on the frontend.

**Root cause**: `SectorHeatmap.jsx` renders `{sector.change_pct}%` without rounding. The backend `change_pct` from `stock_info` is stored as `DECIMAL(8,4)`.

**Fix**:
| File | Change |
|------|--------|
| `web/src/components/dashboard/SectorHeatmap.jsx` | Format: `{(sector.change_pct).toFixed(2)}%` |
| `server/kafka/consumer.go` → `aggregateMarketOverview()` | Round sector `AVG(change_pct)` to 2 decimals: `ROUND(AVG(change_pct), 2)` |

### 1B. IHSG Change % — Fix Stale Overwrite

**Problem**: IHSG index value is correct (from `^JKSE`), but the `change_pct` gets overwritten by `aggregateMarketOverview()` which replaces it with `AVG(change_pct)` of all stocks — not the real IHSG change.

**Root cause**: In `consumer.go:350`, `aggregateMarketOverview()` unconditionally writes `avgChangePct` (average of all individual stock changes) to `market_overview.change_pct`, overwriting the accurate `change_pct` that `persistIndexUpdate()` had already written from `^JKSE`.

**Fix**:
| File | Change |
|------|--------|
| `server/kafka/consumer.go` → `aggregateMarketOverview()` | Preserve the IHSG-sourced `change_pct`: read existing `change_pct` from row `id=1`, only overwrite volume/valuation/foreign_flow. Skip index_value and change_pct if they were already set by `persistIndexUpdate()` |

```go
// Pseudocode fix
_, err = database.DB.Exec(`
    UPDATE market_overview SET
        volume = $1,
        valuation = $2,
        foreign_flow = $3,
        updated_at = NOW()
    WHERE id = 1
`, totalVolume, totalValuation, foreignFlow)
```

### 1C. Market-Hours-Aware Fetching — Stop When Closed

**Problem**: `engine-fetcher` fetches every N minutes 24/7, wasting API calls and overwriting end-of-day data with stale results on weekends/after-hours.

**Fix**:
| File | Change |
|------|--------|
| `engine/data/fetcher.py` | Add WIB time check before fetching — skip if weekend or outside 08:45–16:15 WIB |
| `server/kafka/consumer.go` → `aggregateMarketOverview()` | Add same time-guard — skip aggregation when market is closed |

```python
# engine/data/fetcher.py — add at top of loop
from datetime import datetime
import pytz

def is_market_open():
    wib = pytz.timezone('Asia/Jakarta')
    now = datetime.now(wib)
    if now.weekday() >= 5:  # Saturday/Sunday
        return False
    t = now.hour * 60 + now.minute
    return 8*60+45 <= t <= 16*60+15
```

---

## Phase 2 — Live P&L Engine (Priority: High)

### Concept

Ketika screener menemukan saham yang bagus (BSJP/Swing/Scalping) atau user menambahkan ke watchlist:
1. **Entry price** dicatat saat signal pertama masuk
2. **Live price** di-update dari feed `idx.ohlcv.enriched`
3. **P&L %** = `((live_price - entry_price) / entry_price) * 100`

### Database Changes (Migration `007_live_pnl.sql`)

```sql
-- Add entry_price + live_price columns to screener_results
ALTER TABLE screener_results ADD COLUMN IF NOT EXISTS entry_price DECIMAL(15,2) DEFAULT 0;
ALTER TABLE screener_results ADD COLUMN IF NOT EXISTS live_price DECIMAL(15,2) DEFAULT 0;
ALTER TABLE screener_results ADD COLUMN IF NOT EXISTS pnl_pct DECIMAL(8,4) DEFAULT 0;

-- Add entry_price to watchlists for P&L tracking
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS entry_price DECIMAL(15,2) DEFAULT 0;
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS live_price DECIMAL(15,2) DEFAULT 0;
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS pnl_pct DECIMAL(8,4) DEFAULT 0;
```

### Backend Changes

| File | Change |
|------|--------|
| `server/kafka/consumer.go` → `persistMarketTick()` | After updating `stock_info`, also update `screener_results.live_price` and `watchlists.live_price` for tickers that match. Recompute `pnl_pct`. |
| `server/handlers/webhook.go` → `upsertScreenerResult()` | Set `entry_price = price` on INSERT (first signal). On UPDATE, keep `entry_price` unchanged, only update `live_price`. |
| `server/handlers/screener.go` | Return `entry_price`, `live_price`, `pnl_pct` in API response |
| `server/handlers/watchlist.go` | Include `entry_price`, `live_price`, `pnl_pct` in response. When adding to watchlist, set `entry_price` from current `stock_info.last_price`. |

### Frontend Changes

| File | Change |
|------|--------|
| All screener tables (BSJP, Swing, Scalping) | Show entry price, live price, and P&L % with green/red coloring |
| `WatchlistTable.jsx` | Show entry price, live price, P&L % column |
| WebSocket handler in `useScreener.js` | Also listen to `idx.ohlcv.enriched` to update live prices in real-time |

---

## Phase 3 — Screener UI Redesign (Swing & Scalping)

### Reference (dari gambar yang diberikan)

Desain referensi menunjukkan tabel dengan kolom-kolom berikut:

| No | Stock | Trade Info / News Tag | Last Price / Change (%) / Trade Done | Support / Resistance / Trade Plan / RR Ratio | Fair Value Gap / 3 Week Trend | Volume (Lot) / Value / Frequency | Bandar Movement / Average Price |
|----|-------|----------------------|--------------------------------------|----------------------------------------------|-------------------------------|-----------------------------------|--------------------------------|

### 3A. Swing Table Redesign

**Kolom baru**:
- **No** — row number
- **Stock** — Logo + Ticker + Name + Market Cap (ticker clickable → TradingView)
- **Trade Info** — Tanggal signal + entry price + detail link + news tags
- **Last Price** — Live price + Change % + "Trade Done" indicator
- **Trade Plan** — BID range, TP range, SL level
- **Support/Resistance** — S1, R1, RR Ratio
- **Fair Value Gap** — Visual bar chart (3 week trend)
- **Volume** — Lot, Value (Rp), Frequency
- **Bandar Movement** — Mini bar chart (3 Day/1 Day), Average buy/sell price

**Data source**: Most of this comes from `screener_results.payload` JSONB — we need the TradingView webhook to send richer payload data (TP, SL, support, resistance, fair value gap, etc).

### 3B. Scalping Table — Same Pattern

Similar to Swing but with additional real-time velocity indicators.

### 3C. TradingView Redirect

**Semua ticker link** akan mengarah ke:
```
https://www.tradingview.com/chart/?symbol=IDX:{TICKER}
```

Contoh: `MAPI` → `https://www.tradingview.com/chart/?symbol=IDX:MAPI`

**Implementation**:
```jsx
// Reusable TickerLink component
const TickerLink = ({ ticker }) => (
  <a
    href={`https://www.tradingview.com/chart/?symbol=IDX:${ticker}`}
    target="_blank"
    rel="noopener noreferrer"
    className="text-primary hover:underline font-bold"
  >
    {ticker}
  </a>
);
```

---

## Phase 4 — Watchlist V2

### Reference (dari gambar yang diberikan)

Desain menunjukkan tracking H+1 sampai H+7:

| No | Stock | Date | Price | Trading Setup | H+1 | H+2 | H+3 | H+4 | H+5 | H+6 | H+7 | Harga Jual | Gain Persen |
|----|-------|------|-------|---------------|-----|-----|-----|-----|-----|-----|-----|------------|-------------|

### Database Changes

```sql
-- New table for watchlist daily price tracking
CREATE TABLE IF NOT EXISTS watchlist_daily_prices (
    id BIGSERIAL PRIMARY KEY,
    watchlist_id UUID REFERENCES watchlists(id) ON DELETE CASCADE,
    day_offset INTEGER NOT NULL, -- 1 = H+1, 2 = H+2, etc.
    price DECIMAL(15,2) DEFAULT 0,
    recorded_at DATE NOT NULL,
    UNIQUE(watchlist_id, day_offset)
);

-- Add more fields to watchlists
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS category VARCHAR(20) DEFAULT 'WATCHLIST'; -- STRONG BUY, WATCHLIST
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS breakout_price DECIMAL(15,2) DEFAULT 0;
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS breakout_date DATE;
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS trading_setup TEXT DEFAULT '';
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS sell_price DECIMAL(15,2) DEFAULT 0;
```

### Backend Changes

- New endpoint: `GET /api/watchlist/daily-prices` — returns H+1 to H+7 prices
- New Go worker: `workers/watchlist_tracker.go` — runs at 15:30 WIB daily to capture closing prices and fill H+1...H+7
- `GET /api/watchlist` — enriched response with all new fields

### Frontend Changes

- Complete redesign of `WatchlistTable.jsx` to match reference
- Color-coded H+N cells (green if price > entry, red if below)
- Gain Persen column: `((sell_price - entry_price) / entry_price * 100)`

---

## Phase 5 — News Pipeline Fix

### 5A. Emiten-Only Filtering

**Problem**: News fetcher pulls semua jenis berita ekonomi, bukan hanya tentang emiten (saham).

**Fix**:
| File | Change |
|------|--------|
| `engine/data/news_fetcher.py` | Add emiten filter: only keep news that either (a) contains a valid ticker symbol in the title/description, OR (b) contains key stock-market keywords like "saham", "emiten", "IDX", "bursa", "IHSG", dll. |

```python
EMITEN_KEYWORDS = [
    'saham', 'emiten', 'idx', 'bursa', 'ihsg', 'bei',
    'right issue', 'ipo', 'dividen', 'buyback', 'akuisisi',
    'listing', 'delisting', 'suspend', 'tender offer',
    'stock split', 'reverse stock', 'rights issue',
]

def is_emiten_related(title, description=''):
    text = (title + ' ' + description).lower()
    # Has a known ticker?
    if extract_tickers_from_text(title):
        return True
    # Has emiten keywords?
    return any(kw in text for kw in EMITEN_KEYWORDS)
```

### 5B. Clickable News Source

**Problem**: News items don't redirect to the source when clicked.

**Fix**:
| File | Change |
|------|--------|
| `web/src/components/news/TopSentiment.jsx` | Wrap each news card in `<a href={news.link} target="_blank">` |
| `web/src/components/news/MarketDeepDive.jsx` | Same — make each news item clickable |
| `web/src/components/news/FeaturedNews.jsx` | Featured article clickable to source |

### 5C. Featured News — Fix Empty State

**Problem**: "No featured news available" displayed because the news table has no data or filter is too strict.

**Fix**: Ensure `news_fetcher.py` properly stores news and the `GetFeaturedNews` handler works. Add a fallback: if no featured news, show the latest news item.

---

## Phase 6 — AI Integration (Grok / xAI)

> **Sprint 7 status (postponed, prep-only)**: The actual AI calls are
> deferred until we confirm the production model. The earlier Groq plan
> below is retained for reference, but the working assumption is now
> `grok-4` (or the next verified Grok model at execution time) hosted by
> xAI. During Sprint 7 we only wire up the plumbing — env vars, handler
> stubs, rate limiter, circuit breaker, cache — so flipping the model
> flag later is a config change, not a rewrite.

### Model Selection (Sprint 7 decision)

| Use Case | Model (current default) | Notes |
|----------|-------------------------|-------|
| Screener Commentary (instant) | `grok-4` via xAI OpenAI-compatible endpoint | swap to a smaller model if latency > 2s in staging |
| News Sentiment Enhancement    | `grok-4`                                   | same endpoint, shared circuit breaker |
| Trade Analysis (deep)         | `grok-4`                                   | JSON mode on; tool-calling optional |
| Daily Market Report           | `grok-4`                                   | run at 15:45 WIB via schedule_worker |

`GROK_MODEL` env var controls the actual model id sent to the API so the
verified name (e.g. `grok-4-0709`, `grok-4-fast`, etc.) can be pinned at
deploy time without a code change.

### Architecture Decision (legacy Groq plan — kept for reference)

```
AI Service Layer (old Groq design — superseded by Grok/xAI above)
┌────────────────────────────────────────────┐
│  Groq Fast (llama-3.1-8b-instant)          │
│  → Instant responses (<2s)                 │
│  → Screener Commentary, News Sentiment     │
│                                            │
│  Groq Pro (llama-3.3-70b-versatile)        │
│  → Deep analysis (2-5s)                    │
│  → Trade Analysis, Daily Report            │
└────────────────────────────────────────────┘
```

### Model Selection Strategy (legacy)

| Use Case | Model | Latency | When to Run |
|----------|-------|---------|-------------|
| **Screener Commentary** — quick 1-liner insight per ticker signal | `llama-3.1-8b-instant` | <2s | Real-time on each new signal |
| **News Sentiment Enhancement** — improve keyword-based sentiment | `llama-3.1-8b-instant` | <2s | On each news fetch |
| **Trade Analysis** — TP/SL/setup quality score | `llama-3.3-70b-versatile` | 2-5s | On screener signal (async) |
| **Daily Market Report** — comprehensive market summary | `llama-3.3-70b-versatile` | 5-10s | 15:45 WIB daily |

### System Prompts

#### Screener Commentary (Instant)
```
You are SahamScreen AI, an expert Indonesian stock market analyst.

Given a stock ticker and its technical signal data, provide a concise 1-2 sentence
commentary in Bahasa Indonesia about the trading opportunity.

Rules:
- Be specific about the ticker and its current price action
- Reference the signal type (BSJP/Swing/Scalping)
- Mention key levels (support, resistance) if provided
- Use professional but accessible language
- Output ONLY the commentary, no headers or formatting
- Maximum 280 characters

Example:
Input: BBCA, Swing, BUY signal, price 9800, support 9650, resistance 10200
Output: "BBCA menunjukkan sinyal beli pada area support 9650 dengan target resistance 10200.
Volume naik 15% mengkonfirmasi momentum bullish jangka menengah."
```

#### Trade Analysis (Deep)
```
You are SahamScreen AI, a professional Indonesian stock market technical analyst.

Analyze the given stock data and provide a structured trade recommendation.

Input will contain:
- Ticker symbol and current OHLCV data
- Recent price history (up to 60 days)
- Current technical indicators (RSI, MACD, EMA, VWAP if available)
- Screener signal type and score

Provide analysis in JSON format:
{
  "verdict": "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL",
  "confidence": 0-100,
  "entry_zone": { "low": number, "high": number },
  "targets": [{ "price": number, "label": "TP1/TP2/TP3" }],
  "stop_loss": number,
  "risk_reward_ratio": "1:X.X",
  "support_levels": [number],
  "resistance_levels": [number],
  "key_factors": ["factor1", "factor2", "factor3"],
  "commentary_id": "1-2 sentence summary in Bahasa Indonesia",
  "timeframe": "intraday" | "swing (2-5 days)" | "positional (1-4 weeks)"
}

Rules:
- Base analysis on price action and volume, not speculation
- Always provide stop loss — max 3% below entry for scalping, 5% for swing
- RR ratio must be at least 1:1.5
- Be conservative with targets
- Consider IDX-specific patterns (lot-based trading, T+2 settlement)
```

#### Daily Market Report (Deep)
```
You are SahamScreen AI, generating the end-of-day market report for Indonesian stock
market (IDX / BEI) subscribers.

Input: Today's market summary including IHSG close, sector performance,
top gainers/losers, screener signals, notable news headlines.

Generate a comprehensive yet concise market report in Bahasa Indonesia with sections:
1. **Ringkasan Pasar** — IHSG performance, key drivers
2. **Sektor Unggulan** — Top performing sectors and why
3. **Top Picks Hari Ini** — Best signals from BSJP/Swing/Scalping screeners
4. **Sentimen Berita** — Impact of today's key news on market
5. **Outlook Besok** — What to watch tomorrow

Format in clean markdown. Keep total under 500 words.
```

### Implementation Plan

#### New Backend Service: `server/handlers/ai.go`

```go
// API endpoints:
// GET  /api/ai/commentary?ticker=BBCA&strategy=swing — instant commentary
// GET  /api/ai/analysis?ticker=BBCA — deep trade analysis
// GET  /api/ai/daily-report — today's market report
// POST /api/ai/analyze-news — enhance news sentiment (internal)
```

#### New Engine Worker: `engine/ai/groq_client.py`

```python
# Handles async AI calls:
# - Subscribes to idx.screener.updates Kafka topic
# - On new signal → call Groq Fast for commentary
# - At 15:45 WIB → call Groq Pro for daily report
# - Publishes results to idx.ai.insights Kafka topic
```

#### Environment Variables

New variables for the Sprint 7 scaffolding (actual calls still deferred):

```env
# xAI / Grok — used by server/internal/ai/grok_client.go
GROK_API_KEY=
GROK_API_URL=https://api.x.ai/v1/chat/completions
GROK_MODEL=grok-4
GROK_TIMEOUT_MS=8000
GROK_CACHE_TTL_SECONDS=120

# Per-user rate limit for /api/ai/* (see middleware.PerUserEndpointRateLimit)
AI_RATE_LIMIT_PER_MIN=20
AI_RATE_LIMIT_BURST=5

# Feature gate — leave false until the model decision is confirmed so the
# stub handlers reply with 503 instead of pretending the call succeeded.
AI_ENABLED=false
```

Legacy Groq variables (retained for the fallback plan):

```env
GROQ_API_KEY=REDACTED_API_KEY
GROQ_API_URL=https://api.groq.com/openai/v1/chat/completions
GROQ_FAST_MODEL=llama-3.1-8b-instant
GROQ_PRO_MODEL=llama-3.3-70b-versatile
```

---

## Phase 7 — Schedule-Aware Refresh Logic

### Refresh Schedule Per Strategy

| Strategy | Refresh Timing | Logic |
|----------|---------------|-------|
| **Swing** | 1× or 2× daily — End of Session 1 (12:00/11:30 Fri) + 15:30 WIB | Only refresh live prices at these times for performance check |
| **BSJP** | Session 2 start (13:30/14:00 Fri) + 15:30 WIB | BSJP signals only relevant late afternoon for next-day gap |
| **Scalping** | Real-time during market hours | Continuous live feed (every tick) |
| **Watchlist** | 15:30 WIB daily | Capture closing price for H+N tracking |

### Implementation

| File | Change |
|------|--------|
| `engine/data/fetcher.py` | Add schedule modes: `FETCH_MODE=continuous\|session_end\|daily` |
| New: `server/workers/schedule_worker.go` | Cron-like scheduler that triggers screener re-evaluation at specific WIB times |
| `server/kafka/consumer.go` | Add market-status guard to all persist functions |

```go
// server/workers/schedule_worker.go
func StartScheduleWorker() {
    go func() {
        for {
            now := time.Now().In(wibLoc)
            h, m := now.Hour(), now.Minute()

            switch {
            case h == 12 && m == 0:  // End Session 1 (Mon-Thu)
                triggerSwingRefresh()
            case h == 11 && m == 30: // End Session 1 (Friday)
                if now.Weekday() == time.Friday {
                    triggerSwingRefresh()
                }
            case h == 13 && m == 30: // Start Session 2
                triggerBSJPRefresh()
            case h == 15 && m == 30: // Pre-close
                triggerSwingRefresh()
                triggerBSJPRefresh()
                triggerWatchlistSnapshot()
            }

            time.Sleep(1 * time.Minute)
        }
    }()
}
```

---

## Execution Order & Dependencies

```
Phase 1 - Dashboard Fixes
  [May 12] 1A Sector Heatmap fix
  [May 12] 1B IHSG change_pct fix
  [May 13] 1C Market-hours fetch guard

Phase 2 - Live P&L                        Phase 5 - News Fix
  [May 14] DB migration 007                 [May 14] Emiten filter
  [May 15-16] Backend P&L logic             [May 15] Clickable links
  [May 17] Frontend P&L display             [May 16] Featured news fix

Phase 3 - Screener Redesign
  [May 18] TickerLink component
  [May 19-20] Swing table redesign
  [May 21-22] Scalping table redesign
  [May 23] BSJP table redesign

Phase 7 - Scheduling                      Phase 4 - Watchlist V2
  [May 18-19] Schedule worker                [May 24-25] DB migration + API
  [May 20] Strategy-specific timers          [May 26-27] Frontend redesign
                                             [May 28] Daily tracker worker

Phase 6 - AI (Groq)
  [May 29] Groq client setup
  [May 30] System prompts
  [May 31-Jun 01] Screener commentary
  [Jun 02-03] Daily report
```

---

## Files to Create / Modify Summary

### New Files
| File | Purpose |
|------|---------|
| `server/migrations/007_live_pnl.sql` | P&L columns + watchlist V2 schema |
| `server/handlers/ai.go` | AI endpoints (Groq commentary, analysis, report) |
| `server/workers/schedule_worker.go` | WIB-aware cron scheduler |
| `engine/ai/groq_client.py` | Groq API client + Kafka integration |
| `web/src/components/ui/TickerLink.jsx` | Reusable TradingView redirect component |
| `web/src/components/swing/SwingTableV2.jsx` | Full redesign of Swing table |
| `web/src/components/scalping/ScalpingTableV2.jsx` | Full redesign of Scalping table |
| `web/src/components/watchlist/WatchlistTableV2.jsx` | H+1 to H+7 tracking table |

### Modified Files
| File | Change Summary |
|------|---------------|
| `server/kafka/consumer.go` | Fix IHSG overwrite, add live P&L updates, market-hours guard |
| `server/handlers/screener.go` | Return entry_price, live_price, pnl_pct |
| `server/handlers/watchlist.go` | Enrich with P&L and daily tracking |
| `server/handlers/market.go` | Minor — no overwrite of IHSG data |
| `server/main.go` | Register new AI routes, start schedule worker |
| `engine/data/fetcher.py` | Market-hours check, timezone awareness |
| `engine/data/news_fetcher.py` | Emiten-only filter |
| `web/src/components/dashboard/SectorHeatmap.jsx` | Format change_pct to 2 decimal places |
| `web/src/hooks/useScreener.js` | Include P&L fields in WS updates |
| `web/src/components/news/*.jsx` | Clickable links to source |
| `web/src/services/screenerService.js` | Add AI commentary endpoints |
| `docker-compose.yml` | Add GROQ env vars, possibly new ai-worker service |

---

## Environment Variables to Add

```env
# Groq AI
GROQ_API_KEY=REDACTED_API_KEY
GROQ_FAST_MODEL=llama-3.1-8b-instant
GROQ_PRO_MODEL=llama-3.3-70b-versatile

# Schedule
SWING_REFRESH_TIMES=12:00,15:30
BSJP_REFRESH_TIMES=13:30,15:30
```

---

## Lock Decision Matrix: 8 Keputusan Teknis Default

Konfirmasi 8 default di bawah. Untuk setiap default yang berbeda dari preferensi kamu, sebutkan nomor + pilihan baru. Setelah lock, semua unit kerja berikutnya akan mengacu ke decision ini tanpa re-ask.

1. **API Provider & Key**: Menggunakan **Groq** API dengan key `REDACTED_API_KEY`.
2. **TradingView Webhook Payload**: Karena data aslinya sudah ada cuman masih salah, Backend Go akan bertugas melakukan kalkulasi/koreksi mandiri atau memvalidasi/memperbaiki data TP/SL/Support/Resistance dari webhook tersebut sebelum diolah.
3. **Watchlist Entry Price**: Otomatis mengambil dari harga `last_price` saat ticker dimasukkan ke watchlist.
4. **Urutan Eksekusi (Phase)**: Mulai dari Phase 1 (Dashboard Fixes) secara sekuensial.
5. **AI Models**: `llama-3.1-8b-instant` untuk task seketika (komentar/sentimen) dan `llama-3.3-70b-versatile` untuk task berat (analisis mendalam & report).
6. **Market-Hours Scheduler**: Fetching data otomatis di-pause di luar jam bursa (16:15 - 08:45 WIB) dan saat akhir pekan.
7. **News Pipeline Filter**: Menggunakan filter keyword (emiten, saham, dll) dan ekstraksi ticker di Python fetcher.
8. **UI Component Styling**: Menggunakan Tailwind CSS standar yang sudah ada tanpa tambahan library UI baru, memastikan konsistensi desain yang sudah berjalan.


---

## 12-Unit Work Timeline (21 effective working days)

This section captures the execution plan the team aligned on at the start of
Sprint 7 Day 21. It overlays the 7 Phases above onto 12 concrete "Units" —
small enough to review, ship, and feature-flag independently — and states
the dependency graph so sequencing decisions are explicit.

### Unit Map

| Unit | Scope | Sprint | Days | Primary Files | Depends on |
|------|-------|--------|------|---------------|------------|
| 0 | Decision lock (this doc + 8-default matrix) | Prep | D0 | `PLAN_V2.md` | — |
| 1 | Dashboard fixes: IHSG change_pct + SectorHeatmap formatting | 1 (Day 1–2) | 2 | `server/kafka/consumer.go`, `web/src/components/dashboard/SectorHeatmap.jsx` | 0 |
| 2 | Market-hours guard in engine + Go consumer | 1 (Day 3) | 1 | `engine/data/fetcher.py`, `server/kafka/consumer.go` | 1 |
| 3 | `markethours` module + holiday calendar + `IsMarketOpen` unit tests | 1 (Day 4) | 1 | `server/internal/markethours/` | 2 |
| 4 | Live P&L schema + screener/watchlist enrichment | 2 (Day 5–7) | 3 | `server/migrations/007_live_pnl.sql`, `server/handlers/screener.go`, `server/handlers/watchlist.go`, `server/kafka/consumer.go` | 3 |
| 5 | News pipeline: emiten filter + clickable source + featured fallback | 3 (Day 8) | 1 | `engine/data/news_fetcher.py`, `web/src/components/news/*.jsx` | 1 |
| 6 | Watchlist V2 schema + daily snapshot worker + sell_price PATCH | 4 (Day 9–10) | 2 | `server/migrations/009_watchlist_v2.sql`, `server/handlers/watchlist.go`, `server/workers/watchlist_tracker.go`, `web/src/components/watchlist/WatchlistTable.jsx` | 3, 4 |
| 7 | Screener V2 tables (Swing / Scalping / BSJP) + reusable cells + bandar batch | 5 (Day 11–14) | 4 | `web/src/components/screener/*`, `web/src/components/{swing,scalping,bsjp}/…V2.jsx`, `server/handlers/bandar.go`, `server/handlers/news.go` | 4 |
| 8 | Cron schedule worker + `idx.screener.refresh` topic | 6 (Day 15–16) | 2 | `server/workers/schedule_worker.go`, `server/main.go`, `server/go.mod` | 3 |
| 9 | AI scaffolding (handler stubs, Grok client skeleton, rate limit, env wiring) | 7 (Day 17–20) | 4 | `server/handlers/ai.go`, `server/internal/ai/grok_client.go`, `server/middleware/middleware.go`, `.env.example`, `docker-compose.yml` | 8 |
| 10 | Observability: counters in consumer + handlers, `/api/health` payload upgrade | 7 (Day 21) | 0.5 | `server/kafka/consumer.go`, `server/handlers/watchlist.go`, `server/main.go` | 4, 6, 7, 8, 9 |
| 11 | Test pass: Go unit tests, Vite build gate, `scripts/smoke_test.sh`, `DEPLOYMENT.md` | 7 (Day 21) | 0.5 | `server/**/*_test.go`, `scripts/smoke_test.sh`, `DEPLOYMENT.md`, `web/.env.example` | 10 |

Total calendar effort: 21 working days. Units 10 and 11 fit inside the same
Day-21 window because the counter wiring (U10) is a prerequisite for the
smoke-test assertions (U11).

### Dependency Graph (ASCII DAG)

```
                 0 (decision lock)
                  │
                  ▼
                 1 (dashboard fixes) ──────────┐
                  │                             │
                  ▼                             ▼
                 2 (market-hours guard)        5 (news pipeline)   ← parallel with 2/3
                  │
                  ▼
                 3 (markethours module + tests)
                  │
      ┌───────────┼───────────┐
      ▼           ▼           ▼
      4 (P&L)    8 (schedule) 6 (watchlist V2) ← 6 also waits on 4
                  │                │
                  ▼                │
                  9 (AI scaffold)  │
                                   │
      4 ──────────▶ 7 (screener V2 tables, parallel-safe with 6/8/9)
                                           │
                                           ▼
                                          10 (observability)
                                           │
                                           ▼
                                          11 (tests + smoke + docs)
```

The critical path is `0 → 1 → 2 → 3 → 4 → 6 → 10 → 11` (11 working days).
Everything else can run in parallel with something on that path.

### Resource-Plan Options

The same DAG can be completed by different team sizes. Pick one before
starting Unit 1.

#### Option A — 1 developer sequential (21 days)

Execute units in topological order: `1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10
→ 11`. Each unit is wrapped by its own feature flag so the `main` branch
stays deployable after every merge. Recommended default because it matches
the feature-flag rollout ladder in `DEPLOYMENT.md` without scheduling
headaches.

#### Option B — 2 developers parallel (13–14 days)

Split along the DAG into two tracks:

| Track | Dev | Units | Notes |
|-------|-----|-------|-------|
| Backend / data | Dev A | 1 → 2 → 3 → 4 → 6 → 8 → 10 | Owns migrations + consumer + cron + counters |
| Frontend / AI | Dev B | 5 → 7 → 9 → 11 | Waits on Unit 4 merge before starting Unit 7; AI client (U9) is isolated so it can start earlier |

Daily 15-minute sync keeps the shared files (`server/main.go`,
`web/.env.example`, `DEPLOYMENT.md`) from colliding. Each track still
merges behind its own feature flag so either developer can revert
independently.

### Confirmation Checklist (Unit 0 → Unit 1 gate)

Before kicking off Unit 1, confirm all eight defaults from the **Lock
Decision Matrix** above. Any item that needs to deviate from the listed
default must be flagged by number (e.g. "5: use Grok-4 instead of Groq")
and will propagate to the affected units automatically:

- Decision 1 → Units 9, 11
- Decision 2 → Units 4, 7
- Decision 3 → Units 4, 6
- Decision 4 → whole sequence (overrides this timeline)
- Decision 5 → Unit 9 (model id comes from `GROK_MODEL` env var)
- Decision 6 → Units 2, 3, 6, 8
- Decision 7 → Unit 5
- Decision 8 → Unit 7

> **Update (Sprint 7 Day 21)**: Decisions 1 and 5 have since shifted to
> Grok-4 via xAI — see the "Sprint 7 status" call-out at the top of
> Phase 6. No other decision was reopened.

### Pre-flight (Unit 0 exit criteria)

Before the first commit on Unit 1, confirm:

1. **Postgres backup** — snapshot the `pgdata` volume so migration 007 and
   009 are reversible by volume restore if something slips through review.

   ```bash
   # Docker Compose setup (default in this repo).
   docker compose stop postgres
   docker run --rm \
     -v $(pwd)/pgdata:/var/lib/postgresql/data:ro \
     -v $(pwd)/backups:/backup \
     alpine \
     tar czf /backup/pgdata-pre-plan-v2-$(date +%F).tgz -C / var/lib/postgresql/data
   docker compose start postgres
   ```

2. **Staging environment** — a separate docker-compose stack (e.g.
   `docker-compose.staging.yml` or a second `.env` with a different
   `POSTGRES_PASSWORD` and host ports) so each Unit can be smoke-tested
   against production-shaped data before it reaches the live API. The
   staging stack MUST run the `db-migrator` container so migration 007 and
   009 are exercised end-to-end.

3. **TradingView payload access** — every developer in the rotation must
   have read access to `infra/tradingview/scalping.pine` (the Pine source
   that emits the webhook) and `infra/tradingview/PAYLOAD_CONTRACT.md` (the
   canonical field list the Go webhook handler validates against). Unit 4
   and Unit 7 both consume the enriched payload; a drift between the Pine
   script and the handler is the single most likely source of silent
   production breakage, so the contract doc must be the source of truth
   during code review.

Once the three pre-flight items are green and the eight decisions are
locked, Unit 1 is cleared to start.


---

## Backlog

### Integrate IDX broker summary feed (precondition for broker widgets)

**Context.** A Sprint 7 hygiene pass discovered that the BSJP
`engine/streaming/screener_consumer.py` was stamping a hard-coded
`top_brokers: ['YP', 'CC']` placeholder onto every signal payload. The
value looked real in the UI and misled users into thinking those broker
codes were actually accumulating the ticker. The field has been removed
and the dependent UI widgets now render an explicit
"Broker data unavailable" empty state.

**Why this is backlog, not blocking.** IDX broker-summary data is not part
of the free Yahoo Finance feed; accessing it requires either a licensed
IDX Level-2 data contract or a scraper against the official broker
activity page. Both paths require legal / vendor sign-off before code
can ship.

**Definition of done.**

- [ ] New engine process (or extension of `engine/streaming/bandar_consumer.py`)
      emits `top_buyers` / `top_sellers` arrays on the
      `idx.bandar.flow` Kafka topic, sourced from a licensed broker
      summary feed.
- [ ] `engine/screeners/bandar_analysis.py` enriches its output with the
      same fields so both real-time flow and derived accumulation signals
      carry broker codes.
- [ ] BSJP screener opts in to emitting a `top_brokers` payload field
      again — this time with data pulled from the feed and verified
      against an IDX reference export.
- [ ] Frontend (`web/src/components/bsjp/BandarActivity.jsx`,
      `web/src/pages/StockDetail.jsx`) adds a dedicated broker-level
      widget alongside the existing accumulation widget. The Sprint-7
      hygiene pass already deleted the misleading
      `web/src/components/bsjp/BrokerActivity.jsx` component; the new
      widget must not regress to the same "subscribe to a never-emitted
      field" pattern — add an integration test that asserts the WS
      payload actually carries broker codes before rendering.
- [ ] Integration test that asserts the payload shape matches the
      broker-codes schema, so this class of bug cannot regress.

**Blockers.** Legal review of the data-licensing path. Until that
clears, keep the widgets in the unavailable state — a visible empty
message is strictly better than fabricated broker codes.


### Implement broker summary aggregation (bandar_flow avg_buy_price / avg_sell_price)

**Context.** The Sprint-5 `BandarMovementCell` briefly displayed
"Buy / Sell" price pair derived from `close_position × ±0.5%`. That
produced a plausible-looking average bid/ask pair out of a single scalar
that had nothing to do with broker flow. The fabricated numbers were
removed in the Sprint-7 hygiene pass and the cell now shows the real
`vol_ratio` and `mfi` fields from the `bandar_flow` schema. Re-enabling
a "Buy vs Sell average" display requires actual broker-side aggregation.

**Why this is backlog, not blocking.** Same root cause as the
"Integrate IDX broker summary feed" entry above: IDX broker-summary data
is not part of the free Yahoo Finance feed. Without that feed we cannot
aggregate broker-code weighted averages.

**Definition of done.**

- [ ] Migration adds `avg_buy_price DECIMAL(15,2)` and
      `avg_sell_price DECIMAL(15,2)` columns to `bandar_flow`.
- [ ] `engine/streaming/bandar_consumer.py` populates both columns from
      the broker-summary feed (weighted average of lots bought vs sold,
      per ticker per session).
- [ ] `server/handlers/bandar.go` (`GetBandarFlow`,
      `GetBandarFlowBatch`, and the `BandarFlowResult` struct) surface
      the two new fields in the JSON response.
- [ ] `web/src/components/screener/BandarMovementCell.jsx` replaces the
      current "Vol Ratio / MFI" row with a proper "Buy / Sell" row
      driven by the new fields, keeping the real indicators accessible
      via a hover tooltip or secondary row.
- [ ] Regression test that asserts the cell never falls back to
      synthesising a price from `close_position` so this class of bug
      cannot return by accident.

**Blockers.** Same IDX data-licensing review as the broker-summary feed
entry.


### Implement server-side screener filter parameters

**Context.** The Sprint-3 redesign shipped filter dropdowns on the Swing
(`timeframe`, `indicator`, `sector`, `corp_action`) and Scalping
(`minVol`, `minFreq`, `maxSpread`) pages. Post-ship review found that
the wiring was a UX lie:

- Swing's `filteredData.filter(...)` had an explicit `// mock logic for
  others` comment and only handled a single `indicator === 'rsi_oversold'`
  branch as a substring match on the free-form `signal` label.
- Scalping's filter function consulted only `minVol`; the `minFreq` and
  `maxSpread` dropdowns were rendered but never read.

The Sprint-7 hygiene pass removed the non-functional dropdowns and the
client-side filter function so the tables now show whatever the server
actually screens. The proper fix is to push filtering to the backend.

**Definition of done.**

- [ ] `GET /api/screener/{strategy}` accepts optional query parameters:
      `timeframe`, `indicator`, `sector`, `corp_action`, `min_volume`,
      `min_frequency`, `max_spread`. Unknown params are ignored, not
      errored, so old clients keep working.
- [ ] `server/handlers/screener.go` translates each accepted param into
      a `WHERE` / `ORDER BY` clause against `screener_results` +
      `stock_info`. The `signal` label column keeps its free-form shape
      but a new `screener_results.indicators JSONB` (or equivalent)
      captures machine-readable indicator hits so the filter does not
      regress to substring matching.
- [ ] Swing and Scalping pages reintroduce their filter UIs, now
      feeding the values into `useScreener(strategy, filters)` so the
      fetch URL carries the params. `useScreener` needs a small refactor
      to re-fetch on filter change + debounce.
- [ ] Integration test asserting that `?indicator=rsi_oversold` returns
      only rows whose `indicators` JSONB contains an RSI-oversold entry,
      guarding against a regression back to client-side substring match.
- [ ] README / in-app tooltip documents the filter semantics so users
      know the filter runs server-side (and therefore, for example,
      cannot filter rows that were never emitted by the screener in the
      first place).
