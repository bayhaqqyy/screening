CREATE TABLE IF NOT EXISTS bandar_flow (
    ticker VARCHAR(10) PRIMARY KEY,
    price NUMERIC,
    volume BIGINT,
    vol_ratio NUMERIC,
    obv_trend VARCHAR(20),
    ad_value NUMERIC,
    close_position NUMERIC,
    mfi NUMERIC,
    net_buy_proxy BOOLEAN,
    accum_score NUMERIC,
    signal VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
