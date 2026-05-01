-- server/migrations/003_align_news_and_add_volume.sql
-- Align news table with Kafka producer payload + add volume column to stock_info

-- Add columns that the Kafka news producer sends but the old schema doesn't have
ALTER TABLE news ADD COLUMN IF NOT EXISTS ticker VARCHAR(10);
ALTER TABLE news ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE news ADD COLUMN IF NOT EXISTS sentiment_score DECIMAL(5,2) DEFAULT 0;

-- Create index for fast ticker-based news lookup
CREATE INDEX IF NOT EXISTS idx_news_ticker ON news(ticker);

-- Ensure stock_info has a volume column (already exists, but confirm)
-- ALTER TABLE stock_info ADD COLUMN IF NOT EXISTS volume BIGINT DEFAULT 0;
