"""
Stock Info Seeder
Reads idx_all_companies_info.csv and populates the stock_info table in PostgreSQL.
Run this ONCE before starting the Kafka pipeline to ensure all tickers exist in the DB.

Usage:
  pip install psycopg2-binary
  python seed_stock_info.py
"""

import csv
import os
import psycopg2

CSV_PATH = "idx_all_companies_info.csv"

# Database connection — adjust to match your server config
DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = os.environ.get("DB_PORT", "5432")
DB_NAME = os.environ.get("DB_NAME", "sahamscreen")
DB_USER = os.environ.get("DB_USER", "sahamscreen")
DB_PASS = os.environ.get("DB_PASS", "sahamscreen_dev")

def main():
    print(f"Connecting to PostgreSQL at {DB_HOST}:{DB_PORT}/{DB_NAME}...")
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASS
    )
    conn.autocommit = True
    cur = conn.cursor()
    
    print(f"Reading {CSV_PATH}...")
    count = 0
    skipped = 0
    
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            ticker = row.get('Ticker', '').strip()
            if not ticker:
                skipped += 1
                continue
            
            name = row.get('Name', '').strip()
            sector = row.get('Sector', '').strip()
            industry = row.get('Industry', '').strip()
            
            # Parse market cap (could be float string)
            try:
                market_cap = int(float(row.get('MarketCap', '0')))
            except (ValueError, TypeError):
                market_cap = 0
            
            # Parse previous close
            try:
                prev_close = float(row.get('PreviousClose', '0'))
            except (ValueError, TypeError):
                prev_close = 0.0
            
            try:
                cur.execute("""
                    INSERT INTO stock_info (ticker, name, sector, industry, market_cap, prev_close, last_price, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (ticker) DO UPDATE SET
                        name = EXCLUDED.name,
                        sector = EXCLUDED.sector,
                        industry = EXCLUDED.industry,
                        market_cap = EXCLUDED.market_cap,
                        prev_close = EXCLUDED.prev_close,
                        updated_at = NOW()
                """, (ticker, name, sector, industry, market_cap, prev_close, prev_close))
                count += 1
            except Exception as e:
                print(f"  Error inserting {ticker}: {e}")
                skipped += 1
    
    cur.close()
    conn.close()
    
    print(f"\nDone! Inserted/Updated {count} tickers. Skipped {skipped}.")
    print("You can now start the Kafka pipeline — the consumer will UPDATE these rows with live prices.")

if __name__ == "__main__":
    main()
