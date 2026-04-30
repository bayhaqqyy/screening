-- server/migrations/002_production_tables.sql
-- Production tables for live data

-- News persistence (from Kafka)
CREATE TABLE IF NOT EXISTS news (
    id           BIGSERIAL PRIMARY KEY,
    title        TEXT NOT NULL,
    link         TEXT UNIQUE NOT NULL,
    source       VARCHAR(100),
    sentiment    VARCHAR(20),
    sentiment_cls VARCHAR(100),
    dot_cls      VARCHAR(100),
    tags         TEXT,
    description  TEXT,
    image_url    TEXT,
    published_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_news_created ON news(created_at DESC);

-- Stock info cache (from yfinance)
CREATE TABLE IF NOT EXISTS stock_info (
    ticker       VARCHAR(10) PRIMARY KEY,
    name         VARCHAR(200),
    sector       VARCHAR(100),
    industry     VARCHAR(100),
    market_cap   BIGINT DEFAULT 0,
    prev_close   DECIMAL(15,2) DEFAULT 0,
    last_price   DECIMAL(15,2) DEFAULT 0,
    change_pct   DECIMAL(8,4) DEFAULT 0,
    volume       BIGINT DEFAULT 0,
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stock_sector ON stock_info(sector);

-- Corporate events
CREATE TABLE IF NOT EXISTS corporate_events (
    id          BIGSERIAL PRIMARY KEY,
    ticker      VARCHAR(10) NOT NULL,
    event_type  VARCHAR(50) NOT NULL,
    title       TEXT NOT NULL,
    description TEXT,
    event_date  DATE NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_date ON corporate_events(event_date ASC);

-- Market overview cache
CREATE TABLE IF NOT EXISTS market_overview (
    id          SERIAL PRIMARY KEY,
    index_value DECIMAL(15,2) DEFAULT 0,
    change_pct  DECIMAL(8,4) DEFAULT 0,
    volume      BIGINT DEFAULT 0,
    valuation   BIGINT DEFAULT 0,
    foreign_flow BIGINT DEFAULT 0,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
-- Seed a row
INSERT INTO market_overview (index_value, change_pct, volume, valuation, foreign_flow)
VALUES (0, 0, 0, 0, 0)
ON CONFLICT DO NOTHING;

-- Sector performance cache
CREATE TABLE IF NOT EXISTS sector_performance (
    sector      VARCHAR(50) PRIMARY KEY,
    change_pct  DECIMAL(8,4) DEFAULT 0,
    volume      BIGINT DEFAULT 0,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
