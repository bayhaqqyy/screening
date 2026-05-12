# TradingView Webhook Payload Contract

> **Phase 3 reference** — every field listed here is either already
> sent by the Pine script today (✅) or planned for Phase 3 (🔜).
> The Go handler (`server/handlers/webhook.go`) must accept and persist
> all ✅ fields verbatim; 🔜 fields will be added in future Pine
> revisions and must be forward-compatible (unknown keys are preserved
> in the JSONB `payload` column and must not cause a 400 error).

---

## 1. Top-level Webhook Body

Sent as `application/json` to:

```
POST https://<host>/api/webhooks/tradingview/<PATH_TOKEN>
```

| Field        | Type    | Required | Notes                                                                 |
| ------------ | ------- | -------- | --------------------------------------------------------------------- |
| `secret`     | string  | optional | Body-level auth token; compared against `TV_WEBHOOK_SECRET` env var  |
| `alert_id`   | string  | optional | TradingView `strategy.order.id`; synthesized if absent               |
| `ticker`     | string  | ✅        | Raw symbol, may carry exchange prefix (`IDX:BBCA`). Stripped server-side |
| `exchange`   | string  | ✅        | Exchange prefix, e.g. `IDX`                                          |
| `interval`   | string  | ✅        | TradingView timeframe string, e.g. `"5"`, `"D"`, `"W"`              |
| `strategy`   | string  | ✅        | One of `bsjp`, `swing`, `scalping` (case-insensitive)               |
| `signal`     | string  | ✅        | `STRONG_BUY`, `BUY`, `SELL`, `WATCH`, etc.                          |
| `price`      | float64 | ✅        | Close price at alert time (must be > 0)                              |
| `open`       | float64 | ✅        | Bar open                                                             |
| `high`       | float64 | ✅        | Bar high                                                             |
| `low`        | float64 | ✅        | Bar low                                                              |
| `volume`     | float64 | ✅        | Bar volume                                                           |
| `score`      | int     | ✅        | Conviction score 0–100 (clamped server-side; default 70)            |
| `target`     | float64 | ✅        | Take-profit price; defaults to `price × 1.05` if omitted            |
| `stop_loss`  | float64 | ✅        | Stop-loss price; defaults to `price × 0.97` if omitted              |
| `time`       | string  | ✅        | ISO-8601 UTC alert time `"2025-01-15T09:30:00+0000"`                |
| `rsi`        | float64 | 🔜        | RSI(14) value at alert time (scalping only)                          |
| `vwap`       | float64 | 🔜        | VWAP at alert time                                                   |
| `atr`        | float64 | 🔜        | ATR(14) — used by Phase 3 TP/SL auto-sizing                         |
| `ma20`       | float64 | 🔜        | 20-period moving average                                             |
| `ma50`       | float64 | 🔜        | 50-period moving average                                             |
| `ema9`       | float64 | 🔜        | EMA(9) — scalping momentum filter                                    |

---

## 2. `screener_results.payload` JSONB Shape

After `enrichPayload` runs (server-side enrichment), the persisted JSONB
object contains **both** the raw TV fields and the server-computed fields.

```jsonc
{
  // ── Raw TradingView fields ──────────────────────────────────────────
  "price":       9250,
  "entry_price": 9250,   // frozen on first insert; never overwritten
  "target":      9712.5,
  "stop_loss":   8972.5,
  "volume":      18500000,
  "open":        9100,
  "high":        9300,
  "low":         9050,
  "interval":    "D",
  "exchange":    "IDX",
  "alert_id":    "syn-a1b2c3d4e5f6a7b8-1747123200",
  "alert_time":  "2025-05-13T09:00:00+0000",
  "source":      "tradingview",

  // ── Phase 3: server-computed enrichment (ta/levels.go) ─────────────
  "support":     8800,    // nearest daily support (ComputeSupportResistance)
  "resistance":  9500,    // nearest daily resistance
  "fvg_bullish": true,    // bullish Fair Value Gap present? (ComputeFVG)
  "fvg_high":    9150,    // top of FVG zone
  "fvg_low":     9000,    // bottom of FVG zone
  "trend_3w":    "UP"     // 3-week trend direction: UP | DOWN | SIDEWAYS (ComputeTrend3W)
}
```

---

## 3. Idempotency / Deduplication

| Situation                              | Behaviour                                       |
| -------------------------------------- | ----------------------------------------------- |
| `alert_id` present & already in DB    | `ON CONFLICT DO NOTHING` → HTTP 200 `duplicate` |
| `alert_id` absent                      | synthetic id `syn-<16hex>-<unix-bucket>` (1-min) |
| Same ticker/strategy, new bar          | UPDATE `screener_results` (except locked BSJP)  |
| BSJP row with `is_locked = true`       | Skip UPDATE; entry price is frozen              |

---

## 4. WebSocket Broadcast Envelope

After a successful upsert, the server broadcasts over WS:

```jsonc
{
  "topic": "idx.screener.updates",
  "key":   "BBCA",
  "data": {
    "ticker":    "BBCA",
    "strategy":  "swing",
    "signal":    "BUY",
    "score":     85,
    "payload": { /* same shape as §2 */ },
    "source":    "tradingview",
    "timestamp": "2025-05-13T09:00:01Z"
  }
}
```

---

## 5. Pine Script Compliance Checklist

Before deploying a new or updated Pine script:

- [ ] `_strategy` constant matches one of `bsjp | swing | scalping`
- [ ] `buildPayload` includes all ✅ fields in §1
- [ ] `alert_id` uses `str.tostring(time)` or `strategy.order.id`
- [ ] `time` field formatted as `yyyy-MM-dd'T'HH:mm:ssZ`
- [ ] Webhook URL ends with the correct `PATH_TOKEN`
- [ ] Alert frequency set to `alert.freq_once_per_bar_close`
- [ ] 🔜 fields added when the Pine script is updated for Phase 3

---

## 6. Phase 3 Enrichment Pipeline (Planned)

```
TradingView  ──POST──▶  webhook.go::TradingViewWebhook
                              │
                              ▼
                         normalizeAlert()
                              │
                              ▼
                         enrichPayload()          ◀── ta/levels.go
                         ├─ ComputeSupportResistance(ticker, db)
                         ├─ ComputeFVG(ticker, db)
                         └─ ComputeTrend3W(ticker, db)
                              │
                              ▼
                         upsertScreenerResult()
                              │
                              ▼
                         broadcastScreenerUpdate()
```

`enrichPayload` is a **best-effort** step: if the DB query fails or the
ticker has no historical OHLCV data, the raw TV payload is persisted
unchanged and a warning is logged. The webhook never returns 5xx solely
because enrichment failed.
