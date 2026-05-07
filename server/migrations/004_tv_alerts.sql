-- server/migrations/004_tv_alerts.sql
-- TradingView webhook alerts: audit trail of every alert received from TV.
-- Webhook handler also UPSERTs into screener_results so the existing UI/WS
-- pipeline continues to work without changes.

CREATE TABLE IF NOT EXISTS tv_alerts (
    id           BIGSERIAL PRIMARY KEY,
    alert_id     VARCHAR(64),
    ticker       VARCHAR(20) NOT NULL,
    strategy     VARCHAR(20) NOT NULL,
    signal       VARCHAR(20),
    score        INTEGER,
    price        DECIMAL(15,2),
    payload      JSONB NOT NULL,
    received_at  TIMESTAMPTZ DEFAULT NOW(),
    processed    BOOLEAN DEFAULT FALSE
);

-- Idempotency: same alert_id+ticker+strategy is treated as duplicate.
-- alert_id may be empty when TV does not template it, so we also keep a hash
-- index on the payload time field for those cases.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tv_alerts_unique
    ON tv_alerts(alert_id, ticker, strategy)
    WHERE alert_id IS NOT NULL AND alert_id <> '';

CREATE INDEX IF NOT EXISTS idx_tv_alerts_ticker_time
    ON tv_alerts(ticker, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_tv_alerts_strategy_time
    ON tv_alerts(strategy, received_at DESC);

-- Mark screener_results entries that came from TradingView so we can
-- distinguish them from engine-screener output during the migration window.
ALTER TABLE screener_results
    ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'engine';
