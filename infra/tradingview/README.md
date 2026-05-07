# TradingView Webhook Integration

SahamScreen consumes signals (BSJP / Swing / Scalping) from TradingView alerts
instead of computing them locally with yfinance + Python. This directory
holds:

- `alert-template.json` — JSON body to paste into the TradingView alert
  **Message** box.
- `scalping.pine` — starter Pine Script v5 strategy that emits the JSON the
  Go webhook expects. Adapt freely for BSJP and Swing.

## How the flow works

```
TradingView alert
   │  (HTTPS POST, JSON body)
   ▼
https://webhook.bayhaqqy.my.id/api/webhooks/tradingview/<TOKEN>
   │  (Cloudflare Tunnel)
   ▼
sahamscreen-server (Go)  →  tv_alerts (audit)  →  screener_results (UPSERT)
                                                  │
                                                  ▼
                                          WebSocket broadcast → React UI
```

## Configuring an alert

1. Open the chart for the ticker you want to track (e.g. `IDX:BBCA`).
2. Apply your indicator / strategy (see `scalping.pine` for a starter).
3. Click the alarm icon → **Create Alert**.
4. **Condition**: choose the indicator + the specific signal (e.g. "Strategy:
   Long Entry").
5. **Trigger**: `Once Per Bar Close` (recommended, avoids repaint noise).
6. **Notifications → Webhook URL**:
   ```
   https://webhook.bayhaqqy.my.id/api/webhooks/tradingview/<TV_WEBHOOK_PATH_TOKEN>
   ```
7. **Message**: paste the JSON from `alert-template.json` and customise the
   `strategy` and (optionally) `signal`/`score` for this alert.

The webhook handler accepts only:

| Field      | Required | Notes |
|------------|----------|-------|
| `secret`   | If `TV_WEBHOOK_SECRET` is set | Validated server-side |
| `ticker`   | yes | `{{ticker}}` template; exchange prefix like `IDX:` is stripped |
| `strategy` | yes | One of `bsjp`, `swing`, `scalping` |
| `signal`   | no  | `STRONG_BUY` \| `BUY` \| `WATCH` \| `NEUTRAL` \| `SELL` (defaults to `WATCH`) |
| `price`    | yes | Must be > 0 |
| `score`    | no  | 0..100 (defaults to 70) |
| `target`   | no  | Defaults to `price * 1.05` |
| `stop_loss`| no  | Defaults to `price * 0.97` |
| `volume`, `open`, `high`, `low`, `interval`, `exchange`, `time`, `alert_id` | no | Stored in audit payload |

Anything else you put in the JSON is preserved verbatim in `tv_alerts.payload`
for later inspection.

## Multi-strategy / multi-ticker on Premium

On TradingView Premium you can fire **one alert per Pine Script strategy per
ticker**. To cover the IDX universe across BSJP, Swing, and Scalping:

- Create one alert per (ticker, strategy) pair, **or**
- Use a single Pine Script that publishes multiple `alertcondition()` lines
  and create one alert per condition, **or**
- Use TradingView's **Screener alerts** (Premium) — fires one webhook per
  ticker that matches a screener filter — set `strategy` in the JSON to the
  appropriate value.

The Go handler is idempotent on `(alert_id, ticker, strategy)` when the
Pine Script populates `alert_id`, so duplicate fires from TradingView retries
are safe.

## Pine Script: scalping starter

`scalping.pine` is a self-contained Pine v5 strategy that:

- Uses RSI(14) + VWAP for entries (mirrors the Python `run_scalping` logic
  in `engine/streaming/screener_consumer.py`).
- Emits a JSON body matching `alert-template.json` via the
  `alert()` function — so a single alert "Any alert() function call" covers
  all entry signals.

To use it:

1. Pine Editor → New → paste contents of `scalping.pine` → **Save** &
   **Add to chart**.
2. Create alert:
   - Condition: the script you just added, "Any alert() function call".
   - Webhook URL: the tunnel URL above.
   - **Leave the Message blank** — `scalping.pine` builds the JSON itself
     with `alert(... )`.

For BSJP and Swing, copy the same pattern: change the entry rule and set the
`strategy` field accordingly.
