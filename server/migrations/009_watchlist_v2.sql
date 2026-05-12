-- server/migrations/009_watchlist_v2.sql
--
-- Sprint 4 — Watchlist V2 schema.
--
-- Adds the columns required by the new watchlist UI (entry/live price + P&L,
-- trading setup notes, breakout metadata, sell price, and a H+1..H+7 daily
-- price tracking table populated by workers.SnapshotWatchlistDaily).
--
-- Written idempotently so the db-migrator replays it safely.

-- ---------------------------------------------------------------------------
-- watchlists — extra metadata for the V2 UI.
-- ---------------------------------------------------------------------------
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS category       VARCHAR(20)    DEFAULT 'WATCHLIST'; -- 'STRONG BUY' | 'WATCHLIST'
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS entry_price    DECIMAL(15,2)  DEFAULT 0;
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS live_price     DECIMAL(15,2)  DEFAULT 0;
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS pnl_pct        DECIMAL(8,4)   DEFAULT 0;
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS breakout_price DECIMAL(15,2)  DEFAULT 0;
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS breakout_date  DATE;
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS trading_setup  TEXT           DEFAULT '';
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS sell_price     DECIMAL(15,2)  DEFAULT 0;
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS entry_date     DATE           DEFAULT CURRENT_DATE;

-- Pre-seed entry_date for rows that existed before this migration ran so the
-- H+N tracker has a stable anchor to compute offsets against.
UPDATE watchlists
   SET entry_date = COALESCE(entry_date, added_at::date, CURRENT_DATE)
 WHERE entry_date IS NULL;

-- ---------------------------------------------------------------------------
-- watchlist_daily_prices — one row per (watchlist_id, day_offset).
--
-- day_offset = 1..7 represents H+1..H+7 trading days (weekends/holidays
-- skipped — see markethours.TradingDaysBetween). Filled by the
-- SnapshotWatchlistDaily worker at 15:30 WIB each trading day, and
-- back-filled by BackfillWatchlistMissingSnapshots on boot.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS watchlist_daily_prices (
    id           BIGSERIAL   PRIMARY KEY,
    watchlist_id UUID        NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
    day_offset   INTEGER     NOT NULL CHECK (day_offset BETWEEN 1 AND 7),
    price        DECIMAL(15,2) DEFAULT 0,
    recorded_at  DATE        NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (watchlist_id, day_offset)
);

CREATE INDEX IF NOT EXISTS idx_wdp_watchlist ON watchlist_daily_prices(watchlist_id);
CREATE INDEX IF NOT EXISTS idx_wdp_recorded  ON watchlist_daily_prices(recorded_at DESC);
