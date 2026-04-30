-- server/migrations/init.sql

-- Users & Auth
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name          VARCHAR(100) NOT NULL,
    role          VARCHAR(20) DEFAULT 'free',  -- free | premium | admin
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- User Watchlist
CREATE TABLE watchlists (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
    ticker     VARCHAR(10) NOT NULL,
    added_at   TIMESTAMPTZ DEFAULT NOW(),
    notes      TEXT,
    UNIQUE(user_id, ticker)
);

-- Price Alerts
CREATE TABLE alerts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
    ticker        VARCHAR(10) NOT NULL,
    condition     VARCHAR(10) NOT NULL,  -- 'above' | 'below'
    target_price  DECIMAL(15,2) NOT NULL,
    triggered     BOOLEAN DEFAULT FALSE,
    triggered_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- BSJP Screener Results (persisted from Kafka)
CREATE TABLE screener_results (
    id          BIGSERIAL PRIMARY KEY,
    strategy    VARCHAR(20) NOT NULL,  -- 'bsjp' | 'swing' | 'scalping'
    ticker      VARCHAR(10) NOT NULL,
    signal      VARCHAR(20),
    score       INTEGER,
    payload     JSONB NOT NULL,        -- full screener output
    screened_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_screener_strategy_date ON screener_results(strategy, screened_at DESC);

-- Daily OHLCV Cache (avoid re-fetching)
CREATE TABLE ohlcv_daily (
    ticker     VARCHAR(10) NOT NULL,
    trade_date DATE NOT NULL,
    open       DECIMAL(15,2),
    high       DECIMAL(15,2),
    low        DECIMAL(15,2),
    close      DECIMAL(15,2),
    volume     BIGINT,
    PRIMARY KEY(ticker, trade_date)
);

-- User Settings / Preferences
CREATE TABLE user_settings (
    user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme            VARCHAR(10) DEFAULT 'dark',
    notifications    JSONB DEFAULT '{"bsjp": true, "swing": true, "scalping": false}',
    default_strategy VARCHAR(20) DEFAULT 'bsjp'
);

-- Insert Admin User (Password: admin123)
-- bcrypt hash of 'admin123' is '$2a$10$w6D9t.T3L30q.qZqM/q9w.y901z4h7.YxT9UaI/xS74lYJkZ6yXgW'
INSERT INTO users (email, password_hash, name, role) VALUES 
('admin@sahamscreen.id', '$2a$10$w6D9t.T3L30q.qZqM/q9w.y901z4h7.YxT9UaI/xS74lYJkZ6yXgW', 'Administrator', 'admin');
